'use strict';
/* Read DOI metadata from DataCite, Crossref and JaLC, and works from ORCID, into one plain shape.
 * Pure: these functions take parsed JSON and return objects; nothing here reaches the network. */

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const TAG = /<\/?([a-zA-Z][a-zA-Z0-9:-]*)(\s[^<>]*)?\/?>/g;
const INLINE = /^(em|i|b|strong|sup|sub|span|a|u|mml:\w+|jats:(italic|bold|sup|sub))$/i;
const untag = (t) => t.replace(TAG, (m, name) => (INLINE.test(name) ? '' : ' '));

/* Text without markup or entities, with spaces collapsed. JATS and HTML abstracts read as plain text. */
function plain(s) {
  let t = String(s || '');
  for (let i = 0; i < 2; i++) {
    t = untag(t).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
      if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
      return ENTITIES[e.toLowerCase()] !== undefined ? ENTITIES[e.toLowerCase()] : m;
    });
  }
  return untag(t).replace(/\s+/g, ' ').trim();
}

const orcidOf = (s) => (String(s || '').match(/\d{4}-\d{4}-\d{4}-\d{3}[\dX]/) || [null])[0];
const doiOf = (s) => {
  const m = /10\.\d{4,9}\/\S+/.exec(String(s || '').trim());
  return m ? m[0].replace(/[.,;]+$/, '').toLowerCase() : null;
};

/* The ORCID check digit (ISO 7064 11,2), so that a mistyped iD is refused before any request. */
function validOrcid(id) {
  if (!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(String(id || ''))) return false;
  const d = id.replace(/-/g, '');
  let total = 0;
  for (let i = 0; i < 15; i++) total = (total + Number(d[i])) * 2;
  const r = (12 - (total % 11)) % 11;
  return d[15] === (r === 10 ? 'X' : String(r));
}

/* A licence as a short name, from an SPDX id or a URL; null when neither says which. */
function licenceOf(s) {
  const t = String(s || '').toLowerCase().trim();
  const cc = /creativecommons\.org\/(licenses|publicdomain)\/([a-z-]+)\/(\d\.\d)/.exec(t);
  if (cc) return cc[2] === 'zero' ? 'CC0-' + cc[3] : 'CC-' + cc[2].toUpperCase() + '-' + cc[3];
  if (/^cc(0|-[a-z-]+)-\d\.\d$/.test(t)) return t.toUpperCase().replace(/^CC0/, 'CC0');
  if (/opensource\.org\/licenses?\/mit|^mit$/.test(t)) return 'MIT';
  if (/^(apache-2\.0|gpl-[23]\.0(-only|-or-later)?)$/.test(t)) return t.toUpperCase();
  return null;
}

const FOS = (s) => /fields of science|anzsrc|oecd/i.test(s.subjectScheme || '') || /^FOS:/i.test(s.subject || '');

function fromDataCite(json) {
  const a = json.data.attributes;
  const abstracts = (a.descriptions || []).filter((d) => d.descriptionType === 'Abstract' && plain(d.description));
  const abs = abstracts.find((d) => !d.lang || /^en/i.test(d.lang)) || abstracts[0];
  const dated = (type) => (a.dates || []).find((d) => d.dateType === type && /^\d{4}-\d{2}-\d{2}/.test(d.date));
  const date = (dated('Issued') || dated('Available') || dated('Submitted') || dated('Created') || {}).date;
  const types = a.types || {};
  return {
    agency: 'DataCite',
    doi: String(a.doi || '').toLowerCase(),
    title: plain(((a.titles || []).find((t) => !t.titleType) || (a.titles || [])[0] || {}).title),
    creators: (a.creators || []).map((c) => ({
      name: plain(c.givenName && c.familyName ? c.givenName + ' ' + c.familyName : c.name),
      person: c.nameType ? c.nameType === 'Personal' : !!(c.givenName || c.familyName || /,/.test(c.name || '')),
      orcid: orcidOf(((c.nameIdentifiers || []).find((n) => /orcid/i.test(n.nameIdentifierScheme || '') || /orcid\.org/.test(n.nameIdentifier || '')) || {}).nameIdentifier),
    })),
    abstract: abs ? plain(abs.description) : '',
    rights: (a.rightsList || []).map((r) => ({ text: r.rights || '', uri: r.rightsUri || '', id: r.rightsIdentifier || '', licence: licenceOf(r.rightsIdentifier) || licenceOf(r.rightsUri) })),
    type: { general: types.resourceTypeGeneral || '', specific: types.resourceType || '' },
    date: date ? date.slice(0, 10) : null,
    year: a.publicationYear ? Number(a.publicationYear) : null,
    language: a.language || '',
    version: a.version || '',
    publisher: typeof a.publisher === 'object' && a.publisher ? a.publisher.name || '' : a.publisher || '',
    keywords: (a.subjects || []).filter((s) => !FOS(s)).map((s) => plain(s.subject)).filter(Boolean),
    relations: (a.relatedIdentifiers || []).map((r) => ({ type: r.relationType || '', id: String(r.relatedIdentifier || ''), idType: r.relatedIdentifierType || '' })),
    url: a.url || '',
  };
}

