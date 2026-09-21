#!/usr/bin/env python3
"""マーケットプレイスの整合性チェック。

チェック対象:
  1. 権限規則の書式（allowed-tools に Write()/NotebookEdit()/Glob() のパス規則を使っていないか）
  2. init-repo テンプレートの deny と、各スキルが使うコマンドの衝突
  3. allowed-tools の書き込み許可パスが tmp 配下に収まっているか
  4. ${CLAUDE_PLUGIN_ROOT} 参照先のファイルが実在するか
  5. カタログの整合（スキル名・README の一覧・marketplace.json の source）
  6. init-repo テンプレートの収録ファイルと README の収録物表の一致

使い方: python .claude/skills/marketplace-update/scripts/check.py [--repo <リポジトリのルート>]
終了コード: NG が 1 件でもあれば 1、それ以外は 0（WARN は 0 のまま）
"""
import json
import os
import re
import sys

results = []


def add(level, category, message):
    results.append((level, category, message))


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def frontmatter(text):
    if not text.startswith("---"):
        return {}
    end = text.find("---", 3)
    if end < 0:
        return {}
    data = {}
    for line in text[3:end].splitlines():
        if ":" in line and not line.startswith(" "):
            k, v = line.split(":", 1)
            data[k.strip()] = v.strip()
    return data


def split_rules(value):
    """allowed-tools の値を、括弧の中のカンマで割らないように分解する。"""
    rules, depth, buf = [], 0, ""
    for ch in value:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == "," and depth == 0:
            rules.append(buf.strip())
            buf = ""
        else:
            buf += ch
    if buf.strip():
        rules.append(buf.strip())
    return rules


def deny_prefixes(settings_path):
    """テンプレートの deny から Bash ルールのコマンド接頭辞を取り出す。"""
    deny = json.loads(read(settings_path))["permissions"]["deny"]
    prefixes = []
    for rule in deny:
        m = re.match(r"^Bash\((.+)\)$", rule)
        if not m:
            continue
        pattern = m.group(1)
        prefixes.append(re.sub(r"(:\*| \*)$", "", pattern).strip())
    return prefixes


