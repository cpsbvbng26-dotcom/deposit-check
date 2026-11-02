#!/usr/bin/env node
'use strict';
/* The weekly run keeps one open issue with the latest report, so that its findings reach the owner as a notification.
 *
 *   node scripts/weekly-issue.js report.json report.md
 *
 * Run by .github/workflows/run.yml with GITHUB_TOKEN, GITHUB_REPOSITORY and OWNER_ORCID.
 * Only a report for OWNER_ORCID is posted: a run by hand for another iD writes the job summary and nothing else.
 *
 * - errors or warnings, and no open issue: open one;
 * - errors or warnings, and an open issue: replace its report, and comment when the counts changed (an edit sends no notification);
 * - neither, and an open issue: comment and close it.
 */

const fs = require('fs');

const MARK = '<!-- deposit-check-weekly -->';
const LIMIT = 60000;

const countsOf = (body) => {
  const m = /<!-- counts: (\{[^}]*\}) -->/.exec(body || '');
  return m ? JSON.parse(m[1]) : null;
};
const say = (c) => c.error + ' errors, ' + c.warning + ' warnings, ' + c.info + ' notes';

/* Pure: what to do with the issue, given the open one (or null), the report as JSON and as Markdown, and the date. */
function plan(open, report, md, when) {
  const c = report.counts;
  const attention = c.error + c.warning > 0;
  const title = 'Deposit check: ' + c.error + ' errors, ' + c.warning + ' warnings';
  let text = md.length > LIMIT ? md.slice(0, LIMIT) + '\n\n(The report is cut here. The whole report is in the job summary of the run.)\n' : md;
  const body = MARK + '\n<!-- counts: ' + JSON.stringify(c) + ' -->\n**Weekly run, ' + when + '.** This issue is updated each week, and closes itself when no error or warning is left.\n\n' + text;
  if (!attention) return open ? { kind: 'close', number: open.number, comment: MARK + '\nThe run on ' + when + ' found no error or warning (' + say(c) + '). Closing.' } : { kind: 'none' };
  if (!open) return { kind: 'create', title, body };
  const before = countsOf(open.body);
  const changed = !before || before.error !== c.error || before.warning !== c.warning || before.info !== c.info;
  return { kind: 'update', number: open.number, title, body, comment: changed ? MARK + '\nThe run on ' + when + ': ' + say(c) + (before ? ' (before: ' + say(before) + ').' : '.') : null };
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
  const p = plan(open, report, md, new Date().toISOString().slice(0, 10));
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

module.exports = { plan, MARK, LIMIT, countsOf };