const iso = (parts) => (parts && parts.length === 3 ? parts.map((n, i) => String(n).padStart(i ? 2 : 4, '0')).join('-') : null);

/* Crossref names its relations in kebab case; they are given here in DataCite's terms, so the rules read one vocabulary. */
const CROSSREF_RELATION = {
  'is-preprint-of': 'IsPreprintOf', 'has-preprint': 'HasPreprint', 'is-version-of': 'IsVersionOf', 'has-version': 'HasVersion',
  'is-identical-to': 'IsIdenticalTo', 'is-supplemented-by': 'IsSupplementedBy', 'is-supplement-to': 'IsSupplementTo',
  'references': 'References', 'is-referenced-by': 'IsReferencedBy', 'is-part-of': 'IsPartOf', 'has-part': 'HasPart',
};

function fromCrossref(json) {
  const m = json.message;
  const full = (k) => (m[k] && m[k]['date-parts'] ? iso(m[k]['date-parts'][0]) : null);
  const year = (k) => (m[k] && m[k]['date-parts'] && m[k]['date-parts'][0] ? Number(m[k]['date-parts'][0][0]) : null);
  return {
    agency: 'Crossref',
    doi: String(m.DOI || '').toLowerCase(),
    title: plain((m.title || [])[0]),
    creators: (m.author || []).map((c) => ({
      name: plain([c.given, c.family].filter(Boolean).join(' ') || c.name),
      person: !c.name || !!(c.given || c.family),
      orcid: orcidOf(c.ORCID),
    })),
    abstract: plain(m.abstract),
    rights: (m.license || []).map((l) => ({ text: '', uri: l.URL || '', id: '', licence: licenceOf(l.URL) })),
    type: { general: m.type || '', specific: m.subtype || '' },
    date: full('posted') || full('published') || full('issued') || full('created'),
    year: year('issued') || year('published') || year('posted'),
    language: m.language || '',
    version: '',
    publisher: m.publisher || '',
    keywords: (m.subject || []).map(plain).filter(Boolean),
    relations: Object.entries(m.relation || {}).flatMap(([k, list]) => (Array.isArray(list) ? list : [])
      .map((r) => ({ type: CROSSREF_RELATION[k] || k, id: String(r.id || ''), idType: r['id-type'] === 'doi' ? 'DOI' : r['id-type'] || '' }))),
    url: m.URL || '',
  };
}

/* JaLC registers DOIs in Japan (Jxiv among them). Titles, names and abstracts come in Japanese and English. */
function fromJaLC(json) {
  const d = json.data;
  const en = (list) => (list || []).find((x) => x.lang === 'en') || (list || [])[0] || {};
  const t = en(d.title_list);
  const pd = d.publication_date || {};
  const date = pd.publication_year && pd.publication_month && pd.publication_day
    ? [pd.publication_year, pd.publication_month, pd.publication_day].map((x, i) => String(x).padStart(i ? 2 : 4, '0')).join('-') : null;
  return {
    agency: 'JaLC',
    doi: String(d.doi || '').toLowerCase(),
    title: plain([t.title, t.subtitle].filter(Boolean).join(': ')),
    creators: (d.creator_list || []).map((c) => {
      const n = en(c.names);
      return {
        name: plain([n.first_name, n.last_name].filter(Boolean).join(' ')),
        person: c.type === 'person',
        orcid: orcidOf(((c.researcher_id_list || []).find((r) => r.type === 'ORCID') || {}).id_code),
      };
    }),
    abstract: plain(en((d.description_list || []).filter((x) => x.type === 'Abstract')).description),
    rights: (d.rights_list || []).map((r) => ({ text: r.rights || '', uri: r.uri || '', id: '', licence: licenceOf(r.uri) || licenceOf(r.rights) })),
    type: { general: d.resource_type || '', specific: d.content_type || '' },
    date,
    year: pd.publication_year ? Number(pd.publication_year) : null,
    language: (d.title_list || []).map((x) => x.lang).filter(Boolean)[0] || '',
    version: '',
    publisher: plain(en(d.publisher_list).publisher_name),
    keywords: (d.keyword_list || []).filter((k) => k.lang === 'en').map((k) => plain(k.keyword)).filter(Boolean),
    relations: (d.relation_list || []).map((r) => ({ type: r.relation_type || '', id: String(r.content || ''), idType: r.type || '' })),
    url: d.url || '',
  };
}

