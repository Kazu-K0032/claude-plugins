#!/usr/bin/env bash
# CI の bot に、スキルの雛形（plugins/project/skills/<スキル>/files/）の中の protected paths の編集だけを許可する。
# protected paths は permissions.allow では許可できず、-p の実行では PermissionRequest フックが決めないと拒否になるため。
# 配る deny とフック（files/.claude/settings.json・files/.claude/hooks/）は、人が確かめて直すため許可しない。
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
