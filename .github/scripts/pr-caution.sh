#!/usr/bin/env bash
# bot が変えた重要なファイル（権限・実行・bot の振る舞いに関わるもの）を、PR 本文の先頭の注意書きに並べる。claude-issue-to-pr.yml が、bot の段の後に呼ぶ。
# bot はこれらのファイルを変えてよい。代わりに、マージの前に人が見落とさないよう、目立つ形で知らせる（V3）。
# bot が書き換えられないよう、ワークフローは bot が動く前にこのファイルを $RUNNER_TEMP に写し、写しを流す。
#
# 使い方:
#   pr-caution.sh --list         標準入力のパスの一覧（1 行 1 パス）から、重要なファイルだけを出す
#   pr-caution.sh --render       標準入力のパスの一覧から、注意書き（> [!CAUTION] の引用）だけを出す。重要なファイルが無ければ何も出さない
#   pr-caution.sh --body <本文>  標準入力のパスの一覧から注意書きを作り、本文の先頭に置いた本文を出す。
#                                前回の注意書き（印のコメントの間）は置き換える。重要なファイルが無ければ、注意書きを消す
# ワークフローの routing（レビューの effort を上げる判定）も --list を使う。一覧を 1 か所に保つため

set -uo pipefail

# 重要なファイル。変えるときは、CONTRIBUTING.md の bot の節・docs/claude-bot.md・docs/policies/permissions.md・
# .claude/skills/issue-to-pr/unchangeable-paths.md も直す
#   - リポジトリのルートと、利用先に配る雛形（files/ の下）の .github/・.claude/・.mcp.json・.vscode/・lefthook.yml
#   - どの階層の CLAUDE.md も（Claude が読み込む規約のため）
#   - マーケットプレイスとプラグインのマニフェスト（.claude-plugin/）と、プラグインのフック（plugins/<名前>/hooks/。利用者の環境で動く）
important='(^|/files/)(\.github/|\.claude/|\.mcp\.json$|\.vscode/|\.?lefthook\.ya?ml$)|(^|/)CLAUDE\.md$|^\.claude-plugin/|^plugins/[^/]+/(\.claude-plugin/|hooks/)'
start='<!-- bot-caution:start -->'
end='<!-- bot-caution:end -->'

list_important() {
  grep -E "$important" | sort -u || true
}

# 重要なファイルの一覧（引数）から、注意書きを出す
render() {
  [ -n "$1" ] || return 0
  echo '> [!CAUTION]'
  echo '> bot が、権限・実行・bot の振る舞いに関わるファイルを変えた。マージの前に、次のファイルの差分を人が確かめる。'
  echo '>'
  sed 's/^/> - `/; s/$/`/' <<< "$1"
}

case "${1:-}" in
  --list)
    list_important
    ;;
  --render)
    render "$(list_important)"
    ;;
  --body)
    body_file=${2:?本文のファイルを渡す}
    hits=$(list_important)
    if [ -n "$hits" ]; then
      echo "$start"
      render "$hits"
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
    echo "使い方: pr-caution.sh --list | --render | --body <本文のファイル>" >&2
    exit 2
    ;;
esac