/* The DOIs of the works on an ORCID record (/works), lower-cased. A work may carry several ids; only DOIs are kept. */
function orcidWorks(json) {
  const out = new Map();
  (json.group || []).forEach((g) => {
    const summary = (g['work-summary'] || [])[0] || {};
    const title = plain((((summary.title || {}).title) || {}).value);
    ((g['external-ids'] || {})['external-id'] || []).forEach((x) => {
      if (x['external-id-type'] !== 'doi') return;
      const doi = doiOf(x['external-id-normalized'] ? x['external-id-normalized'].value : x['external-id-value']);
      if (doi && !out.has(doi)) out.set(doi, { doi, title, source: plain(((summary.source || {})['source-name'] || {}).value) });
    });
  });
  return [...out.values()];
}

/* DOIs from a DataCite search (/dois?query=…) or a Crossref one (/works?filter=…). */
const dataciteFound = (json) => (json.data || []).map((d) => String(d.attributes.doi || d.id || '').toLowerCase()).filter(Boolean);
const crossrefFound = (json) => ((json.message || {}).items || []).map((i) => String(i.DOI || '').toLowerCase()).filter(Boolean);

/* The types expected for some DOIs, from a JSON file: { "<DOI>": "<resourceTypeGeneral>", … }.
 * Keys that start with _ are comments. A key that is not a DOI, or a type that is not one word, is refused,
 * so that a mistyped file does not pass as a file with no expectations. */
function expectedTypes(json) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error('the expected types are not a JSON object');
  const out = new Map();
  for (const [k, v] of Object.entries(json)) {
    if (k.startsWith('_')) continue;
    const doi = doiOf(k);
    if (!doi || doi !== k.trim().toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, '')) throw new Error('not a DOI in the expected types: ' + k);
    if (typeof v !== 'string' || !/^[A-Za-z]+$/.test(v)) throw new Error('not a resource type for ' + k + ': ' + JSON.stringify(v));
    out.set(doi, v);
  }
  if (!out.size) throw new Error('no DOI in the expected types');
  return out;
}

/* A related identifier in one form, so that two spellings of it compare equal: a DOI bare and lower-cased, whether it was
 * given bare or as a doi.org URL; any other URL lower-cased, without its scheme and a trailing slash. */
function relatedKey(s) {
  const t = String(s || '').trim();
  if (/^(https?:\/\/(dx\.)?doi\.org\/|doi:)?10\.\d{4,9}\//i.test(t)) return doiOf(t);
  return t.toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

/* The copies of the same text that each DOI should be linked to with IsIdenticalTo, from a JSON file:
 * { "<DOI>": "<DOI or URL of a copy>" | ["<DOI or URL>", …], … }. The key is the record that should carry the link.
 * Keys that start with _ are comments. A key that is not a DOI, or a copy that is neither a DOI nor a URL, is refused,
 * so that a mistyped file does not pass as a file with no copies. */
function expectedIdentical(json) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error('the expected copies are not a JSON object');
  const out = new Map();
  for (const [k, v] of Object.entries(json)) {
    if (k.startsWith('_')) continue;
    const doi = doiOf(k);
    if (!doi || doi !== k.trim().toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, '')) throw new Error('not a DOI in the expected copies: ' + k);
    const list = typeof v === 'string' ? [v] : v;
    if (!Array.isArray(list) || !list.length) throw new Error('no copy given for ' + k);
    const copies = list.map((c) => {
      if (typeof c !== 'string' || !(/^10\.\d{4,9}\/\S+$/.test(c.trim()) || /^https?:\/\/\S+$/.test(c.trim()))) throw new Error('not a DOI or a URL for ' + k + ': ' + JSON.stringify(c));
      return relatedKey(c);
    });
    if (copies.includes(doi)) throw new Error('a DOI given as a copy of itself: ' + k);
    out.set(doi, [...new Set((out.get(doi) || []).concat(copies))]);
  }
  if (!out.size) throw new Error('no DOI in the expected copies');
  return out;
}

module.exports = { expectedTypes, expectedIdentical, relatedKey, plain, orcidOf, doiOf, validOrcid, licenceOf, fromDataCite, fromCrossref, fromJaLC, orcidWorks, dataciteFound, crossrefFound };
