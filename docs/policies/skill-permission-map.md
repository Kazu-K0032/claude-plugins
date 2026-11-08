# スキルの操作と権限設定の対応

`init-repo` が配る設定（deny・フック・`.gitignore`）が、各スキルの操作を止めないようにするための対応表。deny やフックを変えるときと、`tmp/` 以外に書き込むスキルを作るときに見る。線引きの考え方は [P1](p01-operation-boundary.md)。

## 対応表

| スキル | 使う操作 | `init-repo` でそろえること |
| --- | --- | --- |
| `aidd` の `commit`・`docs-sync`・`issue-pr-sync`・`issue-start`・`pr-create`・`ai-report`・`pr-review`・`harness-audit` | `tmp/<ブランチ名>/`・`tmp.md` への書き込み | `.gitignore` に `tmp/` と `tmp.md` を入れる |
| `config:plugin-feedback` | `.claude/settings.local.json` の `env` に 1 キーを足す | deny にこのファイルの `Edit` を入れない。`.gitignore` には入れる |
| `config:plugin-feedback` | `gh issue create`・`gh issue comment` | deny に入れない |
| `aidd:issue-start` | `gh issue develop`・`gh issue edit`・`gh issue comment` | deny に入れない |
| `aidd:issue-start` | `git add <ファイル>`（実装で直したファイル・点検で直した md・作った ADR だけをステージに置く） | deny に `git add` を入れない |
| `init-repo` の `CLAUDE.md`（「実装がひと区切りついたとき」） | `git add <ファイル>`（その区切りで直したファイルだけ）と、`tmp.md` への書き込み | deny に `git add` を入れない |
| `init-repo` の `post-edit-lint.sh` | 編集したファイルに `lefthook run claude-edit` をかける。整形のツールはファイルを書き換える。`--no-auto-install` を付け、`.git/` は書き換えない | なし（フックは deny の対象外） |
| `project:init-repo` | 「Claude が入れる」を選んだときの、lefthook と Lint・整形のツールの導入。`package.json` があれば、選ばれたパッケージマネージャー（`npm install --save-dev`・`pnpm add -D`・`yarn add --dev`）で `package.json`・lock・`node_modules` に書き込む。lefthook は、npm・pnpm では `--ignore-scripts`、Yarn 2 以降では `--mode=skip-build` を付け、`.git/hooks` を書き換えない。Yarn 1 では lefthook を入れない。`package.json` が無いときと Yarn の PnP では、lefthook を winget・Homebrew でリポジトリの外に入れる | deny に `npm install`・`pnpm add`・`yarn add` と、`package.json` の `Edit` を入れない |
| `project:init-repo` | 手順 2 の答えに合わせたコピー後の書き換え（承認を得てから）。入れない `docs/` のフォルダを指す行を、コピーした `CLAUDE.md`・`docs/README.md`・`docs/strategies/` の文書から外し、`docs/strategies/test-strategy.md` の「テストの層」の表を差し替える | deny にこれらのファイルの `Edit` を入れない |
| `project:init-repo` | 前の版の残り物を外す（承認を得てから）。`.claude/settings.json` の `SessionStart` の項目と、`CLAUDE.md`・`docs/README.md` の節・行を書き換える。ファイルの削除（`rm`）は、Claude は実行せず、利用者に示す | deny にこれらのファイルの `Edit` を入れない。`rm` は deny の `Bash(rm *)` が止めるため、人が実行する |
| `project:wordpress` | `lefthook.yml`（古い形では `.claude/hooks/post-edit-lint.sh`）への PHP の Lint の追加と、`.claude/hooks/guard-destructive.sh` への `docker compose down -v` の追加（どちらも承認を得てから）、コピーしたテーマのディレクトリの `mv`、`<ADR_DIR>` への ADR の作成と一覧への 1 行の追加 | deny にこれらのファイル・`<ADR_DIR>` の `Edit` と `mv` を入れない |
| `project:terraform` | `.claude/settings.json` の PreToolUse への `guard-terraform.sh` の登録（古い形の `matcher` は `Bash\|PowerShell\|Monitor` に直す）と `permissions.deny` への秘匿ファイル（`*.tfvars`・`*.tfstate` など）の追加、`lefthook.yml`（古い形では `.claude/hooks/post-edit-lint.sh`）への `terraform fmt` の追加と、`cspell.json` の `words` への語の追加（どれも承認を得てから） | deny にこれらのファイルの `Edit` を入れない |
| `aidd:adr` | `<ADR_DIR>`（`docs/adr/` など）への ADR の作成と、一覧（`README.md`）の作成・更新 | deny にこのディレクトリへの書き込み（`Edit`）を入れない |
| `aidd:issue-pr-sync` | `gh issue edit`・`gh pr edit` | deny に入れない |
| `project:gas` | 既存のコードの `git mv` による `src/` への移動（承認を得てから）、`src/`・`.claude/rules/gas.md`・`.clasp.json` の作成と、`rootDir`・`paths` の書き換え、`.gitignore` への `.clasprc.json` などの追記、`.claude/settings.json` の PreToolUse への `guard-clasp.sh` の登録（古い形の `matcher` は `Bash\|PowerShell\|Monitor` に直す）と `permissions.deny` への認証情報（`.clasprc.json`）の追加、`cspell.json` の `words` への語の追加（どれも承認を得てから） | deny に `git mv` と、これらのファイルの `Edit` を入れない |
| `config:setup-global` | `~/.claude/settings.json` と `~/.claude/statusline/statusline.js`（と `.bak`）への書き込み。置いた `statusline.js` は環境変数 `CLAUDE_STATUSLINE_PLAIN` を読む | なし（どちらもリポジトリの外。deny は `./` で始まるパスだけを止める） |
| `config` のフック | 環境変数 `CLAUDE_PLUGIN_DATA` を読み、そのフォルダに印のファイル `plugin-feedback-notice-shown` を書く | なし（リポジトリの外） |
| `config` のフック・`config:plugin-feedback` | 環境変数 `CLAUDE_PLUGIN_FEEDBACK`・`CLAUDE_PLUGIN_FEEDBACK_SKIP_APPROVAL` を読む | `settings.json` の `env` に入れない（利用者が決める値のため） |
| `config:mod-output-customize` | `~/.claude/mods/` への `mv`・`cp -r` と、`~/.claude/settings.json` の `env.CLAUDE_CODE_PLUGIN_DIRS` の書き換え。mod を外すときの `rm -rf ~/.claude/mods/mod-output-customize` は、Claude は実行せず、利用者に示す | なし（どちらもリポジトリの外）。`rm` は deny の `Bash(rm *)` が止めるため、人が実行する |
| `config:mod-output-customize` が入れる mod | 環境変数 `USERPROFILE`・`HOME` と、`~/.claude/plugins/installed_plugins.json` を読む（リンク先の版を知るため） | なし（どちらもリポジトリの外） |

