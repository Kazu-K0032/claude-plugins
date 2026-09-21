#!/usr/bin/env python3
"""Claude Code セッションログ分析スクリプト（ai-report skill）。

機械処理（集計・期間フィルタ・図表生成・ファイル出力）をすべて担う。
分析対象は本リポジトリのログ（cwd から決定論的に導出）。タイムスタンプは
JST(Asia/Tokyo) に換算してフィルタ・集計する。

使い方:
    python3 analyze.py collect <START> <END>   # 集計し stdout へ + 一時データ保存
    python3 analyze.py report  <START> <END>   # 一時データ + 定性分析を結合し新規出力

日付は YYYY-MM-DD。期間は [START 00:00:00, END 23:59:59.999999] JST の閉区間。
"""
import json
import os
import re
import sys
import glob
import subprocess
import statistics
from collections import Counter
from datetime import datetime, time
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Asia/Tokyo")
CMD_RE = re.compile(r"<command-name>([^<]+)</command-name>")
DATA_FILE = ".ai-report-data.json"
QUAL_FILE = ".ai-report-qualitative.md"
# 定性分析（Claude 執筆）の挿入マーカー
SUMMARY_RE = re.compile(r"<!--\s*SUMMARY\s*-->(.*?)<!--\s*/SUMMARY\s*-->", re.S)
PROMPTS_RE = re.compile(r"<!--\s*PROMPTS\s*-->(.*?)<!--\s*/PROMPTS\s*-->", re.S)
PROMOTION_REASONS_RE = re.compile(r"<!--\s*PROMOTION_REASONS\s*-->(.*?)<!--\s*/PROMOTION_REASONS\s*-->", re.S)
TOKEN_EFFICIENCY_RE = re.compile(r"<!--\s*TOKEN_EFFICIENCY\s*-->(.*?)<!--\s*/TOKEN_EFFICIENCY\s*-->", re.S)
WORKFLOW_EFFICIENCY_RE = re.compile(r"<!--\s*WORKFLOW_EFFICIENCY\s*-->(.*?)<!--\s*/WORKFLOW_EFFICIENCY\s*-->", re.S)
PROMPT_CAP = 1500  # 1 プロンプトあたり stdout へ出す最大文字数
PROMOTION_THRESHOLD = 10  # この回数以上のエージェントを昇格候補として表示する
ADHOC_WORKFLOW_KEY = "(アドホック実行 / .claude/workflows/ 未保存)"  # scriptPath が既知の保存済み workflow に一致しない実行の集計キー
SHORT_PROMPT_MAX = 15  # この文字数以下の typed プロンプトを「極短（聞き返し傾向）」とみなす
# 手戻りシグナル: ユーザーが Claude の実装をやり直し・撤回・訂正する語彙。
# assistant の出力本文は読めないため、ユーザーの修正系プロンプトから手戻りを推定する。
# 誤検知を避けるため「ではなく」「修正して」等の一般的な指示語は含めず保守的に絞る
# （「間違いない」を拾わないよう「間違って」「間違え」のみ、肯定形を拾わないよう「意図と違」等に限定）。
REWORK_PATTERNS = [
    "やり直", "やりなお", "元に戻", "元通り", "差し戻", "巻き戻",
    "取り消", "取消", "そうじゃな", "そうではな", "違います",
    "間違って", "間違え", "勝手に", "頼んでいな", "頼んでな",
    "指示してな", "指示していな", "意図と違", "意図しない", "意図せず",
    "revert", "rollback",
]
REWORK_RE = re.compile("|".join(re.escape(p) for p in REWORK_PATTERNS))

# --- モデル表示名・料金定数 -------------------------------------------------
# モデル ID → 表示名（render_models / render_cost で共通利用）
MODEL_NAME_MAP = {
    "claude-fable-5": "Fable 5",
    "claude-mythos-5": "Mythos 5",
    "claude-opus-5": "Opus 5",
    "claude-opus-4-8": "Opus 4.8",
    "claude-opus-4-7": "Opus 4.7",
    "claude-opus-4-6": "Opus 4.6",
    "claude-opus-4-5": "Opus 4.5",
    "claude-opus-4-5-20251101": "Opus 4.5",
    "claude-opus-4-1": "Opus 4.1",
    "claude-opus-4-1-20250805": "Opus 4.1",
    "claude-sonnet-5": "Sonnet 5",
    "claude-sonnet-4-6": "Sonnet 4.6",
    "claude-sonnet-4-5": "Sonnet 4.5",
    "claude-sonnet-4-5-20250929": "Sonnet 4.5",
    "claude-haiku-4-5": "Haiku 4.5",
    "claude-haiku-4-5-20251001": "Haiku 4.5",
    "<synthetic>": "（合成メッセージ）",
}
# 料金の唯一の情報源（SSOT）は Anthropic 公式の Models overview / Pricing ページ。
# 単価が変わったら公式ページ（または `claude-api` skill）で確認し、
# 下記の値と PRICING_ASOF・USD_JPY を更新すること。
# references/ai-research.md「未検証値を断定しない」に準拠し、確認日を明記する。
# 確認元: https://platform.claude.com/docs/en/about-claude/models/overview
PRICING_ASOF = "2026-08-04"  # 単価を確認した日（公式 Models overview を参照）
USD_JPY = 155.0  # 1 USD = ◯円（概算値・要更新。実レートに合わせて修正すること）
FX_ASOF = "2026-07-24"  # 上記為替の設定日
# モデル ID → (input, output) USD / 100万トークン
MODEL_PRICING = {
    "claude-fable-5": (10.00, 50.00),
    "claude-mythos-5": (10.00, 50.00),  # Fable 5 と同単価（Project Glasswing 限定）
    "claude-opus-5": (5.00, 25.00),
    "claude-opus-4-8": (5.00, 25.00),
    "claude-opus-4-7": (5.00, 25.00),
    "claude-opus-4-6": (5.00, 25.00),
    "claude-opus-4-5": (5.00, 25.00),
    "claude-opus-4-5-20251101": (5.00, 25.00),
    "claude-opus-4-1": (15.00, 75.00),  # 非推奨。2026-08-05 で提供終了
    "claude-opus-4-1-20250805": (15.00, 75.00),
    "claude-sonnet-5": (3.00, 15.00),
    "claude-sonnet-4-6": (3.00, 15.00),
    "claude-sonnet-4-5": (3.00, 15.00),
    "claude-sonnet-4-5-20250929": (3.00, 15.00),
    "claude-haiku-4-5": (1.00, 5.00),
    "claude-haiku-4-5-20251001": (1.00, 5.00),
    # Claude Code がローカルで生成する合成メッセージ。API 呼び出しを伴わず課金されない
    "<synthetic>": (0.00, 0.00),
}
# Sonnet 5 導入価格（分析期間の END 日が終了日以前なら適用）
SONNET5_INTRO = {"claude-sonnet-5": (2.00, 10.00)}
SONNET5_INTRO_END = "2026-08-31"
# キャッシュ単価は input 単価からの倍率で算出（/claude-api prompt-caching）。
# cache 書き込みは既定 5分TTL=1.25×。Claude Code は 1h TTL(2×) の場合もあるが、
# cache_creation はトークン総量が小さく総額への影響は軽微なため 5分TTL を既定とする。
CACHE_WRITE_MULT = 1.25
CACHE_READ_MULT = 0.10


