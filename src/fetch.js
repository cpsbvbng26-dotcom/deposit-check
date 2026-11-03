'use strict';
/* The only module that reaches the network. Every request is a GET to a public API that needs no key:
 * pub.orcid.org, api.datacite.org, api.crossref.org, api.japanlinkcenter.org and api.openalex.org.
 * `get` is passed in, so the checks can run the whole tool on recorded answers without the network. */

const M = require('./metadata.js');

const UA = 'deposit-check (https://github.com/cpsbvbng26-dotcom/deposit-check)';
/* A refused request (429) or a server error is tried again after these waits. */
const RETRY_WAITS_MS = [5 * 1000, 20 * 1000];
/* Requests are made one after another, this far apart, so that no API is asked too often. */
const GAP_MS = 300;

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/* The real `get`: JSON, or null for 404. Crossref asks callers to give a contact address; one can be given in
 * DEPOSIT_CHECK_MAILTO, and none is built in. */
function httpGet({ mailto = process.env.DEPOSIT_CHECK_MAILTO, wait = pause } = {}) {
  const ua = UA + (mailto ? '; mailto:' + mailto : '');
  return async function get(url, accept = 'application/json') {
    for (let attempt = 0; ; attempt++) {
      await wait(GAP_MS);
      const r = await fetch(url, { headers: { 'User-Agent': ua, Accept: accept } });
      if (r.status === 404) return null;
      if (r.ok) return r.json();
      if ((r.status === 429 || r.status >= 500) && attempt < RETRY_WAITS_MS.length) { await wait(RETRY_WAITS_MS[attempt]); continue; }
      throw new Error(url.split('?')[0] + ': HTTP ' + r.status);
    }
  };
}

/* The metadata of one DOI: DataCite first, then Crossref, then JaLC. */
async function lookUp(get, doi) {
  const enc = encodeURIComponent(doi);
  const dc = await get('https://api.datacite.org/dois/' + enc);
  if (dc && dc.data) return M.fromDataCite(dc);
  const cr = await get('https://api.crossref.org/works/' + enc);
  if (cr && cr.message) return M.fromCrossref(cr);
  const ja = await get('https://api.japanlinkcenter.org/dois/' + enc);
  return ja && ja.status === 'OK' && ja.data ? M.fromJaLC(ja) : null;
}

/* How OpenAlex, the open index of scholarly works, holds a DOI: { held, abstract }, or undefined when it could not be read.
 * Reading it is never a reason to stop: an index that cannot be reached says nothing about the record. */
async function openAlexOf(get, doi) {
  try {
    const w = await get('https://api.openalex.org/works/https://doi.org/' + doi);
    return w ? { held: true, abstract: !!w.abstract_inverted_index } : { held: false, abstract: false };
  } catch (e) {
    return undefined;
  }
}

async function orcidWorks(get, orcid) {
  const json = await get('https://pub.orcid.org/v3.0/' + orcid + '/works', 'application/json');
  if (!json) throw new Error('no ORCID record ' + orcid);
  return M.orcidWorks(json);
}

/* The DataCite search for creators that carry the iD. Repositories store it in different forms: Zenodo gives the bare
 * iD, Figshare and OSF its URL. On 2026-11-02 the URL alone found 4 of one author's 34 DOIs, all of them outside Zenodo. */
function dataciteQuery(orcid) {
  return 'creators.nameIdentifiers.nameIdentifier:("' + orcid + '" OR "https://orcid.org/' + orcid + '" OR "http://orcid.org/' + orcid + '")';
}

/* DOIs whose metadata carries the iD: DataCite's search, and Crossref's filter. */
async function carrying(get, orcid) {
  const found = new Set();
  const dc = await get('https://api.datacite.org/dois?query=' + encodeURIComponent(dataciteQuery(orcid)) + '&page[size]=1000');
  if (dc) M.dataciteFound(dc).forEach((d) => found.add(d));
  const cr = await get('https://api.crossref.org/works?filter=orcid:' + orcid + '&rows=1000&select=DOI');
  if (cr) M.crossrefFound(cr).forEach((d) => found.add(d));
  return found;
}

/* Gather everything the rules read. Given an ORCID iD, the works on its record and the works that carry it;
 * given DOIs, those. A DOI that cannot be read is noted and left out; it does not stop the others. */
async function gather({ orcid = null, dois = [], get, log = () => {} }) {
  const works = orcid ? await orcidWorks(get, orcid) : [];
  const found = orcid ? await carrying(get, orcid) : new Set();
  const all = new Set([...works.map((w) => w.doi), ...found, ...dois.map((d) => M.doiOf(d)).filter(Boolean)]);
  const records = new Map();
  const failed = [];
  for (const doi of [...all].sort()) {
    try {
      const r = await lookUp(get, doi);
      if (r) {
        r.openalex = await openAlexOf(get, doi);
        records.set(doi, r);
      }
    } catch (e) {
      failed.push({ doi, error: e.message });
      log('could not read ' + doi + ': ' + e.message);
    }
  }
  /* A DOI that could not be read is not reported as unresolved: that would blame the record for the network. */
  const unread = new Set(failed.map((f) => f.doi));
  return { owner: orcid, works: works.filter((w) => !unread.has(w.doi)), found, records, failed };
}

module.exports = { UA, RETRY_WAITS_MS, GAP_MS, httpGet, lookUp, openAlexOf, orcidWorks, carrying, gather, dataciteQuery };
