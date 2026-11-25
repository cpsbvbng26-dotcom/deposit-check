---
title: 'deposit-check: checking the DOI metadata of a researcher''s deposits against their ORCID record'
tags:
  - DOI
  - ORCID
  - DataCite
  - Crossref
  - metadata
  - open science
authors:
  - name: Takuya Nemoto
    orcid: 0009-0000-1406-0547
    affiliation: 1
affiliations:
  - name: ZEN University, Japan
    index: 1
date: 25 November 2026
bibliography: paper.bib
---

<!-- Draft. Not submitted. JOSS asks for a repository public for more than six months; the earliest date is 2027-05-03.
     Each DOI in paper.bib was read at Crossref or DataCite on 2026-11-25; verification/paper-dois.json records what each registry gave.
     JOSS asks the authors to affirm that they reviewed, edited and validated all AI-assisted output and made the core design
     decisions, and to acknowledge any financial support. Both statements are the author's own. Claude, which drafted this
     paper, cannot make them for the author, and this draft does not contain them. -->

# Summary

Researchers deposit preprints, datasets and software in repositories such as Zenodo [@zenodo], and each deposit receives a DOI.
Search services, open indexes such as OpenAlex [@openalex] and the ORCID registry of researchers [@orcid] do not read the deposited file.
They read the metadata registered with the DOI: the title, the creators and their identifiers, the abstract, the licence, the type and the links to other versions.
deposit-check reads that metadata for all the works of one researcher and says what is missing or inconsistent.
Given an ORCID iD, it gathers the works on the public ORCID record and the works whose DataCite [@datacite] or Crossref [@crossref] metadata carries the iD.
It reads the metadata of each DOI from DataCite, Crossref or JaLC [@jalc], and asks OpenAlex whether it holds each work and its abstract.
It then applies nineteen rules and writes a report in Markdown or JSON that says, for each finding, which record holds the field and where it is changed.
It runs from the command line or as a GitHub Action, needs no key or account, and writes nothing anywhere.

# Statement of need

The FAIR principles ask that research outputs be findable, accessible, interoperable and reusable, and they place much of that burden on metadata [@fair].
For a single deposit, the burden falls on the person who fills in the repository's form.
The repository leaves most fields optional, and its web page shows the deposit, not how the registered metadata reads to a machine.
The gaps have consequences that the depositor does not see.
DataCite's automatic update of ORCID records, for example, adds a work to a researcher's record only when the DOI metadata carries the researcher's iD [@autoupdate].
An index that finds no abstract in the metadata shows none, even when the PDF has one.
A researcher who deposits in several repositories has no single view of all this.

The need arose in practice.
When the author listed their own preprints on Sophaxis [@sophaxis], an overlay preprint server that the author also runs, most of the DataCite records had no abstract in their metadata, and none of the author's Zenodo deposits were on the author's ORCID record.
Neither fact was visible on the repository's own pages.

deposit-check is meant for researchers who deposit their own work, and for the people who support them: library and repository staff, and the moderators of overlay servers, who need to tell a submitter what to fix in the metadata.

# State of the field

Tools that assess metadata exist, but they work at other scales than one person.

Crossref's Participation Reports show each Crossref member how complete its metadata is [@participation], and the Crossref REST API gives, for each member, the share of its records that carry abstracts, ORCID iDs, licences and references.
They describe a publisher, and only its Crossref records.
DataCite's own work on metadata quality, such as the assessment of completeness across repositories and organisations presented by @brightspots, also takes the repository or the organisation as its unit.
The Academic Observatory Workflows of the Curtin Open Knowledge Initiative [@coki] gather Crossref, OpenAlex, ORCID and other sources in Apache Airflow pipelines, to analyse academic institutions.
F-UJI [@fuji; @fujisoftware] is the nearest in form: a service that assesses one research data object at a time, by its identifier, against the FAIRsFAIR metrics.
The OpenCitations DOI ORCID Index [@doiorcid] links DOIs to the ORCID iDs of their authors from the ORCID public data file, to enrich the metadata that an index holds.
ORCID's search-and-link tools and the automatic updates from DataCite and Crossref add works to a record, and clients of the ORCID API, such as the now archived rorcid [@rorcid], return records without judging them.

