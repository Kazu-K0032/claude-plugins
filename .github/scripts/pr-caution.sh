#!/usr/bin/env bash
# bot が変えた重要なファイル（権限・実行・bot の振る舞いに関わるもの）を、PR 本文の先頭の注意書きに並べる。claude-issue-to-pr.yml が、bot の段の後に呼ぶ。
# bot はこれらのファイルを変えてよい。代わりに、マージの前に人が見落とさないよう、目立つ形で知らせる（V3）。
# bot が書き換えられないよう、ワークフローは bot が動く前にこのファイルを $RUNNER_TEMP に写し、写しを流す。
#
# 使い方:
#   pr-caution.sh --list         標準入力のパスの一覧（1 行 1 パス）から、重要なファイルだけを出す
#   pr-caution.sh --body <本文>  標準入力のパスの一覧から注意書きを作り、本文の先頭に置いた本文を出す。
#                                前回の注意書き（印のコメントの間）は置き換える。重要なファイルが無ければ、注意書きを消す

set -uo pipefail

# 重要なファイル。変えるときは、CONTRIBUTING.md の bot の節と docs/claude-bot.md も直す
important='^\.github/|^\.claude/|(^|/)CLAUDE\.md$|^\.mcp\.json$|^\.vscode/|^\.?lefthook\.ya?ml$|/files/\.claude/(settings\.json$|hooks/)'
start='<!-- bot-caution:start -->'
end='<!-- bot-caution:end -->'

list_important() {
  grep -E "$important" | sort -u || true
}

case "${1:-}" in
  --list)
    list_important
    ;;
  --body)
    body_file=${2:?本文のファイルを渡す}
    hits=$(list_important)
    if [ -n "$hits" ]; then
      echo "$start"
      echo '> [!CAUTION]'
      echo '> bot が、権限・実行・bot の振る舞いに関わるファイルを変えた。マージの前に、次のファイルの差分を人が確かめる。'
      echo '>'
      sed 's/^/> - `/; s/$/`/' <<< "$hits"
      echo "$end"
      echo
    fi
    # 前回の注意書きと、その直後の空行を除いた本文を出す。GitHub の本文は CRLF のことがあるため、行末の \r を除いて比べる
    awk -v s="$start" -v e="$end" '
      { line = $0; sub(/\r$/, "", line) }
      line == s { skip = 1; next }
      skip && line == e { skip = 0; drop_blank = 1; next }
      skip { next }
      drop_blank && line ~ /^[[:space:]]*$/ { drop_blank = 0; next }
      { drop_blank = 0; print }
    ' "$body_file"
    ;;
  *)
    echo "使い方: pr-caution.sh --list | --body <本文のファイル>" >&2
    exit 2
    ;;
esac
