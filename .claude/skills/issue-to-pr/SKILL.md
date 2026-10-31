---
name: issue-to-pr
description: Issue のとおりに実装し、作業ブランチに push して develop 向けの下書きの PR を作る。CI の失敗やレビューの指摘を渡されたら直す。GitHub Actions の Claude が、Issue のコメントの @claude で動いたとき（.github/workflows/claude-issue-to-pr.yml）に使う。手元の作業では使わない
---

# Issue から PR を作る

GitHub Actions の Claude が、Issue のとおりに実装し、作業ブランチに push して、`develop` 向けの下書きの PR を作る。その後、ワークフローから CI の失敗やレビューの指摘を渡されたら、直して push する。コミット・push を Claude に任せるのは、P1 の例外（`docs/policies/p01-operation-boundary.md`）のため、手元の作業では使わない。

- 外へ書き込むもの：作業ブランチへのコミットと push、`develop` 向けの下書きの PR。ほかに `tmp/<ブランチ名>/issue-to-pr/` の記録
- 人がすること：PR のレビューとマージ。PR の本文に書いた diff（`.github/workflows/`・`.github/scripts/`・`.claude/hooks/`・`.claude/settings.json`）を当てること

## 参照ファイル

| ファイル | いつ読むか |
| --- | --- |
| `.claude/skills/issue-to-pr/scripts/verify.sh` | 手順 5・9 で検査するとき。引数を付けずに `bash` で流す |

## 想定している引数

引数は受け取らない。実装する Issue は、ワークフローが渡す文脈（`@claude` とコメントされた Issue）から取る。

## 出力先

`tmp/<ブランチ名>/issue-to-pr/` に書く。`<ブランチ名>` は `git branch --show-current` で取り、`/` を `-` に置き換える。ワークフローが同じ場所を読み、PR へのコメントとレビューに使う。

- `report.md`：計画と確かめたこと（手順 3・5・9）
- `pr-body.md`：PR の本文（手順 7）

## 手順

### 1. Issue を読む

`gh issue view <番号> --comments` で、タイトル・本文・コメントを読む。「決めたこと」と後のコメントが食い違えば、新しいコメントに従う。

### 2. 関係する方針を読む

`.claude/rules/plugin-changes.md` の「スキルやテンプレートを変更する場合」に従い、触るファイルに関係する方針（`docs/policies/`）を読む。同じ規約の「変更を終えた場合」のうち、コミット・push を人に任せる項目は、このスキルの手順 6 に読み替える。

### 3. 計画を書く

実装の前に、`report.md` の「## 計画」に、変えるファイルと、それぞれで何をするかを箇条書きで書く。人とレビューの Claude が、意図と実装を比べられるようにするため。

### 4. 実装する

計画のとおりに実装する。Issue に無い判断が要るときは、推測で進めず、手順 8 の形で理由を返して止める。人が決めることを、bot が決めないため。

次のファイルは変えず、そのまま当てられる diff を、PR の本文の末尾に `<details>` で畳んで書く。

- `.github/workflows/`・`.github/scripts/`：権限と secret に関わるため、人が確かめて当てる
- `.claude/hooks/`：deny と並ぶ守りのため、人が確かめて当てる
- `.claude/settings.json`：ワークフローがランナーの中で deny を外し、`--skip-worktree` を付けているため、変えてもコミットに入らない

これらを commit して push しようとすると、ワークフローの pre-push フックが止める。PR に入っていれば、PR は下書きのまま残る。

過去のコミットは、`git show <sha>`・`git log -n <件数> -- <パス>` で要る分だけ読む。全履歴の差分を一度に出すと、コンテキストを使い切るため。

### 5. 検査する

`bash .claude/skills/issue-to-pr/scripts/verify.sh` を流し、`結果: NG` なら直して流し直す。直せない NG は、PR の本文に理由を書く。流した結果（OK・NG と直したこと）を、`report.md` の「## 確かめたこと」に書く。push の前に CI と同じ検査で落としておくと、CI の直しの回数（最大 3 回）を使わずに済むため。

### 6. コミットして push する

`plugins/aidd/skills/commit/commit-rule.md` の形でコミットメッセージを書き、コミットする。`Ref:` には Issue の番号を書く。続けて、作業ブランチを push する。

### 7. 下書きの PR を作る

