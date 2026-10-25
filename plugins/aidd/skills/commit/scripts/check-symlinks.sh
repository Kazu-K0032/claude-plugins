#!/usr/bin/env sh
#
# コミット対象にシンボリックリンクが含まれていないかチェックする。
# 検出時はリンク先を表示し、終了コード 1 で中断する。
#

# 失敗したコマンドを表示する
set -eu

# ステージ済みファイル(--cached)のうち、実質的な変更(ACMRT)があるものを、モード付き(--raw)で一覧表示する
# core.quotepath=false は、日本語名を "\346..." の形にせずそのまま出すため
# 判定はステージのモード 120000（Git がリンクに付ける印）で行う。Windows の既定（core.symlinks=false）では
# リンクが普通のファイルとして置かれ [ -L ] では見つからないが、ステージのモードは OS に依らず 120000 のまま
staged="$(git -c core.quotepath=false diff --cached --raw --diff-filter=ACMRT)"

# ステージ済みのファイルが無ければ終了
if [ -z "$staged" ]; then
  exit 0
fi

# --raw の行（":<元のモード> <新しいモード> <元の id> <新しい id> <状態>\t<パス>"）から、
# 新しいモードが 120000 の行のパスだけを抜き出す。名前の変更（R）は「元のパス\t新しいパス」のため、最後の欄を取る
violations="$(printf '%s\n' "$staged" | awk -F '\t' '{ split($1, m, " "); if (m[2] == "120000") print $NF }')"

# シンボリックリンクが見つからなければ終了
if [ -z "$violations" ]; then
  exit 0
fi

echo "❌ コミット対象にシンボリックリンクが含まれています。"
echo ""
printf '%s\n' "$violations" | while IFS= read -r file; do
  if [ -z "$file" ]; then
    continue
  fi
  # リンク先は、ステージにあるリンクの中身（リンク先のパス）から取る。OS に依らず読めるため
  target="$(git cat-file -p ":$file")"
  echo "  - ${file}"
  echo "      リンク先: ${target}"
done
echo ""
echo "対処方法:"
echo "  1. リンク元（実体ファイル）を編集する"
echo "  2. symlink をステージから外す: git restore --staged <file>"
echo ""
echo "詳細: commit-rule.md 禁止事項「シンボリックリンク側を更新してはいけない、元の情報を更新する」"
exit 1
