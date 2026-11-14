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

## 突き合わせの受付 / Checked intake

2026-12-01 から、誤りの知らせ（`error-report.yml`）は「突き合わせの受付」で確かめる。
人が嘘をつくこと一般は、仕組みでは止められない。受けるのは、申し立てた人がその場で書けない出どころと突き合わせられる申し立てだけで、通らないものと確かめられないものは自動で退ける。
確かめるのは一つだけである。「書いてあること」の語が、「どこか」の欄に書いた所（このリポジトリのファイル、配っている頁、このリポジトリが写しを持つ DOI の PDF か翻刻）に、そのとおりにあること。空白の違いと文字の幅は見ない。頁や節は確かめず、文書の全体を探す。
あればラベル「quote verified」を付ける。それが誤りかどうかは、人が読んで決める。なければ、決まった文のコメントを付けて閉じる。新しい issue で出し直せる。
削除・権利・個人の情報・氏名・人についての記述・同意の撤回を求めると読める issue は、自動では閉じない。ラベル「needs a person」を付け、人が読む。
コメントと実行の記録は、決まった語と issue の番号だけを書き、issue に書かれたことを写さない。
道具は `.github/checked-intake/verify.js`、確かめる先は `.github/checked-intake/config.json` にある。

From 2026-12-01, error reports (`error-report.yml`) are checked by the checked intake.
No system can stop a person from lying in general. Only claims that can be checked against a source that the claimant does not write at the moment of claiming are accepted; a claim that fails, or cannot be checked, is turned away automatically.
One thing is checked: that the words under "What it says" occur, as written, at the location under "Where" (a file of this repository, a page that it serves, or the PDF or transcription of a DOI of which it holds a copy). Differences of white space and character width are ignored. The page or section is not checked; the whole document is searched.
If they occur, the label "quote verified" is added, and whether it is an error is decided by a person. If they do not, the issue is closed with a fixed comment, and a new issue can be opened.
An issue that reads as asking for removal, or concerning rights, personal data, a name, a statement about a person or the withdrawal of a consent, is never closed automatically; it gets the label "needs a person", and a person reads it.
Comments and logs carry only fixed words and the issue number, never what the issue says.
The script is `.github/checked-intake/verify.js`; what it checks against is in `.github/checked-intake/config.json`.

From 2026-12-01, a bug report (`bug_report.yml`) is checked in the same way: the ORCID iD given must be the reporter's own, its public record linking the GitHub account that opens the issue, and a DOI given must list that iD for a creator at DataCite or Crossref. If either check fails, the issue is closed with a fixed comment. The check reads only the websites of that ORCID record and the creators of that DOI, and writes nothing from them.
