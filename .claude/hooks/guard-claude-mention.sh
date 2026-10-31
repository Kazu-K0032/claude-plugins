#!/usr/bin/env bash
# PreToolUse hook: ワークフローの起動語（@claude）を含むコメントを、手元の Claude が書くのを止める。
# Issue のコメントに @claude と書くと、.github/workflows/claude-issue-to-pr.yml が動く。ワークフローの実行は人が行う（P1）。
# settings.json の deny は、コマンドに直接書いた本文しか見ない。--body-file などで渡すファイルの中身は、ここで見る。
# 見るのは、コメントを書くコマンド（gh issue comment・gh pr comment・gh api の comments と addComment）だけ。
# Issue・PR の本文の作成・更新（gh issue create・gh issue edit など）は、ワークフローが動かないため止めない。
# @claude-bot・@claude-plugins-official のように、語の続くものは起動語にならないため止めない。
# Bash・PowerShell・Monitor のツールから呼ぶ（settings.json の matcher）。どれもコマンドは tool_input.command に入る。

# エラーで即座に止めるための厳格モード
set -euo pipefail

# 判定できないときは、承認に回す。exit 2 以外で失敗すると、Claude Code は操作をそのまま進めるため。
# jq が無くても返せるよう、JSON は printf で組む
ask_fallback() {
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"guard-claude-mention.sh: %s。本文に @claude が無いことを確かめてから承認すること。"}}\n' "$1"
  exit 0
}
trap 'ask_fallback "判定の途中で失敗した"' ERR

# 止めた場所（コマンドかファイルのパス）を理由に入れる。パスの \ で JSON が壊れないよう、jq で組む（jq が在るときだけ呼ぶ）
deny() {
  jq -n --arg where "$1" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: ("guard-claude-mention.sh: " + $where + " に、ワークフローの起動語 @claude がある。Issue のコメントに書くと claude-issue-to-pr.yml が動き、ワークフローの実行は人が行う（P1）ため止めた。起動語を書かずに言い換えるか、人に書いてもらうこと。")
    }
  }'
  exit 0
}

# コメントを書くコマンド。gh api は、REST の comments と GraphQL の addComment を見る
comment_re='gh[[:space:]]+((issue|pr)[[:space:]]+comment|api[[:space:]].*(comments|addComment))'
# 起動語。後ろに英数字・_・- が続くもの（@claude-bot など）は、別の名前のため当てない
mention_re='@claude([^[:alnum:]_-]|$)'

input=$(cat)

# jq が無いと取り出せないため、JSON 全体を見る。コメントを書くコマンドに見えるときだけ承認に回す
if ! command -v jq >/dev/null 2>&1; then
  if printf '%s' "$input" | grep -qiE "$comment_re"; then
    ask_fallback "jq が無く、コマンドを取り出せなかった"
  fi
  exit 0
fi

command=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')
[ -z "$command" ] && exit 0
printf '%s' "$command" | grep -qiE "$comment_re" || exit 0

# コマンドに直接書いた本文（--body・-b・ヒアドキュメントなど）
if printf '%s' "$command" | grep -qiE "$mention_re"; then
  deny "コマンド"
fi

# ファイルで渡す本文（--body-file・-F・--input・-f body=@<ファイル>・$(cat <ファイル>) など）。
# 引用符を除いた語のうち、ファイルとして在るものの中身を見る。相対パスは、Claude Code の作業フォルダから読む
cwd=$(printf '%s' "$input" | jq -r '.cwd // empty')
[ -n "$cwd" ] && [ -d "$cwd" ] && cd "$cwd"
set -f
for token in $(printf '%s' "$command" | tr -d "\"'\`"); do
  path=${token##*=}
  path=${path#@}
  path=${path#\$(}
  path=${path#<}
  path=${path%)}
  path=${path%;}
  [ -n "$path" ] && [ -f "$path" ] || continue
  if grep -qiE "$mention_re" -- "$path"; then
    deny "$path"
  fi
done
exit 0