`config:plugin-feedback` が書き込みを止められたときは、書かずに `off` として続ける。

GitHub Actions の Claude App は、作業ブランチへのコミットと push をする（[P1](p01-operation-boundary.md) の例外）。このリポジトリの `.github/workflows/claude-issue-to-pr.yml` は、Claude を動かす前に、`develop` の `settings.json` から設定の写しを作り、写しの中だけで `git commit`・`git push` の deny を外す。どの段も `--setting-sources user` とこの写し（`--settings`）で動かし、作業ツリーの設定・フック・スキル・`CLAUDE.md` を読ませない。フックも、取り分けた写しを指す。利用先で同じワークフローを作るときも、この手順を入れる。push する Claude の step では、env の `GIT_CONFIG_*` で checkout が残した GITHUB_TOKEN のヘッダーを空にし、App のトークンで push させる。残すと push が `github-actions[bot]` の名義になり、その CI が承認待ちで動かないため。外す代わりに、直しの step で許す `git push` は作業ブランチへの完全一致 1 件だけにし、`.github/workflows/` の変更は pre-push フック（`.github/scripts/guard-paths.sh`）で止める。あわせて、ファイルを直す段（実装・直し）の写しにだけ `PermissionRequest` フック（`.github/scripts/allow-protected-edits.sh`）を足し、Claude Code の protected paths の編集を、リポジトリの中（`.git/` を除く）で許可する。権限・実行・bot の振る舞いに関わるファイルを変えた PR には、最後に本文の先頭へ注意書きを置く（`.github/scripts/pr-caution.sh`）。最後の「AI を使った確認を仕上げる」段には、`gh issue edit`・`gh pr edit` を許し、`issue-pr-sync` の決まりで承認の要らない更新だけを反映させる（P1 の例外）。この段は、リポジトリのファイルの書き込みを許さず、`tmp/` だけに絞る。検査のスクリプトは、bot が動く前に取り分けた写しを使う。

このリポジトリは、ワークフローの起動語 `@claude` を含むコメントを、deny（コマンドに書いた本文）とフック（`.claude/hooks/guard-claude-mention.sh`。`--body-file` などで渡すファイルの中身）で止める。`init-repo` には配らない。起動語はリポジトリごとに違うため、利用先で足す（[P1](p01-operation-boundary.md)）。

## Q&A

### Q. 新しいスキルが、`tmp/` 以外に書き込む・`gh` や `git` で書き込む・環境変数を読む

表に行を足す。`init-repo` の deny・フック・`.gitignore` で止まらないか、止まったらどうなるかを書く。

### Q. `init-repo` の deny やフックに操作を足したい

足す前に、この表でその操作を使うスキルを探す。止まるスキルがあれば、利用者に伝えてから決める。`git`・`gh` の deny は、`Bash(...)` と `PowerShell(...)` の組で足す（[P1](p01-operation-boundary.md)）。
