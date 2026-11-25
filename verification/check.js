#!/usr/bin/env node
'use strict';
/* The checks. They run without the network: every answer of an API comes from verification/fixtures.
 *   node verification/check.js
 */

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const FIX = path.join(__dirname, 'fixtures');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const fixture = (f) => JSON.parse(fs.readFileSync(path.join(FIX, f), 'utf8'));
const fixtureAt = (f) => JSON.parse(read(f));

let pass = 0;
const fails = [];
function ok(label, cond, detail) {
  if (cond) { pass++; console.log('  OK    ' + label); } else { fails.push(label); console.log('  FAIL  ' + label + (detail ? '  — ' + detail : '')); }
}

const M = require('../src/metadata.js');
const R = require('../src/rules.js');
const F = require('../src/fetch.js');
const REP = require('../src/report.js');
const CLI = require('../bin/deposit-check.js');

const OWNER = '0000-0002-1825-0097';
/* The answers of the APIs for the fixtures. A URL not listed is a 404; /dois/10.5072%2Fbroken is a server error. */
function stubGet(log = []) {
  const map = {
    ['https://pub.orcid.org/v3.0/' + OWNER + '/works']: 'orcid-works.json',
    'https://api.datacite.org/dois/10.5072%2Fzenodo.100': 'datacite-zenodo.100.json',
    'https://api.datacite.org/dois/10.5072%2Fzenodo.101': 'datacite-zenodo.101.json',
    'https://api.datacite.org/dois/10.5072%2Fzenodo.200': 'datacite-zenodo.200.json',
    'https://api.datacite.org/dois/10.5072%2Fzenodo.400': 'datacite-zenodo.400.json',
    'https://api.datacite.org/dois/10.5072%2Fzenodo.99': 'datacite-zenodo.99.json',
    'https://api.datacite.org/dois/10.5072%2Fm9.figshare.500': 'datacite-figshare.500.json',
    'https://api.datacite.org/dois/10.5072%2Fm9.figshare.500.v2': 'datacite-figshare.500.v2.json',
    'https://api.crossref.org/works/10.5555%2Fcrossref.300': 'crossref-300.json',
    'https://api.japanlinkcenter.org/dois/10.51094%2Fjxiv.example': 'jalc-example.json',
  };
  /* OpenAlex: most works are held with an abstract; zenodo.400 is held without one; the JaLC record is not held; zenodo.200 cannot be read. */
  const openalex = { '10.5072/zenodo.400': 'openalex-no-abstract.json', '10.51094/jxiv.example': null };
  return async (url) => {
    log.push(url);
    if (url.startsWith('https://api.openalex.org/works/https://doi.org/')) {
      const d = url.slice('https://api.openalex.org/works/https://doi.org/'.length);
      if (d === '10.5072/zenodo.200') throw new Error('https://api.openalex.org/works: HTTP 503');
      if (d in openalex) return openalex[d] ? fixture(openalex[d]) : null;
      return fixture('openalex-held.json');
    }
    if (url.startsWith('https://api.datacite.org/dois?query=')) return fixture('datacite-search.json');
    if (url.startsWith('https://api.crossref.org/works?filter=orcid:')) return fixture('crossref-search.json');
    if (url === 'https://api.datacite.org/dois/10.5072%2Fbroken') throw new Error('https://api.datacite.org/dois/10.5072%2Fbroken: HTTP 500');
    return map[url] ? fixture(map[url]) : null;
  };
}
const sink = () => { const s = { text: '', write: (t) => { s.text += t; } }; return s; };

