#!/usr/bin/env python3
"""セッションログからエージェント名を一覧表示、または指定名のタスク概要を標準出力する。

引数なし: このプロジェクトのセッションログに含まれるエージェント名を新しい順に一覧表示する
引数あり: その名前で検索し、セッションごとのプロンプトと使用ツールを表示する
"""
import json
import os
import pathlib
import sys
from collections import Counter

# コマンド系の自動メッセージを除外するパターン
_SKIP_PREFIXES = (
    "<local-command-caveat>",
    "<command-name>",
    "<system-reminder>",
)


def _is_typed_prompt(text: str) -> bool:
    text = text.strip()
    if not text:
        return False
    return not any(text.startswith(p) for p in _SKIP_PREFIXES)


def _iter_events(jl: pathlib.Path):
    """JSONL の各行をイベントとして読む。壊れた行は黙って飛ばす。"""
    with open(jl, encoding="utf-8", errors="ignore") as f:
        for line in f:
            try:
                yield json.loads(line)
            except Exception:
                continue


def list_agents(proj_dir: pathlib.Path) -> list[tuple[str, int, float]]:
    """エージェント名ごとに (名前, 出現セッション数, 最新更新時刻) を返す。"""
    counts: Counter = Counter()
    latest: dict[str, float] = {}

    for jl in proj_dir.glob("*.jsonl"):
        mtime = jl.stat().st_mtime
        names = set()
        for ev in _iter_events(jl):
            if ev.get("type") == "agent-name":
                name = ev.get("agentName", "")
                if name:
                    names.add(name)
        for name in names:
            counts[name] += 1
            latest[name] = max(latest.get(name, 0.0), mtime)

    return sorted(
        ((name, count, latest[name]) for name, count in counts.items()),
        key=lambda row: row[2],
        reverse=True,
    )


def find_sessions(proj_dir: pathlib.Path, agent_name: str) -> list[dict]:
    results = []
    for jl in sorted(proj_dir.glob("*.jsonl"), key=lambda f: f.stat().st_mtime, reverse=True):
        last_prompt = None
        first_prompt = None
        titles: list[str] = []
        tools: Counter = Counter()
        turns = 0
        found = False

        for ev in _iter_events(jl):
            etype = ev.get("type", "")

            if etype == "agent-name" and ev.get("agentName") == agent_name:
                found = True
                turns += 1
            elif etype == "last-prompt":
                candidate = ev.get("lastPrompt", "")
                if _is_typed_prompt(candidate):
                    last_prompt = candidate
            elif etype == "ai-title":
                title = ev.get("aiTitle", "")
                if title and (not titles or titles[-1] != title):
                    titles.append(title)

            msg = ev.get("message", {})
            # ユーザーが実際に打ったメッセージ（first_prompt）
            if msg.get("role") == "user" and first_prompt is None:
                for c in msg.get("content", []):
                    if isinstance(c, dict) and c.get("type") == "text":
                        text = c["text"]
                        if _is_typed_prompt(text):
                            first_prompt = text
                        break

            for c in msg.get("content", []):
                if isinstance(c, dict) and c.get("type") == "tool_use":
                    tools[c.get("name", "")] += 1

        if found:
            results.append(
                {
                    "session_id": jl.stem,
                    "turns": turns,
                    "first_prompt": first_prompt or "（取得不可）",
                    "last_prompt": last_prompt or "（取得不可）",
                    "titles": titles[-5:],  # 最新5件のタイトル推移
                    "top_tools": tools.most_common(5),
                }
            )
    return results


def resolve_project_dir() -> pathlib.Path:
    """カレントディレクトリからセッションログの置き場所を導出する。"""
    encoded = os.getcwd().replace("/", "-")
    return pathlib.Path.home() / ".claude" / "projects" / encoded


def print_list(proj_dir: pathlib.Path) -> None:
    agents = list_agents(proj_dir)
    if not agents:
        print("このプロジェクトのセッションログにエージェント名が見つかりませんでした。")
        return

    print(f"=== エージェント名の一覧（新しい順・{len(agents)} 件） ===\n")
    for name, count, _ in agents:
        print(f"  {name}  （{count} セッション）")
    print("\n昇格したい名前を引数に渡して再実行してください。")


def print_detail(proj_dir: pathlib.Path, agent_name: str) -> None:
    results = find_sessions(proj_dir, agent_name)

    if not results:
        print(f"エージェント '{agent_name}' が見つかりませんでした。")
        print("引数なしで実行すると、利用可能な名前を一覧表示します。")
        return

    print(f"=== エージェント: {agent_name} ===")
    print(f"セッション数: {len(results)}\n")

    for r in results:
        print(f"--- セッション: {r['session_id'][:8]}... ({r['turns']} ターン) ---")

        if r["titles"]:
            print(f"セッション内タイトル推移: {' → '.join(r['titles'])}")

        print("\n最初のプロンプト:")
        print(r["first_prompt"][:400])

        print("\n最後のプロンプト:")
        print(r["last_prompt"][:400])

        if r["top_tools"]:
            tools_str = ", ".join(f"{t}({c})" for t, c in r["top_tools"])
            print(f"\n主要ツール: {tools_str}")
        print()


def main() -> None:
    proj_dir = resolve_project_dir()

    if not proj_dir.exists():
        print(f"プロジェクトディレクトリが見つかりません: {proj_dir}")
        sys.exit(1)

    if len(sys.argv) < 2:
        print_list(proj_dir)
    else:
        print_detail(proj_dir, sys.argv[1])


if __name__ == "__main__":
    main()
