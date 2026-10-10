#!/usr/bin/env python3
"""マーケットプレイスの整合性チェック。

チェック対象（1〜6 は plugins/ 配下の全プラグイン、2 の基準は project の init-repo テンプレート）:
  1. 権限規則の書式（allowed-tools に Write()/NotebookEdit()/Glob() のパス規則を使っていないか）
  2. init-repo テンプレートの deny と、各スキルが使うコマンドの衝突
  3. allowed-tools の書き込み許可パスが tmp 配下に収まっているか
  4. ${CLAUDE_PLUGIN_ROOT} 参照先のファイルが実在するか
  5. カタログの整合（スキル名・README の一覧・marketplace.json の source と登録漏れ）
  6. テンプレート（skills/<スキル名>/files/）の収録ファイルと、そのスキルの README の収録物表の一致
  7. .claude/rules/duplicated-files.md に載っている重複ファイルの組の内容が一致しているか
  8. 各スキル（plugins/ 配下と .claude/skills/）の argument-hint が .claude/rules/argument-hint.md の書き方に沿っているか

使い方: python .claude/skills/marketplace-update/scripts/check.py [--repo <リポジトリのルート>]
終了コード: NG が 1 件でもあれば 1、それ以外は 0（WARN は 0 のまま）
"""
import glob
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
    """テンプレートの deny の Bash ルールを、(ルール, 照合用の正規表現) の組で返す。"""
    deny = json.loads(read(settings_path))["permissions"]["deny"]
    prefixes = []
    for rule in deny:
        m = re.match(r"^Bash\((.+)\)$", rule)
        if not m:
            continue
        pattern = re.sub(r":\*$", " *", m.group(1))
        # * はどの位置でも任意の文字列に当たる。末尾の「 *」だけが * のときは、引数なしのコマンドにも当たる
        regex = "^" + re.escape(pattern).replace(r"\*", ".*") + "$"
        if pattern.endswith(" *") and pattern.count("*") == 1:
            regex = "^" + re.escape(pattern[:-2]) + "( .*)?$"
        prefixes.append((pattern, re.compile(regex)))
    return prefixes


def deny_hit(cmd, prefixes):
    """コマンドが当たる deny のルールを返す。当たらなければ None。"""
    for pattern, regex in prefixes:
        if regex.match(cmd):
            return pattern
    return None


def main():
    repo = os.getcwd()
    if "--repo" in sys.argv:
        repo = sys.argv[sys.argv.index("--repo") + 1]
    plugins_dir = os.path.join(repo, "plugins")
    settings = os.path.join(plugins_dir, "project", "skills", "init-repo", "files",
                            ".claude", "settings.json")

    prefixes = deny_prefixes(settings)
    for plugin_name in sorted(os.listdir(plugins_dir)):
        plugin = os.path.join(plugins_dir, plugin_name)
        if os.path.isdir(os.path.join(plugin, "skills")):
            check_plugin(repo, plugin_name, plugin, prefixes)

    market = json.loads(read(os.path.join(repo, ".claude-plugin", "marketplace.json")))
    for entry in market.get("plugins", []):
        src = os.path.join(repo, entry["source"].lstrip("./"))
        if not os.path.isdir(src):
            add("NG", "catalog", "marketplace.json の source %s が存在しない" % entry["source"])
    sources = {os.path.normpath(entry["source"].lstrip("./")) for entry in market.get("plugins", [])}
    for plugin_name in sorted(os.listdir(plugins_dir)):
        # .DS_Store などのファイルや隠しディレクトリはプラグインではない
        if plugin_name.startswith(".") or not os.path.isdir(os.path.join(plugins_dir, plugin_name)):
            continue
        if os.path.normpath(os.path.join("plugins", plugin_name)) not in sources:
            add("NG", "catalog", "plugins/%s が marketplace.json に登録されていない" % plugin_name)

    check_duplicated_files(repo)
    check_argument_hints(repo)

    order = {"NG": 0, "WARN": 1}
    for level, category, message in sorted(results, key=lambda r: (order[r[0]], r[1])):
        print("[%s] %s: %s" % (level, category, message))
    ng = sum(1 for r in results if r[0] == "NG")
    warn = len(results) - ng
    print("---")
    print("NG: %d / WARN: %d" % (ng, warn))
    return 1 if ng else 0


