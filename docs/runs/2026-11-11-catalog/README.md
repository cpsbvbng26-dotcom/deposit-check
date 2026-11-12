# The author's own works, 2026-11-11

deposit-check was run over every DOI in the catalogue of the author's works, on 2026-11-11.
The catalogue is `catalog.json` in cpsbvbng26-dotcom, at commit `804cffb` of its `main`.
This page lists what the run found at each repository.
Nothing here has been fixed: deposit-check reads metadata and changes nothing, and the records on Zenodo, figshare, OSF, SSRN and ORCID are edited only from the author's accounts, which the sessions that write this repository cannot reach.

## How it was run

```
node bin/deposit-check.js --orcid 0009-0000-1406-0547 $(sed 's/^/--doi /' docs/runs/2026-11-11-catalog/dois.txt) \
  --expect-types docs/runs/2026-11-11-catalog/expected-types.json --fail-on never \
  --out docs/runs/2026-11-11-catalog/report.md
```

- [`dois.txt`](dois.txt): every DOI in the catalogue. That is the DOI of each work, the DOI of all its versions where there is one, and its other DOIs (the SSRN copies).
- [`expected-types.json`](expected-types.json): the type the catalogue gives each work (`resourceType`), for the DOIs registered by DataCite.
- [`report.md`](report.md): the report as the tool wrote it. The ORCID iD was given as well, so the report also covers works that carry the iD but are not in the catalogue, and whether each work is on the ORCID record.

The run was made from a session that could reach DataCite, Crossref, ORCID and OpenAlex. JaLC was not needed: no DOI in the catalogue is registered there.

## What the rules found

### Errors