# --- パス・git ヘルパ -------------------------------------------------------

def log_dir():
    """cwd からセッションログのディレクトリを決定論的に導く。"""
    enc = os.getcwd().replace("/", "-")
    return os.path.join(os.path.expanduser("~"), ".claude", "projects", enc)


def git_branch():
    """現在の git ブランチ名を返す。取得に失敗した場合は "unknown" を返す。"""
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            text=True, stderr=subprocess.DEVNULL,
        ).strip() or "unknown"
    except Exception:
        return "unknown"


def issue_name():
    """git ブランチ名の / を - に置換し単一ディレクトリ名にする。"""
    return git_branch().replace("/", "-")


def out_dir():
    """レポート出力先ディレクトリ tmp/<issue名>/ のパスを返す。"""
    return os.path.join("tmp", issue_name())


def custom_agent_names():
    """`.claude/agents/` 配下（サブフォルダ含む）の永続カスタムエージェント名一覧を返す。

    識別子（= subagent_type）は frontmatter の `name:`。Claude Code 公式仕様上
    ファイル名と `name` は一致しなくてよいため、frontmatter に無い場合のみ
    ファイル名へフォールバックする。
    """
    names = []
    for p in glob.glob(os.path.join(".claude", "agents", "**", "*.md"), recursive=True):
        with open(p, encoding="utf-8") as fh:
            head = fh.read(2000)
        fm = re.match(r"^---\s*\n(.*?)\n---", head, re.S)
        name = None
        if fm:
            m = re.search(r"^name:\s*(\S+)", fm.group(1), re.M)
            if m:
                name = m.group(1).strip()
        names.append(name or os.path.splitext(os.path.basename(p))[0])
    return sorted(names)


def skill_names():
    """`.claude/skills/` 配下のプロジェクトスコープ Skill 名一覧を返す（ディレクトリ名 = frontmatter の `name:`）。"""
    return sorted(
        os.path.basename(os.path.dirname(p))
        for p in glob.glob(os.path.join(".claude", "skills", "*", "SKILL.md"))
    )


def workflow_names():
    """`.claude/workflows/` 配下の保存済み Workflow スクリプト名一覧を返す（ファイル名 = `meta.name`）。"""
    return sorted(
        os.path.splitext(os.path.basename(p))[0]
        for p in glob.glob(os.path.join(".claude", "workflows", "*.js"))
    )


# --- 時刻ヘルパ -------------------------------------------------------------

def parse_ts(ts):
    """ISO8601(UTC, 末尾 Z) を JST aware datetime に変換。失敗時 None。"""
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone(TZ)
    except Exception:
        return None


def parse_range(start, end):
    """開始日・終了日(YYYY-MM-DD)を JST 閉区間 [開始 00:00:00, 終了 23:59:59.999999] の datetime ペアに変換する。"""
    s = datetime.combine(datetime.strptime(start, "%Y-%m-%d").date(), time.min, TZ)
    e = datetime.combine(datetime.strptime(end, "%Y-%m-%d").date(), time.max, TZ)
    return s, e


# --- 集計 -------------------------------------------------------------------

