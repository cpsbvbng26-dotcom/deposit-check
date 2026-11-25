# Deposit check

2 DOIs read. 0 errors, 1 warnings, 0 notes.

## An Example Program

https://doi.org/10.5072/example.1 · DataCite · Zenodo

| | Rule | Found |
| --- | --- | --- |
| warning | The resource type differs from the type expected for the DOI (`type-unexpected`) | registered as Dataset, expected Software |

## Where each field is changed

Each field is held in the DOI metadata that a repository or a publisher registered with DataCite, Crossref or JaLC, in the ORCID record, or at OpenAlex, and is changed only where it is held. This tool reads them and changes none of them.

- **`type-unexpected`** The resource type is part of the DOI metadata, set at the repository (on Zenodo, the Resource type of the record). The expected type is the one in the file given with --expect-types, so the difference lies in one of the two. The type compared is DataCite’s resourceTypeGeneral, so only records registered by DataCite are compared.
