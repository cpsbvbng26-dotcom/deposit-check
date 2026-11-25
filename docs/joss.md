# JOSS に出す準備

deposit-check を Journal of Open Source Software（JOSS）に出すための点検の記録です。
JOSS の文は、`openjournals/joss` の `docs/` から写しています。
写したのは 2026-11-24 に取り寄せた写しで、リンクと強調の記法だけを外してあります。
`joss.theoj.org` には、この作業環境から届きません。
照合したのは、その公開リポジトリの中身です。
点検は 2026-11-25 に Claude が行い、判定も Claude が決めました。
まだ出していません。

## 査読の前の門

査読に入る前に、四つの門があります。
一つでも欠ければ、査読に入らずに返されます（`A submission that fails any one of these will receive a desk rejection, but can be resubmitted once the gaps are addressed.`）。

| 門 | JOSS の文 | いまの状態と根拠 | 満ちるか |
| --- | --- | --- | --- |
| 1 公開の期間 | `The repository must have been public for more than six months prior to submission, with active development spanning that period.` | 最初のコミットは 2026-11-02 です（git の履歴が記す協定世界時の日付）。GitHub の API は、リポジトリを作った時刻を 2026-11-02T20:36:47Z と返します。公開の出来事の一覧のいちばん古いものは、2026-11-02T20:37:19Z です。非公開から公開に切り替えた出来事（PublicEvent）はありません | 最短は 2027-05-03 です。最初のコミットの日から六か月と一日です。後半の `with active development spanning that period` は、日付だけでは満ちません |
| 2 研究に使われている証拠 | `There must be evidence that the software is being used for research — at minimum by the developers themselves, and ideally by others.` | 使っているのは著者自身です。月に一度の実行が、著者の ORCID iD と目録のすべての DOI を読みます。2026-11-11 の目録の実行は、報告とともに `docs/runs/2026-11-11-catalog` にあります。Sophaxis は 2026-11-02 から、投稿の確かめで deposit-check を走らせています。Sophaxis も著者が運営しています。著者以外に使われた記録はありません | 最低限の線（`at minimum by the developers themselves`）には届いていると読めます。足りるかは、編集側が決めます。場の側は `Aspirational statements about future use are not sufficient` と書いています |
| 3 開かれた開発の実践 | `For single-author projects, this bar can be met more broadly — but multiple indicators must be present at submission time: a meaningful public commit history over time, tagged releases or a changelog, tests and CI, clear documentation, a CONTRIBUTING file, and stated support or governance expectations.` | 公開したタグは `v0.1.0`（2026-11-07）です。変更履歴は `CHANGELOG.md` にあります。検査は `verification/check.js` で、CI が push と pull request のたびに回します。`CONTRIBUTING.md` は 2026-11-03 に置きました。支援の方針は、その「Support」の節にあります。足りないのは `a meaningful public commit history over time` で、門 4 と同じ理由です | 履歴のほかは、いま満ちています。履歴は門 4 とともに満ちます |
| 4 反復した開発 | `The development history must show ongoing iteration, not a single burst of commits.` | 2026-11-24 までのコミットは、2026-11-02 から 2026-11-19 までの間に集まっています | 満ちていません。日付が進むだけでは満ちません。場の側が見るのは `evidence that the software has been refined through use and feedback over time` です |

## 査読の項目

左の三つの列は、`review_checklist.md` の項目と文です。
論文の節の項目は、`review_criteria.md` と `paper.md` の文も見ました。

