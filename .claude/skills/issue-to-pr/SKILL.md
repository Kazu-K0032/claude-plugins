---
name: issue-to-pr
description: Issue のとおりに実装し、作業ブランチに push して develop 向けの下書きの PR を作る。CI の失敗やレビューの指摘を渡されたら直し、最後に PR 本文の「AI を使った確認」を仕上げる。GitHub Actions の Claude が、Issue のコメントの @claude で動いたとき（.github/workflows/claude-issue-to-pr.yml）に使う。手元の作業では使わない
---

# Issue から PR を作る

GitHub Actions の Claude が、Issue のとおりに実装し、作業ブランチに push して、`develop` 向けの下書きの PR を作る。その後、ワークフローから頼まれたら、CI の失敗やレビューの指摘を直して push し、最後に PR 本文の「AI を使った確認」を仕上げる。コミット・push を Claude に任せるのは、P1 の例外（`docs/policies/p01-operation-boundary.md`）のため、手元の作業では使わない。

- 外へ書き込むもの：作業ブランチへのコミットと push、`develop` 向けの下書きの PR、承認の要らない Issue・PR の更新（手順 10）。ほかに `tmp/<ブランチ名>/issue-to-pr/` の記録
- 人がすること：PR のレビューとマージ。PR の本文に書いた diff（`.github/workflows/`・`.github/scripts/`・`.claude/hooks/`・`.claude/settings.json`）を当てること

## 参照ファイル

| ファイル | いつ読むか |
| --- | --- |
| `.claude/skills/issue-to-pr/scripts/verify.sh` | 手順 5・9 で検査するとき。引数を付けずに `bash` で流す |
| `.claude/skills/marketplace-update/SKILL.md` | 手順 5 で、手順 3〜6 を流すとき |
| `.claude/skills/issue-to-pr/unchangeable-paths.md` | 手順 4 で、bot が変えないファイル・変えられないファイルに触れるとき |
| `.claude/skills/issue-to-pr/fix-requests.md` | 手順 9 で、渡された指摘を直すとき |
| `.claude/skills/issue-to-pr/finish-checks.md` | 手順 10 で、「AI を使った確認」を仕上げるとき |

## 想定している引数

引数は受け取らない。実装する Issue は、ワークフローが渡す文脈（`@claude` とコメントされた Issue）から取る。

## 出力先

`tmp/<ブランチ名>/issue-to-pr/` に書く。`<ブランチ名>` は `git branch --show-current` で取り、`/` を `-` に置き換える。ワークフローが同じ場所を読み、PR へのコメントとレビューに使う。

- `report.md`：計画と確かめたこと（手順 3・5・9）
- `pr-body.md`：PR の本文（手順 7）
- `finish.md`：「AI を使った確認」のチェックと根拠（手順 10）

## 手順

### 1. Issue を読む

`gh issue view <番号> --comments` で、タイトル・本文・コメントを読む。「決めたこと」と後のコメントが食い違えば、新しいコメントに従う。

### 2. 関係する方針を読む

`.claude/rules/plugin-changes.md` の「スキルやテンプレートを変更する場合」に従い、触るファイルに関係する方針（`docs/policies/`）を読む。同じ規約の「変更を終えた場合」のうち、コミット・push を人に任せる項目は、このスキルの手順 6 に読み替える。

### 3. 計画を書く

実装の前に、`report.md` の「## 計画」に、変えるファイルと、それぞれで何をするかを箇条書きで書く。人とレビューの Claude が、意図と実装を比べられるようにするため。

### 4. 実装する

計画のとおりに実装する。Issue に無い判断が要るときは、推測で進めず、手順 8 の形で理由を返して止める。人が決めることを、bot が決めないため。

`.github/` の下・`.claude/hooks/`・`.claude/settings.json` と、雛形の外の protected paths（`.claude/`・`.vscode/`・`lefthook.yml` など）は変えず、diff を PR の本文に書く。対象と書き方は `unchangeable-paths.md` を読む。

過去のコミットは、`git show <sha>`・`git log -n <件数> -- <パス>` で要る分だけ読む。全履歴の差分を一度に出すと、コンテキストを使い切るため。

### 5. 検査する

`verify.sh`（`marketplace-update` の手順 2 を含む）を流し、`結果: NG` なら直して流し直す。続けて、`marketplace-update` の `SKILL.md` の手順 3〜6 を流す。直せない NG は、PR の本文に理由を書く。流した結果（OK・NG と直したこと）を、`report.md` の「## 確かめたこと」に書く。push の前に CI と同じ検査で落としておくと、CI の直しの回数（最大 3 回）を使わずに済むため。

### 6. コミットして push する

