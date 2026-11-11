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
  /* The set rules are raised in section 3, and type-unexpected in section 10. */
  ok('every rule is raised by some case in these checks', (() => {
    const seen = new Set([...expected200, 'abstract-short', 'licence-missing', 'date-missing']);
    return R.RULES.every((r) => seen.has(r.id) || ['unresolved', 'not-on-orcid', 'same-title', 'openalex-missing', 'openalex-abstract-missing', 'type-unexpected'].includes(r.id));
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
  ok('only src/fetch.js reaches the network', ['src/metadata.js', 'src/rules.js', 'src/report.js', 'bin/deposit-check.js'].every((f) => !/\bfetch\(/.test(read(f))));

  /* ------------------------------------------------------------ 7 */
  console.log('\n7. The repository');
  const readme = read('README.md');
  const table = [...readme.matchAll(/^\| `([a-z-]+)` \| (error|warning|info) \|/gm)].map((m) => m[1] + ':' + m[2]);
  ok('the README lists every rule with its severity, in order, and no other', table.join() === R.RULES.map((x) => x.id + ':' + x.severity).join(), table.join());
  const pkg = JSON.parse(read('package.json'));
  ok('no dependencies; Node.js 22; MIT; the command is bin/deposit-check.js', !pkg.dependencies && !pkg.devDependencies && pkg.engines.node === '>=22'
    && pkg.license === 'MIT' && pkg.bin['deposit-check'] === 'bin/deposit-check.js');
  ok('LICENSE is MIT, and the README says the text is under CC BY 4.0', /^MIT License/.test(read('LICENSE')) && readme.includes('CC BY 4.0'));
  const action = read('action.yml');
  /* An expression may appear only as the value of an environment variable, never in a command, a block or a name. */
  const onlyInEnv = (y) => y.split('\n').filter((l) => l.includes('${{')).every((l) => /^\s+[A-Z][A-Z0-9_]*: \$\{\{ (inputs\.[a-z-]+|secrets\.GITHUB_TOKEN) \}\}$/.test(l));
  ok('the action passes its inputs through the environment, never into the command line', onlyInEnv(action)
    && /ORCID: \$\{\{ inputs\.orcid \}\}/.test(action) && /using: composite/.test(action));
  const wfFiles = fs.readdirSync(path.join(ROOT, '.github', 'workflows'));
  const wf = (f) => read(path.join('.github', 'workflows', f));
  /* The top level only reads. The weekly run writes its issue from its one job, and nowhere else. */
  ok('every workflow only reads, except that the job of the weekly run may write issues; inputs go through the environment',
    wfFiles.length >= 2 && wfFiles.every((f) => /^permissions:\n  contents: read\n(?!  \w)/m.test(wf(f))
      && (f !== 'run.yml' || /^    permissions:\n      contents: read\n      issues: write\n(?!      \w)/m.test(wf(f))) && onlyInEnv(wf(f))));
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
  console.log('\n8. The weekly issue');
  const W = require('../scripts/weekly-issue.js');
  const rep = (e, w, i) => ({ owner: OWNER, counts: { error: e, warning: w, info: i } });
  let p = W.plan(null, rep(1, 2, 3), '# Deposit check\n', '2026-11-03');
  ok('errors or warnings and no open issue: one is opened, with the counts in its title and kept in the body', p.kind === 'create'
    && p.title === 'Deposit check: 1 errors, 2 warnings' && p.body.startsWith(W.MARK) && JSON.stringify(W.countsOf(p.body)) === '{"error":1,"warning":2,"info":3}');
  const open = { number: 7, body: p.body };
  p = W.plan(open, rep(1, 2, 3), '# Deposit check\n', '2026-11-10');
  ok('the same counts a week later: the report is replaced, with no comment', p.kind === 'update' && p.number === 7 && p.comment === null);
  p = W.plan(open, rep(0, 2, 3), '# Deposit check\n', '2026-11-10');
  ok('the counts changed: a comment says how, since an edit sends no notification', p.kind === 'update' && (p.comment || '').includes('0 errors, 2 warnings, 3 notes (before: 1 errors, 2 warnings, 3 notes)'));
  p = W.plan(open, rep(0, 0, 5), '# Deposit check\n', '2026-11-17');
  ok('no error or warning left: the issue is closed with a comment; notes alone do not open one', p.kind === 'close' && p.number === 7
    && W.plan(null, rep(0, 0, 5), '', '2026-11-17').kind === 'none');
  ok('a long report is cut, and says where the whole one is', W.plan(null, rep(1, 0, 0), 'x'.repeat(W.LIMIT + 10), 'd').body.includes('The whole report is in the job summary'));
  const ws = read('scripts/weekly-issue.js');
  ok('the script posts only for the owner’s iD, and talks only to api.github.com', ws.includes('report.owner !== process.env.OWNER_ORCID')
    && (ws.match(/https:\/\/[a-z.]+/g) || []).every((u) => u === 'https://api.github.com'));
  const runYml = wf('run.yml');
  ok('the weekly run writes the report as JSON and Markdown, and passes the token through the environment', runYml.includes('--out report.md --json-out report.json')
    && runYml.includes('node scripts/weekly-issue.js report.json report.md') && /GITHUB_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}/.test(runYml));
  const tmp = path.join(require('os').tmpdir(), 'deposit-check-' + process.pid + '.json');
  r = await run(['--doi', '10.5072/zenodo.101', '--json-out', tmp]);
  ok('--json-out writes JSON whatever --format is', r.out.startsWith('# Deposit check') && JSON.parse(fs.readFileSync(tmp, 'utf8')).read === 1);
  fs.rmSync(tmp, { force: true });
  ok('the README says that the weekly issue exists, when it closes, and that it uses api.github.com', readme.includes('closes itself when no error or warning is left') && readme.includes('api.github.com'));

  /* ------------------------------------------------------------ 9 */
  {
  console.log('\n9. The draft JOSS paper');
  const pmd = read('paper/paper.md');
  const bib = read('paper/paper.bib');
  const body = pmd.replace(/^---[\s\S]*?\n---\n/, '').replace(/<!--[\s\S]*?-->/g, '');
  const pwords = (body.match(/[A-Za-z0-9][A-Za-z0-9'’.-]*/g) || []).length;
  ok('the body is within the JOSS length of 250 to 1000 words (' + pwords + ')', pwords >= 250 && pwords <= 1000);
  ok('the sections JOSS asks for are there, with the AI usage disclosure, and Claude is not an author',
    ['# Summary', '# Statement of need', '# State of the field', '# Software design', '# Research impact statement', '# AI usage disclosure', '# References'].every((h) => body.includes('\n' + h + '\n'))
    && body.includes('Claude is not an author.') && !/name: .*Claude/.test(pmd));
  ok('the one author has the ORCID iD of CITATION.cff', /authors:\n  - name: Takuya Nemoto\n    orcid: 0009-0000-1406-0547\n/.test(pmd) && (pmd.match(/^  - name:/gm) || []).length === 2);
  const keys = [...bib.matchAll(/^@\w+\{([^,]+),/gm)].map((m) => m[1]);
  const cited = [...new Set([...body.matchAll(/\[@([a-z]+)\]/g)].map((m) => m[1]))];
  ok('every citation is in paper.bib, and every entry is cited', cited.length > 0 && cited.every((k) => keys.includes(k)) && keys.every((k) => cited.includes(k)), 'cited ' + cited.join(',') + ' / bib ' + keys.join(','));
  const W = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
  ok('the number of rules in the paper is the number of rules (' + R.RULES.length + ')', body.includes('applies ' + W[R.RULES.length] + ' rules'));
  ok('no DOI in paper.bib until one is checked at its source', !/\bdoi\s*=/i.test(bib));
  ok('the paper says the research impact as it is: no use by other authors yet', body.includes('There is no record yet of use by other authors.'));

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
    ['openalex-missing', { openalex: { held: false, abstract: false } }],
    ['openalex-abstract-missing', { openalex: { held: true, abstract: false } }],
  ];
  const complete = Object.assign({}, d101, { openalex: { held: true, abstract: true } });
  const raised = (rec, expected) => R.audit({ owner: OWNER, works: [], found: new Set(), records: new Map([[rec.doi, rec]]), expected: expected ? new Map(Object.entries(expected)) : null }).map((f) => f.rule);
  ok('the complete record, held by OpenAlex with its abstract, gives nothing', raised(complete).length === 0, raised(complete).join());
  for (const [id, patch, expected] of BREAKS) {
    const got = raised(Object.assign({}, complete, patch), expected);
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
  /* The only write is the weekly issue, in run.yml. Any other write fails here. */
  const writes = workflows.flatMap((f) => [...read(f).matchAll(/^\s+([a-z-]+):\s*write\b/gm)].map((m) => path.basename(f) + ':' + m[1]));
  ok('the only write permission is issues: write, given to the job in run.yml', writes.join() === 'run.yml:issues'
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

  console.log('\n' + '-'.repeat(60));
  if (fails.length) { console.log(pass + ' passed, ' + fails.length + ' failed.'); fails.forEach((f) => console.log('  - ' + f)); process.exit(1); }
  console.log(pass + ' checks passed.');
})();
