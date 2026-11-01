#!/usr/bin/env bash
# ワークフローが .claude/rules/github-actions.md の【必須】のうち、zizmor が確かめない 2 つを守っているかを確かめる。
#   - トップレベルに permissions: {} がある
#   - 全ジョブに timeout-minutes がある（再利用ワークフローを呼ぶジョブ（uses: を持つジョブ）は、timeout-minutes を書けないため除く）
# SHA の固定は zizmor（pr-checks.yml の「ワークフローの検査」）が確かめる。
#
# 使い方: check-workflows.sh [フォルダ]   フォルダの既定は .github/workflows。守っていないものがあれば終了コード 1
# 要るもの: yq（mikefarah/yq の v4）と jq。GitHub の ubuntu-latest のランナーには、どちらも入っている

set -uo pipefail

dir="${1:-.github/workflows}"

if [ ! -d "$dir" ]; then
  echo "フォルダ $dir が無い" >&2
  exit 2
fi

shopt -s nullglob
files=("$dir"/*.yml "$dir"/*.yaml)
shopt -u nullglob

if [ "${#files[@]}" -eq 0 ]; then
  echo "$dir にワークフローが無い" >&2
  exit 2
fi

status=0
for f in "${files[@]}"; do
  # YAML を JSON に変えてから jq で見る。読めないファイルも、確かめられないため失敗にする
  if ! json=$(yq -o=json '.' "$f"); then
    echo "::error file=$f::YAML として読めない"
    status=1
    continue
  fi

  if [ "$(jq -c '.permissions' <<< "$json")" != "{}" ]; then
    echo "::error file=$f::トップレベルに permissions: {} が無い"
    status=1
  fi

  while IFS= read -r job; do
    [ -z "$job" ] && continue
    echo "::error file=$f::ジョブ $job に timeout-minutes が無い"
    status=1
  done < <(jq -r '(.jobs // {}) | to_entries[] | select(.value.uses == null and .value["timeout-minutes"] == null) | .key' <<< "$json")
done

if [ "$status" -eq 0 ]; then
  echo "${#files[@]} 件のワークフローを確かめた。permissions: {} と timeout-minutes は守られている"
fi
exit "$status"
