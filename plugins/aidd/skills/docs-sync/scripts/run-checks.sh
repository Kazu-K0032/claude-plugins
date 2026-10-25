#!/usr/bin/env bash
# docs-sync 機械チェック実行スクリプト
# 担当: ブランチ差分の列挙 / 変更 md の 相対リンク切れ・markdown 規約 / 全走査のリンク切れ・SSOT ポインタ・囲まれた @import
# 基準ブランチ上と main・master では停止する。docs 追従要否の LLM 判定は SKILL.md 側で実施する。
#
# 使い方: run-checks.sh [--base <ref>]
#   --base は比べるブランチ（今のブランチのマージ先）。SKILL.md が PR・規約から決めて渡す。
#   マージ先はブランチ戦略（develop → stg → main など）で変わり、規約を読める LLM 側でしか決められないため。
#   省略時は origin/HEAD（リモートの既定ブランチ）から決める。
#
# リポジトリごとに構成が違うため、SSOT 一覧テーブルのポインタ存在は「一覧があれば検査し、無ければスキップ」する。
# 使っていない規約で FAIL を出さないための措置。
#
# リンク検査（変更 md・全走査）は、リポジトリ直下の .docs-sync-link-ignore に当たるファイルを対象から外す。

set -uo pipefail

# --- 使う道具の確認 ---------------------------------------------------------
# bash 4.4 未満では、mapfile・declare -A と、set -u での空の配列の展開で止まる。
# perl・awk が無いと、検査の出力が空になり、黙って PASS と出る。そのため、検査の前に止める。
# 見つかっても動かないもの（Windows の空のコマンドなど）を通さないよう、実際に動かして確かめる。
if (( BASH_VERSINFO[0] < 4 || (BASH_VERSINFO[0] == 4 && BASH_VERSINFO[1] < 4) )); then
  echo "ERROR: bash 4.4 以上が要ります（今は ${BASH_VERSION}）。macOS 標準の bash 3.2 では動かないため、新しい bash を入れる" >&2
  exit 2
fi
MISSING_TOOLS=""
perl -e 1 >/dev/null 2>&1 || MISSING_TOOLS="$MISSING_TOOLS perl（リンク切れ・SSOT ポインタ・@import の検査）"
awk 'BEGIN { exit 0 }' </dev/null >/dev/null 2>&1 || MISSING_TOOLS="$MISSING_TOOLS awk（markdown 規約の検査）"
if [[ -n "$MISSING_TOOLS" ]]; then
  echo "ERROR: 次の道具が動きません:${MISSING_TOOLS}。入れてから実行し直す" >&2
  exit 2
fi

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "ERROR: git リポジトリのルートを取得できません" >&2
  exit 2
}
cd "$ROOT"

# --- 引数 -------------------------------------------------------------------
BASE_ARG=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --base)
      if [[ $# -lt 2 || -z "$2" ]]; then
        echo "ERROR: --base には比べるブランチを渡す（例: --base origin/develop）" >&2
        exit 2
      fi
      BASE_ARG="$2"
      shift 2
      ;;
    *)
      echo "ERROR: 知らない引数です: $1（使い方: run-checks.sh [--base <ref>]）" >&2
      exit 2
      ;;
  esac
done

# --- 基準ブランチの解決 -----------------------------------------------------
# --base があればそれを使う。無ければ origin/HEAD（リモートの既定ブランチ）を見て、取れなければよくある候補を順に試す。
BASE_REF=""
BASE_SOURCE=""
if [[ -n "$BASE_ARG" ]]; then
  # 渡し間違いを既定ブランチへの黙った切り替えで隠さないため、見つからなければ止める
  if ! git rev-parse --verify --quiet "${BASE_ARG}^{commit}" >/dev/null 2>&1; then
    echo "ERROR: --base のブランチが見つかりません: $BASE_ARG（git fetch origin <ブランチ> で取ってくる）" >&2
    exit 2
  fi
  BASE_REF="$BASE_ARG"
  BASE_SOURCE="--base で指定"
else
  DEFAULT_BRANCH="$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null)"
  if [[ -n "$DEFAULT_BRANCH" ]] && git rev-parse --verify --quiet "$DEFAULT_BRANCH" >/dev/null 2>&1; then
    BASE_REF="$DEFAULT_BRANCH"
    BASE_SOURCE="origin/HEAD"
  else
    for cand in origin/main main origin/master master origin/develop develop; do
      if git rev-parse --verify --quiet "$cand" >/dev/null 2>&1; then
        BASE_REF="$cand"
        BASE_SOURCE="候補から"
        break
      fi
    done
  fi
fi
if [[ -z "$BASE_REF" ]]; then
  echo "ERROR: 基準ブランチが見つかりません（origin/HEAD・main・master・develop を確認）" >&2
  exit 2
fi

# 基準ブランチガード: 基準ブランチ上では差分の基準が無いため停止する。
# develop など、ほかのブランチのマージ先でも、自分のマージ先（--base）と比べるときは止めない。
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
# ファイル名を出す git には -c core.quotepath=false を付ける。
# 既定では日本語名が "docs/\346..." の形で出て、[[ -e ]] で見つからず検査から外れるため。
mapfile -t ALL_CHANGED < <(git -c core.quotepath=false diff --name-only "$MERGE_BASE")

MD_CHANGED=()      # 変更された md 全部（一覧表示用）
CODE_CHANGED=()    # 変更された非 md（docs 追従判定の入力）
DOC_MD=()          # 散文 md（markdown 規約の対象。リンクの対象は除外指定を除いた DOC_MD_LINK）
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
      ;;
    *) CODE_CHANGED+=("$f") ;;
  esac
