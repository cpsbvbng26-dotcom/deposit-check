#!/usr/bin/env node
'use strict';
/* The inputs of the weekly run, from the catalogue of the author's works (catalog.json in cpsbvbng26-dotcom).
 *
 *   node scripts/catalog-inputs.js <catalog.json> <directory>
 *
 * writes into the directory:
 *   dois.txt                  every DOI in the catalogue, one a line: the DOI of each work, the DOI of all its versions
 *                             where there is one, and its other DOIs (the copies of the same text elsewhere, such as SSRN)
 *   expected-types.json       the type the catalogue gives each work (resourceType), for --expect-types
 *   expected-identical.json   the other DOIs of each work, for --expect-identical; only when some work has one
 *
 * Nothing here reaches the network: .github/workflows/run.yml reads the catalogue from GitHub with actions/checkout.
 * A catalogue that cannot be read, or a DOI in it that is not a DOI, stops the run, so that a broken catalogue does not
 * pass as a catalogue with fewer works. */

const fs = require('fs');
const path = require('path');
const { doiOf } = require('../src/metadata.js');

/* Pure: the three inputs from the parsed catalogue. */
function inputs(catalog) {
  if (!catalog || typeof catalog !== 'object' || !Array.isArray(catalog.works)) throw new Error('not a catalogue: no list of works');
  const asOf = catalog.asOf ? ', as of ' + catalog.asOf : '';
  const dois = [];
  const types = { _: 'From catalog.json in cpsbvbng26-dotcom, resourceType' + asOf };
  const identical = { _: 'From catalog.json in cpsbvbng26-dotcom, otherDois' + asOf };
  const add = (d, where) => {
    const x = doiOf(d);
    if (!x || x !== String(d).trim().toLowerCase()) throw new Error('not a DOI in the catalogue, at ' + where + ': ' + JSON.stringify(d));
    if (!dois.includes(x)) dois.push(x);
    return x;
  };
  for (const w of catalog.works) {
    const where = (w && w.id) || '(a work without an id)';
    const others = ((w && w.otherDois) || []).map((d) => add(d, where));
    if (w.conceptDoi) add(w.conceptDoi, where);
    if (!w.doi) {
      if (others.length || w.resourceType) throw new Error('other DOIs or a type, and no DOI, at ' + where);
      continue;
    }
    const doi = add(w.doi, where);
    if (w.resourceType) {
      if (!/^[A-Za-z]+$/.test(w.resourceType)) throw new Error('not a resource type, at ' + where + ': ' + JSON.stringify(w.resourceType));
      types[doi] = w.resourceType;
    }
    if (others.length) identical[doi] = others;
  }
  if (!dois.length) throw new Error('no DOI in the catalogue');
  const some = (o) => Object.keys(o).some((k) => !k.startsWith('_'));
  return { dois: dois.sort(), types: some(types) ? types : null, identical: some(identical) ? identical : null };
}

function main([catalogFile, dir]) {
  if (!catalogFile || !dir) throw new Error('usage: node scripts/catalog-inputs.js <catalog.json> <directory>');
  const got = inputs(JSON.parse(fs.readFileSync(catalogFile, 'utf8')));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'dois.txt'), got.dois.join('\n') + '\n');
  if (got.types) fs.writeFileSync(path.join(dir, 'expected-types.json'), JSON.stringify(got.types, null, 1) + '\n');
  if (got.identical) fs.writeFileSync(path.join(dir, 'expected-identical.json'), JSON.stringify(got.identical, null, 1) + '\n');
  console.log(got.dois.length + ' DOIs from the catalogue; ' + (got.types ? Object.keys(got.types).length - 1 : 0) + ' expected types; '
    + (got.identical ? Object.keys(got.identical).length - 1 : 0) + ' works with copies elsewhere.');
}

if (require.main === module) {
  try { main(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exit(1); }
}

module.exports = { inputs };
