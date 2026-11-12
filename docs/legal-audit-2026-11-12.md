# Legal audit (2026-11-12)

This page records the part of the legal audit of 2026-11-12 that concerns deposit-check. Claude carried out the audit.
It covers the licence statements (README, LICENSE, CITATION.cff, .zenodo.json), the metadata the tool reads, the examples and fixtures, and the record of the run over the author's works (docs/runs/).
The audit of the disclaimer that covers the ten repositories, and the way the statutes were fetched, are in the [record in cpsbvbng26-dotcom](https://github.com/cpsbvbng26-dotcom/cpsbvbng26-dotcom/blob/main/docs/legal-audit-2026-11-12.md).
This page records the maintainer's own position. It is not legal advice to readers.

## Method

Each place that states or relies on law or on a licence was listed, and every article cited was read in a fetched text.
No statute was written from memory.
The Japanese statutes were fetched from e-Gov by Sophaxis's fetch workflow and copied into [verification/statutes.json](https://github.com/cpsbvbng26-dotcom/cpsbvbng26-dotcom/blob/main/verification/statutes.json) in cpsbvbng26-dotcom; its `check_ecosystem.js` confirms that every article cited here is in that file.
Japanese law names are kept in Japanese so that the check can match them.
Findings are one of: Error, Insufficient basis, Omission, Wording, No problem.

## Table

| Place | Law and article | Requirements | Facts | Finding | Action |
| --- | --- | --- | --- | --- | --- |
| README "Licence" | 著作権法第21条 (Copyright Act, Art. 21), CC BY 4.0 Section 3 | Reproduction is the author's right, and the scope of a licence is set by the licensor's statement. Section 3 asks reusers for attribution, a notice of the licence with its URI, and an indication of changes | The README said the text is under CC BY 4.0 without a link to the licence. LICENSE, CITATION.cff and .zenodo.json name only the MIT licence | Wording | The README now links the licence and says what Section 3 asks for. verification/check.js now requires the link |
| What the tool reads | 個人情報保護法第2条 (APPI, Art. 2), 個人情報保護法第16条 (Art. 16) | Personal information is information about a living individual. A business operator handling personal information is one that uses a personal information database for its business | The tool runs on the user's own machine and reads public metadata (names, ORCID iDs) from DataCite, Crossref, ORCID, OpenAlex and JaLC. The maintainer receives none of it | No problem | None |
| docs/runs/2026-11-11-catalog | 著作権法第2条 (Copyright Act, Art. 2), Zenodo Terms of Use | A work is a creative expression. Zenodo metadata may be reused under CC0 unless specified otherwise | The report holds the metadata of the author's own works, as the APIs returned it | No problem | None |
| Examples and fixtures | 個人情報保護法第2条 (APPI, Art. 2) | Information that identifies a specific living individual | The records are made up: DataCite's test prefix 10.5072 and ORCID's fictitious researcher Josiah Carberry. The one Japanese name is a placeholder | No problem | None |
| Terms of the APIs the tool calls | none | The terms of DataCite, Crossref, ORCID, OpenAlex and JaLC for their public APIs | They were not considered before, and were not fetched in this audit | Omission | Recorded here. The tool sends a descriptive User-Agent and reads only public records |

## 2026-11-12 の続き：リスクを締めた

On the same day, the owner asked for the legal risk to be tightened further (「法的リスクをさらにシメて」).
The places that rest on an uncertain reading were read again under the stricter reading.
Where an option holds under the stricter reading and costs nothing, it was taken.
Places that rest on a text that could not be fetched are not handled in this section.

| Place | Law and article | Requirements | Facts | Finding | Action |
| --- | --- | --- | --- | --- | --- |
| docs/runs/2026-11-11-catalog | 個人情報保護法第2条 (APPI, Art. 2), 個人情報保護法第27条 (Art. 27) | Personal information is information about a living individual. A business handling personal information does not pass personal data to a third party without consent | The report holds the metadata of the author's own works only. No other person's name or contact is in it | No problem | None |
| README promises about the tool's results | 民法第709条 (Civil Code, Art. 709) | A person who infringes another's rights or legally protected interests by intent or negligence compensates the loss | The README describes what the rules check and does not promise that the registries are complete or that every gap is found. The MIT License disclaims warranties | No problem | Kept. Claude decided this on 2026-11-12 (2026-11-12 に Claude が決めました), because the text already describes and does not promise |
| Crossref contact address | 個人情報保護法第2条 (APPI, Art. 2) | Information that identifies a specific living individual | No address is built in. It comes only from `DEPOSIT_CHECK_MAILTO` that the user sets | No problem | None |

## 2026-11-12 の続き：取り寄せた周辺の文

Some texts listed above as not fetched were fetched on the same day by Sophaxis's fetch workflow.
They are in `verification/sources-raw.json` on Sophaxis's main (commit 6b40d77, PR #218).
Each conclusion was checked again against them.
Terms of use are works, so only the phrases relied on are quoted here.

| Place | Law and article | Requirements | Facts | Finding | Action |
| --- | --- | --- | --- | --- | --- |
| Calls to ORCID | ORCID Public APIs Terms of Service | The Public APIs may be used only for non-commercial use: no re-use fees and no use "in connection with any revenue-generating product or service". ORCID may rate-limit | The tool is free under the MIT License, charges nothing and is not part of a product that earns revenue. It reads public records only | No problem | None |
| Calls to OpenAlex | OpenAlex licence page and rate-limit page | OpenAlex data is under CC0 ("free to use in any way you like"). Free use has a daily credit budget and at most 100 requests per second | The tool reads one record at a time and pauses between requests (`src/fetch.js`) | No problem | None |
| Calls to DataCite | DataCite Terms and Conditions, DataCite API documentation | The terms cover the material on the DataCite website. The API documentation lists a question on rate limits | The tool reads DOI metadata through the public REST API and does not copy the website | No problem | None |
| Calls to Crossref | Crossref REST API documentation | The page describes the public REST API. The page on the licence of the metadata returned 404 | The tool reads metadata of the works it is given. No contact address is built in | Insufficient basis | Kept. Claude decided this on 2026-11-12 (2026-11-12 に Claude が決めました), because the tool reads only the records it is asked about and quotes nothing beyond the fields it reports |
| Calls to JaLC | JaLC pages (top, metadata, FAQ) | The fetched pages describe membership and DOI registration. No terms for the public API were found on them | The tool reads public metadata only | Insufficient basis | Kept. The API terms are listed as not fetched below |
| paper/ and JOSS | JOSS policies and paper page | Authors of JOSS papers retain copyright, and papers are under CC BY 4.0 ("papers retain copyright") | The repository's text is under CC BY 4.0 and the author keeps the copyright | No problem | None |

## 2026-11-12 の続き：二度目の見落とし

On the same day, another read-only pass was made by a different hand. It found what the sections above had missed.
The earlier rows are a record of what was checked at the time, so they are kept.
The statute is quoted from the fetched text copied into `verification/statutes.json` in cpsbvbng26-dotcom.

| Place | Law and article | Requirements | Facts | Finding | Action |
| --- | --- | --- | --- | --- | --- |
| SECURITY.md | Civil Code Article 709 | The fetched text: 「故意又は過失によって他人の権利又は法律上保護される利益を侵害した者は、これによって生じた損害を賠償する責任を負う」. A channel that does not exist must not be promised to someone who relies on it | SECURITY.md promised GitHub's private vulnerability reporting. On 2026-11-12 the GitHub API returned `enabled: false` for this repository. It is a repository setting, and Claude has no tool that changes it | Error | Rewritten: security issues are received at the email address on the operator's ORCID record, and GitHub's private reporting is stated to be not enabled, with the date it was checked. The text is the same in the ten repositories and here; `check_ecosystem.js` (12j) in cpsbvbng26-dotcom checks it. Claude decided this on 2026-11-12 (2026-11-12 に Claude が決めました), because the only channel that exists is the one the disclaimer already uses |

## 2026-11-12 の続き：四度目の見落とし

On the same day, a fourth read-only pass was made by a different hand. It found what the sections above had missed.
The earlier rows are a record of what was checked at the time, so they are kept. Where an earlier row was wrong, the new row says so and why.
The statute is quoted from the fetched text copied into `verification/statutes.json` in cpsbvbng26-dotcom.

| Place | Law and article | Requirements | Facts | Finding | Action |
| --- | --- | --- | --- | --- | --- |
| README "Licence" and the Japanese section | 著作権法第21条 (Copyright Act, Art. 21) | The fetched text: 「著作者は、その著作物を複製する権利を専有する。」 (SHA-256 `a85d04f2fd20d7867d5579bee40676b13405c58ea7fd7eb27f1e7a5a03bda100`). A licensor can license only what it holds; a licence statement must not read as covering texts by others | The README gave the MIT licence for the code and CC BY 4.0 for the documents, and said nothing about texts by others. Sophaxis had added that sentence in the first follow-up section; it had not reached this repository. The row "README \"Licence\"" in the table above looked at the link to the licence, not at texts by others | Omission | Added, in English and in Japanese: "Texts by others that this repository quotes, or keeps to verify its quotations, are not licensed under CC BY 4.0 or the MIT License and remain their owners'." `check_ecosystem.js` (12l) in cpsbvbng26-dotcom checks it. Claude decided this on 2026-11-12 (2026-11-12 に Claude が決めました), so that the scope is written as Sophaxis writes it |
| CITATION.cff `message` and .zenodo.json `notes` | 著作権法第21条 (Copyright Act, Art. 21) | As above. The licence field of citation metadata holds one licence, so what it covers is stated elsewhere | Both licence fields say MIT. The CITATION.cff message said nothing about scope; the .zenodo.json notes said the code is MIT and the documents CC BY 4.0, but not what the field covers. The table above (README "Licence" row) noted that these files name only the MIT licence and left them | Wording | Both now say that the code is MIT, the README and the other documents CC BY 4.0, that the licence field covers the code only, and that texts by others are not licensed. 12l checks both files and that the layout matches `licenceLayout` in the catalogue. Claude decided this on 2026-11-12 (2026-11-12 に Claude が決めました), to match the scope note Sophaxis's CITATION.cff gained in the third follow-up section |
| README, Japanese section: what the tool reads | none (accuracy) | The list of services the tool calls is complete wherever it is given | The English part lists OpenAlex; the Japanese bullets named only DataCite, Crossref and JaLC for the metadata and left out OpenAlex, which `src/fetch.js` calls for each DOI. The profile pages in cpsbvbng26-dotcom said the tool reads only DataCite, Crossref, JaLC and ORCID | Wording | Added a Japanese bullet that the tool also reads whether OpenAlex holds each work and its abstract. The profile pages now name OpenAlex. 12l compares the names on the profile pages and in this README's diagram with the hosts in `src/fetch.js`. Claude decided this on 2026-11-12 (2026-11-12 に Claude が決めました), so that the list can be checked against the code |

## 2026-11-12 の続き：八度目の見落とし

An eighth read-only pass was made by a different hand. It found what the sections above had missed.
The changes were made on 2026-11-13, Japan time. The earlier rows are a record of what was checked at the time, so they are kept.
Section I of the GitHub Terms of Service says: “Some Service features may be subject to additional terms specific to that feature or product as set forth in the GitHub Additional Product Terms.”
The earlier passes had not fetched those terms (the GitHub Terms for Additional Products and Features).
They were fetched directly from raw.githubusercontent.com on 2026-11-13, at commit `166eb97e485b7de3cd5dbaf8c8d16e4310fda46c` of `github/site-policy`. The SHA-256 of the file is `c39b5a7fc1953ebd37428db18101726acefb55420f766bcd7d912e1b71ee2ffc`.
Their section on Actions says: “Additionally, regardless of whether an Action is using self-hosted runners, Actions should not be used for:” Two of the items listed are these.
“Any activity that places a burden on our servers, where that burden is disproportionate to the benefits provided to users (for example, don't use Actions as a content delivery network or as part of a serverless application, but a low benefit Action could be ok if it’s also low burden); or”
“If using GitHub-hosted runners, any other activity unrelated to the production, testing, deployment, or publication of the software project associated with the repository where GitHub Actions are used.”
The same section says: “Misuse of GitHub Actions may result in termination of jobs, restrictions in your ability to use GitHub Actions, disabling of repositories created to run Actions in a way that violates these Terms, or in some cases, suspension or termination of your GitHub account.”
Both workflows of this repository run on GitHub-hosted runners (`ubuntu-latest`), so each was read against these items. The row of a workflow starts with the name of its file under `.github/workflows/`.
The run times are medians of the latest runs (at most 300) that the GitHub API returned on 2026-11-13.
Dependabot's version updates are a feature of GitHub, not a file of this repository, and are not listed.
The quoted text is copied into `verification/statutes.json` in cpsbvbng26-dotcom (“GitHub の利用規約 I” and “GitHub の追加製品の規約 Actions”); the same section is in the records of all 13 repositories.
The OpenAlex documents were fetched by Sophaxis's fetch workflow on 2026-11-12 and again on 2026-11-13, Japan time (run 43308144509), at commit `8cec9dba1ee17af56e5de4666f63650a02fb798b` of `ourresearch/openalex-docs`, with the same SHA-256 both times.

| Place | Law and article | Requirements | Facts | Finding | Action |
| --- | --- | --- | --- | --- | --- |
| GitHub Additional Product Terms (section on Actions) | GitHub Terms of Service, I; GitHub Additional Product Terms, Actions | The terms of a service used are fetched and read | Section I of the Terms of Service brings in these terms; no earlier pass had read them | Omission | Fetched and quoted here; the text is copied into `verification/statutes.json` in cpsbvbng26-dotcom, and Sophaxis watches it weekly. Claude decided this on 2026-11-13 (2026-11-13 に Claude が決めました). These terms decide what the workflows may be used for |
| `.github/workflows/check.yml` (every push and pull request, and every Thursday at 13:37 Japan time) | GitHub Additional Product Terms, Actions | On GitHub-hosted runners, the use must relate to the production, testing, deployment or publication of the software project of the repository; the burden must not be disproportionate to the benefit | Runs `verification/check.js`. The weekly run finds a key or an address on a quiet day too. Median run time 10 seconds | No problem | Kept. It is testing, and its weekly burden is seconds |
| `.github/workflows/run.yml` (by hand; until 2026-11-13 also every Tuesday at 14:23 Japan time) | GitHub Additional Product Terms, Actions | On GitHub-hosted runners, the use must relate to the production, testing, deployment or publication of the software project of the repository; the burden must not be disproportionate to the benefit | Runs the tool against the live APIs for the author's iD and every DOI in the catalogue of the author's works, keeps the report as an artifact, and keeps one issue with the latest findings. The checks use made-up records only, so this run is the only test of the tool against the APIs as they are. Median run time 53 seconds. The weekly schedule also served the author as a monitor of the author's own records, which is not a purpose that the terms list | Omission | The schedule is now once a month (the 9th, at 14:23 Japan time), and the workflow, the README, the paper draft and the issue text say so. Claude decided this on 2026-11-13 (2026-11-13 に Claude が決めました). A test against the live APIs is testing of the tool; once a month is enough to find a change in an API, and a weekly monitor of the author's records is not needed for the project |
| OpenAlex API (`src/fetch.js`) | OpenAlex documents (licence; rate limits and authentication) | The terms of an API called allow the use | The licence says: “That means it's in the public domain, and free to use in any way you like.” The page on limits says: “The OpenAlex API doesn't require authentication.” It gives “100,000 singleton requests (like `/works/W123`)” as an example of the daily limit, and says: “If you exceed your daily credits or make more than 100 requests per second, you'll get `429` errors instead of useful data.” The tool reads one work per DOI, one request at a time, 300 milliseconds apart | No problem | Kept. The use is far below both the daily limit and the limit per second. The two documents were quoted again here, from the texts fetched before, with the same SHA-256 |
| The check (`verification/check.js`) | none | Each workflow's judgement is pinned by a check | There was none | Omission | Added: every file in `.github/workflows/` has a row in this section, and no row names a missing file; `run.yml` runs at most once a month. `check_ecosystem.js` (12o) in cpsbvbng26-dotcom checks the 13 repositories the same way. Claude decided this on 2026-11-13 (2026-11-13 に Claude が決めました). So that a new workflow cannot be added without being judged against the terms |

Findings in this table: Omission 3, No problem 2.

No lawyer has reviewed this section.

## 2026-11-12 の続き：十度目の見落とし

A tenth read-only pass was made by a different hand. It found what the sections above had missed.
The changes were made on 2026-11-13, Japan time. The earlier rows are a record of what was checked at the time, so they are kept.
The citation metadata of this repository described what the tool reads in an older form.
The description in `.zenodo.json` named DataCite, Crossref and JaLC, and not OpenAlex; the description in `package.json` did the same.
`src/fetch.js` also asks api.openalex.org about each DOI, and pub.orcid.org for the works on the record.
The description in `.zenodo.json` and both languages of the README said that only the ORCID iD and the DOIs are sent.
When a contact address is given in `DEPOSIT_CHECK_MAILTO` (or the action's `mailto` input), `src/fetch.js` adds it to the User-Agent of every request.
The DataCite record of version 0.1.0 (https://api.datacite.org/dois/10.5281/zenodo.24033082, read on 2026-11-13 at 8:06 Japan time; SHA-256 of the whole response `fbf68c94a306705b8e431447a355447b7c1eb52477bd5e66148b342f09955ac9`) has the abstract “No description provided.”, so the frozen record does not carry the older sentence.

| Place | Law and article | Requirements | Facts | Finding | Action |
| --- | --- | --- | --- | --- | --- |
| `.zenodo.json` description and `package.json` description: what the tool reads | none (accuracy) | The list of services the tool calls is complete wherever it is given | Both named DataCite, Crossref and JaLC only. The row “README, Japanese section: what the tool reads” in the section on the fourth pass above made the README complete, but did not look at these two files | Wording | Both now name the public APIs of ORCID, DataCite, Crossref, JaLC and OpenAlex. `check_ecosystem.js` (12l) in cpsbvbng26-dotcom now reads both files and compares the names with the hosts in `src/fetch.js`. Claude decided this on 2026-11-13 (2026-11-13 に Claude が決めました). So that the list is checked against the code in every place it is given. |
| `.zenodo.json` description and the README (English and Japanese): what the tool sends | none (accuracy) | What the tool sends is stated as the code sends it | They said that only the ORCID iD and the DOIs are sent. A contact address, when one is given, goes in the User-Agent of every request | Wording | They now say that the ORCID iD and the DOIs are sent, and a contact address only when one is given. Claude decided this on 2026-11-13 (2026-11-13 に Claude が決めました). So that the sentence holds for every way the tool can be run. |
| `.zenodo.json` notes and `CITATION.cff` message: the licence field | 著作権法第21条 (Copyright Act, Art. 21) | What the licence field covers matches the value of the field | Both say the field covers the code only; both fields are MIT | No problem | Kept. `check_ecosystem.js` (12l) in cpsbvbng26-dotcom now compares the sentence with the value of the field. |

Findings in this table: Wording 2, No problem 1.

No lawyer has reviewed this section.

## Laws checked

- GitHub Terms of Service (section I) and GitHub Additional Product Terms (section on Actions), fetched from `github/site-policy` on 2026-11-13
- 著作権法 (Copyright Act: Art. 2, 21)
- 個人情報保護法 (Act on the Protection of Personal Information: Art. 2, 16, 27)
- 民法 (Civil Code: Art. 709)
- CC BY 4.0 legal code (Section 3); Zenodo Terms of Use
- Terms of ORCID (Public APIs), DataCite and the documentation of the DataCite, Crossref and OpenAlex APIs; JaLC pages; JOSS policies

## Texts that could not be fetched

- The terms of use of JaLC's public API were not found on the fetched JaLC pages.
- Crossref's page on the licence of REST API metadata returned 404.

## Lawyer

Claude carried out this audit.
No lawyer has reviewed this audit.
