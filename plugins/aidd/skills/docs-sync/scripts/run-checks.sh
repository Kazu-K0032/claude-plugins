#!/usr/bin/env bash
# docs-sync 機械チェック実行スクリプト
# 担当: ブランチ差分の列挙 / 変更 md の 相対リンク切れ・markdown 規約 / 全走査のリンク切れ・SSOT ポインタ
# 既定（基準）ブランチ上では停止する。docs 追従要否の LLM 判定は SKILL.md 側で実施する。
#
# リポジトリごとに構成が違うため、次の 2 つは「規約が使われていれば検査し、無ければスキップ」する。
#   - docs-type フロントマター（.claude/ 配下の独自メタデータ規約）
#   - SSOT 一覧テーブルのポインタ存在
# 使っていない規約で FAIL を出さないための措置。

set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "ERROR: git リポジトリのルートを取得できません" >&2
  exit 2
}
cd "$ROOT"

# --- 基準ブランチの解決 -----------------------------------------------------
# origin/HEAD（リモートの既定ブランチ）を最優先で見る。取れなければよくある候補を順に試す。
BASE_REF=""
DEFAULT_BRANCH="$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null)"
if [[ -n "$DEFAULT_BRANCH" ]] && git rev-parse --verify --quiet "$DEFAULT_BRANCH" >/dev/null 2>&1; then
  BASE_REF="$DEFAULT_BRANCH"
else
  for cand in origin/main main origin/master master origin/develop develop; do
    if git rev-parse --verify --quiet "$cand" >/dev/null 2>&1; then
      BASE_REF="$cand"
      break
    fi
  done
fi
if [[ -z "$BASE_REF" ]]; then
  echo "ERROR: 基準ブランチが見つかりません（origin/HEAD・main・master・develop を確認）" >&2
  exit 2
fi

# 既定ブランチガード: 基準ブランチ上では差分の基準が無いため停止する
CURRENT="$(git branch --show-current)"
BASE_NAME="${BASE_REF#origin/}"
if [[ "$CURRENT" == "$BASE_NAME" || "$CURRENT" == "main" || "$CURRENT" == "master" ]]; then
  echo "# docs-sync 機械チェック結果"
  echo
  echo "STOP: 現在 '$CURRENT' ブランチのため停止する。docs-sync は基準ブランチ以外の差分を対象とする。"
  exit 3
fi

MERGE_BASE="$(git merge-base HEAD "$BASE_REF" 2>/dev/null)" || MERGE_BASE="$BASE_REF"

# --- 対象ファイルの分類 -----------------------------------------------------
# 散文 md の判定パターン。docs/ doc/ documentation/ 配下と、任意階層の README 等を拾う。
# ビルド成果物・依存パッケージは除外する。
DOC_PATTERN='^(docs?|documentation)/|(^|/)(README|CLAUDE|CONTRIBUTING|AGENTS)\.md$'
EXCLUDE_PATTERN='(^|/)(node_modules|vendor|dist|build|tmp)/'

# 差分ファイル（分岐点以降のコミット＋作業ツリーの変更）
mapfile -t ALL_CHANGED < <(git diff --name-only "$MERGE_BASE")

MD_CHANGED=()      # 変更された md 全部（一覧表示用）
CODE_CHANGED=()    # 変更された非 md（docs 追従判定の入力）
DOC_MD=()          # 散文 md（リンク・markdown 規約の対象）
META_MD=()         # .claude/rules/*.md・.claude/skills/*/SKILL.md（docs-type の対象）
for f in "${ALL_CHANGED[@]}"; do
  [[ -z "$f" ]] && continue
  case "$f" in
    *.md)
      MD_CHANGED+=("$f")
      if printf '%s\n' "$f" | grep -qE "$EXCLUDE_PATTERN"; then
        : # 除外対象
      elif printf '%s\n' "$f" | grep -qE "$DOC_PATTERN"; then
        DOC_MD+=("$f")
      fi
      case "$f" in
        .claude/rules/*.md|.claude/skills/*/SKILL.md) META_MD+=("$f") ;;
      esac
      ;;
    *) CODE_CHANGED+=("$f") ;;
  esac
done

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
touch "$TMP/links.txt" "$TMP/md.txt" "$TMP/doctype.txt" "$TMP/links_all.txt" "$TMP/ssot.txt"

# 全走査用: 差分に関係なく全散文 md を列挙する。
# 既存ファイルの壊れリンク・壊れ SSOT ポインタは差分に現れないため、ここだけはリポジトリ全体を対象にする。
mapfile -t ALL_DOC_MD < <(git ls-files | grep -E '\.md$' | grep -E "$DOC_PATTERN" | grep -vE "$EXCLUDE_PATTERN")