None of these starts from one researcher, reads every registration agency that holds the researcher's DOIs, compares the result with the researcher's ORCID record, and says for each finding what the researcher can change.
Contributing that to an existing tool was considered.
F-UJI scores one object against fixed metrics; a person-level mode would add the ORCID record, the search of two agencies by iD, the grouping of versions across repository conventions and a comparison that its model does not have.
Participation Reports and the DataCite assessments are run by the registration agencies for their members, and address the member rather than the creator.
deposit-check therefore reads the same open APIs that these services expose, instead of reproducing their data, and stays small and free of dependencies, so that another tool's workflow can run it, as Sophaxis does.

# Software design

The tool is written in JavaScript for Node.js and uses only its standard library.
The choice costs some convenience, such as writing a small reader of the markup that abstracts carry, and gains a tool that runs in another repository's workflow with nothing to install, whose supply chain is the Node.js runtime alone.

It has three parts: a reader, the rules and a reporter.

The reader is the only module that reaches the network.
It makes GET requests one at a time, a moment apart, and retries a refused or failed request twice, after five and twenty seconds.
The monthly run over the author's works takes about a minute; the trade is speed for courtesy to public APIs that need no key.
The fetching function is passed in as an argument, so the whole tool runs in its tests, and from the command line with `--answers`, on recorded answers instead of the network.
A DOI that cannot be read because of the network or an API is reported as not checked, never as a fault of the record.
The search of DataCite asks for the iD both bare and as a URL, because the first live run found that Zenodo stores the bare iD and Figshare and OSF store its URL.

Each agency's metadata is read into one shape, with Crossref's relations given in DataCite's terms, so that each rule is written once.
What an agency records outside that shape is not kept, which keeps the rules simple and loses nothing that a rule reads.

Each rule is a pure function of one record or of the whole set of records, with a severity and a fix.
The versions of one work are read together: only the latest version that was read is checked, and a work missing from the ORCID record is reported once.
Without this, a work deposited in five versions would raise every finding five times.
Zenodo ties versions to a record of all versions, and Figshare by suffixes of the DOI; both conventions are read.
Some faults cannot be seen in the metadata at all: a program registered as a dataset, or a Zenodo paper whose SSRN copy is not linked.
Rather than guess, the tool takes the expected type and the known copies of each DOI from a JSON file that the user gives.

The reporter writes Markdown for people and JSON for programs, and its exit status says whether any finding reached the chosen severity, so that a repository's CI can fail on missing metadata.

The checks run without the network, on made-up records that use test DOI prefixes and the fictitious researcher that ORCID documents.
A complete record is broken once for each rule that reads a single record, and each break must raise its rule and no other.

# Research impact statement

The use so far is the author's own, in two places, and it is public.

A monthly workflow in the repository runs the tool against the live APIs for the author's ORCID iD and for every DOI in the catalogue of the author's works, and keeps one issue with the latest findings.
The run of 2026-11-11 over the catalogue is kept with its report in `docs/runs/2026-11-11-catalog`.
It read fifty-four DOIs and found eight errors, forty-five warnings and twenty-seven notes.
Seven Zenodo deposits had no abstract in their metadata, although the papers carry one in the PDF; an OSF record had no licence; and most works were missing from the author's ORCID record.
The tool changes nothing, and the records are edited only from the author's accounts at each repository.

Since 2026-11-02, Sophaxis has run deposit-check in its submission check, pinned to a commit, and has put its errors and warnings in the comment to the submitter as advice that does not decide the listing.
On 2026-11-15 Sophaxis moved its pin to the commit in which a DOI that cannot be read is reported as not checked, rather than passing as a record without findings.

There is no record yet of use by other authors.

# AI usage disclosure

The software, its checks, its documentation and this paper were written with Claude Code (Anthropic), a generative AI coding tool, at the author's request.
The commits name the models Claude Opus 5 and Claude Opus 5.5 in their trailers, and every commit up to this draft that is not a merge has Claude as its author.
The assistance covered code generation, test generation, refactoring, the documentation, the drafting of this paper, and the search for its references and the retrieval of their metadata.

Correctness was checked by means that do not rely on the model's own account.
The checks run on every push and pull request, without the network, and many of them break their own input on purpose and must see it fail.
The paper's sections, length and citations are checked against `paper.bib`, and each DOI in `paper.bib` was read at Crossref or DataCite, which `verification/paper-dois.json` records.
The tool was run against the live APIs on the author's own works.
Claude is not an author.

# Acknowledgements

deposit-check depends on the open APIs of ORCID, DataCite, Crossref, JaLC and OpenAlex.
deposit-check is not a project of ZEN University, and the university does not endorse it.

# References