def check_plugin(repo, plugin_name, plugin, prefixes):
    """1〜5 のうちプラグイン単位のチェック。"""
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
                "%s:%s: frontmatter の name (%s) がディレクトリ名と違う"
                % (plugin_name, name, fm.get("name")))
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
                # 許可の範囲に入るコマンド（引数なし・引数あり）が deny に当たるかを見る
                pre = deny_hit(cmd, prefixes) or deny_hit(cmd + " x", prefixes)
                if pre:
                    add("NG", "deny-conflict",
                        "%s: allowed-tools の Bash(%s) はテンプレートの deny (%s) に一致する"
                        % (name, m.group(1), pre))
            m = re.match(r"^Edit\((.+)\)$", rule)
            if m and not m.group(1).startswith(("tmp/", "tmp.md")):
                add("WARN", "output-path",
                    "%s: 書き込み許可 %s が tmp 配下ではない。出力先を固定できているか確認する"
                    % (name, rule))

        # 本文で実行を指示している gh / git と削除のコマンドを拾う（人が手で実行する例も含むため WARN）
        for num, line in enumerate(text.splitlines(), 1):
            stripped = line.strip().lstrip("$ ").strip("`")
            m = re.match(r"^((gh|git) [a-z][a-z-]*|(rm|rmdir|unlink|find)\b)", stripped)
            if not m:
                continue
            pre = deny_hit(stripped, prefixes)
            if pre:
                add("WARN", "deny-conflict",
                    "%s:%d 本文の `%s` はテンプレートの deny (%s) に一致する。"
                    "Claude に実行させるのか、人が実行する例示なのかを確認する"
                    % (os.path.relpath(path, repo).replace(os.sep, "/"), num, stripped, pre))

    # 4: ${CLAUDE_PLUGIN_ROOT} の参照先が実在するか
    targets = []
    for root, dirs, files in os.walk(plugin):
        # テンプレート（skills/<スキル名>/files/）は導入先へコピーするもので、プラグインの参照は含まない
        parts = os.path.relpath(root, plugin).split(os.sep)
        if len(parts) >= 3 and parts[0] == "skills" and parts[2] == "files":
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

    # 5: プラグインの README のスキル一覧
    plugin_readme = read(os.path.join(plugin, "README.md"))
    listed = set(re.findall(r"/%s:([a-z0-9-]+)" % re.escape(plugin_name), plugin_readme))
    for name in skill_names:
        if name not in listed:
            add("NG", "catalog", "%s の README に /%s:%s の記載がない" % (plugin_name, plugin_name, name))
    for name in sorted(listed - set(skill_names)):
        add("NG", "catalog",
            "%s の README にある /%s:%s に対応するスキルが無い" % (plugin_name, plugin_name, name))

    # 6: テンプレートを持つスキルの収録ファイルと、そのスキルの README の収録物表
    for name in skill_names:
        template = os.path.join(skills_dir, name, "files")
        if not os.path.isdir(template):
            continue
        label = "%s:%s" % (plugin_name, name)
        readme_path = os.path.join(skills_dir, name, "README.md")
        if not os.path.isfile(readme_path):
            add("NG", "template-inventory", "%s は files/ を持つが README.md（収録物表）が無い" % label)
            continue
        documented = set(re.findall(r"`files/([^`]+)`", read(readme_path)))
        for root, dirs, files in os.walk(template):
            for f in files:
                rel = os.path.relpath(os.path.join(root, f), template).replace(os.sep, "/")
                if not any(rel == d or d.endswith("/") and rel.startswith(d) for d in documented):
                    add("WARN", "template-inventory",
                        "files/%s が %s の README の収録物表に無い" % (rel, label))
        for doc in sorted(documented):
            if not os.path.exists(os.path.join(template, doc)):
                add("NG", "template-inventory",
                    "%s の README にある files/%s が存在しない" % (label, doc))


