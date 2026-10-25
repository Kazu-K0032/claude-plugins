#!/usr/bin/env bash
# PreToolUse hook: GAS の実行の決まり（.claude/rules/gas.md の「clasp で反映する場合」）を守らせる。
# Claude が実行してよいのは、状態を見るだけのコマンド（status・list・logs・open など）まで。
# Apps Script 側へ反映する・取り込む・認証するコマンドは、人が実行する。
# settings.json の deny はルールの形に当たるコマンドしか止めず、npx 経由や -P（--project）を挟んだ実行、bash -c 経由の実行が抜けるため、フックで検出する。
#
# カスタマイズ方針:
#   止めるサブコマンドを足すときは、下の deny_patterns 配列に追記する。判定は grep -E の正規表現で行う。

# エラーで即座に止めるための厳格モード。-E は、関数（deny など）の中の失敗でも、下の ERR のトラップを動かすため
set -Eeuo pipefail

# clasp を呼ぶコマンドかもしれないのに判定できないときは、止める。exit 2 以外で失敗すると、Claude Code は操作をそのまま進めるため
trap 'echo "guard-clasp.sh が判定できなかったため止めた（jq が無い、など）。jq を入れるか、人に実行を頼むこと。" >&2; exit 2' ERR

# clasp の語が入力のどこにも無ければ、jq を使わずに素通りさせる。jq が無い環境で、clasp と関係ないコマンドまで止めないため。
# JSON の中では改行・タブが \n・\t と書かれるため、その直後の clasp も拾う。cl"asp" のような形も拾うため、引用符と \ を取り除いた入力でも見る
input=$(cat)
printf '%s' "$input" | grep -qE '(^|[^[:alnum:]_-]|\\[nrt])clasp([^[:alnum:]_-]|$)' ||
  printf '%s' "$input" | tr -d "\"'\\\\" | grep -qE '(^|[^[:alnum:]_-])clasp([^[:alnum:]_-]|$)' || exit 0

# 渡された JSON からコマンド文字列を取り出し、コマンドが無ければ即座に素通りさせる。Monitor の WebSocket を見張る形には、コマンドが無い
command=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')
[ -z "$command" ] && exit 0

# 照合には、引用符と \ を取り除いた文字列を使う。clasp "push"・p"ush"・\push のように、シェルが同じ語にする形も止めるため
normalized=$(printf '%s' "$command" | tr -d "\"'\\\\")

# clasp を呼ばないコマンドは素通りさせる
printf '%s' "$normalized" | grep -qE '(^|[^[:alnum:]_-])clasp([^[:alnum:]_-]|$)' || exit 0

# clasp と、サブコマンドの前に置けるオプション（-P <ディレクトリ>・--user <名前> など）までに当たる正規表現。
# 同じコマンドの区切り（; & |）は越えない。別のコマンドの単語に当たらないようにするため
clasp='(^|[^[:alnum:]_-])clasp([^;&|]*[[:space:]])?'

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
# Apps Script 側のコードを、手元のコードで上書きする
'push'
# 手元のコードを、Apps Script 側の内容で上書きする。push していない手元の変更が消える
'pull'
# 認証情報（.clasprc.json）を作る・消す
'(login|logout)'
# Apps Script のプロジェクトを作る、または別のプロジェクトのコードを手元へ取り込む
'(create|create-script|clone|clone-script)'
# デプロイ（公開中の版）を作る・消す。Web アプリやアドオンの利用者に影響する
'(deploy|undeploy|create-deployment|delete-deployment)'
# 版（変更できない保存点）を作る。作った版は消せない
'(version|create-version)'
# Apps Script 側の関数を実行する。メールの送信やシートの書き換えなど、実際の処理が動く
'(run|run-function)'
# Apps Script 側のプロジェクトを消す
'(delete|delete-script)'
# 使う Google の API を有効・無効にする
'apis[[:space:]]+(enable|disable)'
)

for p in "${deny_patterns[@]}"; do
  # サブコマンドの直後が英数字・_・- でなければ当てる。bash -c 'clasp push'; ls のように、区切りが続く形も止めるため
  if printf '%s' "$normalized" | grep -qE "${clasp}${p}([^[:alnum:]_-]|$)"; then
    deny "clasp で Apps Script 側へ反映・取り込み・認証をするコマンドは、人が実行する: $command
Claude はコードの編集までを行い、人に clasp push などの実行を頼むこと。"
  fi
done

exit 0
