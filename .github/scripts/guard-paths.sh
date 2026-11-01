#!/usr/bin/env bash
# bot（claude-issue-to-pr.yml の Claude）に変えさせないファイルを、push の前と PR の差分で止める。
# 止めるのは、権限と secret に関わるワークフロー・スクリプト・設定・フック。これらの変更は、人が差分を確かめて当てる（issue-to-pr スキルの手順 4）。
# 手順書の文言だけでは、Issue 本文に混ざった悪い指示で bot が書き換えたときに、見落とせばそのまま入るため、仕組みでも止める。
# ワークフローが bot の動く前にこのファイルを $RUNNER_TEMP に写し、写しを使う。bot が書き換えられないようにするため。
#
# 使い方:
#   guard-paths.sh --files                    標準入力のパスの一覧（1 行 1 パス）を見る。止めるものがあれば終了コード 1
#   guard-paths.sh --pre-push <remote> <url>  git の pre-push フックとして動く。push するコミットが origin/develop から変えたパスを見る
# 限界: GitHub の API でコミットを作る経路（commit signing を有効にしたとき）は、フックを通らない。PR の差分の確認（--files）で止める

set -uo pipefail

# 止めるパス。変えるときは、issue-to-pr スキルの禁止事項と CONTRIBUTING.md の記述も直す
protected='^(\.github/(workflows|scripts)/|\.claude/(settings\.json|hooks/))'

check_files() {
  local hits
  hits=$(grep -E "$protected" || true)
  if [ -n "$hits" ]; then
    echo "bot が変えてはいけないファイルの変更がある:"
    sed 's/^/  - /' <<< "$hits"
    echo "これらは、diff を PR の本文に書き、人が確かめて当てる（issue-to-pr スキルの手順 4）"
    return 1
  fi
  return 0
}

case "${1:-}" in
  --files)
    check_files
    ;;
  --pre-push)
    zero=0000000000000000000000000000000000000000
    status=0
    while read -r _local_ref local_sha _remote_ref _remote_sha; do
      # ブランチの削除は、変えたパスが無いため見ない
      [ "$local_sha" = "$zero" ] && continue
      # 比べる先が取れないときは、確かめられないため止める
      if ! base=$(git merge-base origin/develop "$local_sha" 2>/dev/null); then
        echo "origin/develop と比べられず、変えたパスを確かめられないため、push を止めた"
        status=1
        continue
      fi
      # --no-renames で、改名・移動を「消した元のパス」と「作った先のパス」の 2 件にする。付けないと先のパスだけが出て、protected のファイルを protected でない場所へ動かして消せてしまうため
      git diff --name-only --no-renames "$base" "$local_sha" | check_files || status=1
    done
    exit "$status"
    ;;
  *)
    echo "使い方: guard-paths.sh --files | --pre-push <remote> <url>" >&2
    exit 2
    ;;
esac
