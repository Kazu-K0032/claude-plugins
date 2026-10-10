# P4 スキルの下書きやレポートは tmp に出し、コミットに混ぜないこと

| 区分 | 内容 |
| --- | --- |
| 対象 | `aidd` の `commit`・`docs-sync`・`issue-pr-sync`・`issue-start`・`pr-create`・`ai-report`・`pr-review`・`docs-consistency-audit` |
| 価値 | [V2](../values/v02-understand-before-accept.md)・[V3](../values/v03-human-judgment.md) |

レポートや下書きは `tmp/<ブランチ名>/` と `tmp.md` に書き、`.gitignore` でコミットから外す。

- 作業用の一時ファイルも、`tmp/<ブランチ名>/` に置く。削除は禁止のため、消さずに済む場所に置く（[P1](p01-operation-boundary.md)）
- ブランチ名の `/` は `-` に置き換える（例：`issues/1-sample` → `tmp/issues-1-sample/`）。1 つのブランチの出力を 1 か所にまとめるため

## 理由

- 【コミットへの混入】作業中のファイルを、コミットに混ぜたくないから

## 変えたいとき

- `init-repo` を使っていないリポジトリでは、`.gitignore` に `tmp/` と `tmp.md` を自分で足す

## Q&A

### Q. スキルのレポートや下書きを、どこに出す？

`tmp/<ブランチ名>/` に出す。ブランチ名の `/` は `-` に置き換える。コミットメッセージだけは `tmp.md` に書く。

### Q. スキルの出力を、リポジトリに残したい（ADR など）

`tmp/` には置かない。リポジトリの規約の場所に書く。場所が決まっていなければ、[P3](p03-check-placement.md) のとおり利用者に聞く。
