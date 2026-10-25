#!/usr/bin/env bash
# git の commit / push を Claude に実行させないためのガバナンスガード（PreToolUse: Bash|PowerShell|Monitor）。
#
# なぜ必要か:
#   settings.json の permissions.deny はルールの形に当たるコマンドしか判定しないため、
#   `bash script.sh` のようなラッパー経由や、&& ; | での連結でコミット/push を呼ばれると
#   deny を素通りしてしまう。運用では commit / push は
#   人間が最後に手動で行うため、Claude（Bash ツール）経由の実行を全て塞ぐ。
#
# 何を塞ぐか:
#   (1) コマンド文字列に含まれる git commit / git push（&& ; | 連結・パス付き git も分解して検査）
#   (2) bash/sh/source 等で実行しようとするスクリプトの中身に含まれる git commit / git push
#   (3) gh の書き込み系（pr/issue/release/repo の create/merge/edit/close/delete）
#   いずれも引用符・バッククォート・\ を取り除いてから検査する（git "push"・g"it" push・bash -c "git push" も塞ぐ）
#
# 限界（正直に）:
#   eval・base64 デコード実行・$(...) 内など難読化された呼び出しは完全には潰せない。
#   確実性が要る場合は、環境から push 用の認証情報を外す（認証分離）のが最終的な砦。
#
# 人間の操作は妨げない:
#   `!` プレフィックスでユーザー自身がシェル実行するコマンドは Bash ツールを介さないため、
#   この PreToolUse フックの対象外（＝人間は従来どおり commit / push できる）。
#
# 判定できないときは止める:
#   jq が無いときと、想定外のエラーで失敗したときは exit 2 で止める。
#   2 以外の終了コードで失敗すると、Claude Code は操作をそのまま進めるため。
# エラーで即座に止めるための厳格モード。-E は、関数の中の失敗でも、下の ERR のトラップを動かすため
set -Eeuo pipefail

trap 'echo "guard-git-write.sh が判定できなかったため止めた（入力の JSON が壊れている、など）。人に実行を頼むこと。" >&2; exit 2' ERR

input="$(cat)"

# jq が無いと command を正しく取り出せないため、止める候補の語が入力のどこかにあれば止める。
# 候補は git・gh と、スクリプトを実行するシェル・source・.（下の (2) で中身を見るもの）。
# 語が無ければ通す。jq が無い環境で、関係ないコマンドまで止めないため。
# JSON の中では改行・タブが \n・\t と書かれるため、その直後の語も拾う。g"it" のような形も拾うため、引用符と \ を取り除いた入力でも見る。
# x.sh のようなファイル名で止めないよう、語の直前の . は区切りとみなさない
if ! command -v jq >/dev/null 2>&1; then
    words='(^|[^[:alnum:]_./-]|\\[nrt])((git|gh|bash|sh|zsh|dash|ksh|source)([^[:alnum:]_-]|$)|\.([[:space:]]|\\[nrt]))'
    stripped="$(printf '%s' "$input" | tr -d "\"'\`\\\\")"
    if grep -qE "$words" <<< "$input" || grep -qE "$words" <<< "$stripped"; then
        echo "guard-git-write.sh が jq が無く判定できなかったため止めた。jq を入れるか、人に実行を頼むこと。" >&2
        exit 2
    fi
    exit 0
fi

cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // empty')"
cwd="$(printf '%s' "$input" | jq -r '.cwd // empty')"

# コマンドが空なら通す
[ -z "${cmd:-}" ] && exit 0

# --- 検査ロジック ---------------------------------------------------------

# 引用符・バッククォート・\ を取り除く。git "push"・g"it" push・\push のように、シェルが同じ語にする形も検知するため
normalize() {
    printf '%s' "$1" | tr -d "\"'\`\\\\"
}

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
    segs="$(normalize "$text" | sed -E 's/&&|\|\||;|\||&/\n/g')"
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
segs="$(normalize "$cmd" | sed -E 's/&&|\|\||;|\||&/\n/g')"
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
