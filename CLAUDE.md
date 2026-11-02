# deposit-check

研究者の業績の DOI の登録情報を読み、欠けや食い違いを挙げる道具。依存は無い。Node.js 22。

## 決めごと

1. **どこにも書き込まない**。ORCID・DataCite・Crossref・JaLC への GET だけ。鍵を要する API を足さない。
2. **連絡先を埋め込まない**。Crossref に渡す連絡先は `DEPOSIT_CHECK_MAILTO` で利用者が与える。
3. **ネットワークに出るのは `src/fetch.js` だけ**。規則・読み取り・報告は純粋な関数にする。
4. **検査は網に出ない**。API の答えは `verification/fixtures` の作り物で与える。実在の記録を写さない。
5. **規則を足したら README の表と検査の両方に足す**。表は `check.js` が規則の並びと突き合わせる。
6. **検査の期待値を、通すために変えない**。落ちたら中身を直す。足した検査は壊して落ちることを確かめる。
7. **散文に数を書かない**。規則の数・検査の数は動く。書くなら突き合わせる検査も足す。
8. **言語モデル利用の開示は消さない。Claude を著者にしない**（CITATION.cff・README）。
9. コードは MIT、文書は CC BY 4.0。勝手に変えない。
10. 枝を切って PR にする。コミットは種別ごとに分ける。マージには開示の二行を本文に入れる。

```
node verification/check.js
node bin/deposit-check.js --orcid <iD>     # 網に出る。この環境からは届かない（GitHub だけ）
```

実際の API での動作は `.github/workflows/run.yml` を手で回して確かめる。