| 項目 | JOSS の文 | いまの状態と根拠 | いま直せるか | したこと |
| --- | --- | --- | --- | --- |
| Repository | `Is the source code for this software available at the repository url?` | GitHub で公開です。GitHub の API の `visibility` は `public` です | 済 | なし |
| License | `Does the repository contain a plain-text LICENSE file with the contents of an OSI approved software license?` | `LICENSE` は MIT の全文です。GitHub の API も MIT と読みます | 済 | なし |
| Contribution and authorship | `Has the submitting author made major contributions to the software? Does the full list of paper authors seem appropriate and complete?` | 合併でないコミットの作者は、2026-11-25 の時点でどれも Claude です。著者の寄与（問題の立て方と設計の決め）は、git の作者の欄には出ません | 直せません。公開済みの履歴は書き換えません | 論文の AI usage disclosure に、そのまま書きました |
| Scope and significance | `Does this submission demonstrate clear research impact or credible scholarly significance as described in the JOSS guidelines?` | 門 2 と同じです。業績の登録情報を点検する道具が範囲に入るかは、JOSS が決めます | 直せません | 論文の Research impact statement には、実際の利用だけを書きました |
| Development timeline | `Does the project show evidence of sustained development over time (preferably months or years) rather than rapid, recent code generation?` | 門 4 と同じです | 直せません | なし |
| Open development | `Was the software developed openly from early stages? For projects with recent public repositories, is there at least six months of public development history with evidence of releases, public issues/pull requests, and ideally external engagement?` | 作った日から公開しています。変更は #1 から PR で入れています。六か月に届くのは 2027-05-03 です。外からの関わりはありません | 期間は待つほかありません | なし |
| Collaborative effort | `Does the project show evidence of community engagement such as contributions from multiple developers, issues/discussions from external users, or community influence on the development described in the paper?` | 著者のほかの人のコミットはありません。GitHub の API の fork と star は、どちらもありません | 直せません | なし |
| Good practices | `Does the project follow good open-source practices (license, documentation, tests and/or verification processes, releases, and clear contribution/support pathways)?` | 下の行のとおり、どれもあります | 済 | なし |
| Installation | `Does installation proceed as outlined in the documentation?` | README は `node bin/deposit-check.js` しか書いていませんでした。2026-11-25 に、空の prefix へ `npm install -g github:cpsbvbng26-dotcom/deposit-check` と `npx github:cpsbvbng26-dotcom/deposit-check --help` を走らせ、command が動きました | 直しました | README に三つの入れ方を書き、npm が command の読むファイルをすべて包むことを検査に足しました（#40） |
| Functionality | `Have the functional claims of the software been confirmed?` | 検査は網に出ずに回ります。2026-11-25 に、著者の iD と目録の DOI に対して実際の API で走らせ、2026-11-11 と同じ種類の error が出ました | 済 | なし |
| Performance | `If there are any performance claims of the software, have they been confirmed? (If there are no claims, please check off this item.)` | 論文は、月に一度の実行がおよそ一分で終わると書いています。法令の点検の記録の八度目の節は、その実行の中央値を 53 秒としています | 済 | なし |
| A statement of need | `Do the authors clearly state what problems the software is designed to solve and who the target audience is?` | README の冒頭と、論文の Statement of need にあります | 済 | 論文の節を書き直しました（#40） |
| Installation instructions | `Is there a clearly-stated list of dependencies? Ideally these should be handled with an automated package management solution.` | 依存はありません。要るのは Node.js 22 だけです。npm の registry には載せていません（2026-11-25 に registry.npmjs.org が 404 を返しました）。registry への公開には利用者のアカウントが要り、Claude には触れられません | GitHub からの npm の入れ方は直しました | README に書きました（#40） |
| Example usage | `Do the authors include examples of how to use the software (ideally to solve real-world analysis problems).` | `examples/` は作り物の記録で、網に出ずに一分で試せます。`docs/runs/2026-11-11-catalog` は、著者の公開の ORCID の記録（0009-0000-1406-0547）と目録の実際の DOI を読んだ実行です | 済 | なし |
| Functionality documentation | `Is the core functionality of the software documented to a satisfactory level (e.g., API method documentation)?` | 入口は command と GitHub Action です。README が、選択肢・規則・action の入力を挙げています。JSON の報告の欄は書いていませんでした。モジュールは公開の API にしていません（`package.json` に `main` がありません） | 直しました | README に JSON の報告の欄を足し、報告が書く欄と突き合わせる検査を足しました（#40） |
| Automated tests | `Are there automated tests or manual steps described so that the functionality of the software can be verified?` | `verification/check.js` を CI が回します。`npm test` でも回ります | 済 | なし |
| Community guidelines | `Are there clear guidelines for third parties wishing to 1) Contribute to the software 2) Report issues or problems with the software 3) Seek support` | `CONTRIBUTING.md` の「Which way to go」「Changing the code」「Support」と、不具合の報告の様式（`bug_report.yml`）です | 済 | なし |
| Summary | `Has a clear description of the high-level functionality and purpose of the software for a diverse, non-specialist audience been provided?` | 前の下書きは、DOI の登録情報とは何かを書かずに始まっていました | 直しました | 登録情報とは何かから書き直しました（#40） |
| Statement of need | `Does the paper have a section titled 'Statement of need' that clearly states what problems the software is designed to solve, who the target audience is, and its relation to other work?` | 節はありました | 直しました | 欠けがどう効くかの例を書き足しました（#40） |
| State of the field | `If related tools exist, do they provide a clear "build vs. contribute" justification explaining their unique scholarly contribution and why alternatives are insufficient?` | 前の下書きは関係する道具を挙げて違いを一文で書き、作るか寄与するかの理由を書いていませんでした | 直しました | Participation Reports・DataCite の完全性の取り組み・COKI の Academic Observatory Workflows・F-UJI・OpenCitations の DOI ORCID Index・ORCID の API の client を、DOI か取り寄せた中身で確かめて並べ、理由を書きました（#40） |
| Software design | `Does the paper include a "software design" section that explains the trade-offs weighed, the design/architecture chosen, and why it matters?` | 前の下書きは構成を書き、何を引き換えにしたかをほとんど書いていませんでした | 直しました | 読み取り・規則・報告のそれぞれで、何を引き換えにしたかを書きました（#40） |
| Research impact statement | `Does the paper include a "research impact statement" section providing evidence of realized impact (publications, external use, integrations) or credible near-term significance (benchmarks, reproducible materials, community-readiness signals)? Is the evidence presented compelling?` | 実際の利用は、著者自身と Sophaxis だけです | 書き方は直しました。外の利用は直せません | 実際の利用だけを、記録のある形で書きました（#40） |
| AI usage disclosure | `Does the paper include an "AI usage disclosure" section that transparently discloses any use of generative AI in the software creation, documentation, or paper authoring?` | 節はありました。版と確かめ方がありませんでした | 直しました。人が確かめたという宣言は直せません | 道具とモデルの名・範囲・確かめ方を書きました（#40）。場の側は `Authors must affirm that human team members thoroughly reviewed, modified, and validated all AI-generated content while making primary architectural and design decisions.` と書いています。この一文は著者自身の宣言で、Claude には代わって署名できません。下書きには入れていません |
| Quality of writing | `Is the paper well written (i.e., it does not require editing for structure, language, or writing quality)?` | 判断は査読の側です | なし | なし |
| References | `Is the list of references complete, and is everything cited appropriately that should be cited (e.g., papers, datasets, software)? Do references in the text use the proper citation syntax?` | 前の下書きには DOI がありませんでした | 直しました | DOI を api.crossref.org と api.datacite.org で読み、題と年を `verification/paper-dois.json` に置き、検査と突き合わせました。下書きの PDF は `.github/workflows/draft-pdf.yml` が作り、2026-11-25 に通りました（#40） |