`plugins/aidd/skills/pr-create/pr-body-guide.md` に従い、`.github/PULL_REQUEST_TEMPLATE.md` の節を埋めて、本文を `pr-body.md` に書く。`node plugins/aidd/scripts/body_length.js <本文のファイル>` で長さを数え、超えたら縮める。本文の「関連 Issue」には `Closes #<番号>` を書く。人がマージしたとき、`close-linked-issues.yml` が Issue を閉じるため。

`gh pr create --draft --base develop --body-file <本文のファイル>` で、下書きの PR を作る。リンクを書くだけにしない。レビュー待ちへの切り替えは、ワークフローが CI の通過を確かめてから行う。

### 8. PR を作れないときは理由を返す

最後の返答に、PR を作れなかった理由を日本語で 1〜3 行で書く。ワークフローが、その返答を Issue にコメントするため。

### 9. 指摘を直す（ワークフローから直しを頼まれたとき）

ワークフローが prompt で渡したファイルを読み、指摘を直す。ファイルは次のどちらか。

- CI の失敗（`ci-<段>-<回>.log`）：落ちたジョブのログの末尾。原因を直す
- レビューの指摘（`review-feedback.md`）：`/security-review` と code-review の結果。code-review の行ごとの指摘は、ワークフローが取って、同じファイルの「行ごとの指摘」に載せてある（`gh pr view --comments` では読めない）。マージの前に直すべきものだけを直す。直すべきものが無ければ、何も変えずに終わる

直したら手順 5 の検査を流し、手順 6 のとおりコミットして、同じ作業ブランチに push する。直したことと検査の結果を、`report.md` の「## 直したこと」に、どのファイルを受けての直しかと一緒に足す。PR の本文を変えるときは、`gh pr edit <番号> --body-file <本文のファイル>` で直す。

直さない指摘があれば、理由を「## 直したこと」に書く。直しの回数はワークフローが数え（CI は各段 3 回、レビューは 1 回）、残った指摘は人が判断するため。

## 禁止事項

- `main` に向けた PR を作らない。`main` はリリース専用のため
- PR をレビュー待ちにしない。マージしない。Issue を閉じない。これでよいかの判断は、ワークフローの検査と人が行うため（V3）
- コメント・PR の本文に `@claude` を書かない。ワークフローの起動語のため
- `.github/workflows/`・`.github/scripts/`・`.claude/hooks/`・`.claude/settings.json` を変えない（手順 4）。`.github/scripts/` は、ワークフローが CI を待つのに使うため
- 作業ブランチ以外に push しない。`--force` を付けない。直しの step で許されるのは、作業ブランチへの `git push origin <ブランチ>` だけのため

## 保守

- このスキルは `.github/workflows/claude-issue-to-pr.yml` から呼ぶ（手順 1〜8 は `--append-system-prompt`、手順 9 は `prompt`）。使えるコマンドは、ワークフローの `--allowedTools`（手順 9 は `FIX_TOOLS_BASE` に、作業ブランチへの push を足したもの）で決まる。手順で新しいコマンドを使うときは、そちらにも足す
- 変えてはいけないパスの一覧は、`.github/scripts/guard-paths.sh` の `protected` が正典。変えるときは、手順 4・禁止事項・`CONTRIBUTING.md` も直す
- 流れは Anthropic の「Building effective agents」の型にならう。実装 → CI の直し（最大 3 回）→ `/security-review` と code-review → 直し（1 回）→ CI の直し（最大 3 回）の順で、回数はワークフローが数える。検査を `verify.sh` の 1 本にまとめ、引数を取らないのは、bot が取り違えないようにするため（同じ記事の poka-yoke）
- 公式の code-review は、下書きの PR と、Claude がコメント済みの PR を飛ばす。そのため、ワークフローはレビューの前にレビュー待ちにし、記録のコメントはレビューの後に書く
- `aidd` の `commit`・`pr-create` は `disable-model-invocation: true` のため、bot からはスキルとして呼べない。そのため、決まりのファイルを直接読ませている。ファイルの場所が変わったら、手順 6・7 を直す
- `report.md` と `pr-body.md` の置き場所を変えるときは、ワークフローの `dir` も直す
- コミット・push を任せる範囲を変えるときは、P1 の「例外」と `docs/policies/permissions.md` も直す