def collect_metrics(start, end):
    """指定期間のログ(*.jsonl)を走査し、全メトリクスと typed プロンプトを集計した dict を返す。

    サブエージェント起動回数は Agent ツール呼び出し（tool_use name=="Agent"）の
    description を集計する。agent-name/ai-title はセッション自体の自動タイトルであり
    実際のサブエージェント起動とは無関係（起動0件のセッションでも複数回記録される）のため対象外とする。

    ただし agent-name はセッション単位では「そのセッションが何の作業だったか」を表す
    唯一の手がかりでもある（作業テーマの手がかり）。完全一致で複数セッションに
    またがることは無い（毎回 LLM が新しく言葉を選ぶため）ため、閾値による自動候補判定はせず、
    期間内の一覧だけを素材として返す（意味的な重複判断は collect 実行時の Claude に委ねる）。
    """
    s_dt, e_dt = parse_range(start, end)
    files = sorted(glob.glob(os.path.join(log_dir(), "*.jsonl")))
    known_workflow_names = set(workflow_names())

    tok = Counter()
    tok_by_model = {}  # モデル ID → トークン内訳 Counter（コスト試算用）
    models = Counter()
    tools = Counter()
    mcp = Counter()
    commands = Counter()
    agents = Counter()
    subagent_types = Counter()  # subagent_type → 起動回数（.claude/agents/ の永続カスタムエージェント利用状況）
    skill_tool_calls = Counter()  # input.skill → 起動回数（Skill ツール経由 = モデル自動起動。/name 明示起動は commands に別集計）
    workflow_tool_calls = Counter()  # 起動回数。保存済み workflow は名前で集計、アドホック実行は "(アドホック実行)" に集計
    agent_prompts = {}  # description → 実際に渡した prompt のリスト（昇格候補理由の素材。DATA_FILE には保存しない）
    session_titles = {}  # sessionId → 最新の agent-name（作業テーマの気づき用。DATA_FILE には保存しない）
    daily = Counter()
    hourly = Counter()
    edit_files = Counter()
    bash_cmds = Counter()
    versions = Counter()
    pmodes = Counter()
    thinking = 0
    webfetch = 0
    sessions = set()
    prompt_lens = []
    prompts = []  # 定性分析用 typed プロンプト
    rework_hits = []  # 手戻りシグナルに一致した typed プロンプト

    for f in files:
        with open(f, encoding="utf-8") as fh:
            for line in fh:
                try:
                    o = json.loads(line)
                except Exception:
                    continue
                if o.get("type") == "agent-name" and o.get("agentName"):
                    sid = o.get("sessionId")
                    if sid:
                        session_titles[sid] = o["agentName"]
                    continue
                dt = parse_ts(o.get("timestamp"))
                if dt is None or not (s_dt <= dt <= e_dt):
                    continue
                t = o.get("type")
                if o.get("sessionId"):
                    sessions.add(o["sessionId"])
                if o.get("version"):
                    versions[o["version"]] += 1
                if o.get("permissionMode"):
                    pmodes[o["permissionMode"]] += 1
                if t == "assistant":
                    m = o.get("message", {})
                    u = m.get("usage", {})
                    tok["input"] += u.get("input_tokens", 0)
                    tok["output"] += u.get("output_tokens", 0)
                    tok["cache_read"] += u.get("cache_read_input_tokens", 0)
                    tok["cache_creation"] += u.get("cache_creation_input_tokens", 0)
                    if m.get("model"):
                        models[m["model"]] += 1
                        # モデル別トークン内訳（コスト試算用）
                        mt = tok_by_model.setdefault(m["model"], Counter())
                        mt["input"] += u.get("input_tokens", 0)
                        mt["output"] += u.get("output_tokens", 0)
                        mt["cache_read"] += u.get("cache_read_input_tokens", 0)
                        mt["cache_creation"] += u.get("cache_creation_input_tokens", 0)
                    for c in m.get("content", []):
                        if not isinstance(c, dict):
                            continue
                        if c.get("type") == "thinking":
                            thinking += 1
                        if c.get("type") == "tool_use":
                            name = c.get("name", "?")
                            inp = c.get("input", {}) or {}
                            tools[name] += 1
                            if name.startswith("mcp__"):
                                mcp[name] += 1
                            if name == "WebFetch":
                                webfetch += 1
                            if name == "Skill":
                                sk = (inp.get("skill") or "?").strip()
                                skill_tool_calls[sk] += 1
                            if name == "Workflow":
                                wf_name = (inp.get("name") or "").strip()
                                if not wf_name:
                                    script_path = inp.get("scriptPath") or ""
                                    base = os.path.splitext(os.path.basename(script_path))[0]
                                    wf_name = base if base in known_workflow_names else ADHOC_WORKFLOW_KEY
                                workflow_tool_calls[wf_name] += 1
                            if name == "Bash":
                                head = _bash_head(inp.get("command", ""))
                                if head:
                                    bash_cmds[head] += 1
                            if name == "Agent":
                                desc = (inp.get("description") or "").strip()
                                if desc:
                                    agents[desc] += 1
                                    prompt_text = inp.get("prompt", "")
                                    if prompt_text:
                                        agent_prompts.setdefault(desc, []).append(
                                            {"time": dt.strftime("%m-%d %H:%M"), "text": prompt_text}
                                        )
                                st = (inp.get("subagent_type") or "").strip()
                                if st:
                                    subagent_types[st] += 1
                            if name in ("Edit", "Write") and inp.get("file_path"):
                                edit_files[os.path.basename(inp["file_path"])] += 1
                elif t == "user":
                    content = o.get("message", {}).get("content")
                    txt = content if isinstance(content, str) else "".join(
                        c.get("text", "") for c in (content or [])
                        if isinstance(c, dict)
                    )
                    for cm in CMD_RE.findall(txt):
                        commands[cm.strip()] += 1
                    if o.get("promptSource") == "typed":
                        prompt_lens.append(len(txt))
                        # 日別・時間帯別はユーザー入力（typed プロンプト）のみを数える
                        daily[dt.strftime("%Y-%m-%d")] += 1
                        hourly[dt.strftime("%H")] += 1
                        # 自然言語プロンプトのみ定性分析へ（コマンド/メタは除外）
                        if txt.strip() and not txt.lstrip().startswith("<"):
                            entry = {"time": dt.strftime("%m-%d %H:%M"), "text": txt}
                            prompts.append(entry)
                            if REWORK_RE.search(txt):
                                rework_hits.append(entry)

    # エージェント別関連プロンプトは時刻順に整列する（昇格候補理由の素材。DATA_FILE には保存しない）
    for ps in agent_prompts.values():
        ps.sort(key=lambda p: p["time"])

    # 期間内セッションのみに絞ったセッションテーマ一覧（作業テーマの気づき用。DATA_FILE には保存しない）
    session_themes = sorted({title for sid, title in session_titles.items() if sid in sessions})

    pstats = {}
    if prompt_lens:
        pstats = {
            "count": len(prompt_lens),
            "mean": round(statistics.mean(prompt_lens)),
            "median": round(statistics.median(prompt_lens)),
            "max": max(prompt_lens),
            "min": min(prompt_lens),
        }

    # 会話密度（聞き返し傾向の素材）: 極短プロンプト率・セッション平均プロンプト数
    convo = {}
    if prompt_lens:
        short = sum(1 for n in prompt_lens if n <= SHORT_PROMPT_MAX)
        convo = {
            "typed_total": len(prompt_lens),
            "sessions": len(sessions),
            "avg_per_session": round(len(prompt_lens) / len(sessions), 1) if sessions else 0,
            "short_threshold": SHORT_PROMPT_MAX,
            "short_count": short,
            "short_ratio": round(short / len(prompt_lens) * 100, 1),
        }

    # 手戻りシグナル（完了時間・手戻り削減の素材）: 自然言語プロンプト中の
    # やり直し・撤回・訂正語彙の出現。assistant 出力は読めないためユーザー側から推定する。
    # 割合の分母は自然言語プロンプト数（正規表現は自然言語プロンプトのみに適用するため）。
    rework = {}
    if prompts:
        rework = {
            "typed_nl_total": len(prompts),
            "hit_count": len(rework_hits),
            "hit_ratio": round(len(rework_hits) / len(prompts) * 100, 1),
            "examples": [
                {"time": p["time"], "text": " ".join(p["text"][:120].split())}
                for p in rework_hits[:8]
            ],
        }

    return {
        "range": {"start": start, "end": end},
        "branch": git_branch(),
        "issue": issue_name(),
        "sessions": len(sessions),
        "tokens": dict(tok),
        "tok_by_model": {k: dict(v) for k, v in tok_by_model.items()},
        "convo": convo,
        "rework": rework,
        "models": dict(models),
        "tools": dict(tools),
        "mcp": dict(mcp),
        "commands": dict(commands),
        "agents": dict(agents),
        "subagent_types": dict(subagent_types),
        "skill_tool_calls": dict(skill_tool_calls),
        "workflow_tool_calls": dict(workflow_tool_calls),
        "daily": dict(daily),
        "hourly": dict(hourly),
        "edit_files": dict(edit_files),
        "bash_cmds": dict(bash_cmds),
        "versions": dict(versions),
        "pmodes": dict(pmodes),
        "thinking": thinking,
        "webfetch": webfetch,
        "prompt_stats": pstats,
        "prompts": prompts,
        "agent_prompts": agent_prompts,
        "session_themes": session_themes,
    }


