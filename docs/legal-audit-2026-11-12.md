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

## Laws checked

- 著作権法 (Copyright Act: Art. 2, 21)
- 個人情報保護法 (Act on the Protection of Personal Information: Art. 2, 16, 27)
- 民法 (Civil Code: Art. 709)
- CC BY 4.0 legal code (Section 3); Zenodo Terms of Use

## Texts that could not be fetched

- The terms of use of the public APIs of DataCite, Crossref, ORCID, OpenAlex and JaLC were not fetched.
- The JOSS policy on the licence of published papers was not fetched.

## Lawyer

Claude carried out this audit.
No lawyer has reviewed this audit.