# --- 規約の使用有無を検出 ---------------------------------------------------
# docs-type: .claude/ 配下のファイルが実際にこのフィールドを使っているかを見る。
# 1 つも使っていなければ、このリポジトリの規約ではないと判断して検査をスキップする。
DOCTYPE_IN_USE=0
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  if head -20 "$f" 2>/dev/null | grep -q '^docs-type:'; then
    DOCTYPE_IN_USE=1
    break
  fi
done < <(git ls-files | grep -E '^\.claude/(rules/.*\.md|skills/[^/]+/SKILL\.md)$')

# SSOT 一覧テーブル: 「唯一の情報源」列を持つテーブルがあるファイルを探す。
# 候補は索引になりやすいファイルに限る（本文中の言及を誤検出しないため）。
SSOT_FILE=""
for cand in CLAUDE.md docs/README.md README.md AGENTS.md; do
  [[ -e "$cand" ]] || continue
  if grep -qE '\|\s*(唯一の情報源|SSOT)\s*\|' "$cand"; then
    SSOT_FILE="$cand"
    break
  fi
done

# --- 検査ロジック -----------------------------------------------------------
# 指定 md 群の相対リンク（](path) 形式）の参照先存在を検査し、FAIL 行を第1引数のファイルへ追記する。
# 差分チェックと全走査チェックで同じ判定ロジックを共有するため関数化する。
check_links() {
  out="$1"; shift
  for f in "$@"; do
    [[ -e "$f" ]] || continue
    dir=$(dirname "$f")
    perl -ne 'while (/\]\(([^)\s]+)\)/g) { print "$.\t$1\n"; }' "$f" | while IFS=$'\t' read -r ln target; do
      case "$target" in
        http://*|https://*|mailto:*) continue ;;
        \#*) continue ;;
      esac
      path="${target%%#*}"
      [[ -z "$path" ]] && continue
      if [[ "$path" = /* ]]; then resolved="$ROOT$path"; else resolved="$dir/$path"; fi
      [[ ! -e "$resolved" ]] && echo "FAIL: $f:$ln -> $target" >> "$out"
    done
  done
}

# --- 出力 -------------------------------------------------------------------
echo "# docs-sync 機械チェック結果"
echo
echo "基準ブランチ: $BASE_REF / 現在: $CURRENT"
echo "変更ファイル総数: ${#ALL_CHANGED[@]}（md: ${#MD_CHANGED[@]} / 非md: ${#CODE_CHANGED[@]}）"

echo
echo "## 変更された md"
echo "リンク・markdown 規約は散文 md（docs 配下・README 等）のみ、docs-type は .claude の rules/SKILL.md のみに適用する。"
if [[ ${#MD_CHANGED[@]} -gt 0 ]]; then printf -- '- %s\n' "${MD_CHANGED[@]}"; else echo "（なし）"; fi

echo
echo "## 変更された非 md（docs 追従判断の入力）"
if [[ ${#CODE_CHANGED[@]} -gt 0 ]]; then printf -- '- %s\n' "${CODE_CHANGED[@]}"; else echo "（なし）"; fi

# 1. 相対リンク切れ（変更された散文 md のみ）
echo
echo "## 相対リンク切れ"
if [[ ${#DOC_MD[@]} -gt 0 ]]; then check_links "$TMP/links.txt" "${DOC_MD[@]}"; fi
if [[ -s "$TMP/links.txt" ]]; then cat "$TMP/links.txt"; else echo "PASS"; fi

# 2. markdown 規約（散文 md のみ・コードブロック内除外）
echo
echo "## markdown 規約"
for f in "${DOC_MD[@]}"; do
  [[ -e "$f" ]] || continue
  awk -v file="$f" '
    /^```/ {
      if (in_block) { in_block = 0 }
      else { in_block = 1; if ($0 == "```") print file":"NR" MD040 コードフェンス言語未指定" }
      blank = 0; next
    }
    in_block { next }
    /^# [^#]/ { h1++; if (h1_first == 0) h1_first = NR }
    $0 == "" { blank++; if (blank == 2) print file":"NR" MD012 連続空行" }
    $0 != "" { blank = 0 }
    END { if (h1 > 1) print file":"h1_first" MD025 H1 が "h1" 個 (最初は L"h1_first")" }
  ' "$f" >> "$TMP/md.txt"
  if [[ -s "$f" ]] && [[ -n "$(tail -c1 "$f")" ]]; then echo "$f MD047 末尾改行なし" >> "$TMP/md.txt"; fi
done
if [[ -s "$TMP/md.txt" ]]; then cat "$TMP/md.txt"; else echo "PASS"; fi

# 3. docs-type フロントマター（この規約を使っているリポジトリのみ）
echo
echo "## docs-type フロントマター"
if [[ $DOCTYPE_IN_USE -eq 0 ]]; then
  echo "SKIP: このリポジトリは docs-type 規約を使っていないため検査しない。"
else
  VALID_TYPES="people-doc ai-doc people-ai-doc"
  for f in "${META_MD[@]}"; do
    [[ -e "$f" ]] || continue
    first_line=$(head -1 "$f")
    if [[ "$first_line" != "---" ]]; then
      echo "FAIL: $f フロントマターなし" >> "$TMP/doctype.txt"
      continue
    fi
    docs_type=$(awk '/^---$/{c++; if(c==2)exit} c==1 && /^docs-type:/{gsub(/^docs-type:[[:space:]]*/,""); gsub(/[[:space:]]*$/,""); print; exit}' "$f")
    if [[ -z "$docs_type" ]]; then
      echo "FAIL: $f docs-type フィールドなし" >> "$TMP/doctype.txt"
    elif ! echo "$VALID_TYPES" | grep -qw "$docs_type"; then
      echo "FAIL: $f docs-type の値が不正: '$docs_type'（有効値: people-doc / ai-doc / people-ai-doc）" >> "$TMP/doctype.txt"
    fi
  done
  if [[ -s "$TMP/doctype.txt" ]]; then cat "$TMP/doctype.txt"; else echo "PASS"; fi
fi

# 4. 全 docs リンク切れ（全走査・差分非依存）
echo
echo "## 全 docs リンク切れ（全走査）"
echo "差分に含まれない既存ファイルの壊れリンクも検出する。対象は全散文 md（${#ALL_DOC_MD[@]} 件）。"
if [[ ${#ALL_DOC_MD[@]} -gt 0 ]]; then check_links "$TMP/links_all.txt" "${ALL_DOC_MD[@]}"; fi
if [[ -s "$TMP/links_all.txt" ]]; then cat "$TMP/links_all.txt"; else echo "PASS"; fi

# 5. SSOT 一覧ポインタ存在（全走査・差分非依存）
echo
echo "## SSOT 一覧ポインタ存在（全走査）"
if [[ -z "$SSOT_FILE" ]]; then
  echo "SKIP: 「唯一の情報源」列を持つテーブルが見つからないため検査しない。"
else
  echo "$SSOT_FILE の SSOT 一覧テーブルが指すパスが実在するか検査する。"
  echo "SSOT 表のパスはインラインコードで書かれ ](path) リンクに出ないため、リンク切れチェックでは拾えない。"
  # 「… | 唯一の情報源 |」ヘッダ以降のテーブル行から、各行末尾のインラインコード（＝唯一の情報源列）を取り出す。
  perl -ne '
    if (/\|\s*(?:唯一の情報源|SSOT)\s*\|/) { $in = 1; next; }
    if ($in) {
      if ($_ !~ /^\s*\|/) { $in = 0; next; }
      next if /^\s*\|\s*-+/;
      my @c = /`([^`]+)`/g;
      print "$c[-1]\n" if @c;
    }
  ' "$SSOT_FILE" | while read -r p; do
    path="${p%%#*}"
    [[ -z "$path" ]] && continue
    if [[ "$path" = /* ]]; then resolved="$ROOT$path"; else resolved="$ROOT/$path"; fi
    [[ ! -e "$resolved" ]] && echo "FAIL: $SSOT_FILE SSOT 一覧 -> $p（参照先が実在しない）" >> "$TMP/ssot.txt"
  done
  if [[ -s "$TMP/ssot.txt" ]]; then cat "$TMP/ssot.txt"; else echo "PASS"; fi
fi

# --- サマリ -----------------------------------------------------------------
LINK_FAIL=$(wc -l < "$TMP/links.txt" | tr -d ' ')
MD_FAIL=$(wc -l < "$TMP/md.txt" | tr -d ' ')
DOCTYPE_FAIL=$(wc -l < "$TMP/doctype.txt" | tr -d ' ')
ALLLINK_FAIL=$(wc -l < "$TMP/links_all.txt" | tr -d ' ')
SSOT_FAIL=$(wc -l < "$TMP/ssot.txt" | tr -d ' ')

echo
echo "## サマリ"
echo "リンク切れ FAIL（変更 md）: ${LINK_FAIL:-0}"
echo "markdown 規約 FAIL: ${MD_FAIL:-0}"
if [[ $DOCTYPE_IN_USE -eq 0 ]]; then
  echo "docs-type FAIL: スキップ（規約未使用）"
else
  echo "docs-type FAIL: ${DOCTYPE_FAIL:-0}"
fi
echo "全 docs リンク切れ FAIL（全走査）: ${ALLLINK_FAIL:-0}"
if [[ -z "$SSOT_FILE" ]]; then
  echo "SSOT ポインタ FAIL（全走査）: スキップ（SSOT 一覧なし）"
else
  echo "SSOT ポインタ FAIL（全走査）: ${SSOT_FAIL:-0}"
fi

TOTAL=$((LINK_FAIL + MD_FAIL + DOCTYPE_FAIL + ALLLINK_FAIL + SSOT_FAIL))
if [[ $TOTAL -gt 0 ]]; then
  exit 1
fi
exit 0
