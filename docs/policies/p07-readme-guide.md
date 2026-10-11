# P7 README には本文を書かず、どこに何があるかの案内にとどめること

| 区分 | 内容 |
| --- | --- |
| 対象 | `project:init-repo`（`.claude/rules/readme.md`・`README.md` と `docs/README.md` のひな形・README を作り替える手順）、`project:wordpress`（`wordpress/` 配下の README のひな形）、`project:terraform`（`infra/` 配下の README のひな形）、`aidd:adr`（ADR の一覧の `README.md`） |
| 対象外 | このリポジトリ自身の README（ルート・プラグイン・スキル）。この方針は、利用先に配る README の規約・ひな形と、スキルが作る README を対象にする |
| 価値 | [V4](../values/v04-record-reasons.md) |

README は、どこに何があるかを示す案内板にする。手順・設計・仕様などの本文は `docs/` などに 1 か所だけ書き、README からはリンクで案内する。ルートの README から `docs/` の文書へは、`docs/README.md` だけを案内する。

## 理由

- 【二重管理】README に本文を書くと、原本と README の 2 か所を直すことになり、片方が古くなるから
- 【たどりやすさ】入口が案内だけを持つと、人も AI も、どこを読めばよいかをすぐに判断できるから
- 【案内の階層】ルートの README が `docs/` の下の文書まで案内すると、文書を足すたびに、ルートと `docs/README.md` の両方を直すことになるから

## 変えたいとき

- 利用先で README に本文を書きたいときは、`.claude/rules/readme.md` を書き換えるか、`init-repo` の引数で外して入れない

## Q&A

### Q. ルートの README のひな形に、よく読む文書へのリンクを足したい

足さない。`docs/README.md` に足す。ルートの README からは `docs/README.md` だけを案内する。リンクを直す場所を 1 か所にするため。

### Q. 既存の README に本文がある

`init-repo` は、本文を `docs/` へ移し、README を案内板に作り替えることを提案する。移す先は承認を得てから決め、本文は要約・削除しない。移した本文へのリンクは、移す先の案内板（`docs/README.md` など）に置く。

### Q. README を作るスキルを足す

`.claude/rules/readme.md` の「案内板型 README.md の構成」に合わせる。`aidd:adr` が作る ADR の一覧が手本になる。冒頭の表の「対象」にも足す。
