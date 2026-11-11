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
bibliography: paper.bib
---

<!-- Draft. Not submitted. JOSS asks for a repository public for more than six months; the earliest date is 2027-05-03.
     The references carry no DOIs yet: add a DOI only after checking it at its source. -->

# Summary

deposit-check reads the DOI metadata of a researcher's works and reports what is missing or inconsistent.
Given an ORCID iD [@orcid], it gathers the works on the public ORCID record and the works whose DataCite [@datacite] or Crossref [@crossref] metadata carries the iD.
It reads the metadata of each DOI from DataCite, Crossref or JaLC [@jalc], and checks how OpenAlex [@openalex] holds each work.
It then applies eighteen rules and writes a report in Markdown or JSON, with what to change at the repository for each finding.
It runs from the command line or as a GitHub Action, needs no key, and writes nothing anywhere.

# Statement of need

Indexes, aggregators and ORCID's automatic updates read the metadata registered with a DOI, not the deposited file.
A preprint deposited without an abstract or a licence in its metadata, or without the author's ORCID iD on the author's name, is harder to find, to credit and to reuse, which the FAIR principles set as goals for research outputs [@fair].
Repositories such as Zenodo [@zenodo] leave most of these fields optional, and a researcher who deposits in several places rarely sees how the metadata reads to a machine.

The need arose in practice. When the author listed their own preprints on Sophaxis [@sophaxis], an overlay preprint server, most of the DataCite records had no abstract, and none of the author's Zenodo deposits were on their ORCID record.
Neither fact is visible on the repository's own pages.

deposit-check is meant for researchers who deposit their own work, and for the people who support them, such as library staff and the moderators of overlay servers.
Sophaxis uses it to advise submitters on the metadata of their DOIs.

# State of the field

Crossref's Participation Reports show how complete the metadata of each Crossref member is [@participation], at the level of a publisher rather than a person.
F-UJI assesses one research object at a time against FAIR metrics [@fuji].
The search and link tools of ORCID and the browsing of DataCite let a researcher find and claim works, but do not report what each record lacks.
deposit-check starts from one person's ORCID iD, works across registration agencies, compares the ORCID record with the metadata that carries the iD, and says for each finding what to change and where.

# Software design

The tool is written in JavaScript for Node.js and has no dependencies.
Only one module reaches the network. It makes GET requests one at a time, retries a refused or failed request, and takes the fetching function as an argument, so that the whole tool runs in its tests on recorded answers.
The metadata of each agency is read into one shape. Each rule is a pure function of one record or of the whole set, with a severity and a fix.
The versions of one work are read together: only the latest version is checked, and a work missing from the ORCID record is reported once.
The checks run without the network, on made-up records that use test DOI prefixes and the example iD that ORCID documents. Each check was broken once on purpose, to see that it fails.
A weekly run keeps one issue with the latest report for the author's own iD, and comments when the counts change.

# Research impact statement

deposit-check was made public on 2026-11-02.
It is used to check the author's own deposits, and by Sophaxis to advise submitters.
There is no record yet of use by other authors.

# AI usage disclosure

The code, the checks and this paper were drafted with Claude Code (Anthropic), a language model, at the author's request.
The author decided the design and the rules, reviewed the output, and takes responsibility for it.
Claude is not an author.
The repository history records the use in each commit.

# Acknowledgements

deposit-check depends on the open APIs of ORCID, DataCite, Crossref, JaLC and OpenAlex.

# References
