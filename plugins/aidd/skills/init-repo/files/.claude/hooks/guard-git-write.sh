#!/usr/bin/env bash
# git の commit / push を Claude に実行させないためのガバナンスガード（PreToolUse: Bash）。
#
# なぜ必要か:
#   settings.json の permissions.deny は「コマンド先頭一致」でしか判定しないため、
#   `bash script.sh` のようなラッパー経由や、&& ; | での連結でコミット/push を呼ばれると
#   deny を素通りしてしまう。運用では commit / push は
#   人間が最後に手動で行うため、Claude（Bash ツール）経由の実行を全て塞ぐ。
#
# 何を塞ぐか:
#   (1) コマンド文字列に含まれる git commit / git push（&& ; | 連結・パス付き git も分解して検査）
#   (2) bash/sh/source 等で実行しようとするスクリプトの中身に含まれる git commit / git push
#   (3) gh の書き込み系（pr/issue/release/repo の create/merge/edit/close/delete）
#
# 限界（正直に）:
#   eval・base64 デコード実行・$(...) 内など難読化された呼び出しは完全には潰せない。
#   確実性が要る場合は、環境から push 用の認証情報を外す（認証分離）のが最終的な砦。
#
# 人間の操作は妨げない:
#   `!` プレフィックスでユーザー自身がシェル実行するコマンドは Bash ツールを介さないため、
#   この PreToolUse フックの対象外（＝人間は従来どおり commit / push できる）。
#
# フェイルオープン方針:
#   想定外エラーで誤爆して全 Bash を止めないよう set -e は使わない。最終的に exit 0（許可）。
#   直接コマンドは deny 層でも二重に止まるため、フックの取りこぼしは限定的。
set -uo pipefail

input="$(cat)"

# jq があれば使う。無ければ grep でフォールバック（command と cwd を取り出す）
if command -v jq >/dev/null 2>&1; then
    cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // empty')"
    cwd="$(printf '%s' "$input" | jq -r '.cwd // empty')"
else
    cmd="$(printf '%s' "$input" | grep -oP '"command"\s*:\s*"\K[^"]*' || true)"
    cwd="$(printf '%s' "$input" | grep -oP '"cwd"\s*:\s*"\K[^"]*' || true)"
fi

# コマンドが空なら通す
[ -z "${cmd:-}" ] && exit 0

# --- 検査ロジック ---------------------------------------------------------

# 1 セグメント（区切りで分割した 1 コマンド）に禁止サブコマンドがあれば 0 を返す。
# git は「グローバルオプションを飛ばした最初のサブコマンド」が commit/push のときだけ検知する。
# これにより `git log --grep=commit` のような読み取り系の誤検知を避ける。
is_forbidden_segment() {
    local seg="$1"
    local -a toks=()
    read -r -a toks <<< "$seg" || true
    local n=${#toks[@]}
    [ "$n" -eq 0 ] && return 1
    local i=0
    while [ "$i" -lt "$n" ]; do
        local base="${toks[$i]##*/}"   # パス付き（/usr/bin/git 等）でも basename で判定
        if [ "$base" = "git" ]; then
            local j=$((i + 1))
            while [ "$j" -lt "$n" ]; do
                case "${toks[$j]}" in
                    -c|-C) j=$((j + 2)); continue ;;   # -c key=val / -C dir は 2 語
                    --) j=$((j + 1)); break ;;
                    -*) j=$((j + 1)); continue ;;      # その他のグローバルオプション
                    *) break ;;
                esac
            done
            if [ "$j" -lt "$n" ]; then
                case "${toks[$j]}" in
                    commit|push) return 0 ;;
                esac
            fi
        elif [ "$base" = "gh" ]; then
            local j=$((i + 1))
            while [ "$j" -lt "$n" ] && [ "${toks[$j]:0:1}" = "-" ]; do j=$((j + 1)); done
            local res="${toks[$j]:-}"
            local k=$((j + 1))
            while [ "$k" -lt "$n" ] && [ "${toks[$k]:0:1}" = "-" ]; do k=$((k + 1)); done
            local verb="${toks[$k]:-}"
            case "$res" in
                pr|issue|release|repo)
                    case "$verb" in
                        create|merge|edit|close|delete) return 0 ;;
                    esac
                    ;;
            esac
        fi
        i=$((i + 1))
    done
    return 1
}

# 文字列を && ; | & で分割し、各セグメントを検査する。1 つでも該当すれば 0。
contains_forbidden() {
    local text="$1"
    local segs
    segs="$(printf '%s' "$text" | sed -E 's/&&|\|\||;|\||&/\n/g')"
    while IFS= read -r seg || [ -n "$seg" ]; do
        [ -z "$seg" ] && continue
        if is_forbidden_segment "$seg"; then
            return 0
        fi
    done <<< "$segs"
    return 1
}

block() {
    echo "== コミット/push ガバナンスブロック ==" >&2
    echo "検知コマンド: $cmd" >&2
    echo "理由: $1" >&2
    echo "" >&2
    echo "commit / push は人間が最後に手動で行う運用です。Claude は実行しません。" >&2
    echo "（ラッパースクリプト・複合コマンド経由も禁止）" >&2
    echo "コミットが必要なら、ユーザーが '! git commit ...' 等を自分のシェルで実行してください。" >&2
    exit 2
}

# (1)(3) コマンド文字列そのものを検査
if contains_forbidden "$cmd"; then
    block "コマンドに git commit/push もしくは gh 書き込み操作が含まれています"
fi

# (2) スクリプト実行経由を検査: bash/sh/... で呼ぶファイルの中身をスキャン
segs="$(printf '%s' "$cmd" | sed -E 's/&&|\|\||;|\||&/\n/g')"
while IFS= read -r seg || [ -n "$seg" ]; do
    seg="$(printf '%s' "$seg" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')"
    [ -z "$seg" ] && continue
    declare -a stoks=()
    read -r -a stoks <<< "$seg" || true
    [ "${#stoks[@]}" -eq 0 ] && continue
    runner="${stoks[0]##*/}"
    case "$runner" in
        bash | sh | zsh | dash | ksh | source | .)
            file=""
            for ((x = 1; x < ${#stoks[@]}; x++)); do
                case "${stoks[$x]}" in
                    -*) continue ;;
                    *) file="${stoks[$x]}"; break ;;
                esac
            done
            [ -z "$file" ] && continue
            # 相対パスは cwd 基準で解決する
            case "$file" in
                /*) : ;;
                *) [ -n "${cwd:-}" ] && file="$cwd/$file" ;;
            esac
            [ -f "$file" ] || continue
            file_content="$(cat "$file" 2>/dev/null || true)"
            if contains_forbidden "$file_content"; then
                block "実行しようとしたスクリプト '$file' に git commit/push が含まれています"
            fi
            ;;
    esac
done <<< "$segs"

exit 0
