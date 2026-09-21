#!/usr/bin/env bash
# PostToolUse hook: Edit / Write 後に編集ファイルの lint を自動実行する。
# 結果は exit 0 で返し、問題があれば stdout に出力して Claude へフィードバックする（ブロックしない）。
#
# カスタマイズ方針:
#   - LINT_DIR に node_modules（lint ツール）を持つディレクトリを指定する。リポジトリ直下なら "." のまま。
#   - TARGET_PREFIX に検査対象のパス接頭辞を指定する。全体を対象にするなら "" のまま。
#   - PHP・Python 等を追加する場合は末尾の「言語別チェック」に同じ形でブロックを足す。

set -euo pipefail

# --- プロジェクト固有の設定 ---------------------------------------------
LINT_DIR="."
TARGET_PREFIX=""
# ------------------------------------------------------------------------

input=$(cat)
file_path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')
[ -z "$file_path" ] && exit 0

# 絶対パスが渡された場合はリポジトリルートからの相対パスに変換する
repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
if printf '%s' "$file_path" | grep -q "^/"; then
  file_path="${file_path#"$repo_root"/}"
fi

# 対象外のパスは何もしない
if [ -n "$TARGET_PREFIX" ] && ! printf '%s' "$file_path" | grep -q "^$TARGET_PREFIX"; then
  exit 0
fi

# 生成物・依存パッケージは検査しない
if printf '%s' "$file_path" | grep -qE '(^|/)(node_modules|vendor|dist|build)/'; then
  exit 0
fi

# lint ツールが未インストールなら黙って終了する（環境差で毎回警告を出さない）
[ -d "$LINT_DIR/node_modules/.bin" ] || exit 0

if [ "$LINT_DIR" = "." ]; then
  rel_path="$file_path"
else
  rel_path="${file_path#"$LINT_DIR"/}"
fi

# --- 言語別チェック -----------------------------------------------------

# JS / TS: ESLint
if printf '%s' "$file_path" | grep -qE '\.(js|jsx|ts|tsx|mjs|cjs)$'; then
  if [ -x "$LINT_DIR/node_modules/.bin/eslint" ]; then
    result=$((cd "$LINT_DIR" && ./node_modules/.bin/eslint "$rel_path" 2>&1) || true)
    if [ -n "$result" ]; then
      printf '⚠️  eslint: %s\n%s\n' "$rel_path" "$result"
    fi
  fi
  exit 0
fi

# CSS: Stylelint
if printf '%s' "$file_path" | grep -qE '\.(css|scss)$'; then
  if [ -x "$LINT_DIR/node_modules/.bin/stylelint" ]; then
    result=$((cd "$LINT_DIR" && ./node_modules/.bin/stylelint "$rel_path" 2>&1) || true)
    if [ -n "$result" ]; then
      printf '⚠️  stylelint: %s\n%s\n' "$rel_path" "$result"
    fi
  fi
  exit 0
fi

exit 0
