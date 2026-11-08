# bot が変えないファイル

手順 4 で、bot が変えずに diff を PR の本文に書くファイルと、その書き方を決める。あわせて、変えてよいが人の確認が要るファイルの扱いを示す。

## 変えないファイル

次のファイルは変えず、そのまま当てられる diff を、PR の本文の末尾に `<details>` で畳んで書く。

- `.github/workflows/`：Claude App には workflow の書き込み権限が無く、push を GitHub が拒むため。拒まれた後では、bot はコミットを戻せない

これを commit して push しようとすると、ワークフローの pre-push フックが止める。PR に入っていれば、PR は下書きのまま残る。

## 変えてよいが、注意書きに並ぶファイル

`.github/scripts/`・`.claude/`（`settings.json`・`hooks/`・`skills/`・`rules/` など）・`.mcp.json`・`.vscode/`・`lefthook.yml` と、雛形（`files/`）の中の同じファイル、どの階層の `CLAUDE.md`、`.claude-plugin/`、プラグインの `.claude-plugin/`・`hooks/` は変えてよい。雛形の `files/.github/workflows/` も変えてよい（push を拒まれるのは、リポジトリのルートの `.github/workflows/` だけ）。

- Claude Code の protected paths の編集は、ワークフローが `PermissionRequest` フック（`.github/scripts/allow-protected-edits.sh`）で許可する。`.git/` とリポジトリの外は許可しない
- 変えても、同じ実行の中では効かない。どの段も、`develop` から取り分けた設定・フック・手順の写しで動くため。変えたフックや設定を、push の前に動かして確かめることはできない
- これらが PR に入ると、ワークフローが最後に PR 本文の先頭へ注意書き（`> [!CAUTION]`）を置く。bot は注意書きを書かない。マージの前に、人が差分を確かめる

## 保守

- bot が編集できる protected paths の範囲は、`.github/scripts/allow-protected-edits.sh` が正典。変えるときは、この節と `CONTRIBUTING.md`・`docs/claude-bot.md`・`docs/policies/skill-permission-map.md` も直す
- 注意書きに並ぶファイルは、`.github/scripts/pr-caution.sh` の `important` が正典。変えるときは、この節と `CONTRIBUTING.md`・`docs/claude-bot.md`・`docs/policies/skill-permission-map.md` も直す
