# P12 Issue・PR のタイトルで、変更の種類が一目で分かるようにすること

| 区分 | 内容 |
| --- | --- |
| 対象 | Issue・PR のタイトルを決めるスキル（`aidd` の `issue-pr-sync`・`pr-create`、`config:plugin-feedback`）。`project:init-repo` の Issue フォームと `labels.yml`。このリポジトリの bot（`issue-to-pr`）とリリースの仕組み |
| 例外 | 振り返りのフォーム（`[Retro]`）は、作業の分類に入れない。作業の Issue ではなく、対象の Issue に貼る記録のため。dependabot など、ツールが自動で作る PR のタイトルは変えない |
| 価値 | [V2](../values/v02-understand-before-accept.md)・[V5](../values/v05-mechanisms-over-habits.md) |

リポジトリにタイトルの決まりが無ければ、Issue・PR のタイトルは `[分類] 本文` の形にし、本文は何をするか・何が起きるかを動詞で終える 1 文で書く。分類に合うラベルも付ける。スキルが読む写しは `plugins/aidd/skills/issue-pr-sync/title-and-sidebar.md` の「タイトル」。

| 分類 | 使う場面 | ラベル |
| --- | --- | --- |
| `[Bug]` | 期待と違う動き・エラーを直す | `bug` |
| `[Feature]` | 機能を足す・変える、手順や仕組みを改善する | `feature`（無ければ `enhancement`） |
| `[Docs]` | 文書だけを足す・直す | `docs`（無ければ `documentation`） |
| `[Refactor]` | 外から見た振る舞いを変えずに、構造を直す | `refactor` |
| `[Release]` | リリースの Issue と、リリースの PR | `release` |
| `[Research]` | 調べて決める。実装を伴わない | `research` |
| `[Other]` | 上のどれにも当たらない（版を上げる、依存を更新するなど） | `other` |

- 例：`[Bug] bot の保護パスの確認が、名前の変更を見落とす`、`[Feature] issue-start に --issue-only を足す`
- PR のタイトルは、閉じる Issue が 1 つなら、Issue のタイトルと同じ文字列にする
- ラベルは、リポジトリに実在するものだけを付ける。`release` は、Claude からは付けない

## 理由

- 【読み手】リリースノートは PR のタイトルの一覧のため、タイトルに分類が無いと、バグの修正か機能の追加かを本文を開かずに見分けられないから
- 【書式】英語の角括弧は、`init-repo` の Issue フォームが既に使っていて、日本企業の公開リポジトリの Issue テンプレート（`[Bug]:`・`[Feature]:` など）にも例があるから。日本語の隅付き括弧（【】）の例は見つからなかった（2026-11-01 時点）
- 【そろえる仕組み】分類を人の心がけに任せるとばらつくため、Issue フォーム・スキル・bot で同じ形を出すから
- 【ラベル】分類とラベルを 1 対 1 にすると、同じことを 2 か所で別々に決めずに済むから
- 【リリース】`release` ラベルの付いた Issue はリリースのワークフローを動かし、`release` ラベルの PR はリリースノートから外れる。版を上げるだけの作業に付けると、意図せず動く・載らないから

## 変えたいとき

- 分類を足す・変えるときは、この方針の表、`title-and-sidebar.md` の表、`init-repo` の Issue フォームと `labels.yml`、`plugin-feedback` の `issue-format.md` をすべて直す
- 利用先で別の書式を使うときは、`CONTRIBUTING.md`・`.claude/rules/` などにタイトルの決まりを書くか、Issue フォームの `title` を書き換える。スキルは、決まりがあればそちらに従い、この方針の書式を当てない

## Q&A

### Q. 版を上げる Issue・PR は、どの分類にする

`[Other]` にする。`[Release]` にすると `release` ラベルが付き、リリースのワークフローが動き、リリースノートからも外れるため。

### Q. 閉じる Issue が複数ある PR の分類

Issue の分類がそろえば、その分類にする。違えば、主な変更の分類にし、承認の画面でどれに合わせたかを示す。

### Q. 既存の Issue・PR に分類が無い

一括では直さない。`/aidd:issue-pr-sync` で更新するときに、分類を頭に足す案を出し、承認を取る。Issue のタイトルを変える変更のため。

### Q. 利用先に、タイトルの書き方の決まりがある

利用先の決まりに従い、この方針の書式（`[分類] 本文`）は当てない。この方針は、決まりが無いリポジトリでの既定のため。決まりは `CLAUDE.md`・`.claude/rules/`・`CONTRIBUTING.md`・`docs/` と、Issue フォームの `title` から探し、どれに従ったかを承認の画面と結果に書く。両方を当てると、`[Bug] fix: 〜` のように 2 つの形が混ざるため。ラベルは、分類の表を使ってよい。

### Q. リポジトリに分類のラベルが無い

付けずに進め、無いことを報告に書く。ラベルの作成はリポジトリの設定の変更で、人が行うため（[P1](p01-operation-boundary.md)）。
