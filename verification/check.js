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
    'https://api.crossref.org/works/10.5555%2Fcrossref.300': 'crossref-300.json',
    'https://api.japanlinkcenter.org/dois/10.51094%2Fjxiv.example': 'jalc-example.json',
  };
  return async (url) => {
    log.push(url);
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
  ok('every rule is raised by some case in these checks', (() => {
    const seen = new Set([...expected200, 'abstract-short', 'licence-missing', 'date-missing']);
    return R.RULES.every((r) => seen.has(r.id) || ['unresolved', 'not-on-orcid', 'same-title'].includes(r.id));
  })());

  /* ------------------------------------------------------------ 3 */
  console.log('\n3. All the works of one ORCID iD');
  const urls = [];
  const ctx = await F.gather({ orcid: OWNER, dois: ['10.51094/jxiv.example', '10.5072/broken'], get: stubGet(urls) });
  const all = R.audit(ctx);
  const of = (doi) => all.filter((f) => f.doi === doi).map((f) => f.rule);
  ok('a DOI is looked up at DataCite, then Crossref, then JaLC', urls.indexOf('https://api.datacite.org/dois/10.51094%2Fjxiv.example') < urls.indexOf('https://api.crossref.org/works/10.51094%2Fjxiv.example')
    && urls.indexOf('https://api.crossref.org/works/10.51094%2Fjxiv.example') < urls.indexOf('https://api.japanlinkcenter.org/dois/10.51094%2Fjxiv.example'));
  ok('the DataCite search asks for the creators that carry the iD', urls.some((u) => u.startsWith('https://api.datacite.org/dois?query=') && decodeURIComponent(u).includes('creators.nameIdentifiers.nameIdentifier:"https://orcid.org/' + OWNER + '"')));
  ok('the complete version gives nothing, and its record of all versions is not checked on its own', of('10.5072/zenodo.101').length === 0 && of('10.5072/zenodo.100').length === 0);
  ok('unresolved: the mistyped DOI on the ORCID record', of('10.5072/typo.999').join() === 'unresolved');
  ok('not-on-orcid: the work that carries the iD but is not on the record, and not the record of all versions of a listed version',
    all.filter((f) => f.rule === 'not-on-orcid').map((f) => f.doi).join() === '10.5072/zenodo.400');
  ok('same-title: the two deposits of the same work at two places, once', all.filter((f) => f.rule === 'same-title').map((f) => f.doi + ' ' + f.detail).join() === '10.5072/zenodo.200 same title as 10.5555/crossref.300 (Crossref)');
  ok('a DOI that could not be read is reported as such, and not as unresolved', ctx.failed.map((f) => f.doi).join() === '10.5072/broken' && !of('10.5072/broken').length);
  ok('a DOI given by hand is read too (JaLC), with no finding beyond what it lacks', of('10.51094/jxiv.example').join() === 'licence-missing', of('10.51094/jxiv.example').join());
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
  const wfs = fs.readdirSync(path.join(ROOT, '.github', 'workflows')).map((f) => read(path.join('.github', 'workflows', f)));
  ok('every workflow only reads, and passes inputs through the environment', wfs.length >= 2 && wfs.every((w) => /permissions:\n  contents: read\n(?!  \w)/.test(w) && onlyInEnv(w)));
  const cff = read('CITATION.cff');
  ok('CITATION.cff names one author with an ORCID iD, and no language model', (cff.match(/family-names:/g) || []).length === 1 && cff.includes('orcid: "https://orcid.org/0009-0000-1406-0547"') && !/claude|anthropic|openai|gpt/i.test(cff));
  ok('the README says how the code was written, and that Claude is not an author', readme.includes('Claude Code (Anthropic)') && readme.includes('Claude is not an author'));
  ok('the README says what is sent where, and that no key is needed', ['pub.orcid.org', 'api.datacite.org', 'api.crossref.org', 'api.japanlinkcenter.org'].every((h) => readme.includes(h)));

  console.log('\n' + '-'.repeat(60));
  if (fails.length) { console.log(pass + ' passed, ' + fails.length + ' failed.'); fails.forEach((f) => console.log('  - ' + f)); process.exit(1); }
  console.log(pass + ' checks passed.');
})();
