#!/usr/bin/env bash
# CI の bot に、リポジトリの中の Claude Code の protected paths（.claude/・.vscode/・lefthook.yml など）の編集を許可する。
# protected paths は permissions.allow では許可できず、-p の実行では PermissionRequest フックが決めないと拒否になるため。
# 編集を許しても、bot の段は develop から取り分けた設定・フック・手順の写しで動く（--setting-sources user）。作業ツリーで書き換えた設定やフックは、同じ実行の中では動かない。
# 書き換えた重要なファイルは、ワークフローが PR 本文の先頭の注意書きに並べ、マージの前に人が確かめる（pr-caution.sh）。
# 以前は雛形（plugins/project/skills/<スキル>/files/）の中だけを許可していたため、この名前のまま残している。
set -uo pipefail

path=$(jq -r '.tool_input.file_path // empty')
[ -n "$path" ] || exit 0
# .. を含むパスは、範囲の外を指せるため許可しない
case "$path" in *..*) exit 0 ;; esac

root=$(git rev-parse --show-toplevel) || exit 0
rel=${path#"$root"/}

# リポジトリの外は許可しない
[ "$rel" != "$path" ] || exit 0
# .git/ は、履歴と git の設定（フックの場所など）のため許可しない
[[ $rel =~ ^\.git(/|$) ]] && exit 0

jq -n '{hookSpecificOutput: {hookEventName: "PermissionRequest", decision: {behavior: "allow"}}}'
