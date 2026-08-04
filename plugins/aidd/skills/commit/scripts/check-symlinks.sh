#!/usr/bin/env sh
#
# コミット対象にシンボリックリンクが含まれていないかチェックする。
# 検出時はリンク先と実体を表示し、終了コード 1 で中断する。
#

# 失敗したコマンドを表示する
set -eu

# ステージ済みファイル(--cached)のうち、実質的な変更(ACMRT)があるファイル名だけ(--name-only)を一覧表示する
staged="$(git diff --cached --name-only --diff-filter=ACMRT)"

# ステージ済みのファイルが無ければ終了
if [ -z "$staged" ]; then
  exit 0
fi

# ステージ済みファイルのうち、シンボリックリンクであるものを抽出する
violations=""
while IFS= read -r file; do
  # ファイル名が空行の場合はスキップ
  if [ -z "$file" ]; then
    continue
  fi
  # ファイルがシンボリックリンクであるかチェック
  if [ -L "$file" ]; then
    violations="${violations}${file}
"
  fi
done <<EOF
${staged}
EOF

# シンボリックリンクが見つからなければ終了
if [ -z "$violations" ]; then
  exit 0
fi

echo "❌ コミット対象にシンボリックリンクが含まれています。"
echo ""
printf '%s' "$violations" | while IFS= read -r file; do
  if [ -z "$file" ]; then
    continue
  fi
  target="$(readlink "$file")"
  real="$(readlink -f "$file" 2>/dev/null || echo "$target")"
  echo "  - ${file}"
  echo "      リンク先: ${target}"
  echo "      実体  : ${real}"
done
echo ""
echo "対処方法:"
echo "  1. リンク元（実体ファイル）を編集する"
echo "  2. symlink をステージから外す: git restore --staged <file>"
echo ""
echo "詳細: commit-rule.md 禁止事項「シンボリックリンク側を更新してはいけない、元の情報を更新する」"
exit 1
