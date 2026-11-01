#!/usr/bin/env bash
# CI の bot に、スキルの雛形（plugins/project/skills/<スキル>/files/）の中の protected paths の編集だけを許可する。
# protected paths は permissions.allow では許可できず、-p の実行では PermissionRequest フックが決めないと拒否になるため。
# 配る deny とフック（files/.claude/settings.json・files/.claude/hooks/）は、人が確かめて直すため許可しない。
# 今のワークフローは allow-protected-edits.sh を使う。このファイルは、main にある古いワークフローのために残す。
# 古いワークフローは develop からこのファイルを写すが、段を写しで動かさないため、範囲を広げた版を渡すとフックの書き換えが同じ実行の中で動く。
# 範囲を広げたワークフローをリリースした後に、人が消す（Issue #263）。
set -uo pipefail

path=$(jq -r '.tool_input.file_path // empty')
[ -n "$path" ] || exit 0
# .. を含むパスは、範囲の外を指せるため許可しない
case "$path" in *..*) exit 0 ;; esac

root=$(git rev-parse --show-toplevel) || exit 0
rel=${path#"$root"/}

[[ $rel =~ ^plugins/project/skills/[^/]+/files/ ]] || exit 0
[[ $rel =~ /files/\.claude/(settings\.json$|hooks/) ]] && exit 0

jq -n '{hookSpecificOutput: {hookEventName: "PermissionRequest", decision: {behavior: "allow"}}}'