def _bash_head(cmd):
    """Bash コマンド先頭の実行コマンド名を取り出す（環境変数代入はスキップ）。"""
    for tok in (cmd or "").strip().split():
        if re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", tok):
            continue
        return tok.split("/")[-1]
    return None


# --- 図表レンダリング -------------------------------------------------------

def bar(value, maxval, width=28):
    """value を maxval で正規化した █ の横棒文字列を返す（最大幅 width 文字）。"""
    if maxval <= 0:
        return ""
    n = round(value / maxval * width)
    return "█" * max(n, 1 if value > 0 else 0)


def render_barlist(title, counter, top=None):
    """カウンタを回数降順の ASCII バーチャート（Markdown コードブロック）に整形する。top で上位 N 件に絞る。"""
    items = sorted(counter.items(), key=lambda kv: kv[1], reverse=True)
    if top:
        items = items[:top]
    if not items:
        return f"### {title}\n\n（該当なし）\n"
    mx = items[0][1]
    lines = [f"### {title}\n", "```text"]
    width = max(len(k) for k, _ in items)
    for k, v in items:
        lines.append(f"{k:<{width}}  {bar(v, mx):<28} {v}")
    lines.append("```\n")
    return "\n".join(lines)


def render_table(title, counter, headers=("項目", "回数"), top=None):
    """カウンタを回数降順の Markdown テーブルに整形する。top で上位 N 件に絞る。"""
    items = sorted(counter.items(), key=lambda kv: kv[1], reverse=True)
    if top:
        items = items[:top]
    if not items:
        return f"### {title}\n\n（該当なし）\n"
    lines = [f"### {title}\n", f"| {headers[0]} | {headers[1]} |", "| --- | --- |"]
    for k, v in items:
        lines.append(f"| {k} | {v} |")
    lines.append("")
    return "\n".join(lines)


def render_custom_agents(subagent_types):
    """`.claude/agents/` 配下の永続カスタムエージェントを起動回数付きで整形する（0回も明示する）。

    Agent ツールの subagent_type が custom_agent_names() の返す識別子
    （frontmatter の name:。無ければファイル名）と一致する前提。
    Counter ベースの他テーブルと違い、0回のエージェントも一覧から漏らさず出す
    （「使われているか」を確認する用途のため、未使用であること自体が重要な情報）。
    """
    names = custom_agent_names()
    title = "永続カスタムエージェント別起動回数（.claude/agents/）"
    if not names:
        return f"### {title}\n\n（該当なし）\n"
    rows = sorted(names, key=lambda n: (-subagent_types.get(n, 0), n))
    lines = [f"### {title}\n", "| エージェント | 起動回数 |", "| --- | --- |"]
    for name in rows:
        lines.append(f"| {name} | {subagent_types.get(name, 0)} |")
    lines.append("")
    lines.append("> 0回のエージェントは期間内に Agent ツールの subagent_type として一度も指定されていない。"
                 "継続して0回なら削除を検討する。\n")
    return "\n".join(lines)


def render_skill_usage(commands, skill_tool_calls):
    """`.claude/skills/` 配下の Skill を「手動(/name 明示起動)」「自動(Skill ツール起動)」の内訳付きで整形する（0回も明示する）。

    手動起動は commands（`<command-name>` タグ集計。既存の「Skill / スラッシュコマンド実行回数」と同じ集計源）
    から、自動起動（disable-model-invocation: false でモデルが自発的に呼んだ回数）は skill_tool_calls
    （Skill ツール呼び出しの input.skill）から引く。ユーザーが `/name` で明示起動した場合は Skill ツールを
    経由しないため両者は排他的に加算できる。
    """
    names = skill_names()
    title = "Skill 別実行回数（.claude/skills/）"
    # commands のキーは <command-name> タグの生値で先頭に "/" を含む（例: "/commit"）。
    # skill_names() はディレクトリ名（無スラッシュ）のため正規化してから引く。
    manual_lookup = Counter()
    for k, v in commands.items():
        manual_lookup[k.lstrip("/")] += v

    # プラグイン由来の Skill は `<プラグイン名>:<スキル名>` で記録される。
    # .claude/skills/ に実体が無いため names に現れず、そのままでは集計から落ちる。
    # コロンを含む呼び出し名を拾って別表にまとめる。
    plugin_names = sorted(
        {k for k in manual_lookup if ":" in k} | {k for k in skill_tool_calls if ":" in k}
    )

    if not names and not plugin_names:
        return f"### {title}\n\n（該当なし）\n"

    def build_rows(targets):
        rows = []
        for name in targets:
            manual = manual_lookup.get(name, 0)
            auto = skill_tool_calls.get(name, 0)
            rows.append((name, manual, auto, manual + auto))
        rows.sort(key=lambda r: (-r[3], r[0]))
        return rows

    header = ["| Skill | 手動(/name) | 自動(Skillツール) | 合計 |", "| --- | --- | --- | --- |"]
    lines = [
        f"### {title}\n",
        "> 手動 = ユーザーが `/name` で明示起動した回数。自動 = モデルが description を見て自発的に起動した回数"
        "（Skill ツール経由）。",
        "",
    ]
    if names:
        lines += header
        for name, manual, auto, total in build_rows(names):
            lines.append(f"| {name} | {manual} | {auto} | {total} |")
        lines.append("")
        lines.append("> 合計0回の Skill は期間内に一度も起動されていない。継続して0回なら削除・統合を検討する。\n")
    else:
        lines.append("（プロジェクトスコープの Skill なし）\n")

    if plugin_names:
        lines.append("### Skill 別実行回数（プラグイン由来）\n")
        lines.append(
            "> `<プラグイン名>:<スキル名>` 形式。マーケットプレイス経由で導入した Skill の利用状況。"
            "実体はプラグインのキャッシュ側にあるため、上の表には現れない。\n"
        )
        lines += header
        for name, manual, auto, total in build_rows(plugin_names):
            lines.append(f"| {name} | {manual} | {auto} | {total} |")
        lines.append("")
    return "\n".join(lines)


