# Changelog

## 0.1.0 (unreleased)

- The README records that a submission to JOSS is planned, from 2027-05-03 at the earliest.
- The weekly run keeps one open issue for the author's own iD, comments when the counts change, and closes it when no error or warning is left. `--json-out` writes the JSON report beside another format (#3).

After the first run against the live APIs (#2):

- The DataCite search asks for the iD both bare and as a URL. Zenodo stores the bare iD; the URL alone found 4 of one author's 34 DOIs, none of them at Zenodo.
- Of the versions of one work, only the latest is checked, and a work missing from the ORCID record is reported once. Figshare versions, tied by their DOIs, are not flagged as unlinked.

The first version (#1):

- The works of an ORCID iD, from the ORCID record and from the DataCite and Crossref metadata that carries the iD.
- The metadata of a DOI from DataCite, Crossref or JaLC.
- The rules listed in the README, a report in Markdown or JSON, and a GitHub Action.
- Checks that run without the network, on made-up records.
