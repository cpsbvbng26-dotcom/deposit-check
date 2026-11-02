'use strict';
/* The report: Markdown for people (and for a GitHub job summary), JSON for programs. */

const { RULES, SEVERITIES, byId } = require('./rules.js');

const ORDER = (f) => SEVERITIES.indexOf(f.severity) * 1000 + RULES.findIndex((r) => r.id === f.rule);

function counts(findings) {
  const c = { error: 0, warning: 0, info: 0 };
  findings.forEach((f) => { c[f.severity]++; });
  return c;
}

const esc = (s) => String(s).replace(/\|/g, '\\|').replace(/[<>]/g, (m) => (m === '<' ? '&lt;' : '&gt;'));

function markdown(ctx, findings) {
  const c = counts(findings);
  const lines = ['# Deposit check', ''];
  lines.push((ctx.owner ? 'ORCID iD ' + ctx.owner + ': ' + ctx.works.length + ' works with a DOI on the record, ' : '')
    + ctx.records.size + ' DOIs read. ' + c.error + ' errors, ' + c.warning + ' warnings, ' + c.info + ' notes.');
  if (ctx.failed && ctx.failed.length) lines.push('', 'Could not be read (the network or the API, not the record): ' + ctx.failed.map((f) => f.doi).join(', ') + '.');
  const byDoi = new Map();
  findings.slice().sort((a, b) => ORDER(a) - ORDER(b)).forEach((f) => byDoi.set(f.doi, (byDoi.get(f.doi) || []).concat([f])));
  for (const [doi, list] of [...byDoi].sort((a, b) => ORDER(a[1][0]) - ORDER(b[1][0]) || a[0].localeCompare(b[0]))) {
    const r = ctx.records.get(doi);
    lines.push('', '## ' + (r ? esc(r.title) : doi), '', 'https://doi.org/' + doi + (r ? ' · ' + r.agency + (r.publisher ? ' · ' + esc(r.publisher) : '') : ''), '');
    lines.push('| | Rule | Found |', '| --- | --- | --- |');
    list.forEach((f) => lines.push('| ' + f.severity + ' | ' + byId(f.rule).title + ' (`' + f.rule + '`) | ' + esc(f.detail) + ' |'));
  }
  const used = RULES.filter((r) => findings.some((f) => f.rule === r.id));
  if (used.length) {
    lines.push('', '## What to do', '');
    used.forEach((r) => lines.push('- **`' + r.id + '`** ' + r.fix));
  }
  if (!findings.length) lines.push('', 'Nothing to report.');
  return lines.join('\n') + '\n';
}

function json(ctx, findings) {
  return JSON.stringify({
    owner: ctx.owner,
    works: ctx.works.length,
    read: ctx.records.size,
    failed: ctx.failed || [],
    counts: counts(findings),
    findings: findings.slice().sort((a, b) => ORDER(a) - ORDER(b)),
  }, null, 2) + '\n';
}

/* Whether the run fails: at errors, at warnings and errors, or never. */
function fails(findings, at) {
  if (at === 'never') return false;
  const limit = SEVERITIES.indexOf(at);
  return findings.some((f) => SEVERITIES.indexOf(f.severity) <= limit);
}

module.exports = { markdown, json, counts, fails };