def render_workflow_usage(workflow_tool_calls):
    """`.claude/workflows/` 配下の保存済み Workflow を実行回数付きで整形する（0回も明示する）。

    scriptPath 実行で保存済みファイルに一致しないものは ADHOC_WORKFLOW_KEY に集計済み。
    さらに workflow_tool_calls に、現在の `.claude/workflows/*.js` に存在しない名前
    （リネーム・削除済みの可能性）が残っていれば別出しで警告する。
    """
    names = workflow_names()
    title = "Workflow 別実行回数（.claude/workflows/）"
    known = set(names)
    stale = {k: v for k, v in workflow_tool_calls.items() if k not in known and k != ADHOC_WORKFLOW_KEY}
    if not names and not workflow_tool_calls:
        return f"### {title}\n\n（該当なし）\n"
    lines = [f"### {title}\n"]
    if names:
        rows = sorted(names, key=lambda n: (-workflow_tool_calls.get(n, 0), n))
        lines += ["| Workflow | 実行回数 |", "| --- | --- |"]
        for name in rows:
            lines.append(f"| {name} | {workflow_tool_calls.get(name, 0)} |")
        adhoc = workflow_tool_calls.get(ADHOC_WORKFLOW_KEY, 0)
        if adhoc:
            lines.append(f"| {ADHOC_WORKFLOW_KEY} | {adhoc} |")
        lines.append("")
        lines.append("> 合計0回の Workflow は期間内に一度も実行されていない。継続して0回なら削除を検討する。\n")
    else:
        lines.append("（保存済み Workflow なし）\n")
    if stale:
        lines.append(
            "> 現在の `.claude/workflows/` に存在しない実行名"
            "（プラグイン由来 / リネーム・削除済みのいずれか）:\n"
        )
        for name, count in sorted(stale.items(), key=lambda kv: -kv[1]):
            lines.append(f"> - {name}: {count}回")
        lines.append("")
    return "\n".join(lines)


def render_tokens(tok):
    """トークン内訳テーブル（種別ごとの割合付き）とキャッシュ効率コメントを整形する。"""
    order = [("input", "input"), ("output", "output"),
             ("cache_read", "cache_read"), ("cache_creation", "cache_creation")]
    total = sum(tok.get(k, 0) for k, _ in order)
    lines = ["### トークン内訳\n", "| 種別 | トークン | 割合 |", "| --- | --- | --- |"]
    for key, label in order:
        v = tok.get(key, 0)
        pct = (v / total * 100) if total else 0
        lines.append(f"| {label} | {v:,} | {pct:.1f}% |")
    lines.append(f"| **合計** | **{total:,}** | **100%** |")
    lines.append("")
    input_side = tok.get("input", 0) + tok.get("cache_read", 0) + tok.get("cache_creation", 0)
    eff = (tok.get("cache_read", 0) / input_side * 100) if input_side else 0
    lines.append(f"> キャッシュ効率: 入力側トークンの **{eff:.1f}%** がキャッシュ読み出し"
                 f"（高いほど @import やコンテキストの再利用が効いている）\n")
    return "\n".join(lines)


def render_daily(daily):
    """日別ユーザー入力数（typed プロンプト）の ASCII バーチャートを整形する（日付昇順）。"""
    if not daily:
        return "### 日別ユーザー入力数\n\n（該当なし）\n"
    items = sorted(daily.items())
    mx = max(v for _, v in items)
    lines = ["### 日別ユーザー入力数（typed プロンプト / JST）\n", "```text"]
    for d, v in items:
        lines.append(f"{d}  {bar(v, mx):<28} {v}")
    lines.append("```\n")
    return "\n".join(lines)


def render_hourly(hourly):
    """時間帯別(0〜23時)ユーザー入力数（typed プロンプト）の ASCII バーチャートを整形する。0 件の時間は省く。"""
    if not hourly:
        return "### 時間帯別ユーザー入力数\n\n（該当なし）\n"
    mx = max(hourly.values())
    lines = ["### 時間帯別ユーザー入力数（typed プロンプト / JST）\n", "```text"]
    for h in range(24):
        key = f"{h:02d}"
        v = hourly.get(key, 0)
        if v == 0:
            continue
        lines.append(f"{key}時  {bar(v, mx):<28} {v}")
    lines.append("```\n")
    return "\n".join(lines)


def render_models(models):
    """モデル ID を表示名に変換し、モデル別 assistant ターン数のバーチャートを整形する。"""
    # 表示名が重複するモデル ID（例: Haiku 4.5 の日付あり/なし）を合算する。
    # 辞書内包表記だと同名キーが後勝ちで上書きされ、ターン数が欠落するため加算で集約する。
    c = Counter()
    for k, v in models.items():
        c[MODEL_NAME_MAP.get(k, k)] += v
    return render_barlist("モデル別 assistant ターン数", c)


def _model_price(model_id, end):
    """モデル ID の (input, output) USD/1M 単価を返す。未登録は None。

    日付サフィックス付き ID は除去して再検索する。Sonnet 5 は期間 END 日が
    導入価格の終了日以前なら導入価格を返す。
    """
    key = model_id
    price = MODEL_PRICING.get(key)
    if price is None:
        stripped = re.sub(r"-\d{8}$", "", model_id)  # 例: -20251001 を除去
        price = MODEL_PRICING.get(stripped)
        if price is not None:
            key = stripped
    if price is None:
        return None
    if key in SONNET5_INTRO and end <= SONNET5_INTRO_END:
        return SONNET5_INTRO[key]
    return price


def _cost_usd(tok, price):
    """トークン内訳と (input, output) 単価から概算コスト(USD)を算出する。"""
    in_rate, out_rate = price
    return (
        tok.get("input", 0) * in_rate
        + tok.get("output", 0) * out_rate
        + tok.get("cache_creation", 0) * in_rate * CACHE_WRITE_MULT
        + tok.get("cache_read", 0) * in_rate * CACHE_READ_MULT
    ) / 1_000_000


def total_cost_usd(d):
    """モデル別トークンから総概算コスト(USD)を返す（単価未登録モデルは除外）。"""
    end = d["range"]["end"]
    total = 0.0
    for model_id, tok in d.get("tok_by_model", {}).items():
        price = _model_price(model_id, end)
        if price is not None:
            total += _cost_usd(tok, price)
    return total


