#!/usr/bin/env bash
# issue-to-pr の検査。bot（SKILL.md の手順）と、ワークフローの関門（claude-issue-to-pr.yml）が、同じこのスクリプトを流す。
# 引数を取らないのは、bot が検査の範囲やオプションを取り違えないようにするため（間違えにくい作りにする。poka-yoke）。
# 見るもの：check.py（NG があれば失敗）、develop から変えた JSON が読めるか、変えたシェルスクリプトの構文。
# コミット前の変更と、新しく作ったファイルも見る。bot はコミットの前に流すため。
# 終了コード：0 = 通った、1 = 直すものがある
# check.py は、このスクリプトがリポジトリの中にあれば作業ツリーの版を、外（bot のワークフローの写し）にあれば写しを流す。
#   bot のワークフローは、bot が動く前に、このスクリプトを <trusted>/issue-to-pr/scripts/ に、check.py を <trusted>/ に写す。
#   作業ツリーの check.py は bot が書き換えられ、書き換えた版をトークンを持つ段で動かさないため。写しが無ければ、作業ツリーの版に頼らず NG にする

set -uo pipefail

script_dir=$(cd "$(dirname "$0")" && pwd)
repo=$(git rev-parse --show-toplevel) || exit 1
cd "$repo" || exit 1

base=origin/develop
status=0

# 動く Python を選ぶ。Windows の python3 は、Microsoft Store の案内だけを出す実体の無いコマンドのことがあるため、実行して確かめる
python=
for candidate in python3 python; do
  if "$candidate" -c 'import sys' >/dev/null 2>&1; then
    python=$candidate
    break
  fi
done
if [ -z "$python" ]; then
  echo "NG: python3 が無く、check.py を流せない"
  exit 1
fi

# このスクリプトのフォルダが、同じリポジトリの中かで分ける。パスの書き方（C:/ と /c/）の違いで取り違えないよう、git に聞く
if [ "$(git -C "$script_dir" rev-parse --show-toplevel 2>/dev/null)" = "$repo" ]; then
  check_py=.claude/skills/marketplace-update/scripts/check.py
else
  check_py=$script_dir/../../check.py
  if [ ! -f "$check_py" ]; then
    echo "NG: 写しの check.py（$check_py）が無い。作業ツリーの版は流さない"
    exit 1
  fi
fi
echo "## check.py（$check_py）"
if ! "$python" -B "$check_py"; then
  status=1
fi

echo
echo "## 変えたファイル（$base との差分と、新しいファイル）"
if ! git rev-parse --verify --quiet "$base" >/dev/null; then
  echo "NG: $base が無く、変えたファイルを取れない"
  exit 1
fi
files=$( { git diff --name-only --diff-filter=ACMR "$base"; git ls-files --others --exclude-standard; } | sort -u)
if [ -z "$files" ]; then
  echo "なし"
fi
while IFS= read -r f; do
  [ -n "$f" ] && [ -f "$f" ] || continue
  case "$f" in
    *.json)
      if jq empty "$f" 2>/dev/null; then echo "OK: $f"; else echo "NG: $f（JSON として読めない）"; status=1; fi
      ;;
    *.sh)
      if bash -n "$f" 2>/dev/null; then echo "OK: $f"; else echo "NG: $f（構文エラー）"; status=1; fi
      ;;
  esac
done <<< "$files"

echo
if [ "$status" -eq 0 ]; then
  echo "結果: OK"
else
  echo "結果: NG"
fi
exit "$status"
