'use strict';
/* The rules. Each one says what it finds, how serious it is, and which record holds the field and where it is changed.
 * A record rule reads one work; a set rule reads all of them with the ORCID record.
 * Pure: no rule reaches the network.
 *
 * Severities:
 *   error    the metadata is missing something that readers and indexes rely on
 *   warning  something is probably wrong or incomplete
 *   info     worth knowing; often fine as it is
 */

const M = require('./metadata.js');

const SEVERITIES = ['error', 'warning', 'info'];
const VERSION_RELATIONS = /^(IsVersionOf|HasVersion|IsNewVersionOf|IsPreviousVersionOf)$/;
const norm = (s) => String(s || '').toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

const RULES = [
  {
    id: 'abstract-missing', scope: 'record', severity: 'error',
    title: 'No abstract in the DOI metadata',
    fix: 'The abstract is a description of the type Abstract in the DOI metadata, changed at the repository with the record (on Zenodo, the Description of the record). Indexes such as OpenAlex and Google Scholar read it from there; an abstract in the PDF alone does not reach them.',
    check: (r) => (r.abstract ? [] : ['no description of the type Abstract']),
  },
  {
    id: 'abstract-short', scope: 'record', severity: 'warning',
    title: 'The abstract is very short, or repeats the title',
    fix: 'The abstract is the one in the DOI metadata, changed at the repository with the record. One that gives a line of summary, or the title again, tells indexes and readers little more than the title.',
    check: (r) => {
      if (!r.abstract) return [];
      if (norm(r.abstract) === norm(r.title)) return ['the abstract is the title'];
      return r.abstract.length < 100 ? ['the abstract has ' + r.abstract.length + ' characters'] : [];
    },
  },
  {
    id: 'licence-missing', scope: 'record', severity: 'error',
    title: 'No licence in the DOI metadata',
    fix: 'The licence is the rights statement of the DOI metadata, chosen at the repository (on Zenodo, the Licence of the record; for example CC BY 4.0). Without one, readers may not reuse the work, and some indexes do not list it as open.',
    check: (r) => (r.rights.length ? [] : ['no rights statement']),
  },
  {
    id: 'licence-unreadable', scope: 'record', severity: 'warning',
    title: 'The licence is given only in words',
    fix: 'The rights statement of the DOI metadata is set at the repository. Machines read a licence given as a URL or an SPDX identifier (for example https://creativecommons.org/licenses/by/4.0/ or CC-BY-4.0); a licence in words alone is read by people only.',
    check: (r) => (r.rights.length && !r.rights.some((x) => x.licence || x.uri) ? ['rights: ' + r.rights.map((x) => x.text || '(empty)').join('; ')] : []),
  },
  {
    id: 'owner-orcid-missing', scope: 'record', severity: 'error',
    title: 'Your ORCID iD is not on your name in the DOI metadata',
    fix: 'The creators of the DOI metadata, with the ORCID iD on each name, are set at the repository. The iD in the metadata is what links the work to the holder of the iD given with --orcid in DataCite, Crossref and ORCID’s automatic updates.',
    check: (r, ctx) => (ctx.owner && !r.creators.some((c) => c.orcid === ctx.owner) ? ['none of the creators carries ' + ctx.owner] : []),
  },
  {
    id: 'creators-orcid-missing', scope: 'record', severity: 'info',
    title: 'Some creators of a work with several creators have no ORCID iD in the DOI metadata',
    fix: 'The creators of the DOI metadata, with the ORCID iD on each name, are set at the repository. Each co-author holds an iD of their own, and the metadata carries only the iDs given at the repository.',
    check: (r) => {
      const without = r.creators.filter((c) => c.person && !c.orcid);
      return r.creators.length > 1 && without.length ? [without.map((c) => c.name).join(', ')] : [];
    },
  },
  {
    id: 'type-generic', scope: 'record', severity: 'warning',
    title: 'The resource type is missing or says only “Other”',
    fix: 'The resource type is part of the DOI metadata, set at the repository (on Zenodo, the Resource type of the record), with types such as Preprint, Journal article, Dataset or Software.',
    check: (r) => (!r.type.general || /^other$/i.test(r.type.general) ? ['type: ' + (r.type.general || '(none)') + (r.type.specific ? ' / ' + r.type.specific : '')] : []),
  },
  {
    id: 'type-unexpected', scope: 'record', severity: 'warning',
    title: 'The resource type differs from the type expected for the DOI',
    fix: 'The resource type is part of the DOI metadata, set at the repository (on Zenodo, the Resource type of the record). The expected type is the one in the file given with --expect-types, so the difference lies in one of the two. The type compared is DataCite’s resourceTypeGeneral, so only records registered by DataCite are compared.',
    check: (r, ctx) => {
      const want = expectedType(r, ctx);
      if (!want || r.agency !== 'DataCite') return [];
      return r.type.general.toLowerCase() === want.toLowerCase() ? [] : ['registered as ' + (r.type.general || '(none)') + ', expected ' + want];
    },
  },
  {
    id: 'date-missing', scope: 'record', severity: 'warning',
    title: 'No full date of publication',
    fix: 'The date of publication is part of the DOI metadata, set at the repository. Only the year is in the metadata; a full date has the day, the month and the year.',
    check: (r) => (r.date ? [] : ['year only: ' + (r.year || '(none)')]),
  },
  {
    id: 'keywords-missing', scope: 'record', severity: 'warning',
    title: 'No keywords',
    fix: 'Keywords are the subjects of the DOI metadata, set at the repository. Indexes and readers find the work by them.',
    check: (r) => (r.keywords.length ? [] : ['no subjects']),
  },
  {
    id: 'language-missing', scope: 'record', severity: 'info',
    title: 'No language',
    fix: 'The language of the work (for example en or ja) is part of the DOI metadata, set at the repository.',
    check: (r) => (r.language ? [] : ['no language']),
  },
  {
    id: 'version-unlinked', scope: 'record', severity: 'warning',
    title: 'A version without a link to its other versions',
    fix: 'The link between versions is a related identifier of the DOI metadata at the repository: IsVersionOf the record of all versions, or IsNewVersionOf the version before it. Zenodo adds it when a new version is made from the old one, not when a new deposit is made. Figshare versions are tied by their DOIs (.v1, .v2), and are not flagged.',
    check: (r) => (r.version && family(r) === r.doi && !r.relations.some((x) => VERSION_RELATIONS.test(x.type)) ? ['version ' + r.version + ', no version relation'] : []),
  },
  {
    id: 'relations-none', scope: 'record', severity: 'info',
    title: 'No related works',
    fix: 'Related works are the related identifiers of the DOI metadata, set at the repository: the code, the data, other copies of the work and its published version (for example IsSupplementedBy, IsIdenticalTo, IsPreprintOf). A work with no such related work has nothing to link.',
    check: (r) => (r.relations.length ? [] : ['no related identifiers']),
  },
  {
    id: 'identical-unlinked', scope: 'record', severity: 'warning',
    title: 'A copy of the same text is not linked with IsIdenticalTo',
    fix: 'The link between two copies of one text is a related work of the type IsIdenticalTo in the DOI metadata at the repository (on Zenodo: Related works, “Is identical to”). With it, indexes can tell that the two are one text, and its citations are not split. One side is enough: an SSRN record cannot carry the link, and the Zenodo record can. The copies compared are the ones in the file given with --expect-identical.',
    check: (r, ctx) => copiesOf(r, ctx).filter((id) => !identicalLinked(r, id, ctx)).map((id) => {
      const other = r.relations.filter((x) => M.relatedKey(x.id) === id).map((x) => x.type);
      return 'not linked to ' + id + (other.length ? ' (linked as ' + other.join(', ') + ' only)' : '');
    }),
  },
  {
    id: 'openalex-missing', scope: 'record', severity: 'info',
    title: 'OpenAlex does not hold the work',
    fix: 'What OpenAlex holds is changed by OpenAlex alone. It takes new works from DataCite and Crossref, usually within days. For an older work that it does not hold, one place a gap can lie is the DOI metadata at the repository, and OpenAlex takes reports through its support form.',
    check: (r) => (r.openalex && !r.openalex.held ? ['not in OpenAlex'] : []),
  },
  {
    id: 'openalex-abstract-missing', scope: 'record', severity: 'warning',
    title: 'The DOI metadata has an abstract, and OpenAlex has none',
    fix: 'What OpenAlex holds is changed by OpenAlex alone. It reads the abstract from the DOI metadata when it next updates the work, and takes reports through its support form when the abstract is still missing after some weeks.',
    check: (r) => (r.abstract && r.openalex && r.openalex.held && !r.openalex.abstract ? ['OpenAlex holds the work without an abstract'] : []),
  },
  {
    id: 'unresolved', scope: 'set', severity: 'error',
    title: 'A DOI on the ORCID record is not found at DataCite, Crossref or JaLC',
    fix: 'The DOIs of the works on the ORCID record are as the record gives them, typing errors included, and a withdrawn work stays on the record until the record is changed. The record is changed at orcid.org, by the holder of the iD or by an organisation the holder allows.',
    check: (ctx) => ctx.works.filter((w) => !ctx.records.has(w.doi)).map((w) => ({ doi: w.doi, detail: (w.title || '(no title)') + ' — not found' })),
  },
  {
    id: 'not-on-orcid', scope: 'set', severity: 'warning',
    title: 'A work that carries your ORCID iD is not on your ORCID record',
    fix: 'The works on the ORCID record are changed at orcid.org (Works, Add works, Search & link, DataCite or Crossref), by the holder of the iD. DataCite and Crossref add works to the record themselves when the holder allows them to (auto-update).',
    check: (ctx) => {
      if (!ctx.owner) return [];
      /* A version counts as listed when any version of the same work is on the record. */
      const listed = new Set(ctx.works.map((w) => family(ctx.records.get(w.doi) || { doi: w.doi, relations: [] })));
      /* One finding for each work, on its latest version, not one for each version. */
      return [...ctx.found].filter((d) => ctx.records.has(d) && !listed.has(family(ctx.records.get(d))) && !isSkipped(ctx, d))
        .map((d) => ({ doi: d, detail: ctx.records.get(d).title }));
    },
  },
  {
    id: 'same-title', scope: 'set', severity: 'info',
    title: 'Two deposits with the same title that are not linked as versions or copies',
    fix: 'Two deposits of one work are linked in the DOI metadata at the repository (IsIdenticalTo, or IsVersionOf the same record), and then their citations are not split. Two different works with one title are told apart by a distinct title.',
    check: (ctx) => {
      const linked = (a, b) => a.relations.some((x) => x.id.toLowerCase().includes(b.doi)) || b.relations.some((x) => x.id.toLowerCase().includes(a.doi))
        || family(a) === family(b);
      const byTitle = new Map();
      for (const r of ctx.records.values()) {
        if (isSkipped(ctx, r.doi)) continue;
        const k = norm(r.title);
        if (k) byTitle.set(k, (byTitle.get(k) || []).concat([r]));
      }
      const out = [];
      for (const group of byTitle.values()) {
        for (let i = 0; i < group.length; i++) {
          for (let j = i + 1; j < group.length; j++) {
            if (!linked(group[i], group[j])) out.push({ doi: group[i].doi, detail: 'same title as ' + group[j].doi + ' (' + group[j].agency + ')' });
          }
        }
      }
      return out;
    },
  },
];

