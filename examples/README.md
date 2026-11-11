# Examples

Everything here is made up: deposits under the DataCite test prefix 10.5072, by ORCID's fictitious researcher Josiah Carberry. No real record is copied.

| File | What it is |
| --- | --- |
| [`expected-types.json`](expected-types.json) | The DOIs, and the resource type each should have |
| [`answers.json`](answers.json) | The answers the APIs would give for them, recorded in a file |
| [`report.md`](report.md) | The report the tool writes for them |

## Try it in a minute

Node.js 22 or later. Nothing to install, and no network: `--answers` reads the APIs' answers from the file.

### 1. Run

```
node bin/deposit-check.js --answers examples/answers.json --expect-types examples/expected-types.json
```

In: the DOIs and the types they should have, and the metadata of each DOI.
Out: the report in [`report.md`](report.md). The program was registered as a dataset and should be software, so `type-unexpected` gives one warning. The preprint gives nothing. The exit status is 0, since no finding is an error.

### 2. Make it fail

```
node bin/deposit-check.js --answers examples/answers.json --expect-types examples/expected-types.json --fail-on warning
```

Out: the same report, and the exit status is 1, since a warning now counts.

The repository's CI runs both steps through the action on every push and pull request (the `action` job in `.github/workflows/check.yml`), and `node verification/check.js` checks that step 1 still writes `report.md` as it is.

## With the network

Leave out `--answers`, and give real DOIs in the file of expected types, or with `--doi`:

```
node bin/deposit-check.js --expect-types my-types.json
```
