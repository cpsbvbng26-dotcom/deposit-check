'use strict';
/* The rules. Each one says what it finds, how serious it is, and what to do about it.
 * A record rule reads one work; a set rule reads all of them with the ORCID record.
 * Pure: no rule reaches the network.
 *
 * Severities:
 *   error    the metadata is missing something that readers and indexes rely on
 *   warning  something is probably wrong or incomplete
 *   info     worth knowing; often fine as it is
 */

const SEVERITIES = ['error', 'warning', 'info'];
const VERSION_RELATIONS = /^(IsVersionOf|HasVersion|IsNewVersionOf|IsPreviousVersionOf)$/;
const norm = (s) => String(s || '').toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

const RULES = [
  {
    id: 'abstract-missing', scope: 'record', severity: 'error',
    title: 'No abstract in the DOI metadata',
    fix: 'Add the abstract as a description of the type Abstract at the repository. Indexes such as OpenAlex and Google Scholar read it from there; the PDF alone is not enough.',
    check: (r) => (r.abstract ? [] : ['no description of the type Abstract']),
  },
  {
    id: 'abstract-short', scope: 'record', severity: 'warning',
    title: 'The abstract is very short, or repeats the title',
    fix: 'Give the abstract of the work itself, not a one-line summary or the title again.',
    check: (r) => {
      if (!r.abstract) return [];
      if (norm(r.abstract) === norm(r.title)) return ['the abstract is the title'];
      return r.abstract.length < 100 ? ['the abstract has ' + r.abstract.length + ' characters'] : [];
    },
  },
  {
    id: 'licence-missing', scope: 'record', severity: 'error',
    title: 'No licence in the DOI metadata',
    fix: 'Choose a licence at the repository (for example CC BY 4.0). Without one, readers may not reuse the work, and some indexes do not list it as open.',
    check: (r) => (r.rights.length ? [] : ['no rights statement']),
  },
  {
    id: 'licence-unreadable', scope: 'record', severity: 'warning',
    title: 'The licence is given only in words',
    fix: 'Give the licence as a URL or an SPDX identifier (for example https://creativecommons.org/licenses/by/4.0/ or CC-BY-4.0), so that machines can read it.',
    check: (r) => (r.rights.length && !r.rights.some((x) => x.licence || x.uri) ? ['rights: ' + r.rights.map((x) => x.text || '(empty)').join('; ')] : []),
  },
  {
    id: 'owner-orcid-missing', scope: 'record', severity: 'error',
    title: 'Your ORCID iD is not on your name in the DOI metadata',
    fix: 'Add your ORCID iD to your name among the creators at the repository. The iD in the metadata is what links the work to you in DataCite, Crossref and ORCID’s automatic updates.',
    check: (r, ctx) => (ctx.owner && !r.creators.some((c) => c.orcid === ctx.owner) ? ['none of the creators carries ' + ctx.owner] : []),
  },
  {
    id: 'creators-orcid-missing', scope: 'record', severity: 'info',
    title: 'Some creators of a work with several creators have no ORCID iD in the DOI metadata',
    fix: 'Ask the co-authors for their ORCID iDs and add them at the repository.',
    check: (r) => {
      const without = r.creators.filter((c) => c.person && !c.orcid);
      return r.creators.length > 1 && without.length ? [without.map((c) => c.name).join(', ')] : [];
    },
  },
  {
    id: 'type-generic', scope: 'record', severity: 'warning',
    title: 'The resource type is missing or says only “Other”',
    fix: 'Choose the type of the work at the repository, such as Preprint, Journal article, Dataset or Software.',
    check: (r) => (!r.type.general || /^other$/i.test(r.type.general) ? ['type: ' + (r.type.general || '(none)') + (r.type.specific ? ' / ' + r.type.specific : '')] : []),
  },
  {
    id: 'date-missing', scope: 'record', severity: 'warning',
    title: 'No full date of publication',
    fix: 'Give the date of publication with day, month and year. Only the year is in the metadata.',
    check: (r) => (r.date ? [] : ['year only: ' + (r.year || '(none)')]),
  },
  {
    id: 'keywords-missing', scope: 'record', severity: 'warning',
    title: 'No keywords',
    fix: 'Add a few keywords (subjects) at the repository. They help indexes and readers find the work.',
    check: (r) => (r.keywords.length ? [] : ['no subjects']),
  },
  {
    id: 'language-missing', scope: 'record', severity: 'info',
    title: 'No language',
    fix: 'Give the language of the work (for example en or ja).',
    check: (r) => (r.language ? [] : ['no language']),
  },
  {
    id: 'version-unlinked', scope: 'record', severity: 'warning',
    title: 'A version without a link to its other versions',
    fix: 'Link the version to the record of all versions (IsVersionOf), or to the version before it (IsNewVersionOf). Zenodo and Figshare do this when a new version is made from the old one, not when a new deposit is made.',
    check: (r) => (r.version && !r.relations.some((x) => VERSION_RELATIONS.test(x.type)) ? ['version ' + r.version + ', no version relation'] : []),
  },
  {
    id: 'relations-none', scope: 'record', severity: 'info',
    title: 'No related works',
    fix: 'Where they exist, link the code, the data, other copies of the work and its published version (for example IsSupplementedBy, IsIdenticalTo, IsPreprintOf).',
    check: (r) => (r.relations.length ? [] : ['no related identifiers']),
  },
  {
    id: 'unresolved', scope: 'set', severity: 'error',
    title: 'A DOI on the ORCID record is not found at DataCite, Crossref or JaLC',
    fix: 'Check the DOI on the ORCID record for a typing error. If the work was withdrawn, remove it from the record.',
    check: (ctx) => ctx.works.filter((w) => !ctx.records.has(w.doi)).map((w) => ({ doi: w.doi, detail: (w.title || '(no title)') + ' — not found' })),
  },
  {
    id: 'not-on-orcid', scope: 'set', severity: 'warning',
    title: 'A work that carries your ORCID iD is not on your ORCID record',
    fix: 'Add it to the ORCID record: Works, Add works, Search & link, DataCite or Crossref. Or let them update the record for you (auto-update).',
    check: (ctx) => {
      if (!ctx.owner) return [];
      /* A version counts as listed when any version of the same work is on the record. */
      const listed = new Set(ctx.works.map((w) => family(ctx.records.get(w.doi) || { doi: w.doi, relations: [] })));
      return [...ctx.found].filter((d) => ctx.records.has(d) && !listed.has(family(ctx.records.get(d))) && !isSkipped(ctx, d))
        .map((d) => ({ doi: d, detail: ctx.records.get(d).title }));
    },
  },
  {
    id: 'same-title', scope: 'set', severity: 'info',
    title: 'Two deposits with the same title that are not linked as versions or copies',
    fix: 'If they are the same work, link them (IsIdenticalTo, or IsVersionOf the same record) so that citations are not split. If they differ, a distinct title helps readers.',
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
  const fig = /^(10\.6084\/m9\.figshare\.\d+)(\.v\d+)?$/.exec(r.doi);
  if (fig) return fig[1];
  const v = r.relations.find((x) => x.type === 'IsVersionOf' && /^10\./.test(x.id.replace(/^https?:\/\/(dx\.)?doi\.org\//, '')));
  if (v) return v.id.replace(/^https?:\/\/(dx\.)?doi\.org\//, '').toLowerCase();
  return r.doi;
}

/* A record of all versions is not checked on its own when one of its versions is read: it repeats the latest version,
 * and every finding would come twice. */
function isSkipped(ctx, doi) {
  const r = ctx.records.get(doi);
  if (!r || !r.relations.some((x) => x.type === 'HasVersion')) return false;
  return [...ctx.records.values()].some((o) => o.doi !== doi && family(o) === family(r));
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
