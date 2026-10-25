#!/usr/bin/env bash
# PreToolUse hook: Terraform の実行の決まり（.claude/rules/terraform.md）を守らせる。
# Claude が実行してよいのは fmt・validate・init・plan（-out で保存するもの）まで。
# インフラや state（インフラの今の状態の記録）を変えるコマンドは、人が実行する。
# settings.json の deny はルールの形に当たるコマンドしか止めず、-chdir を付けた実行や bash -c 経由の実行が抜けるため、フックで検出する。
#
# カスタマイズ方針:
#   止めるサブコマンドを足すときは、下の deny_patterns 配列に追記する。判定は grep -E の正規表現で行う。

# エラーで即座に止めるための厳格モード。-E は、関数（deny など）の中の失敗でも、下の ERR のトラップを動かすため
set -Eeuo pipefail

# terraform を呼ぶコマンドかもしれないのに判定できないときは、止める。exit 2 以外で失敗すると、Claude Code は操作をそのまま進めるため
trap 'echo "guard-terraform.sh が判定できなかったため止めた（jq が無い、など）。jq を入れるか、人に実行を頼むこと。" >&2; exit 2' ERR

# terraform と、サブコマンドの前に置けるオプション（-chdir=<ディレクトリ> など）までに当たる正規表現
tf='(^|[^[:alnum:]_-])terraform([[:space:]]+-[^[:space:]]+)*[[:space:]]+'

# terraform の語が入力のどこにも無ければ、jq を使わずに素通りさせる。jq が無い環境で、terraform と関係ないコマンドまで止めないため。
# JSON の中では改行・タブが \n・\t と書かれる。前も後ろも \n・\t のことがあるため、語だけで見る（空白の並びは、取り出した後の $tf で見る）。
# terra"form" のような形も拾うため、引用符と \ を取り除いた入力でも見る
input=$(cat)
printf '%s' "$input" | grep -qE '(^|[^[:alnum:]_-]|\\[nrt])terraform([^[:alnum:]_-]|$)' ||
  printf '%s' "$input" | tr -d "\"'\\\\" | grep -qE '(^|[^[:alnum:]_-])terraform([^[:alnum:]_-]|$)' || exit 0

# 渡された JSON からコマンド文字列を取り出し、コマンドが無ければ即座に素通りさせる。Monitor の WebSocket を見張る形には、コマンドが無い
command=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')
[ -z "$command" ] && exit 0

# 照合には、引用符と \ を取り除いた文字列を使う。terraform "apply"・ap"ply"・\apply のように、シェルが同じ語にする形も止めるため
normalized=$(printf '%s' "$command" | tr -d "\"'\\\\")

# terraform を呼ばないコマンドは素通りさせる
printf '%s' "$normalized" | grep -qE "$tf" || exit 0

# 理由を添えて実行を止める
deny() {
  jq -n --arg reason "$1" '{
  hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $reason
  }
  }'
  exit 0
}

deny_patterns=(
# 保存した plan を実際のインフラへ反映する。plan の中身を人が確かめてから、人が実行する
'apply'
# 全リソースを削除する
'destroy'
# 既存のリソースを state に取り込む。取り込む先を誤ると、次の apply で作り直しや削除が起きる
'import'
# state を実際のインフラに合わせて書き換える（apply -refresh-only と同じ）
'refresh'
# 次の apply で作り直す印を、state に付ける・外す
'(taint|untaint)'
# backend のロックを強制解除する。別の人が apply している最中だと state が壊れる
'force-unlock'
# テストのために本物のリソースを作り、消す
'test'
# state を直接書き換える
'state[[:space:]]+(push|rm|mv|replace-provider)'
# workspace を消す。その workspace の state も消える
'workspace[[:space:]]+delete'
)

for p in "${deny_patterns[@]}"; do
  if printf '%s' "$normalized" | grep -qE "${tf}${p}([[:space:]]|$)"; then
    deny "Terraform でインフラや state を変えるコマンドは、人が実行する: $command
Claude は terraform plan -out=tfplan までを行い、plan の結果を示して、人に terraform apply tfplan を頼むこと。"
  fi
done

# init で state を別の backend へ移すと、移す先を誤ったときに state が失われる
if printf '%s' "$normalized" | grep -qE "${tf}init([[:space:]]|$)" &&
  printf '%s' "$normalized" | grep -qE '[[:space:]]-(migrate-state|force-copy)([[:space:]=]|$)'; then
  deny "state を移す terraform init は、人が実行する: $command"
fi

# plan は保存して、人が中身を確かめた plan だけを apply する。-target は一部だけを反映し、設定と実際のずれに気づけなくなる
if printf '%s' "$normalized" | grep -qE "${tf}plan([[:space:]]|$)"; then
  if printf '%s' "$normalized" | grep -qE '[[:space:]]-target(=|[[:space:]])'; then
    deny "terraform plan で -target を使わない: $command
一部だけを反映すると、設定と実際のずれに気づけなくなる。復旧などの例外の場面では、人が実行する。"
  fi
  if ! printf '%s' "$normalized" | grep -qE '[[:space:]]-out(=|[[:space:]])'; then
    deny "terraform plan は -out=tfplan で plan を保存すること: $command
例: terraform plan -out=tfplan"
  fi
fi

# workspace の切り替えはインフラを変えないが、誤った workspace のまま plan すると別の環境の plan ができる。
# workspace で環境を分けている既存の構成では plan に要るため、止めずに承認を求める。
# 同じコマンドの中の止める操作を先に判定するため、最後に置く
if printf '%s' "$normalized" | grep -qE "${tf}workspace[[:space:]]+select([[:space:]]|$)"; then
  jq -n --arg reason "terraform workspace を切り替える: $command
切り替え先が、作業する環境の workspace かを確かめてから承認すること。" '{
  hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "ask",
      permissionDecisionReason: $reason
  }
  }'
fi

exit 0