def read_bytes_normalized(path):
    with open(path, "rb") as f:
        return f.read().replace(b"\r\n", b"\n")


def check_duplicated_files(repo):
    """7: 重複ファイルの組（.claude/rules/duplicated-files.md の表）の内容が一致しているか。"""
    rule_path = os.path.join(repo, ".claude", "rules", "duplicated-files.md")
    if not os.path.isfile(rule_path):
        return
    text = read(rule_path)
    # frontmatter の paths に無いファイルを編集してもルールが読み込まれないため、表と突き合わせる
    fm_end = text.find("---", 3) if text.startswith("---") else -1
    fm_paths = set(re.findall(r'^\s*-\s*"([^"]+)"', text[3:fm_end], re.M)) if fm_end > 0 else set()
    for line in text.splitlines():
        m = re.match(r"^\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|", line)
        if not m:
            continue
        pair = [m.group(1), m.group(2)]
        missing = [p for p in pair if not os.path.isfile(os.path.join(repo, p))]
        for p in missing:
            add("NG", "duplicated-files", "組に載っている %s が存在しない" % p)
        for p in pair:
            if p not in fm_paths:
                add("NG", "duplicated-files",
                    "%s が duplicated-files.md の paths に無い（編集してもルールが読み込まれない）" % p)
        if missing:
            continue
        # 作業ツリーの改行コード（Windows の CRLF 変換）の違いは内容の差として扱わない
        a, b = (read_bytes_normalized(os.path.join(repo, p)) for p in pair)
        if a != b:
            add("WARN", "duplicated-files",
                "%s と %s の内容が違う。片方の変更をもう片方に入れるか、"
                "意図的な差分なら duplicated-files.md の表に書く" % (pair[0], pair[1]))


HINT_GROUP = re.compile(r"\[[^\[\]]*\]|<[^<>]*>")


def check_argument_hints(repo):
    """8: 入力ヒント（argument-hint）が任意・必須の区別と省略時の動きを示しているか。"""
    paths = glob.glob(os.path.join(repo, "plugins", "*", "skills", "*", "SKILL.md"))
    paths += glob.glob(os.path.join(repo, ".claude", "skills", "*", "SKILL.md"))
    for path in sorted(paths):
        rel = os.path.relpath(path, repo).replace(os.sep, "/")
        text = read(path)
        hint = frontmatter(text).get("argument-hint")
        if hint is None:
            if "$ARGUMENTS" in text:
                add("WARN", "argument-hint",
                    "%s: 本文で $ARGUMENTS を使うが argument-hint が無い。"
                    "引数を受け取るならヒントを書き、受け取らないなら $ARGUMENTS を消す" % rel)
            continue
        hint = hint.strip("\"'")
        groups = HINT_GROUP.findall(hint)
        if not groups or HINT_GROUP.sub("", hint).strip():
            add("NG", "argument-hint", "%s: 引数を [] か <> で囲んでいない部分がある（%s）" % (rel, hint))
            continue
        for group in groups:
            if group.startswith("["):
                if "（任意。省略時は" not in group:
                    add("NG", "argument-hint",
                        "%s: 任意の引数 %s に「（任意。省略時は〜）」が無い" % (rel, group))
            elif "任意" in group or "省略" in group:
                add("NG", "argument-hint",
                    "%s: 必須の引数 %s に「任意」「省略」がある。任意なら [] で書く" % (rel, group))


if __name__ == "__main__":
    sys.exit(main())