def render_cost(d):
    """モデル別トークンから概算コスト（推定）を整形する。単価は Anthropic 公式ページ由来。"""
    tbm = d.get("tok_by_model", {})
    end = d["range"]["end"]
    lines = [
        "### コスト試算（推定）\n",
        f"> 推定値。単価は Anthropic 公式の Models overview 由来（{PRICING_ASOF} 時点）、"
        f"円換算は 1 USD = {USD_JPY:.0f} 円で計算（概算値・要更新）。"
        f"cache は書き込み input×{CACHE_WRITE_MULT}（5分TTL）・読み出し input×{CACHE_READ_MULT} で算出。\n",
        "| モデル | input | output | cache作成 | cache読取 | 概算コスト |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    if not tbm:
        return "### コスト試算（推定）\n\n（モデル別トークンなし）\n"
    # 表示名で束ねる（Haiku 4.5 の日付あり/なし ID など、同一表示名の複数 ID を合算）。
    # 単価はモデル ID 単位で引くため、束ねたグループの代表 ID を保持する（同一表示名＝同一単価前提）。
    merged = {}  # 表示名 → [トークン Counter, 代表 model_id]
    for model_id, tok in tbm.items():
        disp = MODEL_NAME_MAP.get(model_id, model_id)
        slot = merged.setdefault(disp, [Counter(), model_id])
        for k, v in tok.items():
            slot[0][k] += v
    total_usd = 0.0
    intro_note = False
    unknown = []
    for disp, (tok, model_id) in sorted(merged.items(), key=lambda kv: -sum(kv[1][0].values())):
        inp, out = tok.get("input", 0), tok.get("output", 0)
        cw, cr = tok.get("cache_creation", 0), tok.get("cache_read", 0)
        price = _model_price(model_id, end)
        if price is None:
            unknown.append(disp)
            lines.append(f"| {disp} | {inp:,} | {out:,} | {cw:,} | {cr:,} | 単価未登録 |")
            continue
        usd = _cost_usd(tok, price)
        total_usd += usd
        if model_id in SONNET5_INTRO and end <= SONNET5_INTRO_END:
            intro_note = True
            disp += " *"
        lines.append(f"| {disp} | {inp:,} | {out:,} | {cw:,} | {cr:,} | ${usd:,.2f}（¥{usd * USD_JPY:,.0f}） |")
    lines.append(f"| **合計** |  |  |  |  | **${total_usd:,.2f}（¥{total_usd * USD_JPY:,.0f}）** |")
    lines.append("")
    if intro_note:
        lines.append(f"> \\* Claude Sonnet 5 は導入価格（input $2.00 / output $10.00・〜{SONNET5_INTRO_END}）を適用。\n")
    if unknown:
        lines.append(f"> 単価未登録: {', '.join(unknown)}。`MODEL_PRICING` に追加すると金額が出ます。\n")
    return "\n".join(lines)


def render_convo(convo):
    """会話密度（聞き返し傾向の素材）テーブルを整形する。"""
    if not convo:
        return "### 会話密度（聞き返し傾向）\n\n（typed プロンプトなし）\n"
    return (
        "### 会話密度（聞き返し傾向）\n\n"
        "| 指標 | 値 |\n| --- | --- |\n"
        f"| typed プロンプト総数 | {convo['typed_total']} |\n"
        f"| セッション数 | {convo['sessions']} |\n"
        f"| セッション平均プロンプト数 | {convo['avg_per_session']} |\n"
        f"| 極短プロンプト（{convo['short_threshold']}文字以下）数 | {convo['short_count']} |\n"
        f"| 極短プロンプト率 | {convo['short_ratio']}% |\n\n"
        "> セッション平均や極短プロンプト率が高いほど、短い往復（聞き返し）が多い傾向。"
        "トークン効率・コスト最適化と、完了時間・手戻り削減の両観点で参照する。\n"
    )


def render_rework(rework):
    """手戻りシグナル（ユーザーの修正・やり直し系プロンプト）テーブルを整形する。"""
    if not rework:
        return "### 手戻りシグナル\n\n（自然言語プロンプトなし）\n"
    lines = [
        "### 手戻りシグナル（やり直し・撤回・訂正の語彙）\n",
        "| 指標 | 値 |",
        "| --- | --- |",
        f"| 自然言語プロンプト数 | {rework['typed_nl_total']} |",
        f"| 手戻りシグナル検出数 | {rework['hit_count']} |",
        f"| 手戻りシグナル率 | {rework['hit_ratio']}% |",
        "",
    ]
    if rework.get("examples"):
        lines.append("検出プロンプト（抜粋）:\n")
        for e in rework["examples"]:
            lines.append(f"- [{e['time']}] {e['text']}")
        lines.append("")
    lines.append(
        "> 語彙マッチのため誤検知・取りこぼしを含む。assistant の出力本文は読めないため、"
        "ユーザーの修正プロンプトから手戻りを推定する材料。完了時間・手戻り削減の観点で参照する。\n"
    )
    return "\n".join(lines)


def render_prompt_stats(ps):
    """typed プロンプト文字数の統計（件数・平均・中央値・最大・最小）テーブルを整形する。"""
    if not ps:
        return "### プロンプト傾向\n\n（typed プロンプトなし）\n"
    return (
        "### プロンプト傾向（typed プロンプトの文字数）\n\n"
        "| 指標 | 値 |\n| --- | --- |\n"
        f"| 件数 | {ps['count']} |\n"
        f"| 平均 | {ps['mean']} 文字 |\n"
        f"| 中央値 | {ps['median']} 文字 |\n"
        f"| 最大 | {ps['max']} 文字 |\n"
        f"| 最小 | {ps['min']} 文字 |\n"
    )



def _promotion_reason(name, count, threshold):
    """エージェント名と起動回数から昇格候補理由を生成する。"""
    ratio = count / threshold
    if ratio >= 3:
        freq = f"高頻度起動（{count}回 / 閾値の{ratio:.0f}倍）"
    elif ratio >= 2:
        freq = f"頻繁に起動（{count}回）"
    else:
        freq = f"繰り返し起動（{count}回）"

    n = name.lower()
    if any(k in n for k in ("commit", "コミット")):
        domain = "コミット作業の定型化候補"
    elif any(k in n for k in ("test", "テスト", "playwright", "e2e")):
        domain = "テスト実行の定型化候補"
    elif any(k in n for k in ("deploy", "デプロイ", "staatic", "s3")):
        domain = "デプロイ作業の定型化候補"
    elif any(k in n for k in ("review", "レビュー", "pr", "pull")):
        domain = "レビュー作業の定型化候補"
    elif any(k in n for k in ("fix", "修正", "bug", "hotfix")):
        domain = "バグ修正パターンの定型化候補"
    elif any(k in n for k in ("research", "調査", "doc", "docs")):
        domain = "調査・ドキュメント作業の定型化候補"
    elif any(k in n for k in ("impl", "implementation", "実装", "feature")):
        domain = "実装作業の定型化候補"
    elif any(k in n for k in ("lint", "format", "check", "static")):
        domain = "静的検査・整形の定型化候補"
    else:
        domain = "繰り返しパターンあり — 名前から用途を確認"

    return f"{freq} / {domain}"


def render_promotion_candidates(agents_counter, threshold, reasons_dict=None):
    """閾値以上のエージェントを昇格候補として整形する。

    テーブルは名前・起動回数・候補理由の 3 列。候補理由は reasons_dict
    （定性パートの PROMOTION_REASONS）があればそれを使い、無ければ
    _promotion_reason() の自動生成にフォールバックする。実際に渡した指示文
    （prompt）は collect の stdout に別途出力されるので、そちらを読んで
    候補理由を書く。
    """
    candidates = {name: count for name, count in agents_counter.items() if count >= threshold}
    header = "### 昇格候補エージェント\n\n"
    if not candidates:
        return header + "（該当なし）\n"
    rows = sorted(candidates.items(), key=lambda x: -x[1])
    lines = [
        header,
        "> エージェントは Agent ツール呼び出し時の description（3〜5語の短い説明）で集計。",
        "> 実際に渡した指示文は collect 実行時の「昇格候補エージェント 関連プロンプト」を参照する。",
        "> 同じ指示で繰り返し生成しているなら `.claude/agents/<name>.md` に昇格させる。",
        "> Workflow スクリプトを再利用するなら `/workflows` → `s` で `.claude/workflows/` に保存する。",
        "",
        "| エージェント | 起動回数 | 候補理由 |",
        "| --- | --- | --- |",
    ]
    for name, count in rows:
        if reasons_dict and name in reasons_dict:
            reason = reasons_dict[name]
        else:
            reason = _promotion_reason(name, count, threshold)
        lines.append(f"| {name} | {count} | {reason} |")
    return "\n".join(lines) + "\n"


def quant_sections(d, reasons_dict=None):
    """定量セクション（python 生成）の dict を返す。"""
    tok = d["tokens"]
    total_tok = sum(tok.get(k, 0) for k in ("input", "output", "cache_read", "cache_creation"))
    cost = total_cost_usd(d)
    highlights = (
        "### ハイライト\n\n"
        "| 指標 | 値 |\n| --- | --- |\n"
        f"| 分析期間 | {d['range']['start']} 〜 {d['range']['end']} |\n"
        f"| 対象セッション数 | {d['sessions']} |\n"
        f"| 総トークン | {total_tok:,} |\n"
        f"| 概算コスト（推定） | ${cost:,.2f}（¥{cost * USD_JPY:,.0f}） |\n"
        f"| typed プロンプト数 | {d['prompt_stats'].get('count', 0)} |\n"
        f"| thinking ブロック数 | {d['thinking']} |\n"
        f"| WebFetch 回数 | {d['webfetch']} |\n"
    )
    return {
        "highlights": highlights,
        "tokens": render_tokens(tok),
        "cost": render_cost(d),
        "convo": render_convo(d.get("convo", {})),
        "rework": render_rework(d.get("rework", {})),
        "models": render_models(d["models"]),
        "daily": render_daily(d["daily"]),
        "hourly": render_hourly(d["hourly"]),
        "tools": render_barlist("ツール使用回数", Counter(d["tools"]), top=15),
        "mcp": render_table("MCP 使用回数", Counter(d["mcp"]), headers=("MCP ツール", "回数")),
        "commands": render_table("Skill / スラッシュコマンド実行回数",
                                 Counter(d["commands"]), headers=("コマンド", "回数")),
        "agents": render_table("サブエージェント起動回数", Counter(d["agents"]), headers=("エージェント", "起動回数")),
        "promotion_candidates": render_promotion_candidates(Counter(d["agents"]), PROMOTION_THRESHOLD, reasons_dict),
        "custom_agents": render_custom_agents(d.get("subagent_types", {})),
        "skill_usage": render_skill_usage(Counter(d["commands"]), Counter(d.get("skill_tool_calls", {}))),
        "workflow_usage": render_workflow_usage(Counter(d.get("workflow_tool_calls", {}))),
        "bash": render_table("Bash コマンド種別", Counter(d["bash_cmds"]),
                             headers=("コマンド", "回数"), top=15),
        "edit_files": render_table("編集ファイル（作業の重心）", Counter(d["edit_files"]),
                                   headers=("ファイル", "編集回数"), top=15),
        "pmodes": render_table("permissionMode 分布", Counter(d["pmodes"]),
                               headers=("モード", "回数")),
        "versions": render_table("Claude Code バージョン分布", Counter(d["versions"]),
                                 headers=("バージョン", "回数")),
        "prompt_stats": render_prompt_stats(d["prompt_stats"]),
    }


# --- サブコマンド -----------------------------------------------------------

def cmd_collect(start, end):
    """collect サブコマンド。集計して一時データ(DATA_FILE)を保存し、定量サマリと typed プロンプト一覧を stdout に出力する。"""
    d = collect_metrics(start, end)
    agent_prompts = d.pop("agent_prompts", {})  # stdout 出力用。DATA_FILE には含めない
    session_themes = d.pop("session_themes", [])  # stdout 出力用。DATA_FILE には含めない
    os.makedirs(out_dir(), exist_ok=True)
    with open(os.path.join(out_dir(), DATA_FILE), "w", encoding="utf-8") as fh:
        json.dump(d, fh, ensure_ascii=False, indent=1)

    sec = quant_sections(d)
    print(f"# 定量サマリ（{start} 〜 {end} / branch: {d['branch']}）\n")
    for key in ["highlights", "tokens", "cost", "models", "daily", "hourly", "tools",
                "mcp", "commands", "agents", "promotion_candidates", "custom_agents",
                "skill_usage", "workflow_usage", "bash", "edit_files", "pmodes",
                "versions", "prompt_stats", "convo", "rework"]:
        print(sec[key])

    print("\n# typed プロンプト一覧（定性分析の素材）\n")
    if not d["prompts"]:
        print("（自然言語プロンプトなし）")
    for i, p in enumerate(d["prompts"], 1):
        text = p["text"]
        if len(text) > PROMPT_CAP:
            text = text[:PROMPT_CAP] + f" …（残り {len(p['text']) - PROMPT_CAP} 文字省略）"
        print(f"--- [{i}] {p['time']} ---\n{text}\n")

    # 昇格候補エージェントの関連プロンプトを出力（PROMOTION_REASONS 執筆の素材）
    candidates = {name: count for name, count in d["agents"].items() if count >= PROMOTION_THRESHOLD}
    if candidates:
        print("\n# 昇格候補エージェント 関連プロンプト（PROMOTION_REASONS 執筆用）\n")
        print("定性分析ファイルに `<!-- PROMOTION_REASONS -->` ブロックを追加し、\n"
              "各エージェントの候補理由を 1 行で書いてください（形式: `エージェント名: 理由`）。\n")
        for name, count in sorted(candidates.items(), key=lambda x: -x[1]):
            agent_ps = agent_prompts.get(name, [])
            print(f"## {name}（{count}回起動）\n")
            if agent_ps:
                for p in agent_ps[-5:]:  # 最新の最大 5 件
                    text = p["text"]
                    if len(text) > 300:
                        text = text[:300] + "…"
                    print(f"[{p['time']}] {text}\n")
            else:
                print("（関連プロンプトなし）\n")

    print("\n# セッションテーマ一覧（作業テーマの気づき用。SUMMARY 執筆の素材）\n")
    print("セッションの自動タイトル（完全一致では重複しないため件数の閾値判定はしない生の一覧）。\n"
          "意味的に似た作業テーマが複数あれば、SUMMARY に「<該当テーマ>の永続カスタムエージェント化を検討」と"
          "1 文添えてください。無ければこの言及自体を省略してください。\n")
    if session_themes:
        for name in session_themes:
            print(f"- {name}")
    else:
        print("（該当なし）")

    print(f"\n# 次のアクション")
    print(f"issue名: {d['issue']}")
    print(f"定性分析を tmp/{d['issue']}/{QUAL_FILE} に Write したのち "
          f"`report {start} {end}` を実行してください。\n"
          f"SUMMARY / PROMPTS に加え、トークン効率・コスト最適化は TOKEN_EFFICIENCY ブロック、"
          f"完了時間・手戻り削減は WORKFLOW_EFFICIENCY ブロック、"
          f"昇格候補理由は PROMOTION_REASONS ブロックを同ファイルに含めてください。")


def cmd_report(start, end):
    """report サブコマンド。一時データと Claude 執筆の定性パートを結合し、タイムスタンプ付きレポートを新規出力する。

    期間は collect 済みデータを正とする（引数とのズレは警告）。出力後に一時ファイルを削除する。
    """
    data_path = os.path.join(out_dir(), DATA_FILE)
    if not os.path.exists(data_path):
        sys.exit(f"エラー: {data_path} が無い。先に `collect {start} {end}` を実行してください。")
    with open(data_path, encoding="utf-8") as fh:
        d = json.load(fh)

    # 期間は collect 済みデータを正とする（引数とのズレは警告）
    d_start, d_end = d["range"]["start"], d["range"]["end"]
    if (d_start, d_end) != (start, end):
        print(f"警告: 引数の期間 {start}〜{end} は collect 済みデータ {d_start}〜{d_end} "
              f"と異なります。データ側の期間でレポートします。", file=sys.stderr)
    start, end = d_start, d_end

    summary_md, prompts_md, token_eff_md, workflow_eff_md = "", "", "", ""
    reasons_dict = {}
    qual_path = os.path.join(out_dir(), QUAL_FILE)
    if os.path.exists(qual_path):
        qual = open(qual_path, encoding="utf-8").read()
        ms, mp = SUMMARY_RE.search(qual), PROMPTS_RE.search(qual)
        mr = PROMOTION_REASONS_RE.search(qual)
        mt = TOKEN_EFFICIENCY_RE.search(qual)
        mw = WORKFLOW_EFFICIENCY_RE.search(qual)
        if ms:
            summary_md = ms.group(1).strip()
        if mp:
            prompts_md = mp.group(1).strip()
        if mt:
            token_eff_md = mt.group(1).strip()
        if mw:
            workflow_eff_md = mw.group(1).strip()
        if mr:
            for line in mr.group(1).strip().splitlines():
                line = line.strip()
                if not line:
                    continue
                name, _, reason = line.partition(":")
                name, reason = name.strip(), reason.strip()
                if name and reason:
                    reasons_dict[name] = reason
        if not any((ms, mp, mt, mr, mw)):  # マーカー無し: 全文を改善提案へ
            prompts_md = qual.strip()

    sec = quant_sections(d, reasons_dict=reasons_dict)
    now = datetime.now(TZ)
    parts = [
        f"# Claude Code 利用分析レポート",
        "",
        f"- 分析期間: {start} 〜 {end}（JST）",
        f"- 対象ブランチ: {d['branch']}",
        f"- 生成日時: {now.strftime('%Y-%m-%d %H:%M:%S')} JST",
        "",
        "## 総評サマリ",
        "",
        summary_md or "（未記入）",
        "",
        "## 利用状況（定量）",
        "",
        sec["highlights"], sec["tokens"], sec["cost"], sec["models"], sec["daily"], sec["hourly"],
        sec["tools"], sec["mcp"], sec["commands"], sec["agents"], sec["promotion_candidates"], sec["custom_agents"],
        sec["skill_usage"], sec["workflow_usage"], sec["bash"],
        sec["edit_files"], sec["pmodes"], sec["versions"], sec["prompt_stats"], sec["convo"], sec["rework"],
        "## トークン効率・コスト最適化",
        "",
        token_eff_md or "（未記入）",
        "",
        "## 完了時間・手戻り削減",
        "",
        workflow_eff_md or "（未記入）",
        "",
        "## プロンプト改善提案",
        "",
        prompts_md or "（未記入）",
        "",
    ]
    report = "\n".join(parts)

    fname = f"your-ai-report-{now.strftime('%Y%m%d_%H%M%S')}.md"
    fpath = os.path.join(out_dir(), fname)
    with open(fpath, "w", encoding="utf-8") as fh:
        fh.write(report)

    # 一時ファイルを掃除
    for tmp in (data_path, qual_path):
        if os.path.exists(tmp):
            os.remove(tmp)

    print(f"レポートを出力しました: {fpath}")


def main():
    """引数を検証し、collect / report サブコマンドへ振り分けるエントリポイント。"""
    if len(sys.argv) != 4 or sys.argv[1] not in ("collect", "report"):
        sys.exit("usage: analyze.py {collect|report} <START YYYY-MM-DD> <END YYYY-MM-DD>")
    sub, start, end = sys.argv[1], sys.argv[2], sys.argv[3]
    try:
        parse_range(start, end)
    except ValueError:
        sys.exit("エラー: 日付は YYYY-MM-DD 形式で指定してください。")
    if sub == "collect":
        cmd_collect(start, end)
    else:
        cmd_report(start, end)


if __name__ == "__main__":
    main()
