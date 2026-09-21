#!/usr/bin/env bash
# init-repo Skill のインストーラ。テンプレート一式（../files 配下）を導入先リポジトリへコピーする。
#
# 使い方:
#   bash <スクリプトのパス> --check                 衝突状況を一覧表示する（書き込みなし）
#   bash <スクリプトのパス> --apply                 まだ存在しないファイルだけコピーする（既存は絶対に上書きしない）
#   bash <スクリプトのパス> --apply --only <相対パス>...  指定したファイルだけコピーする（既存でも上書きする）
#
# 出力は 1 行 1 ファイルで、先頭のラベルが状態を表す。
#   NEW  ... 導入先に存在しない（--apply でコピーされる）
#   SAME ... 既存ファイルと内容が一致（コピー不要）
#   DIFF ... 既存ファイルと内容が異なる（--apply では触らない。--only で明示指定したときだけ上書き）
set -euo pipefail

src_dir="$(cd "$(dirname "$0")/../files" && pwd)"

mode="check"
only_list=()
# bash 3.x では空配列への ${#arr[@]} が set -u に引っかかるため、件数は別変数で数える
only_count=0
while [ $# -gt 0 ]; do
  case "$1" in
    --check) mode="check" ;;
    --apply) mode="apply" ;;
    --only)
      shift
      while [ $# -gt 0 ] && [ "${1#--}" = "$1" ]; do
        only_list+=("$1")
        only_count=$((only_count + 1))
        shift
      done
      continue
      ;;
    *)
      echo "不明な引数: $1" >&2
      exit 1
      ;;
  esac
  shift
done

# 誤った場所へ展開しないよう、リポジトリのルートでの実行だけを許可する
repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$repo_root" ]; then
  echo "ERROR: git リポジトリの中で実行すること" >&2
  exit 1
fi
# パス表記（Windows の C:/... と /c/... 等）に左右されないよう、ルートからの相対プレフィックスで判定する
if [ -n "$(git rev-parse --show-prefix 2>/dev/null || true)" ]; then
  echo "ERROR: リポジトリのルート（$repo_root）で実行すること" >&2
  exit 1
fi

# --only 指定時は対象を絞る。それ以外はテンプレート全ファイルを対象にする
list_files() {
  if [ "$only_count" -gt 0 ]; then
    printf '%s\n' "${only_list[@]}"
  else
    (cd "$src_dir" && find . -type f | sed 's|^\./||' | sort)
  fi
}

new_count=0
same_count=0
diff_count=0
copied_count=0

while IFS= read -r rel; do
  [ -z "$rel" ] && continue
  src="$src_dir/$rel"
  if [ ! -f "$src" ]; then
    echo "ERROR: テンプレートに存在しないパス: $rel" >&2
    exit 1
  fi

  if [ ! -e "$rel" ]; then
    state="NEW"
    new_count=$((new_count + 1))
  elif cmp -s "$src" "$rel"; then
    state="SAME"
    same_count=$((same_count + 1))
  else
    state="DIFF"
    diff_count=$((diff_count + 1))
  fi

  action=""
  if [ "$mode" = "apply" ]; then
    # --only は「この差分を承知で上書きする」という明示指定のため DIFF でもコピーする
    if [ "$state" = "NEW" ] || { [ "$state" = "DIFF" ] && [ "$only_count" -gt 0 ]; }; then
      mkdir -p "$(dirname "$rel")"
      cp "$src" "$rel"
      copied_count=$((copied_count + 1))
      action=" -> copied"
    fi
  fi

  echo "$state $rel$action"
done < <(list_files)

echo "---"
echo "NEW: $new_count / SAME: $same_count / DIFF: $diff_count"
if [ "$mode" = "apply" ]; then
  echo "コピー: $copied_count 件"
  if [ "$diff_count" -gt 0 ] && [ "$only_count" -eq 0 ]; then
    echo "DIFF のファイルは触っていない。差分を確認して個別に判断すること。"
  fi
fi