/* The versions of one work share a family: the record of all versions (Zenodo's concept DOI) that a version names
 * with IsVersionOf, or that record itself when it lists versions with HasVersion. Figshare numbers its versions
 * .v1, .v2 … after one DOI. Anything else is a family of its own. */
function family(r) {
  const fig = /^(10\.\d+\/m9\.figshare\.\d+)(\.v\d+)?$/.exec(r.doi);
  if (fig) return fig[1];
  const v = r.relations.find((x) => x.type === 'IsVersionOf' && /^10\./.test(x.id.replace(/^https?:\/\/(dx\.)?doi\.org\//, '')));
  if (v) return v.id.replace(/^https?:\/\/(dx\.)?doi\.org\//, '').toLowerCase();
  return r.doi;
}

/* The type expected for a record (ctx.expected: Map of lower-cased DOI → resourceTypeGeneral, from --expect-types).
 * An expectation given for the record of all versions (Zenodo's concept DOI) holds for each of its versions. */
function expectedType(r, ctx) {
  if (!ctx || !ctx.expected) return null;
  return ctx.expected.get(r.doi) || ctx.expected.get(family(r)) || null;
}

/* The copies a record should be linked to (ctx.identical: Map of lower-cased DOI → related keys, from --expect-identical).
 * Copies given for any version of the work, or for the record of all versions, hold for the version that is checked:
 * a new version must keep the link. */
function copiesOf(r, ctx) {
  if (!ctx || !ctx.identical) return [];
  const out = new Set();
  for (const [k, copies] of ctx.identical) {
    const keyed = ctx.records.get(k);
    if (k === r.doi || k === family(r) || (keyed && family(keyed) === family(r))) copies.forEach((c) => out.add(c));
  }
  return [...out];
}

/* Linked when either record names the other with IsIdenticalTo: this record names the copy, or the copy (when it was
 * read) names this record or the record of all its versions. */
function identicalLinked(r, copy, ctx) {
  const names = (rec, ids) => rec.relations.some((x) => x.type === 'IsIdenticalTo' && ids.includes(M.relatedKey(x.id)));
  if (names(r, [copy])) return true;
  const other = ctx.records.get(copy);
  return !!other && names(other, [r.doi, family(r)]);
}

/* Of the versions of one work that were read, only the latest is checked: the others repeat it, and every finding
 * would come once for each version. A record of all versions (Zenodo's concept DOI, Figshare's DOI without .vN)
 * ranks below any version; then the higher version number; then the later date. */
function rank(r, ctx) {
  const members = [...ctx.records.values()].filter((o) => family(o) === family(r));
  const conceptish = members.length > 1 && family(r) === r.doi;
  const fig = /\.v(\d+)$/.exec(r.doi);
  const n = fig ? Number(fig[1]) : Number((/\d+/.exec(r.version || '') || ['0'])[0]);
  return [conceptish ? 0 : 1, n, r.date || String(r.year || '')];
}
const before = (a, b) => (a[0] - b[0]) || (a[1] - b[1]) || (a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0);

function isSkipped(ctx, doi) {
  const r = ctx.records.get(doi);
  if (!r) return false;
  const mine = rank(r, ctx);
  return [...ctx.records.values()].some((o) => o.doi !== doi && family(o) === family(r) && (before(rank(o, ctx), mine) > 0 || (before(rank(o, ctx), mine) === 0 && o.doi > doi)));
}

/* Run every rule. ctx: { owner: ORCID iD or null, works: [{doi,title}], found: Set of DOIs carrying the iD, records: Map doi → record }. */
function audit(ctx) {
  const findings = [];
  for (const rule of RULES) {
    if (rule.scope === 'record') {
      for (const r of ctx.records.values()) {
        if (isSkipped(ctx, r.doi)) continue;
        for (const detail of rule.check(r, ctx)) findings.push({ rule: rule.id, severity: rule.severity, doi: r.doi, detail });
      }
    } else {
      for (const f of rule.check(ctx)) findings.push({ rule: rule.id, severity: rule.severity, doi: f.doi, detail: f.detail });
    }
  }
  return findings;
}

const byId = (id) => RULES.find((r) => r.id === id);

module.exports = { RULES, SEVERITIES, audit, byId, norm, family, isSkipped };