(async () => {
  /* ------------------------------------------------------------ 1 */
  console.log('\n1. Reading the metadata');
  ok('markup and entities become plain text', M.plain('<jats:p>A <i>b</i> &amp; c&#x2019;s</jats:p>') === 'A b & c’s');
  ok('the ORCID check digit is checked (ORCID’s example iD passes, one changed digit fails)',
    M.validOrcid(OWNER) && M.validOrcid('0000-0001-5109-3700') && !M.validOrcid('0000-0002-1825-0098') && !M.validOrcid('0000-0002-1825-009'));
  ok('a licence is read from an SPDX id or a URL, and not from words', M.licenceOf('cc-by-4.0') === 'CC-BY-4.0'
    && M.licenceOf('https://creativecommons.org/licenses/by-sa/4.0/legalcode') === 'CC-BY-SA-4.0'
    && M.licenceOf('https://creativecommons.org/publicdomain/zero/1.0/') === 'CC0-1.0' && M.licenceOf('All rights reserved') === null);
  ok('a DOI is taken from a URL and lower-cased', M.doiOf('https://doi.org/10.5281/ZENODO.123.') === '10.5281/zenodo.123' && M.doiOf('not a doi') === null);
  const d101 = M.fromDataCite(fixture('datacite-zenodo.101.json'));
  ok('DataCite: title, creator with ORCID iD, abstract without markup, licence, type, date, language, version, publisher given as an object',
    d101.title === 'Complete Record' && d101.creators[0].orcid === OWNER && d101.creators[0].person && !d101.abstract.includes('<p>')
    && d101.rights[0].licence === 'CC-BY-4.0' && d101.type.general === 'Preprint' && d101.date === '2026-05-01' && d101.language === 'en'
    && d101.version === 'v2' && d101.publisher === 'Zenodo');
  ok('DataCite: a Fields of Science classification is not a keyword', d101.keywords.join() === 'metadata');
  const c300 = M.fromCrossref(fixture('crossref-300.json'));
  ok('Crossref: ORCID iD from its URL, licence, the posted date, the type', c300.creators[0].orcid === OWNER && c300.rights[0].licence === 'CC-BY-4.0'
    && c300.date === '2026-03-03' && c300.type.general === 'posted-content' && c300.abstract === 'Too short to say much.');
  ok('Crossref: relations are given in DataCite’s terms', M.fromCrossref({ message: { DOI: 'x', relation: { 'is-preprint-of': [{ id: '10.1/a', 'id-type': 'doi' }] } } }).relations[0].type === 'IsPreprintOf');
  const j = M.fromJaLC(fixture('jalc-example.json'));
  ok('JaLC: the English title and abstract, the ORCID iD, the date', j.title === 'An Example Record from JaLC' && j.creators[0].orcid === OWNER
    && j.date === '2026-04-09' && j.abstract.length > 100);
  const works = M.orcidWorks(fixture('orcid-works.json'));
  ok('ORCID: DOIs of the works, lower-cased, each once; a work without a DOI is left out',
    works.map((w) => w.doi).join() === '10.5072/zenodo.101,10.5072/zenodo.200,10.5555/crossref.300,10.5072/typo.999');

  /* ------------------------------------------------------------ 2 */
  console.log('\n2. The rules, one at a time');
  const one = (rec, owner = OWNER) => R.audit({ owner, works: [], found: new Set(), records: new Map([[rec.doi, rec]]) }).map((f) => f.rule);
  ok('a complete record gives no findings', one(d101).length === 0, one(d101).join());
  const d200 = M.fromDataCite(fixture('datacite-zenodo.200.json'));
  const expected200 = ['abstract-missing', 'licence-unreadable', 'owner-orcid-missing', 'creators-orcid-missing', 'type-generic', 'keywords-missing', 'language-missing', 'version-unlinked', 'relations-none'];
  ok('an incomplete record gives each finding it should, and no other', one(d200).join() === expected200.join(), one(d200).join());
  const vary = (patch) => Object.assign({}, d101, patch);
  ok('abstract-short: under 100 characters, or the title again', one(vary({ abstract: 'Short.' })).join() === 'abstract-short'
    && one(vary({ abstract: 'Complete record' })).join() === 'abstract-short');
  ok('licence-missing: no rights at all', one(vary({ rights: [] })).join() === 'licence-missing');
  ok('owner-orcid-missing is not raised without an owner', one(vary({ creators: [{ name: 'X', person: true, orcid: null }] }), null).join() === '');
  ok('creators-orcid-missing is not raised for a single creator', !one(vary({ creators: [{ name: 'X', person: true, orcid: null }] }), null).includes('creators-orcid-missing'));
  ok('date-missing: year only', one(vary({ date: null })).join() === 'date-missing');
  ok('version-unlinked: a version with no version relation, but not one with IsNewVersionOf only',
    one(vary({ relations: [{ type: 'References', id: '10.1/x', idType: 'DOI' }] })).join() === 'version-unlinked'
    && one(vary({ relations: [{ type: 'IsNewVersionOf', id: '10.1/x', idType: 'DOI' }] })).join() === '');
  ok('every rule has an id, a scope, a severity, a title and a fix, and the ids are distinct',
    R.RULES.every((r) => /^[a-z]+(-[a-z]+)*$/.test(r.id) && ['record', 'set'].includes(r.scope) && R.SEVERITIES.includes(r.severity) && r.title && r.fix.length > 20)
    && new Set(R.RULES.map((r) => r.id)).size === R.RULES.length);
  /* The set rules are raised in section 3, type-unexpected in section 10, and identical-unlinked in section 15. */
  ok('every rule is raised by some case in these checks', (() => {
    const seen = new Set([...expected200, 'abstract-short', 'licence-missing', 'date-missing']);
    return R.RULES.every((r) => seen.has(r.id) || ['unresolved', 'not-on-orcid', 'same-title', 'openalex-missing', 'openalex-abstract-missing', 'type-unexpected', 'identical-unlinked'].includes(r.id));
  })());

  /* ------------------------------------------------------------ 3 */
  console.log('\n3. All the works of one ORCID iD');
  const urls = [];
  const ctx = await F.gather({ orcid: OWNER, dois: ['10.51094/jxiv.example', '10.5072/broken'], get: stubGet(urls) });
  const all = R.audit(ctx);
  const of = (doi) => all.filter((f) => f.doi === doi).map((f) => f.rule);
  ok('a DOI is looked up at DataCite, then Crossref, then JaLC', urls.indexOf('https://api.datacite.org/dois/10.51094%2Fjxiv.example') < urls.indexOf('https://api.crossref.org/works/10.51094%2Fjxiv.example')
    && urls.indexOf('https://api.crossref.org/works/10.51094%2Fjxiv.example') < urls.indexOf('https://api.japanlinkcenter.org/dois/10.51094%2Fjxiv.example'));
  /* Zenodo stores the bare iD, Figshare and OSF its URL: on 2026-11-02 the URL alone found 4 of 34 DOIs of one author. */
  ok('the DataCite search asks for the iD both bare (Zenodo) and as a URL (Figshare, OSF)', urls.some((u) => u.startsWith('https://api.datacite.org/dois?query=')
    && decodeURIComponent(u).includes('creators.nameIdentifiers.nameIdentifier:("' + OWNER + '" OR "https://orcid.org/' + OWNER + '"')));
  ok('a bare iD in the metadata is read as the iD', M.fromDataCite(fixture('datacite-zenodo.101.json')).creators[0].orcid === OWNER
    && fixture('datacite-zenodo.101.json').data.attributes.creators[0].nameIdentifiers[0].nameIdentifier === OWNER);
  ok('the complete version gives nothing, and its record of all versions is not checked on its own', of('10.5072/zenodo.101').length === 0 && of('10.5072/zenodo.100').length === 0);
  ok('unresolved: the mistyped DOI on the ORCID record', of('10.5072/typo.999').join() === 'unresolved');
  ok('not-on-orcid: each work that carries the iD but is not on the record, once, on its latest version; not a version of a listed work',
    all.filter((f) => f.rule === 'not-on-orcid').map((f) => f.doi).join() === '10.5072/zenodo.400,10.5072/m9.figshare.500.v2', all.filter((f) => f.rule === 'not-on-orcid').map((f) => f.doi).join());
  ok('an older version of a work is not checked on its own, however incomplete', of('10.5072/zenodo.99').length === 0);
  ok('Figshare: only the latest version is checked, and versions tied by their DOIs are not flagged as unlinked',
    of('10.5072/m9.figshare.500').length === 0 && of('10.5072/m9.figshare.500.v2').join() === 'keywords-missing,language-missing,not-on-orcid', of('10.5072/m9.figshare.500.v2').join());
  ok('same-title: the two deposits of the same work at two places, once', all.filter((f) => f.rule === 'same-title').map((f) => f.doi + ' ' + f.detail).join() === '10.5072/zenodo.200 same title as 10.5555/crossref.300 (Crossref)');
  ok('a DOI that could not be read is reported as such, and not as unresolved', ctx.failed.map((f) => f.doi).join() === '10.5072/broken' && !of('10.5072/broken').length);
  ok('a DOI given by hand is read too (JaLC), with no finding beyond what it lacks, and OpenAlex not holding it', of('10.51094/jxiv.example').join() === 'licence-missing,openalex-missing', of('10.51094/jxiv.example').join());
  ok('openalex-abstract-missing: the DOI metadata has an abstract and OpenAlex has none; not raised when the metadata has none, nor when OpenAlex could not be read',
    of('10.5072/zenodo.400').includes('openalex-abstract-missing') && !of('10.5072/zenodo.200').some((x) => /^openalex/.test(x))
    && R.audit({ owner: null, works: [], found: new Set(), records: new Map([['x', Object.assign({}, d200, { doi: 'x', openalex: { held: true, abstract: false } })]]) }).every((f) => f.rule !== 'openalex-abstract-missing'));
  ok('an OpenAlex that cannot be read is no finding, and does not mark the DOI as unread', ctx.records.get('10.5072/zenodo.200').openalex === undefined && !ctx.failed.some((f) => f.doi === '10.5072/zenodo.200'));
  ok('the Crossref deposit: a short abstract, no keywords, no related works', of('10.5555/crossref.300').join() === 'abstract-short,keywords-missing,relations-none,same-title'
    || of('10.5555/crossref.300').join() === 'abstract-short,keywords-missing,relations-none', of('10.5555/crossref.300').join());

  /* ------------------------------------------------------------ 4 */
  console.log('\n4. The report');
  const md = REP.markdown(ctx, all);
  const c = REP.counts(all);
  ok('the first line counts the works, the DOIs read and the findings', md.includes('ORCID iD ' + OWNER + ': 4 works with a DOI on the record, ' + ctx.records.size + ' DOIs read. ' + c.error + ' errors, ' + c.warning + ' warnings, ' + c.info + ' notes.'));
  const sections = md.split('\n## ').slice(1).filter((x) => !x.startsWith('What to do')).map((x) => [...x.matchAll(/^\| (error|warning|info) \|/gm)].map((m) => R.SEVERITIES.indexOf(m[1])));
  ok('works with errors come first, and within a work errors come before warnings and notes; each finding names its rule',
    sections.every((sv) => sv.every((v, i) => !i || v >= sv[i - 1])) && sections.every((sv, i) => !i || sv[0] >= sections[i - 1][0])
    && all.every((f) => md.includes('`' + f.rule + '`')));
  ok('“What to do” gives the fix of each rule that was raised, and only those', R.RULES.every((r) => md.includes('**`' + r.id + '`** ' + r.fix) === all.some((f) => f.rule === r.id)));
  ok('the DOI that could not be read is named, as the network’s fault, not the record’s', md.includes('Could not be read (the network or the API, not the record): 10.5072/broken.'));
  ok('a | in a title does not break the table', REP.markdown({ owner: null, works: [], records: new Map([['10.1/a', Object.assign({}, d200, { doi: '10.1/a', title: 'A | B' })]]) }, [{ rule: 'abstract-missing', severity: 'error', doi: '10.1/a', detail: 'x|y' }]).includes('A \\| B'));
  const js = JSON.parse(REP.json(ctx, all));
  ok('JSON: the same counts and findings', js.counts.error === c.error && js.findings.length === all.length && js.owner === OWNER);
  ok('the run fails at the severity asked for', REP.fails(all, 'error') && !REP.fails([{ severity: 'info' }], 'warning') && REP.fails([{ severity: 'info' }], 'info') && !REP.fails(all, 'never'));

  /* ------------------------------------------------------------ 5 */
  console.log('\n5. The command');
  const run = async (args) => { const out = sink(); const err = sink(); const code = await CLI.main(args, { get: stubGet(), stdout: out, stderr: err, env: {} }); return { code, out: out.text, err: err.text }; };
  let r = await run(['--orcid', OWNER]);
  ok('with errors found, the command exits 1 and prints the report', r.code === 1 && r.out.startsWith('# Deposit check'));
  r = await run(['--orcid', 'https://orcid.org/' + OWNER, '--fail-on', 'never', '--format', 'json']);
  ok('an ORCID iD may be given as its URL; --fail-on never exits 0; --format json prints JSON', r.code === 0 && JSON.parse(r.out).owner === OWNER);
  r = await run(['--doi', '10.5072/zenodo.101']);
  ok('a complete DOI alone: nothing to report, exit 0', r.code === 0 && r.out.includes('Nothing to report.'));
  r = await run(['--orcid', '0000-0002-1825-0098']);
  ok('a wrong check digit is refused before any request, exit 2', r.code === 2 && r.err.includes('check digit'));
  r = await run([]);
  ok('no iD and no DOI: exit 2 with the usage', r.code === 2 && r.err.includes('Usage:'));
  r = await run(['--orcid', '0000-0001-5109-3700']);
  ok('an ORCID record that does not exist: exit 2', r.code === 2 && r.err.includes('no ORCID record'));

  /* ------------------------------------------------------------ 6 */
  console.log('\n6. Asking the APIs politely');
  const answers = (list) => { let i = 0; return async () => list[i++]; };
  const res = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });
  const realFetch = global.fetch;
  const waits = [];
  global.fetch = answers([res(429), res(200, { a: 1 })]);
  const g = F.httpGet({ wait: async (ms) => { waits.push(ms); } });
  ok('a 429 is tried again after a wait, and the answer is returned', JSON.stringify(await g('https://x/')) === '{"a":1}' && waits.includes(F.RETRY_WAITS_MS[0]));
  global.fetch = answers([res(404)]);
  ok('a 404 is no record, not an error', (await g('https://x/')) === null);
  global.fetch = answers([res(500), res(500), res(500)]);
  let threw = null;
  try { await g('https://x/y?z=1'); } catch (e) { threw = e.message; }
  ok('a server error is tried twice more, then reported without the query', threw === 'https://x/y: HTTP 500');
  global.fetch = realFetch;
  ok('every request waits a moment after the last, and the waits grow', F.GAP_MS >= 200 && F.RETRY_WAITS_MS.length === 2 && F.RETRY_WAITS_MS[1] > F.RETRY_WAITS_MS[0]);
  ok('no contact address is built in; one can be given in DEPOSIT_CHECK_MAILTO', !/mailto:[^'"]/.test(read('src/fetch.js').replace("'; mailto:' + mailto", '')) && read('src/fetch.js').includes('process.env.DEPOSIT_CHECK_MAILTO'));
  ok('only src/fetch.js reaches the network', ['src/metadata.js', 'src/rules.js', 'src/report.js', 'bin/deposit-check.js', 'scripts/catalog-inputs.js'].every((f) => !/\bfetch\(/.test(read(f))));

  /* ------------------------------------------------------------ 7 */
  console.log('\n7. The repository');
  const readme = read('README.md');
  const table = [...readme.matchAll(/^\| `([a-z-]+)` \| (error|warning|info) \|/gm)].map((m) => m[1] + ':' + m[2]);
  ok('the README lists every rule with its severity, in order, and no other', table.join() === R.RULES.map((x) => x.id + ':' + x.severity).join(), table.join());
  const pkg = JSON.parse(read('package.json'));
  ok('no dependencies; Node.js 22; MIT; the command is bin/deposit-check.js', !pkg.dependencies && !pkg.devDependencies && pkg.engines.node === '>=22'
    && pkg.license === 'MIT' && pkg.bin['deposit-check'] === 'bin/deposit-check.js');
  ok('LICENSE is MIT, and the README says the text is under CC BY 4.0, with a link to the licence (legal audit, 2026-11-12)', /^MIT License/.test(read('LICENSE')) && readme.includes('[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)'));
  const action = read('action.yml');
  /* An expression may appear only as the value of an environment variable, never in a command, a block or a name. */
  const onlyInEnv = (y) => y.split('\n').filter((l) => l.includes('${{')).every((l) => /^\s+[A-Z][A-Z0-9_]*: \$\{\{ (inputs\.[a-z-]+|secrets\.GITHUB_TOKEN) \}\}$/.test(l));
  ok('the action passes its inputs through the environment, never into the command line', onlyInEnv(action)
    && /ORCID: \$\{\{ inputs\.orcid \}\}/.test(action) && /using: composite/.test(action));
  const wfFiles = fs.readdirSync(path.join(ROOT, '.github', 'workflows'));
  const wf = (f) => read(path.join('.github', 'workflows', f));
  /* The top level only reads. The monthly run writes its issue from its one job, and nowhere else. */
  /* 2026-11-14: the checked intake (checked-intake.yml) is the same file in the 13 repositories, and check_ecosystem.js in
   * cpsbvbng26-dotcom pins it. Its top level reads and writes issues, and its one expression outside the environment is the
   * group of its concurrency, by issue number. Nothing else is allowed to it. */
  /* 2026-11-15: the group moved to the checking job, with a group of its own for a run that does not check. */
  const INTAKE_GROUP = "      group: ${{ (github.event_name == 'issues' && github.event.sender.login != github.repository_owner) && format('checked-intake-issue-{0}', github.event.issue.number) || format('checked-intake-run-{0}', github.run_id) }}";
  /* 2026-11-19: the answer to an issue opened with an empty body (empty-issue.yml) is the same file in 15 repositories, and
   * check_ecosystem.js in cpsbvbng26-dotcom (13f) pins it. It writes a label and one comment, so its top level writes issues
   * and nothing else, and it reads no contents. */
  ok('every workflow only reads, except that the job of the monthly run may write issues, the checked intake writes issues, and the answer to an issue with an empty body writes issues and reads nothing else; inputs go through the environment',
    wfFiles.length >= 2 && wfFiles.every((f) => (f === 'checked-intake.yml' ? /^permissions:\n  contents: read\n  issues: write\n(?!  \w)/m.test(wf(f)) && !/^ +permissions:/m.test(wf(f))
      : f === 'empty-issue.yml' ? /^permissions:\n  issues: write\n(?!  \w)/m.test(wf(f)) && !/^ +permissions:/m.test(wf(f)) : /^permissions:\n  contents: read\n(?!  \w)/m.test(wf(f)))
      && (f !== 'run.yml' || /^    permissions:\n      contents: read\n      issues: write\n(?!      \w)/m.test(wf(f)))
      && onlyInEnv(f === 'checked-intake.yml' ? wf(f).split('\n').filter((l) => l !== INTAKE_GROUP).join('\n') : wf(f))));
  const cff = read('CITATION.cff');
  ok('CITATION.cff names one author with an ORCID iD, and no language model', (cff.match(/family-names:/g) || []).length === 1 && cff.includes('orcid: "https://orcid.org/0009-0000-1406-0547"') && !/claude|anthropic|openai|gpt/i.test(cff));
  /* Zenodo reads .zenodo.json before CITATION.cff, so the disclosure has to be in it too. */
  const zen = JSON.parse(read('.zenodo.json'));
  ok('.zenodo.json names the one author of CITATION.cff, the licence of LICENSE, and says Claude is not an author',
    Array.isArray(zen.creators) && zen.creators.length === 1 && zen.creators[0].orcid === '0009-0000-1406-0547'
    && zen.license === 'mit' && /Claude Code \(Anthropic\)/.test(zen.notes || '') && (zen.notes || '').includes('Claude is not an author.')
    && !/claude|anthropic/i.test(JSON.stringify(zen.creators)));
  /* The DOIs that Zenodo gave on release (DataCite: 24033082 is v0.1.0 and IsVersionOf 24033081). */
  const readme0 = read('README.md');
  ok('the README, in both languages, and CITATION.cff give the DOI of version 0.1.0 and the DOI of every version; the version is that of package.json',
    ['10.5281/zenodo.24033082', '10.5281/zenodo.24033081'].every((d) => cff.includes('value: "' + d + '"') && (readme0.match(new RegExp('\\(https://doi\\.org/' + d.replace(/\./g, '\\.') + '\\)', 'g')) || []).length === 2)
    && cff.includes('doi: "10.5281/zenodo.24033081"') && cff.includes('version: "' + JSON.parse(read('package.json')).version + '"') && readme0.includes('## Citing'));
  const contributing = read('CONTRIBUTING.md');
  ok('CONTRIBUTING says where issues and pull requests go, how to run the checks, that checks are not loosened, and how the models are disclosed; the README points to it',
    contributing.includes('node verification/check.js') && contributing.includes('A check is never loosened to make a change pass.')
    && contributing.includes('A generative model is never listed as an author or a contributor.') && readme.includes('[CONTRIBUTING.md](CONTRIBUTING.md)'));
  ok('the README says how the code was written, and that Claude is not an author', readme.includes('Claude Code (Anthropic)') && readme.includes('Claude is not an author'));
  ok('the README says what is sent where, and that no key is needed', ['pub.orcid.org', 'api.datacite.org', 'api.crossref.org', 'api.japanlinkcenter.org', 'api.openalex.org'].every((h) => readme.includes(h)));

  /* ------------------------------------------------------------ 8 */
  console.log('\n8. The issue of the monthly run');
  const W = require('../scripts/weekly-issue.js');
  /* A report with e errors, w warnings and i notes, each on a DOI of its own; `moved` puts the first warning on another DOI. */
  const rep = (e, w, i, moved) => {
    const f = (sev, rule, n, base) => Array.from({ length: n }, (_, k) => ({ rule, severity: sev, doi: '10.5072/' + base + '.' + (k === 0 && moved && sev === 'warning' ? 900 : k) }));
    return { owner: OWNER, counts: { error: e, warning: w, info: i }, findings: [].concat(f('error', 'abstract-missing', e, 'e'), f('warning', 'keywords-missing', w, 'w'), f('info', 'language-missing', i, 'i')) };
  };
  let p = W.plan(null, rep(1, 2, 3), '# Deposit check\n', '2026-11-03');
  ok('errors or warnings and no open issue: one is opened, with the counts in its title and kept in the body', p.kind === 'create'
    && p.title === 'Deposit check: 1 errors, 2 warnings' && p.body.startsWith(W.MARK) && JSON.stringify(W.countsOf(p.body)) === '{"error":1,"warning":2,"info":3}');
  const open = { number: 7, body: p.body };
  p = W.plan(open, rep(1, 2, 3), '# Deposit check\n', '2026-11-10');
  ok('the same counts a month later: the report is replaced, with no comment', p.kind === 'update' && p.number === 7 && p.comment === null);
  p = W.plan(open, rep(0, 2, 3), '# Deposit check\n', '2026-11-10');
  ok('the counts changed: a comment says how, since an edit sends no notification', p.kind === 'update' && (p.comment || '').includes('0 errors, 2 warnings, 3 notes (before: 1 errors, 2 warnings, 3 notes)'));
  p = W.plan(open, rep(0, 0, 5), '# Deposit check\n', '2026-11-17');
  ok('no error or warning left: the issue is closed with a comment; notes alone do not open one', p.kind === 'close' && p.number === 7
    && W.plan(null, rep(0, 0, 5), '', '2026-11-17').kind === 'none');
  ok('a long report is cut, and says where the whole one is', W.plan(null, rep(1, 0, 0), 'x'.repeat(W.LIMIT + 10), 'd').body.includes('The whole report is in the job summary'));
  /* 417: the issue keeps the findings of the last report, so that the next run says what changed, not only how many. */
  ok('the issue keeps each finding as its rule and DOI', JSON.stringify(W.keptOf(W.plan(null, rep(1, 1, 0), '', 'd').body).keys) === '["abstract-missing 10.5072/e.0","keywords-missing 10.5072/w.0"]');
  p = W.plan(open, rep(1, 2, 3, true), '# Deposit check\n', '2026-11-10');
  ok('the same counts and other findings: a comment names the finding that is gone and the one that is new', p.kind === 'update'
    && (p.comment || '').includes('No longer found:\n- `keywords-missing` 10.5072/w.0') && (p.comment || '').includes('New:\n- `keywords-missing` 10.5072/w.900'), p.comment);
  p = W.plan(open, rep(1, 3, 3), '# Deposit check\n', '2026-11-10');
  ok('a new finding alone: the comment names it, and names nothing as gone', (p.comment || '').includes('New:\n- `keywords-missing` 10.5072/w.2') && !(p.comment || '').includes('No longer found'));
  const oldBody = W.MARK + '\n<!-- counts: {"error":1,"warning":2,"info":3} -->\n**Weekly run, 2026-11-03.**\n';
  ok('an issue from before, which kept only the counts: the counts are compared',
    W.plan({ number: 7, body: oldBody }, rep(1, 2, 3), '', 'd').comment === null && (W.plan({ number: 7, body: oldBody }, rep(1, 2, 4), '', 'd').comment || '').includes('before: 1 errors, 2 warnings, 3 notes'));
  const many = rep(0, 2000, 0);
  const manyBody = W.plan(null, many, 'x'.repeat(W.LIMIT + 10), 'd').body;
  ok('a long list of findings is kept as a digest, which still tells a change; the body stays within what GitHub takes',
    W.keptOf(manyBody).keys === null && W.keptOf(manyBody).sum === W.digest(W.keysOf(many)) && manyBody.length <= 65536
    && W.plan({ number: 7, body: manyBody }, many, '', 'd').comment === null && W.plan({ number: 7, body: manyBody }, rep(0, 2000, 0, true), '', 'd').comment !== null);
  const longKept = W.plan(null, rep(0, 550, 0), 'x'.repeat(W.LIMIT + 10), 'd').body;
  ok('a list of findings kept in full shortens the report, so that the body stays within what GitHub takes',
    W.keptOf(longKept).keys !== null && W.keptOf(longKept).keys.length === 550 && longKept.length <= 65536 && longKept.includes('The whole report is in the job summary'), String(longKept.length));
  ok('the issue says when the catalogue was read, and at which commit', W.plan(null, rep(1, 0, 0), '', 'd', 'abc123def456').body.includes('Every DOI in `catalog.json` of cpsbvbng26-dotcom, at abc123def456, was read as well.')
    && !W.plan(null, rep(1, 0, 0), '', 'd', null).body.includes('catalog.json'));
  const ws = read('scripts/weekly-issue.js');
  ok('the script posts only for the owner’s iD, and talks only to api.github.com', ws.includes('report.owner !== process.env.OWNER_ORCID')
    && (ws.match(/https:\/\/[a-z.]+/g) || []).every((u) => u === 'https://api.github.com'));
  const runYml = wf('run.yml');
  ok('the monthly run writes the report as JSON and Markdown, and passes the token through the environment', runYml.includes('--out report.md --json-out report.json')
    && runYml.includes('node scripts/weekly-issue.js report.json report.md') && /GITHUB_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}/.test(runYml));
  const tmp = path.join(require('os').tmpdir(), 'deposit-check-' + process.pid + '.json');
  r = await run(['--doi', '10.5072/zenodo.101', '--json-out', tmp]);
  ok('--json-out writes JSON whatever --format is', r.out.startsWith('# Deposit check') && JSON.parse(fs.readFileSync(tmp, 'utf8')).read === 1);
  fs.rmSync(tmp, { force: true });
  ok('the README says that the issue of the monthly run exists, when it closes, and that it uses api.github.com', readme.includes('closes itself when no error or warning is left') && readme.includes('api.github.com'));
  /* 2026-11-25: the issue text must name the schedule that run.yml has. The cadence is read from the cron of run.yml. The
   * head of the issue (and its line for DOIs not checked) must use its words and not those of another cadence; the README's
   * line on run.yml and the comment at the top of run.yml must say "once a" month (or week); and the paper, the scripts,
   * the notes of the fixtures and the Unreleased part of CHANGELOG.md must not call it the run or the issue of another
   * cadence. Until 2026-11-13 the run was weekly; issue #4 keeps the text of the last weekly run (2026-11-10) until the
   * next run replaces it. */
  const CADENCE = { month: ['Monthly run, ', 'updated each month', 'next month'], week: ['Weekly run, ', 'updated each week', 'next week'] };
  const JA = { month: '月に一度の実行', week: '週に一度の実行' };
  const cadenceOf = (yml) => {
    const crons = [...yml.matchAll(/cron: '([^']+)'/g)].map((m) => m[1].split(' '));
    if (crons.length !== 1 || crons[0].length !== 5) return null;
    const [mi, h, dom, mon, dow] = crons[0];
    const n = (x) => /^\d+$/.test(x);
    if (n(mi) && n(h) && n(dom) && mon === '*' && dow === '*') return 'month';
    if (n(mi) && n(h) && dom === '*' && mon === '*' && n(dow)) return 'week';
    return null;
  };
  const cadenceProblems = (yml, head, rd, docs) => {
    const c = cadenceOf(yml);
    if (!c) return ['the cron of run.yml is neither monthly nor weekly, and the issue has no words for it'];
    const bad = [];
    CADENCE[c].filter((w) => !head.includes(w)).forEach((w) => bad.push('the issue lacks "' + w + '"'));
    const rdLine = rd.split('\n').find((l) => l.startsWith('`.github/workflows/run.yml` runs the tool itself')) || '';
    if (!rdLine.includes('once a ' + c)) bad.push('the README\'s line on run.yml does not say "once a ' + c + '"');
    if (!(yml.split('\n')[1] || '').includes('once a ' + c)) bad.push('the comment at the top of run.yml does not say "once a ' + c + '"');
    if (!rd.includes(JA[c])) bad.push('the README in Japanese does not say 「' + JA[c] + '」');
    for (const [other, words] of Object.entries(CADENCE)) {
      if (other === c) continue;
      words.filter((w) => head.includes(w)).forEach((w) => bad.push('the issue says "' + w + '"'));
      const re = new RegExp('\\b' + other + 'ly (run|issue)\\b', 'i');
      for (const [f, t] of Object.entries(docs)) if (re.test(t)) bad.push(f + ' calls it the ' + other + 'ly run or issue');
      if (rdLine.includes('once a ' + other)) bad.push('the README\'s line on run.yml says "once a ' + other + '"');
      [['README.md', rd], ['docs/joss.md', docs['docs/joss.md']]].filter(([, t]) => (t || '').includes(JA[other])).forEach(([f]) => bad.push(f + ' says 「' + JA[other] + '」'));
    }
    return bad;
  };
  const headOf = (body) => body.split('\n\n')[0];
  const issueHead = headOf(W.plan(null, Object.assign(rep(1, 0, 0), { failed: [{ doi: '10.5072/x.1', error: 'HTTP 503' }] }), '# Deposit check\n', '2026-12-09').body);
  const changelog = read('CHANGELOG.md');
  const unreleased = changelog.slice(changelog.indexOf('## Unreleased'), changelog.indexOf('\n## ', changelog.indexOf('## Unreleased') + 3));
  const cadenceDocs = { 'paper/paper.md': read('paper/paper.md'), 'docs/joss.md': read('docs/joss.md'), 'scripts/weekly-issue.js': read('scripts/weekly-issue.js'),
    'scripts/catalog-inputs.js': read('scripts/catalog-inputs.js'), 'verification/fixtures/README.md': read('verification/fixtures/README.md'),
    'the Unreleased part of CHANGELOG.md': unreleased, 'the steps of run.yml': runYml.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n') };
  const cp = cadenceProblems(runYml, issueHead, readme, cadenceDocs);
  ok('the issue of the run, and the files that describe the run, name the schedule of the cron of run.yml (' + (cadenceOf(runYml) ? cadenceOf(runYml) + 'ly' : 'no cadence known') + ') and no other', unreleased.startsWith('## Unreleased') && cp.length === 0, cp.join('; '));
  const cpBroken = [
    cadenceProblems(runYml.replace("cron: '23 5 9 * *'", "cron: '23 5 * * 2'"), issueHead, readme, cadenceDocs),
    cadenceProblems(runYml.replace("cron: '23 5 9 * *'", "cron: '23 5 9 */3 *'"), issueHead, readme, cadenceDocs),
    cadenceProblems(runYml, issueHead.replace('updated each month', 'updated each week'), readme, cadenceDocs),
    cadenceProblems(runYml, issueHead.replace('Monthly run, ', 'Weekly run, '), readme, cadenceDocs),
    cadenceProblems(runYml, issueHead.replace('next month', 'next time'), readme, cadenceDocs),
    cadenceProblems(runYml, issueHead, readme, Object.assign({}, cadenceDocs, { 'verification/fixtures/README.md': cadenceDocs['verification/fixtures/README.md'].replace('the monthly run reads', 'the weekly run reads') })),
    cadenceProblems(runYml, issueHead, readme, Object.assign({}, cadenceDocs, { 'the Unreleased part of CHANGELOG.md': unreleased + '\n- The weekly issue keeps the findings.\n' })),
    cadenceProblems(runYml, issueHead, readme.replace('by hand or once a month', 'by hand or once a week'), cadenceDocs),
    cadenceProblems(runYml.replace('or once a month for', 'or once a week for'), issueHead, readme, cadenceDocs),
    cadenceProblems(runYml, issueHead, readme.replace('月に一度の実行', '週に一度の実行'), cadenceDocs),
    cadenceProblems(runYml, issueHead, readme, Object.assign({}, cadenceDocs, { 'docs/joss.md': cadenceDocs['docs/joss.md'].replace('月に一度の実行', '週に一度の実行') })),
  ];
  ok('break on purpose: a weekly cron, a quarterly cron, "each week" or "Weekly run" in the issue, "next month" dropped, the weekly run in the notes of the fixtures, in CHANGELOG.md, in the README, in the comment of run.yml, in Japanese in the README and in docs/joss.md (' + cpBroken.filter((b) => b.length).length + ' / ' + cpBroken.length + ')', cpBroken.every((b) => b.length > 0));

  /* ------------------------------------------------------------ 9 */
  {
  console.log('\n9. The draft JOSS paper');
  const pmd = read('paper/paper.md');
  const bib = read('paper/paper.bib');
  const body = pmd.replace(/^---[\s\S]*?\n---\n/, '').replace(/<!--[\s\S]*?-->/g, '');
  const W = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
  /* 2026-11-25: JOSS's guide to the paper (docs/paper.md of openjournals/joss, read on 2026-11-24) asks for 750 to 1750 words
   * and for the sections Summary, Statement of need, State of the field, Software design, Research impact statement,
   * AI usage disclosure, Acknowledgements and References. The draft of 2026-11-03 was checked against 250 to 1000 words and
   * without Acknowledgements or the order. Each DOI of paper.bib was read at Crossref or DataCite on 2026-11-25, and
   * verification/paper-dois.json records the title and year each registry gave; before, the check asked for no DOI at all.
   * The numbers the paper writes in words are those of the code and of the run it names. The affirmation of human review
   * is the author's own statement, which Claude cannot make, so the draft must not claim it. Broken copies must fail. */
  const SECTIONS = ['Summary', 'Statement of need', 'State of the field', 'Software design', 'Research impact statement', 'AI usage disclosure', 'Acknowledgements', 'References'];
  const UNITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  const inWords = (n) => (n < 20 ? UNITS[n] : TENS[Math.floor(n / 10)] + (n % 10 ? '-' + UNITS[n % 10] : ''));
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  const runReport = read('docs/runs/2026-11-11-catalog/report.md');
  const runHead = /, (\d+) DOIs read\. (\d+) errors, (\d+) warnings, (\d+) notes\./.exec(runReport);
  const runAbstracts = (runReport.match(/^\| error \| No abstract in the DOI metadata \(`abstract-missing`\) \|/gm) || []).length;
  const sources = JSON.parse(read('verification/paper-dois.json'));
  const flat = (s) => String(s).replace(/[{}]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const bibEntries = (b) => [...b.matchAll(/^@(\w+)\{([^,\n]+),\n([\s\S]*?)\n\}/gm)].map((m) => {
    const f = {};
    for (const x of m[3].matchAll(/^\s+([a-z]+)\s*=\s*\{(.*)\},?$/gm)) f[x[1]] = x[2];
    return { type: m[1], key: m[2], f };
  });
  const paperProblems = (p, b, src) => {
    const bad = [];
    const bodyOf = p.replace(/^---[\s\S]*?\n---\n/, '').replace(/<!--[\s\S]*?-->/g, '');
    const n = (bodyOf.match(/[A-Za-z0-9][A-Za-z0-9'’.-]*/g) || []).length;
    if (n < 750 || n > 1750) bad.push('length ' + n);
    const heads = [...bodyOf.matchAll(/^# (.+)$/gm)].map((m) => m[1].trim());
    if (heads.join('|') !== SECTIONS.join('|')) bad.push('sections ' + heads.join(', '));
    if (!/\n# References\n*$/.test(bodyOf)) bad.push('References is not last');
    const sec = (h) => { const i = bodyOf.indexOf('\n# ' + h + '\n'); const j = bodyOf.indexOf('\n# ', i + 1); return i < 0 ? '' : bodyOf.slice(i, j < 0 ? bodyOf.length : j); };
    for (const h of SECTIONS.slice(0, -1)) if ((sec(h).match(/[A-Za-z]+/g) || []).length < 25) bad.push('section too short: ' + h);
    const es = bibEntries(b);
    const keys = es.map((e) => e.key);
    const cited = [...new Set([...bodyOf.matchAll(/(?<![\w.`-])@([a-z]+)\b/g)].map((m) => m[1]))];
    const brackets = [...bodyOf.matchAll(/\[([^\]]*@[^\]]*)\]/g)].map((m) => m[1]);
    if (!brackets.every((x) => /^@[a-z]+(; @[a-z]+)*$/.test(x))) bad.push('citation syntax');
    if (!cited.length || !cited.every((k) => keys.includes(k)) || !keys.every((k) => cited.includes(k))) bad.push('citations ' + cited.join(',') + ' / bib ' + keys.join(','));
    if (new Set(keys).size !== keys.length) bad.push('a key twice');
    const used = new Set();
    for (const e of es) {
      if (!e.f.title || !e.f.year) { bad.push(e.key + ': no title or year'); continue; }
      if (!e.f.doi) { if (!/^https:\/\//.test(e.f.url || '')) bad.push(e.key + ': neither a DOI nor a URL'); continue; }
      const d = e.f.doi.toLowerCase();
      const r = src.records[d];
      used.add(d);
      if (!r) { bad.push(e.key + ': a DOI not read at its agency'); continue; }
      if (!['crossref', 'datacite', 'jalc'].includes(r.agency) || !['api.crossref.org', 'api.datacite.org'].includes(r.api)) bad.push(e.key + ': agency');
      if (flat(e.f.title) !== flat(r.title)) bad.push(e.key + ': title differs from the registry');
      if (Number(e.f.year) !== r.year) bad.push(e.key + ': year differs from the registry');
    }
    for (const d of Object.keys(src.records)) if (!used.has(d)) bad.push('a record without an entry: ' + d);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(src.read || '')) bad.push('the date of reading');
    const prose = bodyOf.replace(/\s+/g, ' ');
    if (!prose.includes('applies ' + W[R.RULES.length] + ' rules')) bad.push('the number of rules');
    if (!prose.includes('retries a refused or failed request ' + ['never', 'once', 'twice'][F.RETRY_WAITS_MS.length] + ', after ' + F.RETRY_WAITS_MS.map((ms) => inWords(ms / 1000)).join(' and ') + ' seconds')) bad.push('the retries');
    if (!runHead || !prose.includes('It read ' + inWords(Number(runHead[1])) + ' DOIs and found ' + inWords(Number(runHead[2])) + ' errors, ' + inWords(Number(runHead[3])) + ' warnings and ' + inWords(Number(runHead[4])) + ' notes.')) bad.push('the counts of the run of 2026-11-11');
    if (!prose.includes(cap(inWords(runAbstracts)) + ' Zenodo deposits had no abstract in their metadata')) bad.push('the abstracts missing in the run');
    if (!prose.includes('There is no record yet of use by other authors.')) bad.push('the research impact as it is');
    if (!prose.includes('Claude is not an author.') || /name: .*Claude/.test(p) || !prose.includes('Claude Code (Anthropic)') || !prose.includes('Claude Opus 5 and Claude Opus 5.5') || !prose.includes('verification/paper-dois.json')) bad.push('the AI usage disclosure');
    if (/\bthe author(s)? (decided|reviewed|validated|takes? responsibility)|\bhuman authors? (reviewed|edited|validated)/i.test(prose)) bad.push('an affirmation that only the author can make');
    if (!p.replace(/\s+/g, ' ').includes('Both statements are the author\'s own. Claude, which drafted this paper, cannot make them for the author, and this draft does not contain them.')) bad.push('the note on the affirmation');
    if (!p.includes('Draft. Not submitted.')) bad.push('the draft note');
    return bad;
  };
  const pp = paperProblems(pmd, bib, sources);
  const pwords = (body.match(/[A-Za-z0-9][A-Za-z0-9'’.-]*/g) || []).length;
  ok('the paper follows JOSS\'s guide of 2026: ' + pwords + ' words within 750 to 1750, the eight sections in order with References last, every citation in paper.bib and every entry cited, each DOI read at its agency with the title and year of the registry, the numbers it writes those of the code and of the run of 2026-11-11, the AI usage disclosure, no affirmation made for the author, and no use by other authors claimed', pp.length === 0, pp.join('; '));
  ok('the one author has the ORCID iD of CITATION.cff', /authors:\n  - name: Takuya Nemoto\n    orcid: 0009-0000-1406-0547\n/.test(pmd) && (pmd.match(/^  - name:/gm) || []).length === 2);
  const swap = (t, a, b) => t.replace('\n# ' + a + '\n', '\n# @@A\n').replace('\n# ' + b + '\n', '\n# ' + a + '\n').replace('\n# @@A\n', '\n# ' + b + '\n');
  const firstDoi = Object.keys(sources.records)[0];
  const paperBreaks = [
    ['two sections swapped', swap(pmd, 'Software design', 'State of the field'), bib, sources],
    ['Acknowledgements taken out', pmd.replace('\n# Acknowledgements\n', '\n'), bib, sources],
    ['a section of the old guide added', pmd.replace('\n# References\n', '\n# Mathematics\n\n' + 'Nothing here. '.repeat(10) + '\n\n# References\n'), bib, sources],
    ['too long', pmd.replace('\n# Acknowledgements\n', '\n' + 'More words here. '.repeat(70) + '\n\n# Acknowledgements\n'), bib, sources],
    ['too short', pmd.replace(/\n# Statement of need\n[\s\S]*?\n# Research impact statement\n/, '\n# Statement of need\n\n' + 'Researchers need to see the metadata of their deposits as a machine reads it. '.repeat(3)
      + '\n\n# State of the field\n\nThe other tools [@fair; @autoupdate; @sophaxis; @participation; @brightspots; @coki; @fuji; @fujisoftware; @doiorcid; @rorcid] work at the scale of a member, an object or an institution. ' + 'They do not start from one person. '.repeat(3)
      + '\n\n# Software design\n\nThe reader retries a refused or failed request ' + ['never', 'once', 'twice'][F.RETRY_WAITS_MS.length] + ', after ' + F.RETRY_WAITS_MS.map((ms) => inWords(ms / 1000)).join(' and ') + ' seconds. ' + 'Each rule is a pure function of a record. '.repeat(3) + '\n\n# Research impact statement\n'), bib, sources],
    ['a citation not in paper.bib', pmd.replace('[@zenodo]', '[@zenodo; @nowhere]'), bib, sources],
    ['an entry not cited', pmd, bib + '\n@misc{uncited,\n  title = {Nothing},\n  year  = {2026},\n  url   = {https://example.org/}\n}\n', sources],
    ['a title changed', pmd, bib.replace('{ORCID}: a system to uniquely identify researchers', '{ORCID}: a system to identify researchers'), sources],
    ['a year changed', pmd, bib.replace(/year    = \{2016\}/, 'year    = {2015}'), sources],
    ['a DOI not read', pmd, bib.replace('10.1087/20120404', '10.1087/20120405'), sources],
    ['a record without an entry', pmd, bib, Object.assign({}, sources, { records: Object.assign({}, sources.records, { '10.5555/unused': { agency: 'crossref', api: 'api.crossref.org', title: 'x', year: 2026, type: 'x' } }) })],
    ['a record of another agency', pmd, bib, Object.assign({}, sources, { records: Object.assign({}, sources.records, { [firstDoi]: Object.assign({}, sources.records[firstDoi], { api: 'doi.org' }) }) })],
    ['the number of rules', pmd.replace('applies ' + W[R.RULES.length] + ' rules', 'applies ' + W[R.RULES.length + 1] + ' rules'), bib, sources],
    ['the counts of the run', pmd.replace(/It read ([a-z-]+) DOIs/, 'It read sixty DOIs'), bib, sources],
    ['the abstracts missing', pmd.replace(/\n([A-Z][a-z-]+) Zenodo deposits had no abstract/, '\nNine Zenodo deposits had no abstract'), bib, sources],
    ['the retries', pmd.replace('after five and twenty seconds', 'after five and thirty seconds'), bib, sources],
    ['an affirmation written for the author', pmd.replace('Claude is not an author.', 'The author reviewed and validated all of it.\nClaude is not an author.'), bib, sources],
    ['use by others claimed', pmd.replace('There is no record yet of use by other authors.', 'Other authors use it.'), bib, sources],
    ['Claude as an author', pmd.replace('  - name: Takuya Nemoto\n', '  - name: Takuya Nemoto\n  - name: Claude\n'), bib, sources],
    ['a citation written with a comma', pmd.replace('[@fuji; @fujisoftware]', '[@fuji, @fujisoftware]'), bib, sources],
  ];
  const stillPass = paperBreaks.filter(([, p, b, s]) => paperProblems(p, b, s).length === 0).map(([nm]) => nm);
  ok('break on purpose: the paper check fails on each of ' + paperBreaks.length + ' broken copies (sections, length, citations, titles, years, DOIs, records, numbers, disclosure)', stillPass.length === 0, stillPass.join(', '));
  /* 2026-11-12 (the third missed findings): the one affiliation is the university where the author is enrolled, as JOSS's
   * guide to the paper asks for the authors and their affiliations, with no title; the body says in one sentence that the
   * tool is not a project of the university and that the university does not endorse it. Broken copies must fail. */
  const AFFIL = 'affiliations:\n  - name: ZEN University, Japan\n    index: 1\n';
  const NOT_UNIV = 'deposit-check is not a project of ZEN University, and the university does not endorse it.';
  const affilOk = (t) => {
    const head = /^---\n([\s\S]*?)\n---\n/.exec(t);
    const b = head ? t.slice(head[0].length).replace(/<!--[\s\S]*?-->/g, '') : '';
    return !!head && t.includes(AFFIL) && (head[1].match(/^  - name:/gm) || []).length === 2 && b.replace(/\s+/g, ' ').includes(NOT_UNIV);
  };
  const affilBreaks = [pmd.replace('deposit-check is not a project', 'deposit-check is a project'), pmd.replace('the university does not endorse it.', 'the university endorses it.'),
    pmd.replace('  - name: ZEN University, Japan\n', '  - name: ZEN University, Japan\n    index: 1\n  - name: Independent\n'), pmd.replace(AFFIL, '')];
  ok('the one affiliation is ZEN University, Japan, and the body says that deposit-check is not a project of the university and is not endorsed by it; broken copies fail',
    affilOk(pmd) && affilBreaks.every((b) => b !== pmd && !affilOk(b)));

  }

  /* ------------------------------------------------------------ 10 */
  console.log('\n10. Expected types');
  const ex = M.expectedTypes({ _: 'a comment', '10.5072/Zenodo.101': 'Software', 'https://doi.org/10.5072/zenodo.200': 'Dataset' });
  ok('a file of expected types is read: comments are skipped, DOIs are lower-cased and may be given as URLs',
    ex.size === 2 && ex.get('10.5072/zenodo.101') === 'Software' && ex.get('10.5072/zenodo.200') === 'Dataset');
  const refused = (j) => { try { M.expectedTypes(j); return false; } catch (e) { return true; } };
  ok('a key that is not a DOI, a type that is not one word, an empty file and a list are refused',
    refused({ 'zenodo.101': 'Software' }) && refused({ '10.5072/zenodo.101': 'Journal article' }) && refused({ '10.5072/zenodo.101': 3 })
    && refused({ _: 'only a comment' }) && refused([]) && !refused({ '10.5072/zenodo.101': 'software' }));
  const typed = (rec, expected) => R.audit({ owner: null, works: [], found: new Set(), records: new Map([[rec.doi, rec]]), expected: new Map(Object.entries(expected)) })
    .filter((f) => f.rule === 'type-unexpected').map((f) => f.detail);
  ok('type-unexpected: a DataCite record registered under another type; the case of the type does not matter',
    typed(d101, { '10.5072/zenodo.101': 'Software' }).join() === 'registered as Preprint, expected Software'
    && typed(d101, { '10.5072/zenodo.101': 'preprint' }).length === 0 && typed(d101, {}).length === 0);
  ok('type-unexpected: a type given for the record of all versions holds for its versions',
    typed(d101, { '10.5072/zenodo.100': 'Dataset' }).join() === 'registered as Preprint, expected Dataset');
  ok('type-unexpected: Crossref and JaLC records are not compared, since their types are named in other words',
    typed(c300, { '10.5555/crossref.300': 'Preprint' }).length === 0 && typed(j, { '10.51094/jxiv.example': 'Preprint' }).length === 0);
  ok('type-unexpected reads the resourceTypeGeneral of DataCite', fixture('datacite-zenodo.101.json').data.attributes.types.resourceTypeGeneral === d101.type.general);
  const ag = F.answersGet({ _: 'x', 'https://a/': { a: 1 } });
  ok('recorded answers: a URL in the file gives its answer, any other is a 404', JSON.stringify(await ag('https://a/')) === '{"a":1}' && (await ag('https://b/')) === null && (await ag('_')) === null);
  const tmpTypes = path.join(require('os').tmpdir(), 'deposit-check-types-' + process.pid + '.json');
  fs.writeFileSync(tmpTypes, JSON.stringify({ '10.5072/zenodo.101': 'Software' }));
  r = await run(['--expect-types', tmpTypes, '--format', 'json']);
  ok('--expect-types alone: the DOIs in the file are checked, and a differing type is a warning', r.code === 0
    && JSON.parse(r.out).findings.map((f) => f.rule + ' ' + f.doi).join() === 'type-unexpected 10.5072/zenodo.101');
  fs.writeFileSync(tmpTypes, '{ "10.5072/zenodo.101": "Software", }');
  r = await run(['--expect-types', tmpTypes]);
  ok('a file of expected types that cannot be read: exit 2, before any request', r.code === 2 && r.out === '');
  fs.rmSync(tmpTypes, { force: true });

  /* ------------------------------------------------------------ 11 */
  console.log('\n11. The example');
  const EXAMPLE = ['--answers', 'examples/answers.json', '--expect-types', 'examples/expected-types.json'];
  const exampleRun = async (extra) => {
    const out = sink(); const err = sink();
    const cwd = process.cwd(); process.chdir(ROOT);
    try {
      /* The network is not reached: a request that is not answered from the file would throw here. */
      const code = await CLI.main(EXAMPLE.concat(extra), { get: async (u) => { throw new Error('network: ' + u); }, stdout: out, stderr: err, env: {} });
      return { code, out: out.text, err: err.text };
    } finally { process.chdir(cwd); }
  };
  r = await exampleRun([]);
  ok('the example runs without the network and writes examples/report.md as it is, exit 0', r.code === 0 && r.out === read('examples/report.md') && r.err === '', r.err);
  ok('the example shows type-unexpected, and nothing else', /\(`type-unexpected`\) \| registered as Dataset, expected Software \|/.test(r.out)
    && [...r.out.matchAll(/\(`([a-z-]+)`\)/g)].map((m) => m[1]).join() === 'type-unexpected');
  r = await exampleRun(['--fail-on', 'warning']);
  ok('the example fails once warnings count, exit 1', r.code === 1);
  const exReadme = read('examples/README.md');
  const exCmd = 'node bin/deposit-check.js ' + EXAMPLE.join(' ');
  ok('examples/README.md gives the two commands that these checks run, and the action runs them too',
    exReadme.includes('\n' + exCmd + '\n') && exReadme.includes('\n' + exCmd + ' --fail-on warning\n') && readme.includes('[`examples/`](examples/)')
    && /uses: \.\/\n\s+with:\n\s+expect-types: examples\/expected-types\.json\n\s+answers: examples\/answers\.json\n\s+- name/.test(wf('check.yml'))
    && /continue-on-error: true\n\s+uses: \.\/\n\s+with:\n\s+expect-types: examples\/expected-types\.json\n\s+answers: examples\/answers\.json\n\s+fail-on: warning\n/.test(wf('check.yml'))
    && wf('check.yml').includes("if: steps.warnings.outcome != 'failure'\n        run: exit 1"));
  ok('the example is made up: the DataCite test prefix, and ORCID’s fictitious researcher', Object.keys(fixtureAt('examples/answers.json')).filter((k) => !k.startsWith('_'))
    .every((k) => /10\.5072(%2F|\/)example\.\d$/.test(k)) && JSON.stringify(fixtureAt('examples/answers.json')).includes(OWNER));

  /* ------------------------------------------------------------ 12 */
  console.log('\n12. Breaking a complete record');
  /* A complete record gives nothing. Each break changes one thing, and must raise its rule and no other.
   * If a break raised nothing, the rule would be looking at nothing. */
  const other = { name: 'A. N. Other', person: true, orcid: null };
  const BREAKS = [
    ['abstract-missing', { abstract: '' }],
    ['abstract-short', { abstract: 'Short.' }],
    ['licence-missing', { rights: [] }],
    ['licence-unreadable', { rights: [{ text: 'All rights reserved', uri: '', id: '', licence: null }] }],
    ['owner-orcid-missing', { creators: [Object.assign({}, d101.creators[0], { orcid: '0000-0001-5109-3700' })] }],
    ['creators-orcid-missing', { creators: [d101.creators[0], other] }],
    ['type-generic', { type: { general: 'Other', specific: '' } }],
    ['type-unexpected', {}, { '10.5072/zenodo.101': 'Software' }],
    ['date-missing', { date: null }],
    ['keywords-missing', { keywords: [] }],
    ['language-missing', { language: '' }],
    ['version-unlinked', { relations: [{ type: 'References', id: '10.1/x', idType: 'DOI' }] }],
    ['relations-none', { relations: [], version: '' }],
    ['identical-unlinked', {}, null, { '10.5072/zenodo.101': ['10.5555/crossref.300'] }],
    ['openalex-missing', { openalex: { held: false, abstract: false } }],
    ['openalex-abstract-missing', { openalex: { held: true, abstract: false } }],
  ];
  const complete = Object.assign({}, d101, { openalex: { held: true, abstract: true } });
  const raised = (rec, expected, identical) => R.audit({ owner: OWNER, works: [], found: new Set(), records: new Map([[rec.doi, rec]]),
    expected: expected ? new Map(Object.entries(expected)) : null, identical: identical ? new Map(Object.entries(identical)) : null }).map((f) => f.rule);
  ok('the complete record, held by OpenAlex with its abstract, gives nothing', raised(complete).length === 0, raised(complete).join());
  for (const [id, patch, expected, identical] of BREAKS) {
    const got = raised(Object.assign({}, complete, patch), expected, identical);
    ok('break for ' + id + ': raises it and no other', got.join() === id, got.join() || 'nothing');
  }
  const recordRules = R.RULES.filter((x) => x.scope === 'record').map((x) => x.id);
  ok('there is one break for each rule that reads a single record, in the order of the rules', BREAKS.map((b) => b[0]).join() === recordRules.join());
  const said = /The checks break a complete record in (\d+) ways, one for each rule that reads a single record/.exec(readme);
  ok('the number of breaks the README gives is the number of breaks (' + BREAKS.length + ')', said !== null && Number(said[1]) === BREAKS.length, said ? 'README ' + said[1] : 'not found in the README');

  /* ------------------------------------------------------------ 13 */
  console.log('\n13. What the README says of the repository');
  const runtime = ['bin', 'src', 'scripts'].flatMap((d) => fs.readdirSync(path.join(ROOT, d)).filter((f) => f.endsWith('.js')).map((f) => d + '/' + f));
  const builtin = new Set(require('module').builtinModules);
  const loaded = runtime.flatMap((f) => [...read(f).matchAll(/\brequire\(\s*['"]([^'"]+)['"]\s*\)|\bimport\s*\(\s*['"]([^'"]+)['"]|\bfrom\s+['"]([^'"]+)['"]/g)].map((m) => [f, m[1] || m[2] || m[3]]));
  const outside = loaded.filter(([, m]) => !m.startsWith('./') && !m.startsWith('../') && !builtin.has(m.replace(/^node:/, '')));
  ok('the tool loads only modules of Node.js and its own files, as the README says', loaded.length > 0 && outside.length === 0
    && readme.includes('the tool uses only the standard library of Node.js'), outside.map((x) => x.join(': ')).join(', '));
  /* 2026-11-25: JOSS's review checklist asks whether installation proceeds as documented. The tool is not on the npm
   * registry; on 2026-11-25 `npm install -g github:cpsbvbng26-dotcom/deposit-check` and `npx github:…` were run and gave the
   * command. Here, offline: the README gives the three ways, package.json names the command and the checks as its test, and
   * the files npm packs hold every file the command loads, followed from bin/deposit-check.js. Broken copies must fail. */
  const closure = (start) => {
    const seen = new Set();
    const walk = (f) => {
      if (seen.has(f)) return;
      seen.add(f);
      for (const m of read(f).matchAll(/\brequire\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g)) walk(path.posix.normalize(path.posix.join(path.posix.dirname(f), m[1])).replace(/^(?!.*\.js$)(.*)$/, '$1.js'));
    };
    walk(start);
    return [...seen];
  };
  const installProblems = (man, rd, binText) => {
    const bad = [];
    const bin = (man.bin || {})['deposit-check'];
    if (bin !== 'bin/deposit-check.js' || !binText.startsWith('#!/usr/bin/env node\n')) bad.push('the command');
    if ((man.scripts || {}).test !== 'node verification/check.js') bad.push('npm test');
    const packed = man.files || [];
    const missing = closure('bin/deposit-check.js').filter((f) => !packed.some((x) => f === x || f.startsWith(x.replace(/\/$/, '') + '/')));
    if (missing.length) bad.push('not packed: ' + missing.join(', '));
    for (const c of ['npm install -g github:cpsbvbng26-dotcom/deposit-check\n', 'npx github:cpsbvbng26-dotcom/deposit-check --help\n', 'git clone https://github.com/cpsbvbng26-dotcom/deposit-check && cd deposit-check && node bin/deposit-check.js --help\n', 'In a clone, `npm test` runs the checks']) if (!rd.includes(c)) bad.push('the README: ' + c.slice(0, 30));
    return bad;
  };
  const binText = read('bin/deposit-check.js');
  const pkgJson = JSON.parse(read('package.json'));
  const ip = installProblems(pkgJson, readme, binText);
  ok('installation: the README gives npm from GitHub, npx and a clone; package.json names the command and npm test; npm packs every file the command loads (' + closure('bin/deposit-check.js').length + ')', ip.length === 0, ip.join('; '));
  const ipBroken = [
    installProblems(Object.assign({}, pkgJson, { files: pkgJson.files.filter((x) => x !== 'src') }), readme, binText),
    installProblems(Object.assign({}, pkgJson, { bin: { 'deposit-check': 'bin/other.js' } }), readme, binText),
    installProblems(Object.assign({}, pkgJson, { scripts: {} }), readme, binText),
    installProblems(pkgJson, readme.replace('npm install -g github:cpsbvbng26-dotcom/deposit-check\n', 'npm install -g deposit-check\n'), binText),
    installProblems(pkgJson, readme, binText.replace('#!/usr/bin/env node\n', '')),
  ];
  ok('break on purpose: src/ left out of the package, another command file, no npm test, an install from the registry, no shebang (' + ipBroken.filter((b) => b.length).length + ' / ' + ipBroken.length + ')', ipBroken.every((b) => b.length > 0));
  /* The fields of the JSON report, as the README lists them, are those that the report writes. */
  const jsonRep = JSON.parse(REP.json({ owner: OWNER, works: [], records: new Map(), failed: [] }, [{ rule: 'abstract-missing', severity: 'error', doi: '10.5072/x', detail: 'd' }]));
  const jsonOk = (rd) => {
    const s = (rd.split('### The JSON report\n')[1] || '').split('\n## ')[0];
    const rows = [...s.matchAll(/^\| `([a-z]+)` \|/gm)].map((m) => m[1]);
    return rows.join() === Object.keys(jsonRep).join() && s.includes('`{ ' + Object.keys(jsonRep.findings[0]).join(', ') + ' }`')
      && s.includes('`{ doi, error }`') && s.includes('`' + R.SEVERITIES.join('`, `') + '`');
  };
  ok('the README lists the fields of the JSON report, in order, and the fields of a finding; a row taken out or a field renamed fails',
    jsonOk(readme) && !jsonOk(readme.replace(/\n\| `failed` \|[^\n]*/, '')) && !jsonOk(readme.replace('`{ rule, severity, doi, detail }`', '`{ rule, doi, detail }`')));
  ok('the README gives the type and the status of the catalogue, in both languages, under the title; CITATION.cff says software',
    readme.startsWith('# deposit-check\n\n種類：ソフトウェア　状態：改訂中\n\nType: Software · Status: In revision\n\n') && /^type: software$/m.test(cff));
  const changes = [...read('CHANGELOG.md').matchAll(/^## (\d+\.\d+\.\d+) \((\d{4}-\d{2}-\d{2})\)$/gm)].map((m) => [m[1], m[2]]);
  const relRows = [...readme.matchAll(/^\| (\d+\.\d+\.\d+) \| \[([^\]]+)\]\(https:\/\/doi\.org\/([^)]+)\) \| (\d{4}-\d{2}-\d{2}) \| \[([^\]]+)\]\(CHANGELOG\.md#([^)]+)\) \|$/gm)];
  const cffVersions = [...cff.matchAll(/value: "([^"]+)"\n\s+description: "Version (\d+\.\d+\.\d+)"/g)].map((m) => [m[2], m[1]]);
  const concept = /^\| Every version \| \[([^\]]+)\]\(https:\/\/doi\.org\/([^)]+)\) \| \| Resolves to the latest version \|$/m.exec(readme);
  ok('the table of releases has a row for each version in CHANGELOG.md, with its date and the DOI that CITATION.cff gives, and the DOI of every version',
    changes.length > 0 && relRows.length === changes.length
    && relRows.every((m, i) => m[1] === changes[i][0] && m[4] === changes[i][1] && m[2] === m[3] && m[5] === m[1]
      && m[6] === m[1].replace(/\./g, '') + '-' + m[4] && cffVersions.some(([v, d]) => v === m[1] && d === m[2]))
    && concept !== null && concept[1] === concept[2] && cff.includes('doi: "' + concept[1] + '"'),
    relRows.length + ' rows / ' + changes.length + ' versions');
  const inputs = [...action.matchAll(/^  ([a-z-]+):\n    description:/gm)].map((m) => m[1]);
  const options = new Set([...CLI.USAGE.matchAll(/^  --([a-z-]+)/gm)].map((m) => m[1]));
  const listed = /^The inputs are (.+)\.$/m.exec(readme);
  ok('each input of the action is an option of the command or the contact address, and the README lists them all',
    inputs.length > 0 && inputs.every((i) => options.has(i === 'dois' ? 'doi' : i) || i === 'mailto')
    && listed !== null && [...listed[1].matchAll(/`([a-z-]+)`/g)].map((m) => m[1]).sort().join() === inputs.slice().sort().join()
    && inputs.every((i) => action.includes('${{ inputs.' + i + ' }}')), inputs.join(', '));
  const bug = read('.github/ISSUE_TEMPLATE/bug_report.yml');
  const required = [...bug.matchAll(/^  - type: (textarea|input)\n    id: ([a-z-]+)\n[\s\S]*?\n    validations:\n      required: (true|false)$/gm)].filter((m) => m[3] === 'true').map((m) => m[2]);
  ok('the bug report form requires what happened, what was expected, the steps to reproduce, the version and the environment',
    ['what', 'expected', 'steps', 'version', 'environment'].every((id) => required.includes(id)) && contributing.includes('.github/ISSUE_TEMPLATE/bug_report.yml'), required.join(', '));

  /* ------------------------------------------------------------ 14 */
  console.log('\n14. Dependencies, workflows and secrets');
  const manifest = JSON.parse(read('package.json'));
  ok('package.json declares no dependencies of any kind',
    ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'].every((k) => !manifest[k] || Object.keys(manifest[k]).length === 0));
  const tracked = require('child_process').execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' }).split('\0').filter((f) => f && fs.existsSync(path.join(ROOT, f)));
  const workflows = tracked.filter((f) => /^\.github\/workflows\/.+\.ya?ml$/.test(f));
  const installs = workflows.concat(['action.yml']).flatMap((f) => [...read(f).matchAll(/\b(?:npm|pip3?)\s+install\b[^\n]*/g)].map((m) => f + ': ' + m[0]));
  ok('no workflow and no action installs a package', installs.length === 0, installs.join(', '));
  const noTop = workflows.filter((f) => !/^permissions:/m.test(read(f)));
  ok('every workflow sets permissions at the top level', workflows.length > 0 && noTop.length === 0, noTop.join(', '));
  /* The only write is the issue of the monthly run, in run.yml. Any other write fails here. */
  const writes = workflows.flatMap((f) => [...read(f).matchAll(/^\s+([a-z-]+):\s*write\b/gm)].map((m) => path.basename(f) + ':' + m[1]));
  /* 2026-11-14: the checked intake (checked-intake.yml, the same file in the 13 repositories) labels issues and comments on them (from 2026-11-15 it closes none), so it writes to issues too. */
  /* 2026-11-19: the answer to an issue opened with an empty body (empty-issue.yml, the same file in 15 repositories) labels the issue and comments once, so it writes to issues too, and to nothing else. */
  ok('the only write permission is issues: write, given to the job in run.yml, to the checked intake and to the answer to an issue with an empty body', writes.sort().join() === 'checked-intake.yml:issues,empty-issue.yml:issues,run.yml:issues'
    && /^permissions:\n  contents: read\n/m.test(read('.github/workflows/run.yml')), writes.join(', '));
  const uses = workflows.concat(['action.yml']).flatMap((f) => [...read(f).matchAll(/^\s*(?:-\s+)?uses:\s*(\S+)(.*)$/gm)].map((m) => [f, m[1], m[2]])).filter(([, u]) => !u.startsWith('./'));
  const loose = uses.filter(([, u, rest]) => !/^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/.test(u) || !/^\s+#\s*\S+/.test(rest));
  ok('every action from outside is pinned to a full commit SHA, with its tag in a comment (' + uses.length + ')', uses.length > 0 && loose.length === 0, loose.map((x) => x[0] + ' ' + x[1]).join(', '));
  ok('the checks also run once a week', /^\s+schedule:\s*\n\s+- cron:/m.test(read('.github/workflows/check.yml')) && read('.github/workflows/check.yml').includes('node verification/check.js'));
  /* The shapes are cut in two, so that this file does not match itself. */
  const SECRET = [new RegExp('-----BEGIN ' + '[A-Z ]*PRIVATE KEY' + '-----'), new RegExp('\\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github' + '_pat_[A-Za-z0-9_]{22,})'),
    new RegExp('\\bAKI' + 'A[0-9A-Z]{16}\\b'), new RegExp('\\bxox' + '[abprs]-[A-Za-z0-9-]{10,}'), new RegExp('\\bAIz' + 'a[0-9A-Za-z_-]{35}\\b'), new RegExp('\\bsk-(?:an' + 't-)?[A-Za-z0-9_-]{32,}')];
  const MAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
  const ALLOWED = new Set(['noreply@anthropic.com', 'you@example.com']);
  const secrets = [], mails = [];
  for (const f of tracked) {
    const buf = fs.readFileSync(path.join(ROOT, f));
    if (buf.subarray(0, 8192).includes(0)) continue;
    const text = buf.toString('utf8');
    if (SECRET.some((re) => re.test(text))) secrets.push(f);
    for (const m of text.match(MAIL) || []) if (!ALLOWED.has(m) && !m.endsWith('@users.noreply.github.com')) mails.push(f + ' ' + m);
  }
  ok('no tracked file holds a private key or a token (' + tracked.length + ' files)', secrets.length === 0, secrets.join(', '));
  ok('no tracked file holds an e-mail address other than the allowed ones', mails.length === 0, mails.slice(0, 10).join(', '));

  /* ------------------------------------------------------------ 15 */
  console.log('\n15. Copies of the same text');
  const ide = M.expectedIdentical({ _: 'a comment', '10.5072/Zenodo.101': 'https://doi.org/10.5555/CROSSREF.300', '10.5072/zenodo.400': ['10.5555/crossref.300', 'https://PhilArchive.org/rec/EXAMPLE/'] });
  ok('a file of copies is read: comments are skipped, a copy is one DOI or a list, DOIs are lower-cased, URLs lose their scheme and case',
    ide.size === 2 && ide.get('10.5072/zenodo.101').join() === '10.5555/crossref.300' && ide.get('10.5072/zenodo.400').join() === '10.5555/crossref.300,philarchive.org/rec/example');
  const refusedI = (j) => { try { M.expectedIdentical(j); return false; } catch (e) { return true; } };
  ok('a key that is not a DOI, no copy, a copy that is neither a DOI nor a URL, a DOI as its own copy, an empty file and a list are refused',
    refusedI({ 'zenodo.101': '10.5555/crossref.300' }) && refusedI({ '10.5072/zenodo.101': [] }) && refusedI({ '10.5072/zenodo.101': 'SSRN 300' })
    && refusedI({ '10.5072/zenodo.101': 3 }) && refusedI({ '10.5072/zenodo.101': '10.5072/ZENODO.101' }) && refusedI({ _: 'only a comment' }) && refusedI([])
    && !refusedI({ '10.5072/zenodo.101': '10.5555/crossref.300' }));
  const copies = (recs, identical) => R.audit({ owner: null, works: [], found: new Set(), records: new Map(recs.map((x) => [x.doi, x])), identical: new Map(Object.entries(identical)) })
    .filter((f) => f.rule === 'identical-unlinked').map((f) => f.doi + ' ' + f.detail);
  const pair = { '10.5072/zenodo.101': ['10.5555/crossref.300'] };
  const withRel = (rec, rel) => Object.assign({}, rec, { relations: rec.relations.concat([rel]) });
  ok('identical-unlinked: neither record names the other', copies([d101, c300], pair).join() === '10.5072/zenodo.101 not linked to 10.5555/crossref.300', copies([d101, c300], pair).join());
  ok('identical-unlinked: not raised when this record names the copy with IsIdenticalTo, given as a doi.org URL in another case',
    copies([withRel(d101, { type: 'IsIdenticalTo', id: 'https://doi.org/10.5555/CROSSREF.300', idType: 'URL' }), c300], pair).length === 0);
  ok('identical-unlinked: not raised when the copy names this record, or the record of all its versions',
    copies([d101, withRel(c300, { type: 'IsIdenticalTo', id: '10.5072/zenodo.100', idType: 'DOI' })], pair).length === 0
    && copies([d101, withRel(c300, { type: 'IsIdenticalTo', id: '10.5072/zenodo.101', idType: 'DOI' })], pair).length === 0);
  ok('identical-unlinked: a link of another type does not count, and the detail says which type it is',
    copies([withRel(d101, { type: 'IsVariantFormOf', id: '10.5555/crossref.300', idType: 'DOI' })], pair).join() === '10.5072/zenodo.101 not linked to 10.5555/crossref.300 (linked as IsVariantFormOf only)');
  ok('identical-unlinked: a copy given as a URL is compared without its scheme, case or trailing slash',
    copies([withRel(d101, { type: 'IsIdenticalTo', id: 'https://philarchive.org/rec/EXAMPLE', idType: 'URL' })], { '10.5072/zenodo.101': ['philarchive.org/rec/example'] }).length === 0
    && copies([d101], { '10.5072/zenodo.101': ['philarchive.org/rec/example'] }).join() === '10.5072/zenodo.101 not linked to philarchive.org/rec/example');
  /* A new version must keep the link: copies given for an older version hold for the version that is checked. */
  const v1 = Object.assign({}, d101, { doi: '10.5072/zenodo.99', version: 'v1', relations: [{ type: 'IsVersionOf', id: '10.5072/zenodo.100', idType: 'DOI' }, { type: 'IsIdenticalTo', id: '10.5555/crossref.300', idType: 'DOI' }] });
  ok('identical-unlinked: copies given for an older version are checked on the latest one, which lost the link',
    copies([v1, d101], { '10.5072/zenodo.99': ['10.5555/crossref.300'] }).join() === '10.5072/zenodo.101 not linked to 10.5555/crossref.300'
    && copies([v1, withRel(d101, { type: 'IsIdenticalTo', id: '10.5555/crossref.300', idType: 'DOI' })], { '10.5072/zenodo.99': ['10.5555/crossref.300'] }).length === 0);
  ok('identical-unlinked is not raised without a file of copies', R.audit({ owner: null, works: [], found: new Set(), records: new Map([[d101.doi, d101]]) }).every((f) => f.rule !== 'identical-unlinked'));
  const tmpCopies = path.join(require('os').tmpdir(), 'deposit-check-copies-' + process.pid + '.json');
  fs.writeFileSync(tmpCopies, JSON.stringify(pair));
  const copyUrls = [];
  {
    const out = sink(); const err = sink();
    const code = await CLI.main(['--expect-identical', tmpCopies, '--format', 'json'], { get: stubGet(copyUrls), stdout: out, stderr: err, env: {} });
    const got = JSON.parse(out.text);
    ok('--expect-identical alone: the DOI and its copy are both read, and the missing link is a warning', code === 0 && got.read === 2
      && got.findings.filter((f) => f.rule === 'identical-unlinked').map((f) => f.severity + ' ' + f.doi).join() === 'warning 10.5072/zenodo.101'
      && copyUrls.includes('https://api.crossref.org/works/10.5555%2Fcrossref.300'), out.text.slice(0, 200));
  }
  fs.writeFileSync(tmpCopies, JSON.stringify({ '10.5072/zenodo.101': 'SSRN 300' }));
  r = await run(['--expect-identical', tmpCopies]);
  ok('a file of copies that cannot be read: exit 2, before any request', r.code === 2 && r.out === '' && r.err.includes('not a DOI or a URL'));
  fs.rmSync(tmpCopies, { force: true });
  ok('the README gives --expect-identical, and says that one side of the link is enough',
    readme.includes('| `--expect-identical <file>` |') && readme.includes('One side is enough') && action.includes('EXPECT_IDENTICAL: ${{ inputs.expect-identical }}'));

  /* ------------------------------------------------------------ 16 */
  console.log('\n16. The catalogue in the monthly run');
  const CI = require('../scripts/catalog-inputs.js');
  const cat = CI.inputs(fixture('catalog.json'));
  ok('every DOI of the catalogue, each once: the DOI of each work, of all its versions, and its other DOIs; a work without a DOI is passed over',
    cat.dois.join() === '10.5072/zenodo.100,10.5072/zenodo.101,10.5072/zenodo.400,10.5555/crossref.300', cat.dois.join());
  ok('the expected types are the types the catalogue gives, and only those it gives', JSON.stringify(Object.entries(cat.types).filter(([k]) => !k.startsWith('_')))
    === '[["10.5072/zenodo.101","Preprint"],["10.5072/zenodo.400","Preprint"]]' && M.expectedTypes(cat.types).size === 2);
  ok('the copies are the other DOIs the catalogue gives, and the command reads them', JSON.stringify(Object.entries(cat.identical).filter(([k]) => !k.startsWith('_')))
    === '[["10.5072/zenodo.400",["10.5555/crossref.300"]]]' && M.expectedIdentical(cat.identical).get('10.5072/zenodo.400').join() === '10.5555/crossref.300');
  const noCopies = JSON.parse(JSON.stringify(fixture('catalog.json')));
  noCopies.works.forEach((w) => { w.otherDois = []; });
  ok('a catalogue with no other DOIs gives no file of copies, rather than an empty one the command would refuse', CI.inputs(noCopies).identical === null);
  const refusedC = (j) => { try { CI.inputs(j); return false; } catch (e) { return true; } };
  const broken = (patch) => { const j = JSON.parse(JSON.stringify(fixture('catalog.json'))); Object.assign(j.works[1], patch); return j; };
  ok('a catalogue that is not one, a DOI that is not a DOI, a type of two words, and a copy without the DOI of its work stop the run',
    refusedC({}) && refusedC({ works: [] }) && refusedC(broken({ doi: 'zenodo.400' })) && refusedC(broken({ otherDois: ['SSRN 300'] }))
    && refusedC(broken({ resourceType: 'Journal article' })) && refusedC(broken({ doi: null })) && !refusedC(fixture('catalog.json')));
  const runW = wf('run.yml');
  ok('the monthly run reads catalog.json of cpsbvbng26-dotcom from GitHub, that one file only, with no credentials left behind',
    /- uses: actions\/checkout@[0-9a-f]{40} # \S+\n\s+with:\n\s+repository: cpsbvbng26-dotcom\/cpsbvbng26-dotcom\n\s+ref: main\n\s+path: catalogue\n\s+sparse-checkout: catalog\.json\n\s+sparse-checkout-cone-mode: false\n\s+persist-credentials: false\n/.test(runW)
    && runW.includes('node scripts/catalog-inputs.js catalogue/catalog.json inputs'));
  ok('the monthly run passes the DOIs, the types and the copies of the catalogue, for the author’s iD only',
    /if \[ "\$iD" = "\$OWNER_ORCID" \]; then\n\s+args\+=\(--doi "\$\(cat inputs\/dois\.txt\)"\)\n\s+if \[ -f inputs\/expected-types\.json \]; then args\+=\(--expect-types inputs\/expected-types\.json\); fi\n\s+if \[ -f inputs\/expected-identical\.json \]; then args\+=\(--expect-identical inputs\/expected-identical\.json\); fi\n\s+fi\n/.test(runW));
  ok('the report is kept as an artifact of the run, before the issue is written', /- uses: actions\/upload-artifact@[0-9a-f]{40} # \S+\n\s+with:\n\s+name: deposit-check-report\n\s+path: \|\n\s+report\.md\n\s+report\.json\n/.test(runW)
    && runW.indexOf('actions/upload-artifact@') < runW.indexOf('node scripts/weekly-issue.js'));
  /* A scheduled run never commits: it has no write to contents, and no workflow runs git commit or git push. */
  const commits = workflows.concat(['action.yml']).filter((f) => /\bgit\s+(-C\s+\S+\s+)?(commit|push)\b|contents:\s*write/.test(read(f)));
  ok('no workflow commits or pushes: the runs write to no branch', commits.length === 0, commits.join(', '));
  ok('every checkout leaves no credentials behind', workflows.every((f) => [...read(f).matchAll(/uses: actions\/checkout@\S+[^\n]*\n(\s+with:\n((?:\s{10}\S[^\n]*\n)*))?/g)].every((m) => /persist-credentials: false/.test(m[2] || ''))));
  ok('the README says the monthly run reads the catalogue and keeps the report as an artifact', readme.includes('every DOI in the catalogue of the author’s works') && readme.includes('artifact'));

  /* GitHub's Terms of Service bring in the GitHub Additional Product Terms (section I), whose section on Actions limits the use
   * of GitHub-hosted runners to the production, testing, deployment or publication of the project. Every workflow has a row
   * in the eighth section of the legal audit, judged against it, and the run against the live APIs is a monthly test. */
  console.log('\n17. The workflows and GitHub\'s terms for Actions (2026-11-13)');
  const EIGHTH = '\n## 2026-11-12 の続き：八度目の見落とし\n';
  const PURPOSE = 'If using GitHub-hosted runners, any other activity unrelated to the production, testing, deployment, or publication of the software project associated with the repository where GitHub Actions are used.';
  const wfProblems = (text, names, run) => {
    const bad = [];
    const i = text.indexOf(EIGHTH);
    if (i < 0) return ['no eighth section in the audit'];
    const j = text.indexOf('\n## ', i + EIGHTH.length);
    const sec = text.slice(i, j < 0 ? text.length : j);
    const rows = sec.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| Place |') && !l.startsWith('| --- |')).map((l) => l.slice(2, -2).split(' | '));
    for (const r of rows) {
      if (r.length !== 6 || !['Error', 'Insufficient basis', 'Omission', 'Wording', 'No problem'].includes(r[4])) bad.push('the shape of a row: ' + r[0].slice(0, 30));
      else if (r[4] !== 'No problem' && !r[5].includes('Claude decided this on 2026-11-13')) bad.push('a decision without its maker: ' + r[0].slice(0, 30));
    }
    const named = rows.map((r) => (/^`\.github\/workflows\/([^`]+)`/.exec(r[0]) || [])[1]).filter(Boolean);
    names.filter((n) => !named.includes(n)).forEach((n) => bad.push('no row for ' + n));
    named.filter((n) => !names.includes(n)).forEach((n) => bad.push('a row for a missing workflow: ' + n));
    if (!sec.includes('“' + PURPOSE + '”')) bad.push('the section on Actions is not quoted');
    const crons = [...run.matchAll(/cron: '([^']+)'/g)].map((m) => m[1].split(' '));
    if (crons.length !== 1 || crons[0][2] === '*' || crons[0][4] !== '*') bad.push('run.yml is scheduled more often than once a month');
    return bad;
  };
  const auditText = read('docs/legal-audit-2026-11-12.md');
  const wfNames = fs.readdirSync(path.join(ROOT, '.github', 'workflows')).filter((f) => /\.ya?ml$/.test(f)).sort();
  const runText = wf('run.yml');
  const wp = wfProblems(auditText, wfNames, runText);
  ok('every workflow (' + wfNames.length + ') has a row in the eighth section of the legal audit, judged against GitHub\'s terms for Actions, and the run against the live APIs is at most monthly', wp.length === 0, wp.join(', '));
  const wpBroken = [
    wfProblems(auditText, wfNames.concat(['newsletter.yml']), runText),
    wfProblems(auditText, wfNames.slice(1), runText),
    wfProblems(auditText.replace(/\n\| `\.github\/workflows\/check\.yml`[^\n]*/, ''), wfNames, runText),
    wfProblems(auditText.replace('publication of the software project', 'promotion of the software project'), wfNames, runText),
    wfProblems(auditText, wfNames, runText.replace("cron: '23 5 9 * *'", "cron: '23 5 * * 2'")),
    wfProblems(auditText.replace(EIGHTH, '\n## Eighth\n'), wfNames, runText),
  ];
  ok('break on purpose: a new workflow, a removed one, a dropped row, a word of the quotation, a weekly run again, the heading (' + wpBroken.filter((b) => b.length).length + ' / ' + wpBroken.length + ')', wpBroken.every((b) => b.length > 0));

  console.log('\n18. The bug report form asks for your own DOI or iD, never someone else\'s (2026-11-13)');
  /* The sixteenth read-only pass found that the form asked for the DOIs or the ORCID iD the tool was run on, and for its
   * output pasted as it is, and said that a DOI may be named because its metadata is public. The metadata of a DOI names its
   * authors, and the output lists what is missing or wrong in their records. Claude decided on 2026-11-13: the form asks for
   * a reproduction on the reporter's own DOI or iD, and, for someone else's record, a description without its DOI or iD and
   * without the tool's findings about it. The example names no real DOI or iD. */
  const SIXTEENTH = '\n## 2026-11-13：十六度目の見落とし\n';
  const OWN = 'Show the problem on your own DOI or ORCID iD where you can: name it, and paste what the tool printed.';
  const OTHER = "If the record that shows the problem belongs to someone else, describe the problem (the rule, the field and what was expected) without naming its DOI or iD, and without pasting what the tool found about that person's record.";
  const OWN_C = "Show it on a DOI of your own work, if you can. If the deposit is someone else's, describe the problem without naming its DOI, and without pasting what the tool found about it.";
  const formProblems = (form, contrib, audit) => {
    const bad = [];
    if (!form.includes(OWN) || !form.includes(OTHER)) bad.push('the form does not limit a reproduction to your own DOI or iD');
    if (!/Paste the output as it is only if the run was on your own DOI or iD; otherwise describe it\./.test(form)) bad.push('the output field asks for any output');
    if (!/Name the DOIs or the ORCID iD it was run on only if they are your own\./.test(form)) bad.push('the steps field asks for any DOI or iD');
    if (/\b10\.\d{4,9}\/[^\s<>]+|\b\d{4}-\d{4}-\d{4}-\d{3}[\dX]\b/.test(form)) bad.push('the form holds a DOI or an iD of real shape');
    if (/helps most|so it can be named here|Give a DOI that shows it/.test(form + contrib)) bad.push('an invitation to name a DOI is back');
    if (!contrib.includes(OWN_C)) bad.push('CONTRIBUTING.md does not limit the DOI to your own work');
    const i = audit.indexOf(SIXTEENTH);
    const j = i < 0 ? -1 : audit.indexOf('\n## ', i + SIXTEENTH.length);
    const sec = i < 0 ? '' : audit.slice(i, j < 0 ? audit.length : j);
    if (!sec || audit.indexOf('\n## Laws checked\n') < i) bad.push('no sixteenth section before the laws checked');
    const rows = sec.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| Place |') && !l.startsWith('| --- |')).map((l) => l.slice(2, -2).split(' | '));
    if (rows.length < 3 || rows.some((r) => r.length !== 6 || !['Error', 'Insufficient basis', 'Omission', 'Wording', 'No problem'].includes(r[4]))) bad.push('the shape of the sixteenth table');
    const kinds = ['Error', 'Insufficient basis', 'Omission', 'Wording', 'No problem'];
    const m = /Findings in this table: ([^.]+)\./.exec(sec);
    const said = m ? Object.fromEntries(m[1].split(', ').map((x) => { const k = x.replace(/ \d+$/, ''); return [k, Number(x.slice(k.length + 1))]; })) : {};
    if (!m || !kinds.every((k) => (said[k] || 0) === rows.filter((r) => r[4] === k).length)) bad.push('the count of findings');
    if (rows.some((r) => r[4] !== 'No problem' && !r[5].includes('Claude decided this on 2026-11-13 (2026-11-13 に Claude が決めました)'))) bad.push('a decision without its maker');
    if (!sec.includes('No lawyer has reviewed this section.')) bad.push('the sentence on the lawyer');
    return bad;
  };
  const formText = read('.github/ISSUE_TEMPLATE/bug_report.yml');
  const fp = formProblems(formText, contributing, auditText);
  ok('the bug report form asks for a reproduction on your own DOI or iD, and for someone else\'s record a description without its DOI or iD or the findings about it; CONTRIBUTING.md says the same; the sixteenth section of the audit is complete', fp.length === 0, fp.join(', '));
  const fpBroken = [
    formProblems(formText.replace(OWN, 'A DOI that shows the problem helps most. The metadata of a DOI is public, so it can be named here.'), contributing, auditText),
    formProblems(formText.replace(OTHER, ''), contributing, auditText),
    formProblems(formText.replace(' only if the run was on your own DOI or iD; otherwise describe it.', '.'), contributing, auditText),
    formProblems(formText.replace('. Name the DOIs or the ORCID iD it was run on only if they are your own.', ', and the DOIs or the ORCID iD it was run on.'), contributing, auditText),
    formProblems(formText.replace('<your own DOI>', '10.' + '5281/zen' + 'odo.1234567'), contributing, auditText),
    formProblems(formText.replace('<your own DOI>', '--orcid 0000-0002-1825-0097'), contributing, auditText),
    formProblems(formText, contributing.replace(OWN_C, 'Give a DOI that shows it, if you can.'), auditText),
    formProblems(formText, contributing, auditText.replace(SIXTEENTH, '\n## Sixteenth\n')),
    formProblems(formText, contributing, auditText.replace(/(## 2026-11-13：十六度目の見落とし[\s\S]*?Findings in this table: [^.]*?)(\d+)\./, (_, a, n) => a + (Number(n) + 1) + '.')),
    formProblems(formText, contributing, auditText.replace(/(## 2026-11-13：十六度目の見落とし[\s\S]*?)No lawyer has reviewed this section\./, '$1')),
  ];
  ok('break on purpose: the old invitation, the sentence for someone else\'s record, the output field, the steps field, a DOI or an iD in the example, the old line of CONTRIBUTING.md, the heading, the count, the lawyer (' + fpBroken.filter((b) => b.length).length + ' / ' + fpBroken.length + ')', fpBroken.every((b) => b.length > 0));

  console.log('\n2026-11-15. What could not be checked, the time limits, and the record');
  {
    const W = require('../scripts/weekly-issue.js');
    const F = require('../src/fetch.js');
    const rep = (o) => Object.assign({ counts: { error: 0, warning: 0, info: 0 }, findings: [], failed: [] }, o);
    const down = rep({ failed: [{ doi: '10.5072/x.1', error: 'HTTP 503' }] });
    const closeAll = W.plan({ number: 7, body: W.MARK }, rep({}), '#', 'd');
    const stays = W.plan({ number: 7, body: W.MARK }, down, '#', 'd');
    ok('a DOI that could not be read keeps the issue open as "not checked", is named in it, and fails the run; nothing read means close',
      closeAll.kind === 'close' && stays.kind === 'update' && /1 not checked/.test(stays.title) && stays.body.includes('could not be read this time (not checked)') && W.plan(null, down, '#', 'd').kind === 'create' && W.notChecked(down) === 1 && W.notChecked(rep({})) === 0);
    /* The real get: a server error, an answer that is not JSON, and no answer, each an error after the retries; a 404 is null. */
    const answers = (list) => { let k = 0; return async () => list[Math.min(k++, list.length - 1)]; };
    const realFetch = global.fetch;
    const res = (status, text) => ({ status, ok: status >= 200 && status < 300, json: async () => JSON.parse(text) });
    const tryGet = async (a) => { global.fetch = a; try { return await F.httpGet({ wait: async () => {} })('https://api.example.invalid/x'); } catch (e) { return 'error: ' + e.message; } finally { global.fetch = realFetch; } };
    const r503 = await tryGet(answers([res(503, '{}')])), rBad = await tryGet(answers([res(200, '<html>')])), r404 = await tryGet(answers([res(404, '')]));
    const rTime = await tryGet(async () => { const e = new Error('timeout'); e.name = 'TimeoutError'; throw e; });
    ok('a server error, an answer that is not JSON and no answer within a minute are errors, never an empty record; a 404 is "not found"',
      /^error: .*HTTP 503$/.test(r503) && /could not be read$/.test(rBad) && r404 === null && /no answer within a minute$/.test(rTime) && read('src/fetch.js').includes('signal: AbortSignal.timeout(60000)'));
    const wfFiles2 = fs.readdirSync(path.join(ROOT, '.github', 'workflows')).filter((f) => /\.ya?ml$/.test(f));
    const jobsOf = (y) => (y.split(/^jobs:\n/m)[1] || '').split(/\n(?=  [a-z][a-z0-9_-]*:\n)/).filter((b) => /^  [a-z]/.test(b));
    const noLimit = wfFiles2.flatMap((f) => jobsOf(read(path.join('.github', 'workflows', f))).filter((b) => { const m = /\n    timeout-minutes: (\d+)\n/.exec('\n' + b + '\n'); return !m || Number(m[1]) > 60; }).map((b) => f + ' ' + (/^  ([a-z0-9_-]+)/.exec(b) || [])[1]));
    ok('every job of every workflow (' + wfFiles2.length + ') has a time limit of 60 minutes or less', noLimit.length === 0, noLimit.join(', '));
    const aud = read('docs/legal-audit-2026-11-12.md');
    const HEAD = '\n## 2026-11-15：自動化を固める\n';
    const sec = aud.includes(HEAD) ? aud.slice(aud.indexOf(HEAD), aud.indexOf('\n## ', aud.indexOf(HEAD) + 5)) : '';
    const recProblems = (s) => {
      const bad = [];
      const rows = s.split('\n').filter((l) => /^\| (?!---|Place \|)/.test(l)).map((l) => l.replace(/^\| | \|$/g, '').split(' | '));
      const K = ['Error', 'Insufficient basis', 'Omission', 'Wording', 'No problem'];
      if (rows.length < 3 || !rows.every((y) => y.length === 6 && K.includes(y[4]))) bad.push('table');
      const said = ((/Findings in this table: ([^.]+)\./.exec(s) || [])[1] || '');
      if (said !== K.filter((k) => rows.some((y) => y[4] === k)).map((k) => k + ' ' + rows.filter((y) => y[4] === k).length).join(', ')) bad.push('count');
      if (!s.includes('2026-11-15 に利用者が決め、Claude が書きました') || rows.some((y) => !y[5].includes('2026-11-15 に利用者が決め、Claude が書きました'))) bad.push('who decided');
      if (!s.includes('No lawyer has reviewed this section.')) bad.push('lawyer');
      return bad;
    };
    ok('the record has its section 「2026-11-15：自動化を固める」, with its table, count, maker and the sentence on lawyers', sec && recProblems(sec).length === 0, recProblems(sec).join(', '));
    const br = [
      W.plan({ number: 7, body: W.MARK }, down, '#', 'd').kind === 'close',
      recProblems(sec.replace(/Findings in this table: [^.]+\./, 'Findings in this table: Omission 9.')).length === 0,
      recProblems(sec.replace('No lawyer has reviewed this section.', '')).length === 0,
    ];
    ok('break on purpose: a count changed and the lawyer sentence taken out each fail, and a DOI not read never closes the issue', br.every((b) => !b));
  }

  /* ------------------------------------------------------------ 19 */
  console.log('\n19. The plan for JOSS (docs/joss.md, 2026-11-25)');
  {
    /* The four gates before review, each item of the review checklist, and the size of the tool, as Claude judged them on
     * 2026-11-25 from JOSS's docs. The earliest date is six months and one day after the first commit (UTC); the README says
     * the same date in both languages. The lines of each module, and the number of rules, are those of the code. The record
     * gives no task to the user (rule 11). It does not say that the size criterion is met. Broken copies must fail. */
    const FIRST = '2026-11-02';
    const d = new Date(FIRST + 'T00:00:00Z');
    d.setUTCMonth(d.getUTCMonth() + 6);
    d.setUTCDate(d.getUTCDate() + 1);
    const EARLIEST = d.toISOString().slice(0, 10);
    const QUOTES = [
      'The repository must have been public for more than six months prior to submission, with active development spanning that period.',
      'There must be evidence that the software is being used for research — at minimum by the developers themselves, and ideally by others.',
      'Aspirational statements about future use are not sufficient',
      'The development history must show ongoing iteration, not a single burst of commits.',
      '"Minor utility" packages, including "thin" API clients, and single-function packages are not acceptable.',
      'Authors must affirm that human team members thoroughly reviewed, modified, and validated all AI-generated content while making primary architectural and design decisions.',
      'The paper should be between 750-1750 words.',
    ];
    const modules = ['src', 'bin'].flatMap((dir) => fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith('.js')).map((f) => dir + '/' + f)).sort();
    const linesOf = (f) => (read(f).match(/\n/g) || []).length;
    const planProblems = (doc, rd, lines) => {
      const bad = [];
      const gates = ['1 公開の期間', '2 研究に使われている証拠', '3 開かれた開発の実践', '4 反復した開発'];
      const rows = doc.split('\n').filter((l) => /^\| [1-4] /.test(l)).map((l) => l.replace(/^\| | \|$/g, '').split(' | '));
      if (rows.map((r) => r[0]).join() !== gates.join() || !rows.every((r) => r.length === 4)) bad.push('the four gates');
      const g1 = rows[0] || [];
      if (!(g1[2] || '').includes('最初のコミットは ' + FIRST + ' です') || !(g1[3] || '').includes('最短は ' + EARLIEST + ' です。最初のコミットの日から六か月と一日です。')) bad.push('the date of gate 1');
      if (!rd.includes('the first commit here is from ' + FIRST + ', so the earliest date is ' + EARLIEST + '.') || !rd.includes('投稿できるのは最短で ' + EARLIEST + ' です。')) bad.push('the date in the README');
      if (!(rows[3] || [])[3] || !rows[3][3].startsWith('満ちていません。')) bad.push('gate 4 is not met');
      for (const q of QUOTES) if (!doc.includes('`' + q + '`')) bad.push('the quotation: ' + q.slice(0, 30));
      const size = doc.split('\n').filter((l) => /^\| `(src|bin)\/[^`]+` \| \d+ \|/.test(l)).map((l) => /^\| `([^`]+)` \| (\d+) \|/.exec(l));
      const named = size.map((m) => m[1]).sort();
      if (named.join() !== modules.join()) bad.push('the modules of the table: ' + named.join(','));
      for (const m of size) if (lines[m[1]] !== Number(m[2])) bad.push('the lines of ' + m[1] + ': ' + m[2] + ' / ' + lines[m[1]]);
      if (!doc.includes('\n規則は ' + R.RULES.length + ' です。\n')) bad.push('the number of rules');
      const median = /\| `\.github\/workflows\/run\.yml` [^\n]*Median run time (\d+) seconds/.exec(read('docs/legal-audit-2026-11-12.md'));
      if (!median || !doc.includes('その実行の中央値を ' + median[1] + ' 秒としています')) bad.push('the median run time of the record');
      if (!doc.includes('この条件を満たしているとは書きません。\n満たすかどうかは、JOSS が決めます。')) bad.push('the size criterion is not claimed');
      if (/[てで]ください|利用者が確かめ|利用者の手作業|利用者の作業|needs the owner|for the owner to/.test(doc)) bad.push('a task for the user');
      if (!rd.includes('[`docs/joss.md`](docs/joss.md), in Japanese.') || !rd.includes('[`docs/joss.md`](docs/joss.md) にあります。')) bad.push('the README points to it');
      return bad;
    };
    const plan = read('docs/joss.md');
    const realLines = Object.fromEntries(modules.map((f) => [f, linesOf(f)]));
    const pl = planProblems(plan, readme, realLines);
    ok('docs/joss.md gives the four gates with the earliest date ' + EARLIEST + ' (as the README does), the quotations of JOSS, the lines of each of the ' + modules.length + ' modules and the number of rules as in the code, no claim that the size criterion is met, and no task for the user', pl.length === 0, pl.join('; '));
    const firstMod = modules[0];
    const plBroken = [
      planProblems(plan, readme, Object.assign({}, realLines, { [firstMod]: realLines[firstMod] + 1 })),
      planProblems(plan.replace(/\n\| `bin\/deposit-check\.js` \|[^\n]*/, ''), readme, realLines),
      planProblems(plan.replace('最短は ' + EARLIEST + ' です。', '最短は 2027-05-02 です。'), readme, realLines),
      planProblems(plan, readme.replace('so the earliest date is ' + EARLIEST, 'so the earliest date is 2027-04-03'), realLines),
      planProblems(plan.replace('\n規則は ' + R.RULES.length + ' です。\n', '\n規則は ' + (R.RULES.length + 1) + ' です。\n'), readme, realLines),
      planProblems(plan.replace('`"Minor utility" packages', '`"Small utility" packages'), readme, realLines),
      planProblems(plan.replace('この条件を満たしているとは書きません。\n', 'この条件を満たしています。\n'), readme, realLines),
      planProblems(plan + '\nタグを付けてください。\n', readme, realLines),
      planProblems(plan.replace('| 満ちていません。', '| 満ちています。'), readme, realLines),
      planProblems(plan.replace('その実行の中央値を ', 'その実行の中央値を 1'), readme, realLines),
    ];
    ok('break on purpose: a line count, a module left out, the date of gate 1 in either file, the number of rules, a word of a quotation, the size claimed, a task for the user, gate 4 met, the median run time (' + plBroken.filter((b) => b.length).length + ' / ' + plBroken.length + ')', plBroken.every((b) => b.length > 0));
  }

  console.log('\n' + '-'.repeat(60));
  if (fails.length) { console.log(pass + ' passed, ' + fails.length + ' failed.'); fails.forEach((f) => console.log('  - ' + f)); process.exit(1); }
  console.log(pass + ' checks passed.');
})();
