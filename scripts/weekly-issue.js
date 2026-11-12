#!/usr/bin/env node
'use strict';
/* The weekly run keeps one open issue with the latest report, so that its findings reach the owner as a notification.
 *
 *   node scripts/weekly-issue.js report.json report.md
 *
 * Run by .github/workflows/run.yml with GITHUB_TOKEN, GITHUB_REPOSITORY and OWNER_ORCID, and CATALOGUE_COMMIT when the
 * DOIs of the catalogue were read as well. Only a report for OWNER_ORCID is posted: a run by hand for another iD writes
 * the job summary and nothing else.
 *
 * The issue keeps the findings of the last report (each as its rule and DOI), so that the next run can say what changed:
 * - errors or warnings, and no open issue: open one;
 * - errors or warnings, and an open issue: replace its report, and comment when the findings changed, naming the ones
 *   that are gone and the ones that are new (an edit sends no notification, a comment does);
 * - neither, and an open issue: comment and close it.
 */

const fs = require('fs');
const crypto = require('crypto');

const MARK = '<!-- deposit-check-weekly -->';
const LIMIT = 60000;
const MAX = 65000;
/* The findings are kept in the issue as a list while the list is this short, and as a digest beyond it. */
const KEEP = 20000;
/* A comment names at most this many findings that are gone, and as many that are new. */
const NAME = 30;

const countsOf = (body) => {
  const m = /<!-- counts: (\{[^}]*\}) -->/.exec(body || '');
  return m ? JSON.parse(m[1]) : null;
};
const say = (c) => c.error + ' errors, ' + c.warning + ' warnings, ' + c.info + ' notes';

/* Each finding as its rule and its DOI, sorted. Two findings of one rule on one DOI (two copies unlinked) are kept twice. */
const keysOf = (report) => (report.findings || []).map((f) => f.rule + ' ' + f.doi).sort();
const digest = (keys) => crypto.createHash('sha256').update(keys.join('\n')).digest('hex');
const keptOf = (body) => {
  const list = /<!-- findings: (\[[^\]]*\]) -->/.exec(body || '');
  const sum = /<!-- findings-sha256: ([0-9a-f]{64}) -->/.exec(body || '');
  return { keys: list ? JSON.parse(list[1]) : null, sum: sum ? sum[1] : null };
};

/* What is in a and not in b, counting repeats. */
function minus(a, b) {
  const left = b.slice();
  return a.filter((k) => { const i = left.indexOf(k); if (i < 0) return true; left.splice(i, 1); return false; });
}

const named = (title, list) => (list.length ? '\n\n' + title + ':\n' + list.slice(0, NAME).map((k) => '- `' + k.replace(' ', '` ')).join('\n')
  + (list.length > NAME ? '\n- and ' + (list.length - NAME) + ' more' : '') : '');

/* Pure: what to do with the issue, given the open one (or null), the report as JSON and as Markdown, the date, and the
 * commit of the catalogue when its DOIs were read. */
function plan(open, report, md, when, catalogue) {
  const c = report.counts;
  const attention = c.error + c.warning > 0;
  const title = 'Deposit check: ' + c.error + ' errors, ' + c.warning + ' warnings';
  const keys = keysOf(report);
  const kept = JSON.stringify(keys);
  const head = MARK + '\n<!-- counts: ' + JSON.stringify(c) + ' -->\n<!-- findings-sha256: ' + digest(keys) + ' -->\n'
    + (kept.length <= KEEP ? '<!-- findings: ' + kept + ' -->\n' : '')
    + '**Weekly run, ' + when + '.** This issue is updated each week, and closes itself when no error or warning is left.'
    + (catalogue ? ' Every DOI in `catalog.json` of cpsbvbng26-dotcom, at ' + catalogue + ', was read as well.' : '') + '\n\n';
  /* GitHub takes a body of 65536 characters at most: the report gets what the head leaves. */
  const room = Math.min(LIMIT, MAX - head.length);
  const text = md.length > room ? md.slice(0, room) + '\n\n(The report is cut here. The whole report is in the job summary of the run, and in its artifact.)\n' : md;
  const body = head + text;
  if (!attention) return open ? { kind: 'close', number: open.number, comment: MARK + '\nThe run on ' + when + ' found no error or warning (' + say(c) + '). Closing.' } : { kind: 'none' };
  if (!open) return { kind: 'create', title, body };
  const before = countsOf(open.body);
  const was = keptOf(open.body);
  /* The findings are compared when the issue kept them; an issue from before kept only the counts. */
  const changed = was.sum ? was.sum !== digest(keys)
    : !before || before.error !== c.error || before.warning !== c.warning || before.info !== c.info;
  if (!changed) return { kind: 'update', number: open.number, title, body, comment: null };
  const what = was.keys ? named('No longer found', minus(was.keys, keys)) + named('New', minus(keys, was.keys)) : '';
  return { kind: 'update', number: open.number, title, body,
    comment: MARK + '\nThe run on ' + when + ': ' + say(c) + (before ? ' (before: ' + say(before) + ').' : '.') + what };
}

async function github(method, path, body) {
  const r = await fetch('https://api.github.com/repos/' + process.env.GITHUB_REPOSITORY + path, {
    method,
    headers: { Authorization: 'Bearer ' + process.env.GITHUB_TOKEN, Accept: 'application/vnd.github+json', 'User-Agent': 'deposit-check', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(method + ' ' + path + ': HTTP ' + r.status);
  return r.status === 204 ? null : r.json();
}

async function main([jsonFile, mdFile]) {
  const report = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  if (report.owner !== process.env.OWNER_ORCID) { console.log('not the owner’s iD: no issue'); return; }
  const md = fs.readFileSync(mdFile, 'utf8');
  const open = ((await github('GET', '/issues?state=open&per_page=100')) || []).find((i) => !i.pull_request && (i.body || '').startsWith(MARK)) || null;
  const p = plan(open, report, md, new Date().toISOString().slice(0, 10), process.env.CATALOGUE_COMMIT || null);
  if (p.kind === 'create') console.log('opened #' + (await github('POST', '/issues', { title: p.title, body: p.body })).number);
  if (p.kind === 'update') {
    await github('PATCH', '/issues/' + p.number, { title: p.title, body: p.body });
    if (p.comment) await github('POST', '/issues/' + p.number + '/comments', { body: p.comment });
    console.log('updated #' + p.number + (p.comment ? ', with a comment' : ''));
  }
  if (p.kind === 'close') {
    await github('POST', '/issues/' + p.number + '/comments', { body: p.comment });
    await github('PATCH', '/issues/' + p.number, { state: 'closed', state_reason: 'completed' });
    console.log('closed #' + p.number);
  }
  if (p.kind === 'none') console.log('nothing to report, no issue open');
}

if (require.main === module) main(process.argv.slice(2)).catch((e) => { console.error(e.message); process.exit(1); });

module.exports = { plan, MARK, LIMIT, MAX, KEEP, NAME, countsOf, keysOf, keptOf, digest, minus };