done

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
touch "$TMP/links.txt" "$TMP/md.txt" "$TMP/links_all.txt" "$TMP/ssot.txt" "$TMP/enclosed.txt"

# 全走査用: 差分に関係なく全散文 md を列挙する。
# 既存ファイルの壊れリンク・壊れ SSOT ポインタは差分に現れないため、ここだけはリポジトリ全体を対象にする。
mapfile -t ALL_DOC_MD < <(git -c core.quotepath=false ls-files | grep -E '\.md$' | grep -E "$DOC_PATTERN" | grep -vE "$EXCLUDE_PATTERN")

# 囲まれた @import の検査対象。Claude Code が @path を import として展開する指示ファイル（CLAUDE.md・AGENTS.md）に限る。
# .docs-sync-link-ignore は使わない。テンプレートの files/ は導入先と同じ構成のため、相対パスはその中で解決できる。
mapfile -t ENTRY_MD < <(printf '%s\n' "${ALL_DOC_MD[@]}" | grep -E '(^|/)(CLAUDE|AGENTS)\.md$')

# リンク検査だけから外すファイル。リポジトリ直下の .docs-sync-link-ignore（書式は .gitignore と同じ）で指定する。
# 導入先のリポジトリを基準にリンクを書いたテンプレートなど、そのリポジトリの中では解決できないファイルのため。
# markdown 規約からは外さない（テンプレートの書式の崩れは、導入先へそのまま配られるため）。
LINK_IGNORE_FILE=".docs-sync-link-ignore"
declare -A LINK_IGNORED=()
if [[ -f "$LINK_IGNORE_FILE" ]]; then
  while IFS= read -r f; do
    [[ -n "$f" ]] && LINK_IGNORED["$f"]=1
  done < <(git -c core.quotepath=false ls-files --cached --ignored --exclude-from="$LINK_IGNORE_FILE")
fi

