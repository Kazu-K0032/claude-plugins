#!/usr/bin/env bash
# PreToolUse hook: 破壊的コマンドを検出し承認をエスカレーションする。
# データ消失・課金影響・履歴破壊を伴う操作を対象にする。
# rm・git clean・git push --force は settings.json の deny でも止めているが、deny はルールの形に
# 当たるコマンドしか止めず、bash -c などを経由した実行は止まらない。そのため、ここでも検出する。
# Bash と PowerShell の両方のツールから呼ぶ（settings.json の matcher）。どちらもコマンドは tool_input.command に入る。
#
# カスタマイズ方針:
#   プロジェクト固有の破壊的操作（クラウド CLI の delete 系・本番ホストへの SSH 等）は
#   下部の patterns 配列に追記する。判定は grep -iE の正規表現で行う。
#   PowerShell はコマンド名・オプションの大文字小文字を区別しないため、大文字小文字を区別せずに判定する。

# エラーで即座に止めるための厳格モード
set -euo pipefail

# 渡された JSON からコマンド文字列を取り出し、コマンドが無ければ即座に素通りさせる
input=$(cat)
command=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')
[ -z "$command" ] && exit 0

patterns=(
# -r・-R・-f（--recursive・--force）のどれかが付いた rm。再帰削除・強制削除はファイル復元ができない
# オプションはファイル名の後ろにも置けるため、同じコマンドの中（; & | の手前まで）を探す
'(^|[^[:alnum:]_-])rm[[:space:]]+([^;&|]*[[:space:]])?(-[a-zA-Z]*[rRf][a-zA-Z]*|--recursive|--force)([[:space:]]|$)'
# PowerShell の Remove-Item と、その別名（ri・del・erase・rd・rmdir）に -Recurse・-Force が付いたもの。
# PowerShell はオプションを先頭の数文字に略せる（-r・-fo など）ため、略した形も含める。-Recurse:$true の形も当たる
'(^|[^[:alnum:]_-])(remove-item|ri|del|erase|rd|rmdir)[[:space:]]+([^;&|]*[[:space:]])?-(r|re|rec|recu|recur|recurs|recurse|fo|for|forc|force)([[:space:]:]|$)'
# ステージング・ワーキングツリーをコミットに強制リセットする。未コミット変更が消える
'git[[:space:]]+reset[[:space:]]+--hard'
# 未追跡ファイルを強制削除する。-f で復元できないファイルが消える
'git[[:space:]]+clean[[:space:]]+-[a-zA-Z]*f'
# リモートブランチを強制上書きする。他者のコミットや履歴が失われる
'git[[:space:]]+push[[:space:]].*(--force|--force-with-lease|-f)'
)

for p in "${patterns[@]}"; do
if printf '%s' "$command" | grep -qiE "$p"; then
    jq -n --arg cmd "$command" '{
    hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason: ("破壊的操作の可能性: " + $cmd + "\n削除・変更される対象を列挙し、実データ（本番環境・データベース等）を含まないか確認してから承認すること。")
    }
    }'
    exit 0
fi
done
exit 0
