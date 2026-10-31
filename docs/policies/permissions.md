# スキルの操作と権限設定の対応

`init-repo` が配る設定（deny・フック・`.gitignore`）が、各スキルの操作を止めないようにするための対応表。deny やフックを変えるときと、`tmp/` 以外に書き込むスキルを作るときに見る。線引きの考え方は [P1](p01-operation-boundary.md)。

## 対応表

| スキル | 使う操作 | `init-repo` でそろえること | `guard-git-write.sh` を使うと |
| --- | --- | --- | --- |
| `aidd` の `commit`・`docs-sync`・`issue-pr-sync`・`issue-start`・`pr-create`・`ai-report`・`pr-review`・`harness-audit` | `tmp/<ブランチ名>/`・`tmp.md` への書き込み | `.gitignore` に `tmp/` と `tmp.md` を入れる | 止まらない |
| `config:plugin-feedback` | `.claude/settings.local.json` の `env` に 1 キーを足す | deny にこのファイルの `Edit` を入れない。`.gitignore` には入れる | 止まらない |
| `config:plugin-feedback` | `gh issue create`・`gh issue comment` | deny に入れない | `create` が止まり、下書きを Web の画面に貼る手順になる |
| `aidd:issue-start` | `gh issue develop`・`gh issue edit`・`gh issue comment` | deny に入れない | `edit`（担当者の追加と本文の更新）が止まる。本文は `tmp/` に下書きを残すところまでになる |
| `aidd:issue-start` | `git add <ファイル>`（実装で直したファイル・点検で直した md・作った ADR だけをステージに置く） | deny に `git add` を入れない | 止まらない |
| `init-repo` の `CLAUDE.md`（「実装がひと区切りついたとき」） | `git add <ファイル>`（その区切りで直したファイルだけ）と、`tmp.md` への書き込み | deny に `git add` を入れない | 止まらない |
| `init-repo` の `post-edit-lint.sh` | 編集したファイルに `lefthook run claude-edit` をかける。整形のツールはファイルを書き換える。`--no-auto-install` を付け、`.git/` は書き換えない | なし（フックは deny の対象外） | 止まらない |
| `project:init-repo` | 「Claude が入れる」を選んだときの、lefthook と Lint・整形のツールの導入。`package.json` があれば `npm install --save-dev`（lefthook は `--ignore-scripts` を付け、`.git/hooks` を書き換えない）で `package.json`・lock・`node_modules` に書き込む。無ければ winget・Homebrew でリポジトリの外に入れる | deny に `npm install` と、`package.json` の `Edit` を入れない | 止まらない |
| `project:wordpress` | `lefthook.yml`（古い形では `.claude/hooks/post-edit-lint.sh`）への PHP の Lint の追加と、`.claude/hooks/guard-destructive.sh` への `docker compose down -v` の追加（どちらも承認を得てから）、コピーしたテーマのディレクトリの `mv`、`<ADR_DIR>` への ADR の作成と一覧への 1 行の追加 | deny にこれらのファイル・`<ADR_DIR>` の `Edit` と `mv` を入れない | 止まらない |
| `project:terraform` | `.claude/settings.json` の PreToolUse への `guard-terraform.sh` の登録（古い形の `matcher` は `Bash\|PowerShell\|Monitor` に直す）と `permissions.deny` への秘匿ファイル（`*.tfvars`・`*.tfstate` など）の追加、`lefthook.yml`（古い形では `.claude/hooks/post-edit-lint.sh`）への `terraform fmt` の追加と、`cspell.json` の `words` への語の追加（どれも承認を得てから） | deny にこれらのファイルの `Edit` を入れない | 止まらない |
| `aidd:adr` | `<ADR_DIR>`（`docs/adr/` など）への ADR の作成と、一覧（`README.md`）の作成・更新 | deny にこのディレクトリへの書き込み（`Edit`）を入れない | 止まらない |
| `aidd:issue-pr-sync` | `gh issue edit`・`gh pr edit` | deny に入れない | 反映が止まり、下書きを出すところまでになる |
| `project:gas` | 既存のコードの `git mv` による `src/` への移動（承認を得てから）、`src/`・`.claude/rules/gas.md`・`.clasp.json` の作成と、`rootDir`・`paths` の書き換え、`.gitignore` への `.clasprc.json` などの追記、`.claude/settings.json` の PreToolUse への `guard-clasp.sh` の登録（古い形の `matcher` は `Bash\|PowerShell\|Monitor` に直す）と `permissions.deny` への認証情報（`.clasprc.json`）の追加、`cspell.json` の `words` への語の追加（どれも承認を得てから） | deny に `git mv` と、これらのファイルの `Edit` を入れない | 止まらない |
| `config:setup-global` | `~/.claude/settings.json` と `~/.claude/statusline/statusline.js`（と `.bak`）への書き込み。置いた `statusline.js` は環境変数 `CLAUDE_STATUSLINE_PLAIN` を読む | なし（どちらもリポジトリの外。deny は `./` で始まるパスだけを止める） | 関係しない |
| `config` のフック | 環境変数 `CLAUDE_PLUGIN_DATA` を読み、そのフォルダに印のファイル `plugin-feedback-notice-shown` を書く | なし（リポジトリの外） | 関係しない |
| `config` のフック・`config:plugin-feedback` | 環境変数 `CLAUDE_PLUGIN_FEEDBACK`・`CLAUDE_PLUGIN_FEEDBACK_SKIP_APPROVAL` を読む | `settings.json` の `env` に入れない（利用者が決める値のため） | 関係しない |
| `config:mod-output-customize` | `~/.claude/mods/` への `mv`・`cp -r` と、`~/.claude/settings.json` の `env.CLAUDE_CODE_PLUGIN_DIRS` の書き換え。mod を外すときの `rm -rf ~/.claude/mods/mod-output-customize` は、Claude は実行せず、利用者に示す | なし（どちらもリポジトリの外）。`rm` は deny の `Bash(rm *)` が止めるため、人が実行する | 関係しない |
| `config:mod-output-customize` が入れる mod | 環境変数 `USERPROFILE`・`HOME` と、`~/.claude/plugins/installed_plugins.json` を読む（リンク先の版を知るため） | なし（どちらもリポジトリの外） | 関係しない |