## 論文の形

| 項目 | JOSS の文 | いまの状態 |
| --- | --- | --- |
| 語数 | `The paper should be between 750-1750 words.` | 範囲の中です。数は `verification/check.js` の出力に出ます |
| 節 | `sections for Summary, Statement of need, State of the field, Software design, Research impact statement, AI usage disclosure, Acknowledgements, and References` | この順に並び、検査が順まで見ます |
| 資金 | `Acknowledgement of any financial support.` | 資金の申告は著者自身の文で、Claude には書けません。下書きには入れていません |
| 利益相反 | `All authors must disclose any potential conflicts of interest related to the research in their manuscript, including financial, personal, or professional relationships that may affect their objectivity.` | Sophaxis を著者が運営していることは、論文に書きました。申告そのものは著者自身の文です |

## 大きさ

場の側は、小さな道具を受けません（`"Minor utility" packages, including "thin" API clients, and single-function packages are not acceptable.`）。
言語の慣習どおりの形も求めます（`packaged appropriately according to common community standards for the programming language being used`）。
この条件を満たしているとは書きません。
満たすかどうかは、JOSS が決めます。

道具の本体は次のファイルです。
行の数は、`verification/check.js` がファイルと突き合わせます。

| ファイル | 行 | 役目 |
| --- | --- | --- |
| `src/fetch.js` | 113 | 読み取り。網に出る唯一のモジュール |
| `src/metadata.js` | 220 | 三つの登録機関の登録情報を一つの形にする |
| `src/rules.js` | 251 | 規則 |
| `src/report.js` | 63 | 報告 |
| `bin/deposit-check.js` | 95 | command |

規則は 19 です。
ほかに、GitHub Action（`action.yml`）と、月に一度の実行の台本（`scripts/`）があります。
包みは `package.json` で、npm の registry には載せていません。
読み取り・規則・報告に分けてありますが、小さな道具と見られるおそれは残ります。

## 版

公開したタグは `v0.1.0` だけです。
それ以後の変更は、`CHANGELOG.md` の「Unreleased」にあります。
この作業環境からタグを push すると、403 で返ります。
GitHub の Release と Zenodo の版は利用者のアカウントで作るもので、Claude には触れられません。

## 前の記録との違い

README の「Plans」は 2026-11-03 から、参考文献に DOI を入れないと書いていました。
2026-11-25 に、どの DOI も登録元で確かめて入れました。
論文の検査は 250 語から 1000 語を見ていました。
2026-11-25 に、JOSS の今の手引きの 750 語から 1750 語に改めました。