| DOI | Work | Rule | What is missing |
| --- | --- | --- | --- |
| [10.5281/zenodo.22055709](https://doi.org/10.5281/zenodo.22055709) | A Naval Gazette Entry for Lieutenant Otani Tsune | `abstract-missing` | No description of the type Abstract on Zenodo |
| [10.5281/zenodo.22057583](https://doi.org/10.5281/zenodo.22057583) | Manifesto of Imperial Selfhood | `abstract-missing` | The same |
| [10.5281/zenodo.22058254](https://doi.org/10.5281/zenodo.22058254) | The Nobility and Exemplarity of the Celibate Individual | `abstract-missing` | The same |
| [10.5281/zenodo.22058777](https://doi.org/10.5281/zenodo.22058777) | The Trinity-Infinity Framework, Series II | `abstract-missing` | The same |
| [10.5281/zenodo.22058964](https://doi.org/10.5281/zenodo.22058964) | The Trinity-Infinity Framework, Series III | `abstract-missing` | The same |
| [10.5281/zenodo.22064241](https://doi.org/10.5281/zenodo.22064241) | Fragmentarian Spiritual Individualism | `abstract-missing` | The same |
| [10.5281/zenodo.23114131](https://doi.org/10.5281/zenodo.23114131) | 「30歳魔法使い」都市伝説の構造分析 | `abstract-missing` | The same |
| [10.17605/osf.io/mq7za](https://doi.org/10.17605/osf.io/mq7za) | Sophaxis: An Independent Overlay Preprint Server (OSF; not in the catalogue) | `licence-missing` | No licence on the OSF record |

The papers carry their abstracts in the PDF. The metadata, which indexes read, does not.

### Warnings

| Rule | DOIs | What is missing |
| --- | --- | --- |
| `keywords-missing` | Zenodo: 22055709, 22057583, 22058254, 22058624, 22058777, 22058964, 22064241, 23114131. figshare: 34419198. SSRN: 7358779, 7358818, 7446961, 7449338, 7537983. OSF: mq7za | No keywords (subjects). The terms in cpsbvbng26-dotcom's `docs/keywords.json` are the ones that keep them the same across works |
| `abstract-short` | 10.5281/zenodo.24033082 (deposit-check 0.1.0) | The description is a one-line summary, not the abstract of `paper/paper.md` |
| `openalex-abstract-missing` | 10.5281/zenodo.24033082, and SSRN 7358779, 7358818, 7446961, 7449338, 7537983 | OpenAlex has no abstract. It reads one from the metadata when it next updates the work, and only where the metadata has one |
| `not-on-orcid` | Every work in the catalogue except the SSRN copies already on the record (7358779, 7358818, 7449338, 7537983); and OSF mq7za | The works are not on the ORCID record |

### Notes

- `language-missing`: no language in the metadata of most records (see the report). Zenodo has a language field; it applies to the next version or to an edit of the record.
- `relations-none`: the SSRN copies and the OSF record link to nothing. The Zenodo records can link to the SSRN copies (for example IsIdenticalTo), as the catalogue already pairs them.
  - Added on 2026-11-12: the Zenodo side was already done. DataCite, read on 2026-11-12, gives each of the Zenodo records 22058254, 22057583, 22058777 and 22055709 an IsIdenticalTo to its SSRN copy, and the records were last updated before this run. An SSRN record cannot carry the link, so `relations-none` on the copies stays. The rule `identical-unlinked` now checks these pairs, from the catalogue's other DOIs.
- `type-unexpected` did not fire: every DataCite record has the type the catalogue gives it.
- `owner-orcid-missing` did not fire: every record carries the author's ORCID iD.

## Title, creator and date, compared with the catalogue

The rules do not compare a record with the catalogue. These were compared by reading the same metadata (DataCite and Crossref, 2026-11-11) against `catalog.json`.
Decided on 2026-11-12: the catalogue entries in the table below are not changed to match the registries. The catalogue is the source the site is built from, and some registry titles are the ones in error, such as the Kangxi radicals in the SSRN title below. A difference stays listed here until the registry record changes; the registry records cannot be edited from here.

| DOI | Field | Registry | Catalogue |
| --- | --- | --- | --- |
| 10.5281/zenodo.22058624 | Title | The Trinity-Infinity Framework: A Conceptual Model with … | The Trinity-Infinity Framework, Series I: A Conceptual Model with … |
| 10.5281/zenodo.22058624 | Dates | Two dates of the type Issued, 2026-08-22 and 2025-09-22 | (no date) |
| 10.5281/zenodo.22058624 | Relations | IsVersionOf 10.5281/zenodo.17173702 | No DOI of all versions |
| 10.5281/zenodo.23114131 | Title | 「30歳魔法使い」都市伝説の構造分析 | The same, followed by —— クラスチェンジと強化解除の物語的メカニズム |
| 10.5281/zenodo.22685687 | Title | The English title followed by / 凍結された公開物に対する、決定的な正誤表の監査 | The English title only |
| 10.2139/ssrn.7449338 | Title | Lieutenant Otani Tsune (⼤⾕恒), written with the Kangxi radicals U+2F24 and U+2F95 | 大谷恒, with the ordinary characters U+5927 and U+8C37. A search for 大谷恒 does not find the SSRN record |
| 10.2139/ssrn.7449338 | Title | Ends after the name | Followed by the subtitle (A Note on the Investiture List …) |
| 10.2139/ssrn.7358779 | Title | The Nobility and Exemplarity of the Celibate Individual | Followed by the subtitle (An Antinatalist and Ascetic Reconsideration …) |
| 10.2139/ssrn.7446961 | Title | Ends with Revised Edition | No Revised Edition |
| 10.2139/ssrn.7358779 | Licence | A link to the USPTO page on copyright basics | CC BY 4.0, as on Zenodo |
| 10.2139/ssrn.7358818 | Licence | A link to the USPTO page on copyright basics | CC BY 4.0, as on Zenodo |

The creator agrees everywhere: Nemoto, Takuya, with the ORCID iD (figshare writes the name in the other order).
The year of publication is 2026 on every record. SSRN gives the year only.

These identifiers came up, and the catalogue does not give them:
- 10.17605/osf.io/mq7za, the OSF record of Sophaxis, which carries the author's iD;
- 10.5281/zenodo.24033081, the DOI of all versions of deposit-check, which this repository's README gives and the catalogue leaves empty.

## What cannot be fixed from here

Every finding above is on a service this repository cannot write to: Zenodo, figshare, OSF, SSRN and ORCID are edited only from the author's accounts.
None of them has been fixed. Running the same command again shows what is left.
