#!/usr/bin/env python3
"""Issue・PR の本文が、文字数の上限に収まっているかを数える。

上限と数え方の正典は、このスクリプトから見て ../references/short-body.md。
  - 全体: 500 文字以内。HTML コメントと定型の節（見出しに「チェックリスト」か「関連 Issue」を含む節）は数えない。
    見出し・記号は数え、改行と行頭・行末の空白は数えない。リンクは見える文字だけ数える
  - 項目: 箇条書きの 1 項目と、地の文の 1 文は 50 文字以内。見出し・表・引用・コードブロックは対象外

使い方: python -B body_length.py <ファイル | -> [--item-only]
  -            標準入力から読む（下書きのファイルを作らないスキル用）
  --item-only  項目だけを確かめ、全体は数えない（検証コメント用）
終了コード: 上限内なら 0、超えていれば 1、引数の誤りは 2
"""
import re
import sys

TOTAL_LIMIT = 500
ITEM_LIMIT = 50

FENCE = re.compile(r"^ {0,3}(`{3,}|~{3,})")
HEADING = re.compile(r"^ {0,3}(#{1,6})\s+(.*)$")
FIXED_SECTION = re.compile(r"チェックリスト|関連\s*issue", re.IGNORECASE)
LIST_MARKER = re.compile(r"^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?")
LINK = re.compile(r"!?\[([^\]]*)\]\([^)]*\)")
COMMENT = re.compile(r"<!--.*?-->", re.S)


def read_input(path):
    if path == "-":
        sys.stdin.reconfigure(encoding="utf-8")
        return sys.stdin.read()
    with open(path, encoding="utf-8") as f:
        return f.read()


def strip_comments(text):
    """コードブロックの外の HTML コメントを消す。行番号がずれないよう、改行は残す。"""
    out, chunk, in_fence, marker = [], [], False, ""

    def flush():
        if chunk:
            joined = "\n".join(chunk)
            out.extend(COMMENT.sub(lambda m: "\n" * m.group(0).count("\n"), joined).split("\n"))
            chunk.clear()

    for line in text.split("\n"):
        m = FENCE.match(line)
        if in_fence:
            out.append(line)
            if m and m.group(1)[0] == marker[0] and len(m.group(1)) >= len(marker):
                in_fence = False
            continue
        if m:
            flush()
            in_fence, marker = True, m.group(1)
            out.append(line)
            continue
        chunk.append(line)
    flush()
    return out


def classify(lines):
    """行ごとに (数えるか, コードブロックの中か) を返す。定型の節は、下位の見出しも含めて数えない。"""
    result, in_fence, marker, skip_level = [], False, "", 0
    for line in lines:
        m = FENCE.match(line)
        if in_fence:
            result.append((skip_level == 0, True))
            if m and m.group(1)[0] == marker[0] and len(m.group(1)) >= len(marker):
                in_fence = False
            continue
        if m:
            in_fence, marker = True, m.group(1)
            result.append((skip_level == 0, True))
            continue
        h = HEADING.match(line)
        if h:
            level = len(h.group(1))
            if skip_level and level <= skip_level:
                skip_level = 0
            if not skip_level and FIXED_SECTION.search(h.group(2)):
                skip_level = level
        result.append((skip_level == 0, False))
    return result


def visible(line):
    """リンクは見える文字だけにし、行頭・行末の空白を除く。"""
    return LINK.sub(r"\1", line).strip()


def item_overflows(num, line):
    """50 文字を超える項目・文を (行番号, 文字数, 文) で返す。"""
    text = visible(line)
    if not text or text.startswith(("#", "|", ">")):
        return []
    if LIST_MARKER.match(line):
        item = visible(LIST_MARKER.sub("", line, count=1))
        return [(num, len(item), item)] if len(item) > ITEM_LIMIT else []
    sentences = [s for s in re.findall(r"[^。！？]*[。！？]?", text) if s.strip()]
    return [(num, len(s.strip()), s.strip()) for s in sentences if len(s.strip()) > ITEM_LIMIT]


def main(argv):
    # Windows の既定の文字コード（cp932）で出すと、Claude が読む出力が文字化けするため
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    args = [a for a in argv if a != "--item-only"]
    item_only = len(args) != len(argv)
    if len(args) != 1:
        print(__doc__, file=sys.stderr)
        return 2

    try:
        text = read_input(args[0])
    except OSError as e:
        print("読めない: %s" % e, file=sys.stderr)
        return 2
    lines = strip_comments(text.replace("\r\n", "\n"))
    kinds = classify(lines)
    total = sum(len(visible(line)) for line, (counted, _) in zip(lines, kinds) if counted)
    overflows = []
    for num, (line, (counted, in_fence)) in enumerate(zip(lines, kinds), 1):
        if counted and not in_fence:
            overflows.extend(item_overflows(num, line))

    ng = bool(overflows)
    if item_only:
        print("全体: 数えない（--item-only）")
    else:
        ng = ng or total > TOTAL_LIMIT
        print("全体: %d / %d 文字（%s）" % (total, TOTAL_LIMIT, "NG" if total > TOTAL_LIMIT else "OK"))
    if overflows:
        print("%d 文字を超える項目・文:" % ITEM_LIMIT)
        for num, length, text in overflows:
            print("  %d 行目: %d 文字「%s」" % (num, length, text))
    else:
        print("%d 文字を超える項目・文: なし" % ITEM_LIMIT)
    return 1 if ng else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