`config:plugin-feedback` が書き込みを止められたときは、書かずに `off` として続ける。

GitHub Actions の Claude App は、作業ブランチへのコミットと push をする（[P1](p01-operation-boundary.md) の例外）。このリポジトリの `.github/workflows/claude-issue-to-pr.yml` は、Claude を動かす前に、ランナーの中だけで `git commit`・`git push` の deny を外し、`git update-index --skip-worktree` で書き換えた `settings.json` をコミットから外す。利用先で同じワークフローを作るときも、この手順を入れる。

このリポジトリは、ワークフローの起動語 `@claude` を含むコメントを、deny（コマンドに書いた本文）とフック（`.claude/hooks/guard-claude-mention.sh`。`--body-file` などで渡すファイルの中身）で止める。`init-repo` には配らない。起動語はリポジトリごとに違うため、利用先で足す（[P1](p01-operation-boundary.md)）。

## Q&A

### Q. 新しいスキルが、`tmp/` 以外に書き込む・`gh` や `git` で書き込む・環境変数を読む

表に行を足す。`init-repo` の deny・フック・`.gitignore` で止まらないか、止まったらどうなるかを書く。

### Q. `init-repo` の deny やフックに操作を足したい

足す前に、この表でその操作を使うスキルを探す。止まるスキルがあれば、利用者に伝えてから決める。`git`・`gh` の deny は、`Bash(...)` と `PowerShell(...)` の組で足す（[P1](p01-operation-boundary.md)）。
