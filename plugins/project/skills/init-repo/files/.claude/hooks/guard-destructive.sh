#!/usr/bin/env bash
# PreToolUse hook: 破壊的コマンドを検出し承認をエスカレーションする。
# settings.json の deny で止めている git push/commit/tag/remote、gh mutation とは
# 重複させず、データ消失・課金影響・履歴破壊を伴う操作のみを対象にする。
#
# カスタマイズ方針:
#   プロジェクト固有の破壊的操作（クラウド CLI の delete 系・本番ホストへの SSH 等）は
#   下部の patterns 配列に追記する。判定は grep -E の正規表現で行う。

# エラーで即座に止めるための厳格モード
set -euo pipefail

# 渡された JSON からコマンド文字列を取り出し、コマンドが無ければ即座に素通りさせる
input=$(cat)
command=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')
[ -z "$command" ] && exit 0

# --- Terraform は「保存済み plan を必ず通す」規約を機械的に強制する ---
# 規約: plan は -out=tfplan で保存し、apply はその保存済み plan ファイルだけを食わせる。
# flag の付け忘れを口頭ルールに頼らず deny で物理的に止める。apply は下の patterns では扱わない。
# Terraform を使わないリポジトリでは、この 2 ブロックごと削除してよい。

# terraform plan: -out が無ければ deny（plan を保存しない実行を禁止）
if printf '%s' "$command" | grep -qE 'terraform[[:space:]]+plan'; then
  if ! printf '%s' "$command" | grep -qE '[[:space:]]-out(=|[[:space:]])'; then
    jq -n --arg cmd "$command" '{
    hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: ("terraform plan は -out=tfplan で plan を保存すること: " + $cmd + "\n例: terraform plan -out=tfplan")
    }
    }'
    exit 0
  fi
  # -out 付きの plan はインフラを変更しないため素通りさせる
  exit 0
fi

# terraform apply: 保存済み plan ファイル（非フラグの位置引数）が無ければ deny（直接 apply 禁止）
if printf '%s' "$command" | grep -qE 'terraform[[:space:]]+apply'; then
  if ! printf '%s' "$command" | grep -qE 'terraform[[:space:]]+apply([[:space:]]+-[^[:space:]]+)*[[:space:]]+[^-[:space:]][^[:space:]]*'; then
    jq -n --arg cmd "$command" '{
    hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: ("terraform apply は保存済み plan ファイルを渡すこと（直接 apply 禁止）: " + $cmd + "\n手順: terraform plan -out=tfplan → terraform apply tfplan")
    }
    }'
    exit 0
  fi
  # plan ファイルを渡した apply は実インフラを変更するため、承認（ask）へエスカレーションする
  jq -n --arg cmd "$command" '{
  hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "ask",
      permissionDecisionReason: ("破壊的操作の可能性: " + $cmd + "\n削除・変更される対象を列挙し、実データ（本番環境・tfstate 等）を含まないか確認してから承認すること。")
  }
  }'
  exit 0
fi

patterns=(
# 全リソースを削除する。本番環境で実行するとインフラ構成がすべて失われる
'terraform[[:space:]]+destroy'
# state ファイルの強制上書き。古い state で push すると plan/apply が実態と乖離する
'terraform[[:space:]]+state[[:space:]]+push'
# state からリソースを削除。クラウド側のリソースは残るが Terraform が管理を失い次の apply で再作成衝突が起きる
'terraform[[:space:]]+state[[:space:]]+rm'
# state 内のリソース参照先を書き換え。誤った引数で不整合が生じると destroy → 再作成が発生する
'terraform[[:space:]]+state[[:space:]]+mv'
# backend のロックを強制解除。別プロセスが apply 中に実行すると state が破損する
'terraform[[:space:]]+force-unlock'
# workspace 切り替え。誤った workspace で apply すると別環境に影響する
'terraform[[:space:]]+workspace[[:space:]]+(select|delete)'
# コンテナと named volume を削除する。DB データが消えるとアプリの全コンテンツが失われる
'docker[[:space:]]+compose[[:space:]]+down[[:space:]].*-v'
'docker-compose[[:space:]]+down[[:space:]].*-v'
# -r または -f オプション付きの rm。再帰削除・強制削除はファイル復元ができない
'rm[[:space:]]+-[a-zA-Z]*[rf][a-zA-Z]*[rf]'
# ステージング・ワーキングツリーをコミットに強制リセットする。未コミット変更が消える
'git[[:space:]]+reset[[:space:]]+--hard'
# 未追跡ファイルを強制削除する。-f で復元できないファイルが消える
'git[[:space:]]+clean[[:space:]]+-[a-zA-Z]*f'
# リモートブランチを強制上書きする。他者のコミットや履歴が失われる
'git[[:space:]]+push[[:space:]].*(--force|--force-with-lease|-f)'
)

for p in "${patterns[@]}"; do
if printf '%s' "$command" | grep -qE "$p"; then
    jq -n --arg cmd "$command" '{
    hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason: ("破壊的操作の可能性: " + $cmd + "\n削除・変更される対象を列挙し、実データ（本番環境・tfstate 等）を含まないか確認してから承認すること。")
    }
    }'
    exit 0
fi
done
exit 0
