# bot が変えないファイル

手順 4 で、bot が変えずに diff を PR の本文に書くファイルと、その書き方を決める。権限と守りに関わるファイルを、人が確かめてから当てるため。

## 変えないファイル

次のファイルは変えず、そのまま当てられる diff を、PR の本文の末尾に `<details>` で畳んで書く。

- `.github/workflows/`・`.github/scripts/`：権限と secret に関わるため、人が確かめて当てる
- `.claude/hooks/`：deny と並ぶ守りのため、人が確かめて当てる
- `.claude/settings.json`：ワークフローがランナーの中で deny を外し、`--skip-worktree` を付けているため、変えてもコミットに入らない

これらを commit して push しようとすると、ワークフローの pre-push フックが止める。PR に入っていれば、PR は下書きのまま残る。

## 変えられないファイル

Claude Code の protected paths（`.claude/`・`.vscode/`・`lefthook.yml` など）は、スキルの雛形（`plugins/project/skills/<スキル>/files/`）の中だけ編集できる。ワークフローが、この範囲だけを `PermissionRequest` フック（`.github/scripts/allow-template-edits.sh`）で許可しているため。範囲の外は `which is a sensitive file` で拒否されるため、同じく diff を PR の本文に書く。

雛形の中でも、`files/.claude/settings.json` と `files/.claude/hooks/` は許可しない。利用先に配る deny とフックで、人が確かめて直すため。

## 保守

- bot が編集できる protected paths の範囲は、`.github/scripts/allow-template-edits.sh` が正典。変えるときは、この節と `docs/claude-bot.md` も直す