def main():
    repo = os.getcwd()
    if "--repo" in sys.argv:
        repo = sys.argv[sys.argv.index("--repo") + 1]
    plugin = os.path.join(repo, "plugins", "aidd")
    template = os.path.join(plugin, "skills", "init-repo", "files")
    settings = os.path.join(template, ".claude", "settings.json")

    prefixes = deny_prefixes(settings)
    skills_dir = os.path.join(plugin, "skills")
    skill_names = sorted(
        d for d in os.listdir(skills_dir)
        if os.path.isfile(os.path.join(skills_dir, d, "SKILL.md"))
    )

    # 1・2・3: 各スキルの allowed-tools と本文を検査する
    for name in skill_names:
        path = os.path.join(skills_dir, name, "SKILL.md")
        text = read(path)
        fm = frontmatter(text)
        if fm.get("name") != name:
            add("NG", "catalog",
                "%s: frontmatter の name (%s) がディレクトリ名と違う" % (name, fm.get("name")))
        for rule in split_rules(fm.get("allowed-tools", "")):
            m = re.match(r"^(Write|NotebookEdit|MultiEdit|Glob)\((.+)\)$", rule)
            if m:
                alt = "Read" if m.group(1) == "Glob" else "Edit"
                add("NG", "rule-form",
                    "%s: %s は権限判定に使われない。%s(%s) に直す"
                    % (name, rule, alt, m.group(2)))
            m = re.match(r"^Bash\((.+)\)$", rule)
            if m:
                cmd = re.sub(r"(:\*| \*)$", "", m.group(1)).strip()
                for pre in prefixes:
                    if cmd == pre or cmd.startswith(pre + " "):
                        add("NG", "deny-conflict",
                            "%s: allowed-tools の Bash(%s) はテンプレートの deny (%s) に一致する"
                            % (name, m.group(1), pre))
            m = re.match(r"^Edit\((.+)\)$", rule)
            if m and not m.group(1).startswith(("tmp/", "tmp.md")):
                add("WARN", "output-path",
                    "%s: 書き込み許可 %s が tmp 配下ではない。出力先を固定できているか確認する"
                    % (name, rule))

        # 本文で実行を指示している gh / git コマンドを拾う（人が手で実行する例も含むため WARN）
        for num, line in enumerate(text.splitlines(), 1):
            stripped = line.strip().lstrip("$ ").strip("`")
            m = re.match(r"^(gh|git) [a-z][a-z-]*( [a-z][a-z-]*)?", stripped)
            if not m:
                continue
            for pre in prefixes:
                if stripped == pre or stripped.startswith(pre + " "):
                    add("WARN", "deny-conflict",
                        "%s:%d 本文の `%s` はテンプレートの deny (%s) に一致する。"
                        "Claude に実行させるのか、人が実行する例示なのかを確認する"
                        % (os.path.relpath(path, repo).replace(os.sep, "/"), num, stripped, pre))
                    break

    # 4: ${CLAUDE_PLUGIN_ROOT} の参照先が実在するか
    targets = []
    for root, dirs, files in os.walk(plugin):
        if os.path.join("skills", "init-repo", "files") in root:
            continue
        for f in files:
            if f.endswith((".md", ".js", ".py", ".sh")):
                targets.append(os.path.join(root, f))
    for path in targets:
        for ref in set(re.findall(r"\$\{CLAUDE_PLUGIN_ROOT\}/([A-Za-z0-9_./-]+)", read(path))):
            if not os.path.exists(os.path.join(plugin, ref)):
                add("NG", "plugin-root-ref",
                    "%s: ${CLAUDE_PLUGIN_ROOT}/%s が存在しない"
                    % (os.path.relpath(path, repo).replace(os.sep, "/"), ref))

    # 5: README の一覧と marketplace.json
    plugin_readme = read(os.path.join(plugin, "README.md"))
    listed = set(re.findall(r"/aidd:([a-z0-9-]+)", plugin_readme))
    for name in skill_names:
        if name not in listed:
            add("NG", "catalog", "プラグインの README に /aidd:%s の記載がない" % name)
    for name in sorted(listed - set(skill_names)):
        add("NG", "catalog", "プラグインの README にある /aidd:%s に対応するスキルが無い" % name)

    market = json.loads(read(os.path.join(repo, ".claude-plugin", "marketplace.json")))
    for entry in market.get("plugins", []):
        src = os.path.join(repo, entry["source"].lstrip("./"))
        if not os.path.isdir(src):
            add("NG", "catalog", "marketplace.json の source %s が存在しない" % entry["source"])

    # 6: テンプレートの収録ファイルと init-repo README の収録物表
    init_readme = read(os.path.join(plugin, "skills", "init-repo", "README.md"))
    documented = set(re.findall(r"`files/([^`]+)`", init_readme))
    for root, dirs, files in os.walk(template):
        for f in files:
            rel = os.path.relpath(os.path.join(root, f), template).replace(os.sep, "/")
            if not any(rel == d or d.endswith("/") and rel.startswith(d) for d in documented):
                add("WARN", "template-inventory",
                    "files/%s が init-repo の README の収録物表に無い" % rel)
    for doc in sorted(documented):
        if not os.path.exists(os.path.join(template, doc)):
            add("NG", "template-inventory",
                "init-repo の README にある files/%s が存在しない" % doc)

    order = {"NG": 0, "WARN": 1}
    for level, category, message in sorted(results, key=lambda r: (order[r[0]], r[1])):
        print("[%s] %s: %s" % (level, category, message))
    ng = sum(1 for r in results if r[0] == "NG")
    warn = len(results) - ng
    print("---")
    print("NG: %d / WARN: %d" % (ng, warn))
    return 1 if ng else 0


if __name__ == "__main__":
    sys.exit(main())
