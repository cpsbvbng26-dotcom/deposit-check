#!/usr/bin/env node
'use strict';
/* deposit-check: read the DOI metadata of a researcher's works and say what is missing.
 *
 *   deposit-check --orcid 0000-0002-1825-0097
 *   deposit-check --doi 10.5281/zenodo.1234567 --doi 10.6084/m9.figshare.7654321.v2
 *   deposit-check --orcid … --format json --fail-on warning
 *   deposit-check --expect-types types.json      (each DOI in the file, and the resource type it should have)
 *   deposit-check --expect-identical copies.json (each DOI in the file, and the copies of the same text it should be linked to)
 *
 * Exit status: 0 when nothing reaches --fail-on, 1 when something does, 2 when the tool could not run.
 */

const fs = require('fs');
const { gather, httpGet, answersGet } = require('../src/fetch.js');
const { audit } = require('../src/rules.js');
const R = require('../src/report.js');
const { validOrcid, doiOf, expectedTypes, expectedIdentical } = require('../src/metadata.js');

const USAGE = `Usage: deposit-check [--orcid <iD>] [--doi <DOI> …] [options]

  --orcid <iD>        check the works on this ORCID record, and the works whose metadata carries the iD
  --doi <DOI>         check this DOI as well (may be given more than once)
  --expect-types <f>  a JSON file of DOIs and the resource type each should have; they are checked as well
  --expect-identical <f>
                      a JSON file of DOIs and the copies of the same text each should be linked to with
                      IsIdenticalTo; the DOIs in it are checked as well
  --format <f>        markdown (default) or json
  --fail-on <s>       error (default), warning, info or never: exit 1 when a finding is this serious or more
  --out <file>        write the report to a file as well as to the output
  --json-out <file>   also write the report as JSON to a file, whatever --format is
  --summary           also append the Markdown report to $GITHUB_STEP_SUMMARY
  --answers <file>    read the APIs' answers from this JSON file instead of the network (for the example)
`;

function parse(argv) {
  const o = { orcid: null, dois: [], format: 'markdown', failOn: 'error', out: null, jsonOut: null, summary: false, expectTypes: null, expectIdentical: null, answers: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => { if (i + 1 >= argv.length) throw new Error(a + ' needs a value'); return argv[++i]; };
    if (a === '--orcid') o.orcid = val().replace(/^https?:\/\/orcid\.org\//, '').trim();
    else if (a === '--doi') o.dois.push(...val().split(/[\s,]+/).filter(Boolean));
    else if (a === '--format') o.format = val();
    else if (a === '--fail-on') o.failOn = val();
    else if (a === '--out') o.out = val();
    else if (a === '--json-out') o.jsonOut = val();
    else if (a === '--summary') o.summary = true;
    else if (a === '--expect-types') o.expectTypes = val();
    else if (a === '--expect-identical') o.expectIdentical = val();
    else if (a === '--answers') o.answers = val();
    else if (a === '--help' || a === '-h') o.help = true;
    else throw new Error('unknown argument: ' + a);
  }
  if (o.help) return o;
  if (!o.orcid && !o.dois.length && !o.expectTypes && !o.expectIdentical) throw new Error('give --orcid, --doi, --expect-types or --expect-identical');
  if (o.orcid && !validOrcid(o.orcid)) throw new Error('not a valid ORCID iD (the check digit does not match): ' + o.orcid);
  const bad = o.dois.filter((d) => !doiOf(d));
  if (bad.length) throw new Error('not a DOI: ' + bad.join(', '));
  if (!['markdown', 'json'].includes(o.format)) throw new Error('--format is markdown or json');
  if (!['error', 'warning', 'info', 'never'].includes(o.failOn)) throw new Error('--fail-on is error, warning, info or never');
  return o;
}

async function main(argv, { get = httpGet(), stdout = process.stdout, stderr = process.stderr, env = process.env } = {}) {
  let o;
  try { o = parse(argv); } catch (e) { stderr.write(e.message + '\n\n' + USAGE); return 2; }
  if (o.help) { stdout.write(USAGE); return 0; }
  let expected = null;
  let identical = null;
  try {
    if (o.expectTypes) expected = expectedTypes(JSON.parse(fs.readFileSync(o.expectTypes, 'utf8')));
    if (o.expectIdentical) identical = expectedIdentical(JSON.parse(fs.readFileSync(o.expectIdentical, 'utf8')));
    if (o.answers) get = answersGet(JSON.parse(fs.readFileSync(o.answers, 'utf8')));
  } catch (e) { stderr.write(e.message + '\n'); return 2; }
  let ctx;
  try {
    const copies = identical ? [...identical].flatMap(([k, list]) => [k].concat(list.filter((c) => doiOf(c) === c))) : [];
    const dois = o.dois.concat(expected ? [...expected.keys()] : [], copies);
    ctx = await gather({ orcid: o.orcid, dois, get, log: (m) => stderr.write(m + '\n') });
  } catch (e) { stderr.write('deposit-check could not run: ' + e.message + '\n'); return 2; }
  ctx.expected = expected;
  ctx.identical = identical;
  const findings = audit(ctx);
  const md = R.markdown(ctx, findings);
  const text = o.format === 'json' ? R.json(ctx, findings) : md;
  stdout.write(text);
  if (o.out) fs.writeFileSync(o.out, text);
  if (o.jsonOut) fs.writeFileSync(o.jsonOut, R.json(ctx, findings));
  if (o.summary && env.GITHUB_STEP_SUMMARY) fs.appendFileSync(env.GITHUB_STEP_SUMMARY, md);
  return R.fails(findings, o.failOn) ? 1 : 0;
}

if (require.main === module) main(process.argv.slice(2)).then((code) => { process.exitCode = code; });

module.exports = { main, parse, USAGE };
