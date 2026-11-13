# Contributing to deposit-check

deposit-check is maintained by one person, Takuya Nemoto. Contributions are welcome, and this page says where each kind goes.

## Which way to go

| What | Where |
| --- | --- |
| A rule that is wrong for some deposits, or a rule that is missing | [An issue](https://github.com/cpsbvbng26-dotcom/deposit-check/issues/new). Show it on a DOI of your own work, if you can. If the deposit is someone else's, describe the problem without naming its DOI, and without pasting what the tool found about it. |
| A bug | [An issue](https://github.com/cpsbvbng26-dotcom/deposit-check/issues/new?template=bug_report.yml), with the bug report form (`.github/ISSUE_TEMPLATE/bug_report.yml`). It asks for the steps to reproduce, the version and the environment. |
| A question or a suggestion | [An issue](https://github.com/cpsbvbng26-dotcom/deposit-check/issues/new) |
| A change to the code, the rules or the documents | A pull request, as below |

Issues are public. Do not put personal data in them.
Write in English or Japanese. The maintainer aims to answer within 7 days.

## Changing the code

1. Fork the repository and make a branch.
2. Make the change. There are no dependencies to install; Node.js 22 is enough.
3. Run the checks. They run without the network, on made-up records in `verification/fixtures`.

   ```
   node verification/check.js
   ```

4. Open a pull request. Say what changed and why. The same checks run on GitHub Actions.

A new rule needs a line in the rules table of the README, a case in the checks that raises it, and a case that does not.
A check is never loosened to make a change pass. If a check fails, fix the change, or explain in the pull request why the check is wrong.
Only `src/fetch.js` reaches the network, and only with GET requests to public APIs that need no key. Keep it that way.

## Language models and other generative models

deposit-check was written with Claude Code (Anthropic), and the README says so.
A contribution made with a generative model is welcome: say which model and what it did, and check the result yourself.
A generative model is never listed as an author or a contributor.

## Licence

By contributing, you agree that your contribution is shared under the licences of the repository: the code under MIT ([LICENSE](LICENSE)), and the documents under CC BY 4.0.

## Conduct

Be civil. Criticism of the work is welcome; attacks on people are not.

## Support

Help is given in the issues, by the maintainer, as time allows.