`plugins/aidd/skills/commit/commit-rule.md` の形でコミットメッセージを書き、コミットする。`Ref:` には Issue の番号を書く。続けて、作業ブランチを push する。

### 7. 下書きの PR を作る

`plugins/aidd/skills/pr-create/pr-body-guide.md` に従い、`.github/PULL_REQUEST_TEMPLATE.md` の節を埋めて、本文を `pr-body.md` に書く。`node plugins/aidd/scripts/body_length.js <本文のファイル>` で概要（最初の節）の長さを数え、300 文字を超えたら縮める。本文の「関連 Issue」には `Closes #<番号>` を書く。人がマージしたとき、`close-linked-issues.yml` が Issue を閉じるため。

`gh pr create --draft --base develop --title "<タイトル>" --body-file <本文のファイル>` で、下書きの PR を作る。タイトルは Issue のタイトルと同じ文字列にする。Issue のタイトルが `[Bug]` などの分類で始まっていなければ、`plugins/aidd/skills/issue-pr-sync/title-and-sidebar.md` の「タイトル」の表で分類を選び、頭に付ける。Release の説明は PR のタイトルの一覧のため、分類で種類を見分けられるようにする。リンクを書くだけにしない。レビュー待ちへの切り替えは、ワークフローが CI の通過を確かめてから行う。

### 8. PR を作れないときは理由を返す

最後の返答に、PR を作れなかった理由を日本語で 1〜3 行で書く。ワークフローが、その返答を Issue にコメントするため。

### 9. 指摘を直す（ワークフローから直しを頼まれたとき）

`fix-requests.md` の手順で、ワークフローが渡したファイル（CI の失敗のログか、レビューの指摘の `review-feedback.md`）を読んで直し、同じ作業ブランチに push する。

### 10. AI を使った確認を仕上げる（ワークフローから頼まれたとき）

`finish-checks.md` の手順で、PR 本文の「AI を使った確認」の 3 行を点検し、条件を満たす行にチェックを入れる。ファイルは直さない。根拠を記録に書き、人が確かめられるようにするため。

## 禁止事項

- `main` に向けた PR を作らない。`main` はリリース専用のため
- PR をレビュー待ちにしない。マージしない。Issue を閉じない。これでよいかの判断は、ワークフローの検査と人が行うため（V3）
- コメント・PR の本文に `@claude` を書かない。ワークフローの起動語のため
- `.github/workflows/`・`.github/scripts/`・`.claude/hooks/`・`.claude/settings.json` を変えない（手順 4）。`.github/scripts/` は、ワークフローが CI を待つのに使うため
- 作業ブランチ以外に push しない。`--force` を付けない。直しの step で許されるのは、作業ブランチへの `git push origin <ブランチ>` だけのため

## 保守

- このスキルは `.github/workflows/claude-issue-to-pr.yml` から呼ぶ（手順 1〜8 は `--append-system-prompt`、手順 9・10 は `prompt`）。使えるコマンドは、ワークフローの `--allowedTools`（手順 9 は `FIX_TOOLS_BASE` に、作業ブランチへの push を足したもの）で決まる。手順で新しいコマンドを使うときは、そちらにも足す
- 変えてはいけないパスの一覧は、`.github/scripts/guard-paths.sh` の `protected` が正典。変えるときは、手順 4・`unchangeable-paths.md`・禁止事項・`CONTRIBUTING.md` も直す
- 流れは Anthropic の「Building effective agents」の型にならう。実装 → CI の直し（最大 3 回）→ `/security-review`・code-review・docs-sync → 直し（1 回）→ CI の直し（最大 3 回）→ 仕上げの順で、回数はワークフローが数える（図は `docs/claude-bot.md`）。検査を `verify.sh` の 1 本にまとめ、引数を取らないのは、bot が取り違えないようにするため（同じ記事の poka-yoke）
- 公式の code-review は、下書きの PR と、Claude がコメント済みの PR を飛ばす。そのため、ワークフローはレビューの前にレビュー待ちにし、記録のコメントはレビューの後に書く
- `aidd` の `commit`・`pr-create`・`docs-sync`・`issue-pr-sync` と `marketplace-update` は `disable-model-invocation: true` のため、bot からはスキルとして呼べない。そのため、決まりのファイルを直接読ませている。ファイルの場所が変わったら、手順 5〜7・`finish-checks.md`・ワークフローの docs-sync の段を直す
- `report.md` と `pr-body.md` の置き場所を変えるときは、ワークフローの `dir` も直す
- コミット・push と Issue・PR の更新を任せる範囲を変えるときは、P1 の「例外」と `docs/policies/permissions.md` も直す