# 引数のうち、リンク検査から外すファイルに当たらないものを 1 行ずつ出力する
link_targets() {
  for f in "$@"; do
    [[ -n "${LINK_IGNORED[$f]:-}" ]] || printf '%s\n' "$f"
  done
}
mapfile -t DOC_MD_LINK < <(link_targets "${DOC_MD[@]}")
mapfile -t ALL_DOC_MD_LINK < <(link_targets "${ALL_DOC_MD[@]}")
DOC_LINK_SKIPPED=$(( ${#DOC_MD[@]} - ${#DOC_MD_LINK[@]} ))
ALL_LINK_SKIPPED=$(( ${#ALL_DOC_MD[@]} - ${#ALL_DOC_MD_LINK[@]} ))

# --- 規約の使用有無を検出 ---------------------------------------------------
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

# 指定ファイルの、バッククォートで囲まれていて読み込まれない @path を検出し、FAIL 行を第1引数のファイルへ追記する。
# Claude Code は import の解析で Markdown のコードスパンとコードブロックを飛ばす。読ませたい文書を囲むと、エラーも出ずに読み込まれない。
# 参照先のファイルが実在するものだけを挙げる。@param や pkg@v4 のように実在しないものは、import の意図ではないため。
# ~ と / で始まるパスは、機械ごとに違って存在を確かめられないため飛ばす。
# 囲まれた範囲は、フェンスの中と、同じ行の中のコードスパン。複数行にまたがるコードスパンは見ない。
check_enclosed_imports() {
  out="$1"; shift
  for f in "$@"; do
    [[ -e "$f" ]] || continue
    perl -ne '
      BEGIN { ($dir = $ARGV[0]) =~ s{[^/]*$}{}; $fence = ""; }
      sub scan {
        my ($t) = @_;
        while ($t =~ /(?<![\w\@])\@((?:\\ |[^\s`])+)/g) {
          my $p = $1;
          $p =~ s/\\ / /g;
          $p =~ s/(?:[.,;:!?)\]}>"\x27]|、|。|）|」|』)+$//;
          next if $p eq "" || $p =~ m{^[~/]};
          my $r = $dir . $p;
          printf "FAIL: %s:%d \@%s -> %s（囲まれていて読み込まれない）\n", $ARGV, $., $p, $r if -f $r;
        }
      }
      if ($fence eq "") {
        if (/^\s*(`{3,})[^`]*$/ or /^\s*(~{3,})/) { $fence = substr($1, 0, 1); $flen = length($1); next; }
        scan($2) while /(?<!`)(`+)(?!`)(.+?)(?<!`)\1(?!`)/g;
      } else {
        if (/^\s*(\Q$fence\E{$flen,})\s*$/) { $fence = ""; next; }
        scan($_);
      }
    ' "$f" >> "$out"
  done
}

# --- 出力 -------------------------------------------------------------------
echo "# docs-sync 機械チェック結果"
echo
echo "基準ブランチ: $BASE_REF（$BASE_SOURCE） / 現在: $CURRENT"
echo "変更ファイル総数: ${#ALL_CHANGED[@]}（md: ${#MD_CHANGED[@]} / 非md: ${#CODE_CHANGED[@]}）"

echo
echo "## 変更された md"
echo "リンク・markdown 規約は散文 md（docs 配下・README 等）のみに適用する。"
if [[ ${#MD_CHANGED[@]} -gt 0 ]]; then printf -- '- %s\n' "${MD_CHANGED[@]}"; else echo "（なし）"; fi

echo
echo "## 変更された非 md（docs 追従判断の入力）"
if [[ ${#CODE_CHANGED[@]} -gt 0 ]]; then printf -- '- %s\n' "${CODE_CHANGED[@]}"; else echo "（なし）"; fi

# 1. 相対リンク切れ（変更された散文 md のみ）
echo
echo "## 相対リンク切れ"
if [[ $DOC_LINK_SKIPPED -gt 0 ]]; then
  echo "変更された散文 md のうち ${DOC_LINK_SKIPPED} 件を $LINK_IGNORE_FILE の指定で対象から外した。"
fi
if [[ ${#DOC_MD_LINK[@]} -gt 0 ]]; then check_links "$TMP/links.txt" "${DOC_MD_LINK[@]}"; fi
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

# 3. 全 docs リンク切れ（全走査・差分非依存）
echo
echo "## 全 docs リンク切れ（全走査）"
echo "差分に含まれない既存ファイルの壊れリンクも検出する。対象は全散文 md（${#ALL_DOC_MD_LINK[@]} 件）。"
if [[ $ALL_LINK_SKIPPED -gt 0 ]]; then
  echo "ほかに ${ALL_LINK_SKIPPED} 件を $LINK_IGNORE_FILE の指定で対象から外した。"
fi
if [[ ${#ALL_DOC_MD_LINK[@]} -gt 0 ]]; then check_links "$TMP/links_all.txt" "${ALL_DOC_MD_LINK[@]}"; fi
if [[ -s "$TMP/links_all.txt" ]]; then cat "$TMP/links_all.txt"; else echo "PASS"; fi

# 4. SSOT 一覧ポインタ存在（全走査・差分非依存）
echo
echo "## SSOT 一覧ポインタ存在（全走査）"
if [[ -z "$SSOT_FILE" ]]; then
  echo "SKIP: 「唯一の情報源」列を持つテーブルが見つからないため検査しない。"
else
  echo "$SSOT_FILE の SSOT 一覧テーブルが指すパスが実在するか検査する。"
  echo "SSOT 表のパスはインラインコードで書かれ ](path) リンクに出ないため、リンク切れチェックでは拾えない。"
  echo "パスでない値（/<plugin>:<skill> 形式のスラッシュコマンド・URL）は検査しない。"
  # プラグインのスラッシュコマンド（/<plugin>:<skill>）。[[ =~ ]] の右辺はクォートすると文字列一致になるため変数に置く。
  SLASH_COMMAND_PATTERN='^/[A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+$'
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
    # パスでない値は実在を確かめられないため飛ばす。URL の扱いは check_links に揃える。
    case "$p" in
      http://*|https://*|mailto:*) continue ;;
    esac
    # 名前空間の無い /xxx はリポジトリ直下からのパスと区別できないため、パスとして検査する。
    [[ "$p" =~ $SLASH_COMMAND_PATTERN ]] && continue
    path="${p%%#*}"
    [[ -z "$path" ]] && continue
    if [[ "$path" = /* ]]; then resolved="$ROOT$path"; else resolved="$ROOT/$path"; fi
    [[ ! -e "$resolved" ]] && echo "FAIL: $SSOT_FILE SSOT 一覧 -> $p（参照先が実在しない）" >> "$TMP/ssot.txt"
  done
  if [[ -s "$TMP/ssot.txt" ]]; then cat "$TMP/ssot.txt"; else echo "PASS"; fi
fi

# 5. 囲まれた @import（全走査・差分非依存）
# CLAUDE.md・AGENTS.md が無いリポジトリでは、使っていない規約で FAIL を出さないため SKIP を返す。
echo
echo "## 囲まれた @import（全走査）"
if [[ ${#ENTRY_MD[@]} -eq 0 ]]; then
  echo "SKIP: CLAUDE.md・AGENTS.md が見つからないため検査しない。"
else
  echo "CLAUDE.md・AGENTS.md の、バッククォートで囲まれていて読み込まれない @path を検出する。対象は ${#ENTRY_MD[@]} 件。"
  echo "Claude Code は import の解析でコードスパンとコードブロックを飛ばす。参照先のファイルが実在するものだけを挙げる。"
  check_enclosed_imports "$TMP/enclosed.txt" "${ENTRY_MD[@]}"
  if [[ -s "$TMP/enclosed.txt" ]]; then cat "$TMP/enclosed.txt"; else echo "PASS"; fi
fi

# --- サマリ -----------------------------------------------------------------
LINK_FAIL=$(wc -l < "$TMP/links.txt" | tr -d ' ')
MD_FAIL=$(wc -l < "$TMP/md.txt" | tr -d ' ')
ALLLINK_FAIL=$(wc -l < "$TMP/links_all.txt" | tr -d ' ')
SSOT_FAIL=$(wc -l < "$TMP/ssot.txt" | tr -d ' ')
ENCLOSED_FAIL=$(wc -l < "$TMP/enclosed.txt" | tr -d ' ')

echo
echo "## サマリ"
echo "リンク切れ FAIL（変更 md）: ${LINK_FAIL:-0}"
echo "markdown 規約 FAIL: ${MD_FAIL:-0}"
echo "全 docs リンク切れ FAIL（全走査）: ${ALLLINK_FAIL:-0}"
if [[ -z "$SSOT_FILE" ]]; then
  echo "SSOT ポインタ FAIL（全走査）: スキップ（SSOT 一覧なし）"
else
  echo "SSOT ポインタ FAIL（全走査）: ${SSOT_FAIL:-0}"
fi
if [[ ${#ENTRY_MD[@]} -eq 0 ]]; then
  echo "囲まれた @import FAIL（全走査）: スキップ（CLAUDE.md・AGENTS.md なし）"
else
  echo "囲まれた @import FAIL（全走査）: ${ENCLOSED_FAIL:-0}"
fi

TOTAL=$((LINK_FAIL + MD_FAIL + ALLLINK_FAIL + SSOT_FAIL + ENCLOSED_FAIL))
if [[ $TOTAL -gt 0 ]]; then
  exit 1
fi
exit 0
