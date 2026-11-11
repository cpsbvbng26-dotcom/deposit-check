# Changelog

## Unreleased

- A rule, `type-unexpected`: the resource type registered at DataCite (`resourceTypeGeneral`) differs from the type expected for the DOI. The expected types are given in a JSON file with `--expect-types`, or the action's `expect-types` input; each DOI in the file is checked as well. A type given for the DOI of all versions holds for each version.
- `--answers` reads the answers of the APIs from a JSON file instead of the network.
- `examples/`: made-up deposits, their recorded answers and the report, to try the tool in a minute without the network. The checks run the example and compare the report.
- The CI uses the action on the repository itself, on the example: it passes, and it fails once warnings count.
- The README gives the type and status of the repository, a figure of what goes in and what comes out, a table of releases and their DOIs, and that only the standard library of Node.js is used. The checks compare each with the repository.
- The checks break a complete record once for each rule that reads a single record, and the README gives their number.
- A bug report form (`.github/ISSUE_TEMPLATE/bug_report.yml`) that asks for the steps to reproduce, the version and the environment.

## 0.1.0 (2026-11-07)

- Released on GitHub and archived at Zenodo: version DOI 10.5281/zenodo.24033082, and 10.5281/zenodo.24033081 for every version. The README, in both languages, and `CITATION.cff` give both.

- A draft of the JOSS paper, `paper/paper.md` and `paper/paper.bib`.
- Two rules read OpenAlex (#7): `openalex-missing` (the index does not hold the work) and `openalex-abstract-missing` (the DOI metadata has an abstract and the index has none). An OpenAlex that cannot be read gives no finding.
- `CONTRIBUTING.md` (#6): where each kind of contribution goes, and how to check a change.
- The README records that a submission to JOSS is planned, from 2027-05-03 at the earliest (#5).
- The weekly run keeps one open issue for the author's own iD, comments when the counts change, and closes it when no error or warning is left. `--json-out` writes the JSON report beside another format (#3).

After the first run against the live APIs (#2):

- The DataCite search asks for the iD both bare and as a URL. Zenodo stores the bare iD; the URL alone found 4 of one author's 34 DOIs, none of them at Zenodo.
- Of the versions of one work, only the latest is checked, and a work missing from the ORCID record is reported once. Figshare versions, tied by their DOIs, are not flagged as unlinked.

The first version (#1):

- The works of an ORCID iD, from the ORCID record and from the DataCite and Crossref metadata that carries the iD.
- The metadata of a DOI from DataCite, Crossref or JaLC.
- The rules listed in the README, a report in Markdown or JSON, and a GitHub Action.
- Checks that run without the network, on made-up records.
