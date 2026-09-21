#!/usr/bin/env python3
"""Claude Code セッションログ分析スクリプト（aidd プラグインの ai-report skill）。

機械処理（集計・期間フィルタ・図表生成・ファイル出力）をすべて担う。
分析対象は本リポジトリのログ（cwd から決定論的に導出）。タイムスタンプは
JST(Asia/Tokyo) に換算してフィルタ・集計する。

使い方:
    python3 analyze.py collect <START> <END>   # 集計し stdout へ + 一時データ保存
    python3 analyze.py report  <START> <END>   # 一時データ + 定性分析を結合し新規出力

日付は YYYY-MM-DD。期間は [START 00:00:00, END 23:59:59.999999] JST の閉区間。

実行する外部コマンドは git のみ（いずれも読み取り専用）:
    git rev-parse --show-toplevel      # リポジトリルート（ログディレクトリ名の導出）
    git rev-parse --abbrev-ref HEAD    # 現在のブランチ名（出力先パス）
    git remote get-url origin          # origin URL（同一リポジトリのクローン判定）
    git -C <dir> remote get-url origin # 他クローンの origin URL（同上）
"""
import json
import os
import re
import sys
import glob
import functools
import subprocess
import statistics
from collections import Counter
from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

# Windows の Python には OS 提供の tz データベースが無く、`tzdata` を別途入れていないと
# ZoneInfo("Asia/Tokyo") が ZoneInfoNotFoundError で落ちる。JST は夏時間を持たないため、
# 取れない環境では固定オフセット +09:00 で等価に代替する（追加パッケージを要求しない）。
try:
    TZ = ZoneInfo("Asia/Tokyo")
except ZoneInfoNotFoundError:
    TZ = timezone(timedelta(hours=9), "JST")
CMD_RE = re.compile(r"<command-name>([^<]+)</command-name>")
DATA_FILE = ".ai-report-data.json"
QUAL_FILE = ".ai-report-qualitative.md"
# 定性分析（Claude 執筆）の挿入マーカー
SUMMARY_RE = re.compile(r"<!--\s*SUMMARY\s*-->(.*?)<!--\s*/SUMMARY\s*-->", re.S)
PROMPTS_RE = re.compile(r"<!--\s*PROMPTS\s*-->(.*?)<!--\s*/PROMPTS\s*-->", re.S)
PROMOTION_REASONS_RE = re.compile(r"<!--\s*PROMOTION_REASONS\s*-->(.*?)<!--\s*/PROMOTION_REASONS\s*-->", re.S)
TOKEN_EFFICIENCY_RE = re.compile(r"<!--\s*TOKEN_EFFICIENCY\s*-->(.*?)<!--\s*/TOKEN_EFFICIENCY\s*-->", re.S)
WORKFLOW_EFFICIENCY_RE = re.compile(r"<!--\s*WORKFLOW_EFFICIENCY\s*-->(.*?)<!--\s*/WORKFLOW_EFFICIENCY\s*-->", re.S)
MECHANIZATION_RE = re.compile(r"<!--\s*MECHANIZATION\s*-->(.*?)<!--\s*/MECHANIZATION\s*-->", re.S)
PROMPT_CAP = 1500  # 1 プロンプトあたり stdout へ出す最大文字数
PROMOTION_THRESHOLD = 3  # この回数以上のエージェントを昇格候補として表示する
# しきい値は実測に合わせている。description は毎回書き起こされるため同一タスクでも表記が
# 揺れて回数が積み上がりにくく、10 回に達することがまず無い（2 週間の実ログで最大 4 回）。
# ただし回数だけでは表記の違う同一作業を束ねられないため、関連プロンプトは起動回数に関係なく
# 全エージェント分を出し（AGENT_PROMPT_MAX_AGENTS 件まで）、意味の同一性は読み手が判断する。
AGENT_PROMPT_MAX_AGENTS = 30  # 関連プロンプトを出力するエージェント数の上限
AGENT_PROMPT_PER_AGENT = 3  # 1 エージェントあたり出力するプロンプト数の上限（新しい順）
NO_ATTR_LABEL = "(スキル帰属なし・通常作業)"  # attributionSkill を持たない assistant ターンの表示名
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
# ESC 中断: ユーザーがターンを中断したときにログへ記録される固定文言の前方一致。
# 語彙マッチ（REWORK_PATTERNS）と違いユーザーの言葉遣いに依存しない行動ベースの手戻りシグナル。
INTERRUPT_PREFIX = "[Request interrupted by user"
# Bash コマンド種別の集計でサブコマンドまで連結するパッケージランナー
# （そのままだと `pnpm turbo test` も `pnpm studio` もすべて `pnpm` に潰れるため）。
RUNNER_CMDS = {"pnpm", "npm", "npx", "yarn", "bun"}
# 検証コマンド分類: Bash コマンド全文への substring / 単語境界マッチ。
# `&&` 連結で複数カテゴリに該当する場合はそれぞれに計上する（概算）。
VERIFY_CATEGORIES = [
    ("テスト実行", re.compile(r"vitest|playwright|\btest\b")),
    ("型チェック", re.compile(r"type-check|\btsc\b")),
    ("Lint/Format", re.compile(r"\blint\b|biome")),
    ("ビルド", re.compile(r"\bbuild\b")),
]

# --- 料金設定 ---------------------------------------------------------------
# 単価・為替はスクリプトにもリポジトリにも保持しない。時間経過だけで陳腐化する値なので、
# レポート生成のたびにスキル側（SKILL.md の Step 0）が調べ、collect の --pricing で渡す。
# 渡された値は中間データに載せて report まで引き継ぐ。単価を受け取った collect の実行時刻を
# pricing_asof として同時に記録し、コスト試算の注記に「調査時点」として出す（report を
# 後から実行してもレポート冒頭の生成日時とはズレるため、生成日時では代用できない）。
#
# 単価はモデル ID 単位ではなくファミリー（opus / sonnet / haiku / …）単位で受け取る。
# 世代ごとに ID を列挙させると、新モデルが出た直後のレポートでそのモデルのコストが
# 丸ごと集計から落ちるため。
#
# --pricing に渡す JSON の形式:
#   {"usd_jpy": 159.6,
#    "family": {"opus": [5.0, 25.0], "sonnet": [3.0, 15.0], ...},
#    "intro": {"claude-sonnet-5": {"price": [2.0, 10.0], "until": "2026-08-31"}}}
#
# キャッシュ単価だけは input 単価からの倍率で算出する。価格改定ではなく prompt caching の
# 仕様側の値なので、毎回の調査対象には含めずコードに置く。cache 書き込みは既定 5分TTL=1.25×。
# Claude Code は 1h TTL(2×) の場合もあるが、cache_creation はトークン総量が小さく
# 総額への影響は軽微なため 5分TTL を既定とする。
CACHE_WRITE_MULT = 1.25
CACHE_READ_MULT = 0.10


def parse_pricing(raw):
    """--pricing で渡された JSON 文字列を検証して dict にする。不正なら終了する。"""
    try:
        p = json.loads(raw)
        return {
            "usd_jpy": float(p["usd_jpy"]),
            "family": {k: (float(v[0]), float(v[1])) for k, v in p["family"].items()},
            "intro": {
                k: ((float(v["price"][0]), float(v["price"][1])), v["until"])
                for k, v in (p.get("intro") or {}).items()
            },
        }
    except (json.JSONDecodeError, AttributeError, KeyError, TypeError, ValueError, IndexError) as e:
        sys.exit(f"エラー: --pricing の JSON が不正です（{e}）。")


# --- 行動パターン（仕組み化候補）の抽出 -------------------------------------

# AskUserQuestion の結果に埋め込まれる回答テキスト。'"質問"="回答"' の組を取り出す。
ASK_ANSWER_RE = re.compile(r'"([^"]+)"="([^"]+?)"(?=[,.]|\s*$)')
# 推奨マーカー。回答ラベルの比較時に落とす（同じ選択肢が (Recommended) 付き/無しで記録されるため）
RECOMMEND_RE = re.compile(r'\s*[（(](?:推奨|Recommended|推奨\s*)[)）]\s*$', re.IGNORECASE)
# 質問文の可変部（PR 番号・ブランチ名・件数など）。正規化して同種の質問を束ねる。
QUESTION_VAR_RE = re.compile(r'[（(][^）)]*[)）]|[#0-9A-Za-z_/\.\-]+')

CHAIN_MIN = 5  # この回数以上出現したツール連鎖を「定型パターン」として報告する
REPEAT_CMD_MIN = 3  # この回数以上実行された同一 Bash コマンドを「反復」として報告する
ASK_MIN = 2  # この回数以上聞かれた質問を回答一貫性の判定対象にする


def _cell(text, cap=60):
    """markdown テーブルのセルに安全に入る 1 行テキストへ整形する。"""
    t = re.sub(r"\s+", " ", str(text or "")).replace("|", "\\|").strip()
    return (t[:cap] + "…") if len(t) > cap else t


def _norm_question(q):
    """質問文から可変部を落として同種の質問を束ねるキーを返す。"""
    k = QUESTION_VAR_RE.sub("", q)
    return re.sub(r"\s+", "", k)[:40]


def _norm_answer(a):
    """回答ラベルから推奨マーカーを落として比較可能にする。"""
    return RECOMMEND_RE.sub("", a.split("\n")[0]).strip()


# --- 失敗事由の分類 ---------------------------------------------------------

# tool_result の本文から失敗の事由を推定するパターン（上から順に最初に一致したものを採用）。
REASON_PERMISSION = "権限未許可（許可待ちで中断）"  # allow 追加で消せる事由（サブコマンド内訳の対象）

ERROR_REASON_PATTERNS = [
    ("ユーザーが拒否", ("The user doesn't want", "user rejected", "rejected the tool")),
    ("deny ルールで禁止", ("deny rule", "denied by your permission settings")),
    (REASON_PERMISSION, ("Permission to use", "has been denied", "requires approval")),
    ("auto モード分類器がブロック", ("auto mode classifier", "Blocked by classifier")),
    ("読み込みサイズ上限超過（分割が必要）", ("exceeds maximum allowed tokens",)),
    ("読み込み後にファイルが変更された", ("has been modified since read",)),
    ("未読ファイルへの書き込み", ("has not been read yet",)),
    ("スキルが自動起動不可（ユーザー起動のみ）", ("disable-model-invocation",)),
    ("出力がスキーマ不一致", ("does not match required schema",)),
    ("パス・ファイルが存在しない", ("No such file or directory", "does not exist", "ENOENT")),
    ("コマンドが異常終了", ("Exit code", "command not found", "Traceback")),
    ("タイムアウト", ("timed out", "timeout")),
]


# 権限判定はシェル演算子で割ったサブコマンド単位（各サブコマンドが独立に許可ルールへ一致する必要がある）
DENY_SPLIT_RE = re.compile(r"&&|\|\||;|\|&|\||\n|\$\(|`")
# ヒアドキュメントの中身（Python コード・GraphQL クエリ等）はシェルコマンドではないため、分割前に落とす
HEREDOC_RE = re.compile(r"<<-?\s*['\"]?([A-Za-z_][A-Za-z0-9_]*)['\"]?\s*\n.*?\n\s*\1\s*(?=\n|$)", re.S)
# 複数行にまたがるクォート文字列（python -c の本体・gh api の GraphQL クエリ等）も中身なので落とす
MULTILINE_STR_RE = re.compile(r"'[^']*'|\"[^\"]*\"", re.S)
# コマンド名として妥当な形（変数展開・クォート・波括弧を含むトークンは中身の断片なので捨てる）
CMD_HEAD_RE = re.compile(r"[A-Za-z_][A-Za-z0-9_.+-]*$")
# シェル構文・制御構造。コマンドではないため許可ルールの対象にならない。
# ただし eval / source は権限判定を迂回できるため deny 設定に書かれることがあり、
# その場合は拒否の原因になる（denied_bash_heads() で救う）
SHELL_NOISE_HEADS = frozenset({
    "{", "}", "(", ")", "[", "]", "[[", "]]", "if", "then", "elif", "else", "fi",
    "for", "while", "do", "done", "case", "esac", "exit", "return", "local", "export", "set",
    "break", "continue", "shift", "eval", "source",
})
# 既定ではプロンプトなしに通る読み取り専用コマンド。拒否の原因になりにくいので集計から除くが、
# deny 設定に書いていれば拒否される（denied_bash_heads() で救う）
BUILTIN_READONLY_HEADS = frozenset({
    "ls", "cat", "echo", "pwd", "head", "tail", "grep", "find", "wc", "which",
    "diff", "stat", "du", "cd", "printf", "true",
})
# サブコマンドまで見ないと許可ルールを書けないコマンド（git status と git commit を区別する）
SUBCMD_HEADS = frozenset({
    "git", "gh", "docker", "terraform", "aws", "kubectl", "cargo", "go", "poetry", "uv",
})


def _error_reason(content):
    """tool_result の content から失敗事由のラベルを返す。分類できなければ「その他」。"""
    if isinstance(content, list):
        text = " ".join(
            c.get("text", "") for c in content if isinstance(c, dict)
        )
    else:
        text = content if isinstance(content, str) else ""
    for label, needles in ERROR_REASON_PATTERNS:
        if any(n in text for n in needles):
            return label
    return "その他"


def _settings_files():
    """Claude Code の設定ファイルのパスを列挙する（存在しないものは読み込み側で無視する）。

    公式の設定階層（user / project / local / managed）に対応する。managed は Linux/WSL の
    パスのみ扱う（本リポジトリの開発環境が WSL2 前提のため）。
    """
    home = os.path.expanduser("~")
    root = repo_root()
    return [
        os.path.join(home, ".claude", "settings.json"),
        os.path.join(root, ".claude", "settings.json"),
        os.path.join(root, ".claude", "settings.local.json"),
        "/etc/claude-code/managed-settings.json",
        *sorted(glob.glob("/etc/claude-code/managed-settings.d/*.json")),
    ]


@functools.lru_cache(maxsize=1)
def denied_bash_heads():
    """設定ファイルの permissions.deny から、拒否対象の Bash コマンド名を集める。

    読み取り専用コマンドとシェル構文を集計から除く判定（_deny_subcmd_labels）で使う。
    これらを固定リストで「拒否の原因になり得ない」と決め打つと、`cat` や `eval` を deny して
    いる環境で実際に止まったコマンドがレポートから消え、allow 追加の判断材料が欠ける。
    パターンからコマンド名を特定できないもの（`Bash(*foo*)` 等）は対象外。
    """
    heads = set()
    for path in _settings_files():
        try:
            with open(path, encoding="utf-8") as fh:
                rules = (json.load(fh).get("permissions") or {}).get("deny") or []
        except (OSError, json.JSONDecodeError, AttributeError):
            continue
        for rule in rules:
            if not isinstance(rule, str):
                continue
            m = re.fullmatch(r"Bash\((.*)\)", rule.strip())
            if not m:
                continue
            # `Bash(cat:*)` `Bash(rm -rf *)` のどちらの書式でも先頭のコマンド名まで削る
            head = _bash_head(m.group(1).split(":")[0])
            if head and CMD_HEAD_RE.fullmatch(head):
                heads.add(head)
    return frozenset(heads)


def _deny_subcmd_labels(cmd):
    """Bash コマンドを許可判定の単位（サブコマンド）に割り、[(ラベル, コマンド例)] を出現順で返す。

    ヒアドキュメント・複数行クォートの中身はシェルコマンドではないため落とす。既定でプロンプト
    なしに通る読み取り専用コマンドとシェル構文は除くが、deny 設定に書かれているものは拒否の
    原因になるため残す。同一ラベルは 1 コマンド内で 1 回だけ返す。
    """
    denied = denied_bash_heads()
    # 落とした箇所は省略記号に置き換える（コマンド例として読める形を保つ）
    body = HEREDOC_RE.sub("<<…", cmd or "")
    body = MULTILINE_STR_RE.sub(lambda m: "'…'" if "\n" in m.group(0) else m.group(0), body)
    out, seen = [], set()
    for part in DENY_SPLIT_RE.split(body):
        part = part.strip()
        head = _bash_head(part)
        if not head or not CMD_HEAD_RE.fullmatch(head):
            continue
        if head not in denied and (head in SHELL_NOISE_HEADS or head in BUILTIN_READONLY_HEADS):
            continue
        if head in SUBCMD_HEADS:
            # 先頭の環境変数代入とオプションを飛ばして、最初のサブコマンドを拾う
            sub = next((t for t in part.split()[1:]
                        if re.fullmatch(r"[a-z][a-z0-9-]*", t)), None)
            if sub:
                head = f"{head} {sub}"
        if head in seen:
            continue
        seen.add(head)
        flat = " ".join(part.split())
        out.append((head, flat if len(flat) <= 56 else flat[:56] + "…"))
    return out


def _tally_deny_subcmds(cmd, counter, examples):
    """権限未許可で止まった Bash コマンドを、許可判定の単位（サブコマンド）に割って数える。

    複合コマンドは各サブコマンドが独立に許可ルールへ一致する必要がある一方、どのサブコマンドで
    止まったかはログに残らない。そのため含まれるサブコマンドを全部数える（1 コマンド内の重複は
    1 回だけ数えるため、合計は拒否件数と一致しない）。
    """
    for label, example in _deny_subcmd_labels(cmd):
        counter[label] += 1
        examples.setdefault(label, example)


def _top_reason(counter):
    """「ツール: 事由」Counter から最多の 1 件を「ラベル（件数）」形式で返す。空なら「—」。"""
    if not counter:
        return "—"
    label, count = counter.most_common(1)[0]
    return f"{label}（{count}）"


# --- パス・git ヘルパ -------------------------------------------------------

def projects_root():
    """Claude Code のセッションログ格納ルート（~/.claude/projects）を返す。"""
    return os.path.join(os.path.expanduser("~"), ".claude", "projects")


def _git(*args):
    """git コマンドを実行して stdout を返す。失敗時は None。"""
    try:
        return subprocess.check_output(
            ["git", *args], text=True, stderr=subprocess.DEVNULL
        ).strip() or None
    except Exception:
        return None


@functools.lru_cache(maxsize=1)
def repo_root():
    """リポジトリのルートディレクトリを返す。git 管理外なら cwd。

    `.claude/` 配下（settings / agents / skills / workflows）はリポジトリルート基準に
    置かれるため、cwd ではなくルートから解決する。モノレポのサブディレクトリで
    起動したセッション（`cd apps/web-app && claude` 等）でも同じ結果にするため。
    """
    return _git("rev-parse", "--show-toplevel") or os.getcwd()


def _norm_origin(url):
    """git remote URL を "owner/repo" に正規化する（scp 形式・https 形式の差を吸収）。"""
    if not url:
        return ""
    u = url.strip().rstrip("/")
    if u.endswith(".git"):
        u = u[:-4]
    u = re.sub(r"^[A-Za-z][A-Za-z0-9+.\-]*://", "", u)  # scheme を落とす
    u = u.split("@")[-1]  # user@ を落とす
    parts = [x for x in re.split(r"[:/]+", u) if x]
    return "/".join(parts[-2:]).lower() if len(parts) >= 2 else u.lower()


def _dir_cwd(d):
    """ログディレクトリの jsonl から、そのセッションが動いていた元の cwd（絶対パス）を 1 つ取り出す。

    ディレクトリ名は cwd の "/" を "-" に置換した非可逆エンコードなので復元できないが、
    ログのレコード自体が cwd を絶対パスで持っているためそちらを読む。
    """
    for f in sorted(glob.glob(os.path.join(d, "*.jsonl")), reverse=True)[:5]:
        try:
            with open(f, encoding="utf-8") as fh:
                for i, line in enumerate(fh):
                    if i >= 80:
                        break
                    if '"cwd"' not in line:
                        continue
                    try:
                        cwd = json.loads(line).get("cwd")
                    except Exception:
                        continue
                    if cwd:
                        return cwd
        except Exception:
            continue
    return None


def _enc_key(path):
    """ログディレクトリ名の比較用キー。英数字以外を "-" に潰して表記差を吸収する。

    Claude Code は cwd をディレクトリ名にする際に区切り文字を "-" へ置換するが、
    置換対象の文字種（"/" だけか、ドットやアンダースコアも含むか）に依存しないよう、
    比較する両側を同じ規則で正規化する。ドットを含むホーム（/home/foo.bar/...）でも
    一致するようにするため、"/" のみの置換にはしない。
    """
    return re.sub(r"[^A-Za-z0-9]+", "-", path)


def _own_log_dir(base):
    """cwd に対応するログディレクトリの実パスを返す。見つからなければ推定パスを返す。"""
    key = _enc_key(os.getcwd())
    if os.path.isdir(base):
        for name in sorted(os.listdir(base)):
            d = os.path.join(base, name)
            if os.path.isdir(d) and _enc_key(name) == key:
                return d
    return os.path.join(base, key)


def repo_family_prefix():
    """同一リポジトリのクローン・worktree を束ねる、エンコード済みディレクトリ名の前方一致プレフィックスを返す。

    origin を照合できないディレクトリ（cwd が消えている・git 管理外）向けのフォールバック判定に使う。
    """
    root = repo_root()
    base = os.path.basename(root)
    url = _git("remote", "get-url", "origin") or ""
    repo = os.path.splitext(os.path.basename(url.rstrip("/")))[0] if url else ""
    # 「knowledgebase-2」のようなクローン・worktree 名から接尾辞を落とし、リポジトリ名に寄せる
    if repo and base != repo and base.startswith(repo):
        root = os.path.join(os.path.dirname(root), repo)
    return _enc_key(root)


def log_dirs(explicit=None):
    """走査対象のログディレクトリを [(パス, 判定理由)] で返す（同一リポジトリの全クローン・worktree 分）。

    Claude Code は cwd 単位でログを分けるため、同じリポジトリでもクローン先や worktree ごとに
    別ディレクトリへ記録される。cwd のディレクトリだけでは大半を取りこぼすので、次の順で判定する。

    1. --project-dirs が指定されていればそれだけを使う
    2. 各ディレクトリのログから元の cwd を読み、その cwd の origin が現在のリポジトリと
       一致すれば対象にする（最も確実）
    3. cwd が消えている・git 管理外で origin を照合できない場合のみ、
       ディレクトリ名の前方一致で推定する
    """
    base = projects_root()
    if explicit:
        return [(d if os.path.isabs(d) else os.path.join(base, d), "明示指定")
                for d in explicit]
    own = _own_log_dir(base)
    if not os.path.isdir(base):
        return [(own, "cwd")]

    cur_origin = _norm_origin(_git("remote", "get-url", "origin"))
    prefix = repo_family_prefix()
    picked = []
    for name in sorted(os.listdir(base)):
        d = os.path.join(base, name)
        if not os.path.isdir(d):
            continue
        d_cwd = _dir_cwd(d)
        d_origin = ""
        if d_cwd and os.path.isdir(d_cwd):
            d_origin = _norm_origin(
                _git("-C", d_cwd, "remote", "get-url", "origin")
            )
        if d_origin and cur_origin:
            if d_origin == cur_origin:
                picked.append((d, "origin 一致"))
            continue  # origin が判明していて不一致なら別リポジトリとして除外
        # origin を照合できない場合のみ名前で推定する
        if _enc_key(name).startswith(prefix):
            picked.append((d, "プレフィックス推定"))
    # 判定が外れた場合の保険として cwd 自身のディレクトリは必ず含める
    if os.path.isdir(own) and all(d != own for d, _ in picked):
        picked.append((own, "cwd"))
    return picked or [(own, "cwd")]


def git_branch():
    """現在の git ブランチ名を返す。取得に失敗した場合は "unknown" を返す。"""
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            text=True, stderr=subprocess.DEVNULL,
        ).strip() or "unknown"
    except Exception:
        return "unknown"


def out_dir():
    """レポート出力先ディレクトリ tmp/<ブランチ名>/ のパスを返す。

    commit / pr-create と同じ規約: ブランチ名の `/` は置換せず
    サブディレクトリとして扱う（例: tmp/issues/1449-.../）。
    """
    return os.path.join("tmp", git_branch())


def custom_agent_names():
    """`.claude/agents/` 配下（サブフォルダ含む）の永続カスタムエージェント名一覧を返す。

    識別子（= subagent_type）は frontmatter の `name:`。Claude Code 公式仕様上
    ファイル名と `name` は一致しなくてよいため、frontmatter に無い場合のみ
    ファイル名へフォールバックする。
    """
    names = []
    for p in glob.glob(os.path.join(repo_root(), ".claude", "agents", "**", "*.md"), recursive=True):
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
        for p in glob.glob(os.path.join(repo_root(), ".claude", "skills", "*", "SKILL.md"))
    )


def workflow_names():
    """`.claude/workflows/` 配下の保存済み Workflow スクリプト名一覧を返す（ファイル名 = `meta.name`）。"""
    return sorted(
        os.path.splitext(os.path.basename(p))[0]
        for p in glob.glob(os.path.join(repo_root(), ".claude", "workflows", "*.js"))
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

def collect_metrics(start, end, project_dirs=None):
    """指定期間のログ(*.jsonl)を走査し、全メトリクスと typed プロンプトを集計した dict を返す。

    ログはトップレベル（メインセッション）だけでなく `<sessionId>/subagents/**` 配下
    （サブエージェント・Workflow 起動分。isSidechain=true）も再帰的に走査する。
    トークン・ツール使用は実費・実績としてサブエージェント分も算入し、トークンは
    内訳（side_tokens）を分けて持つ。typed プロンプト系（会話密度・手戻り・日別）は
    promptSource=="typed" のみが対象のため影響を受けない。

    サブエージェント起動回数は Agent ツール呼び出し（tool_use name=="Agent"）の
    description を集計する。agent-name/ai-title はセッション自体の自動タイトルであり
    実際のサブエージェント起動とは無関係（起動0件のセッションでも複数回記録される）のため対象外とする。

    ただし agent-name はセッション単位では「そのセッションが何の作業だったか」を表す
    唯一の手がかりでもある（サブエージェント化・スキル化を検討する際の検索キー）。完全一致で複数セッションに
    またがることは無い（毎回 LLM が新しく言葉を選ぶため）ため、閾値による自動候補判定はせず、
    期間内の一覧だけを素材として返す（意味的な重複判断は collect 実行時の Claude に委ねる）。
    """
    s_dt, e_dt = parse_range(start, end)
    scan_pairs = log_dirs(project_dirs)
    scan_dirs = [d for d, _ in scan_pairs]
    scan_reasons = dict(scan_pairs)
    files = sorted(
        f for d in scan_dirs
        for f in glob.glob(os.path.join(d, "**", "*.jsonl"), recursive=True)
    )
    known_workflow_names = set(workflow_names())

    tok = Counter()
    side_tok = Counter()  # うちサブエージェント・Workflow 分（isSidechain=true）の内訳
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
    session_titles = {}  # sessionId → 最新の agent-name（サブエージェント化・スキル化の気づき用。DATA_FILE には保存しない）
    daily = Counter()
    edit_files = Counter()
    bash_cmds = Counter()
    verify_cmds = Counter()  # 検証コマンド（テスト・型・Lint・ビルド）カテゴリ別実行回数
    pmodes = Counter()
    efforts = Counter()  # assistant ターンの reasoning effort 分布
    attr_turns = Counter()  # attributionSkill → 帰属 assistant ターン数（スキル別コスト帰属）
    attr_tok = {}  # attributionSkill → モデル ID → トークン内訳 Counter（スキル別コスト帰属）
    turn_durs = []  # メインセッションのターン所要時間（durationMs）
    tool_errors = 0  # tool_result の is_error=true 数（失敗した呼び出し＝無駄トークン）
    tool_denials = Counter()  # toolDenialKind 別の権限拒否数
    tool_use_names = {}  # tool_use_id -> ツール名（失敗内訳をツール単位で出すため）
    tool_use_attr = {}  # tool_use_id -> (attributionSkill, サブエージェント実行か)（失敗の発生箇所を出すため）
    tool_use_cmd = {}  # tool_use_id -> Bash コマンド全文（権限未許可のサブコマンド内訳を出すため）
    tool_use_file = {}  # tool_use_id -> ファイル名（Read/Write/Edit の失敗対象を出すため）
    deny_subcmds = Counter()  # 権限未許可で止まったコマンドに含まれるサブコマンド別件数
    deny_examples = {}  # サブコマンド -> 実際のコマンド例
    tool_error_detail = Counter()  # (ツール名, 事由) 別の失敗数
    fail_by_attr = Counter()  # attributionSkill 別の失敗・拒否数（どのスキル実行中に起きたか）
    fail_side_by_attr = Counter()  # うちサブエージェント・Workflow 実行中に起きた数
    fail_reason_by_attr = {}  # attributionSkill -> 「ツール: 事由」別 Counter（最多事由の表示用）
    fail_detail_by_attr = {}  # attributionSkill -> (ツール, 事由, 対象) 別 Counter（発生箇所ごとの内訳）
    ask_answers = {}  # 正規化した質問 → Counter(回答ラベル)（毎回同じ選択＝問いかけ不要の判定）
    ask_samples = {}  # 正規化した質問 → 実際の質問文（表示用の代表例）
    tool_events = []  # (sessionId, dt, ラベル, ファイルパス) の時系列。連鎖・蛇足行動の導出元
    cd_mixed = 0  # cd を混ぜた Bash 呼び出し数（絶対パス指定にすれば消せる蛇足）
    repeat_cmds = Counter()  # 正規化した Bash コマンド全文 → 実行回数（定型化・allow 候補）
    esc_interrupts = 0  # ユーザーの ESC 中断数（固定文言マッチ）
    bash_interrupts = 0  # Bash 実行が中断された数（toolUseResult.interrupted）
    lines_added = 0  # Edit/Write の structuredPatch から集計した追加行数（産出）
    lines_removed = 0
    changed_files = set()
    edits_total = 0  # userModified 判定を持つ Edit/Write 結果の総数
    edits_user_modified = 0  # うちユーザーが手直しした数
    sessions = set()
    prompt_lens = []
    prompts = []  # 定性分析用 typed プロンプト
    rework_hits = []  # 手戻りシグナルに一致した typed プロンプト
    dir_sessions = {d: set() for d in scan_dirs}  # 走査ディレクトリ → 期間内セッション（カバレッジ可視化用）

    for f in files:
        cur_dir = next((d for d in scan_dirs if f.startswith(d + os.sep)), None)
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
                side = bool(o.get("isSidechain"))  # サブエージェント・Workflow 実行分
                if o.get("sessionId") and not side:
                    sessions.add(o["sessionId"])
                    if cur_dir is not None:
                        dir_sessions[cur_dir].add(o["sessionId"])
                if o.get("permissionMode") and not side:
                    pmodes[o["permissionMode"]] += 1
                if o.get("toolDenialKind"):
                    tool_denials[o["toolDenialKind"]] += 1
                if t == "system" and o.get("subtype") == "turn_duration" and not side:
                    ms = o.get("durationMs")
                    if isinstance(ms, (int, float)) and ms > 0:
                        turn_durs.append(ms)
                if t == "assistant":
                    m = o.get("message", {})
                    u = m.get("usage", {})
                    usage = Counter({
                        "input": u.get("input_tokens", 0),
                        "output": u.get("output_tokens", 0),
                        "cache_read": u.get("cache_read_input_tokens", 0),
                        "cache_creation": u.get("cache_creation_input_tokens", 0),
                    })
                    tok += usage
                    if side:
                        side_tok += usage
                    if o.get("effort"):
                        efforts[o["effort"]] += 1
                    attr = (o.get("attributionSkill") or "").strip()
                    if attr:
                        attr_turns[attr] += 1
                    if m.get("model"):
                        models[m["model"]] += 1
                        # モデル別トークン内訳（コスト試算用）
                        tok_by_model.setdefault(m["model"], Counter()).update(usage)
                        if attr:
                            # スキル別コスト帰属（モデル別に積み、report 時に単価を掛ける）
                            attr_tok.setdefault(attr, {}).setdefault(m["model"], Counter()).update(usage)
                    for c in m.get("content", []):
                        if not isinstance(c, dict):
                            continue
                        if c.get("type") == "tool_use":
                            name = c.get("name", "?")
                            inp = c.get("input", {}) or {}
                            tools[name] += 1
                            if c.get("id"):
                                tool_use_names[c["id"]] = name
                                tool_use_attr[c["id"]] = (attr, side)
                                if name == "Bash":
                                    tool_use_cmd[c["id"]] = inp.get("command", "")
                                elif inp.get("file_path"):
                                    tool_use_file[c["id"]] = os.path.basename(inp["file_path"])
                            # 連鎖・蛇足行動の導出元となる時系列イベント
                            ev_label = name
                            if name == "Bash":
                                ev_head = _bash_head(inp.get("command", ""))
                                ev_label = f"Bash({ev_head})" if ev_head else "Bash"
                            tool_events.append(
                                (o.get("sessionId") or "?", dt, ev_label,
                                 inp.get("file_path") or "")
                            )
                            if name.startswith("mcp__"):
                                mcp[name] += 1
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
                                cmd_text = inp.get("command", "")
                                head = _bash_head(cmd_text)
                                if head:
                                    bash_cmds[head] += 1
                                # cd の混入（Claude Code では権限プロンプトを誘発する蛇足）
                                if re.search(r"(^|[;&|]\s*)cd\s", cmd_text):
                                    cd_mixed += 1
                                norm_cmd = re.sub(r"\s+", " ", cmd_text).strip()
                                if norm_cmd:
                                    repeat_cmds[norm_cmd] += 1
                                for cat, cat_re in VERIFY_CATEGORIES:
                                    if cat_re.search(cmd_text):
                                        verify_cmds[cat] += 1
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
                    # ツール結果の失敗（無駄トークン）と実行後メタ（中断・手直し・変更量）
                    if isinstance(content, list):
                        for c in content:
                            if isinstance(c, dict) and c.get("type") == "tool_result" and c.get("is_error"):
                                tool_errors += 1
                                tname = tool_use_names.get(c.get("tool_use_id"), "?")
                                reason = _error_reason(c.get("content"))
                                tool_error_detail[(tname, reason)] += 1
                                # 発生箇所は「その tool_use を出した assistant ターン」の帰属で決める
                                f_attr, f_side = tool_use_attr.get(c.get("tool_use_id"), ("", False))
                                f_label = f_attr or NO_ATTR_LABEL
                                fail_by_attr[f_label] += 1
                                if f_side:
                                    fail_side_by_attr[f_label] += 1
                                fail_reason_by_attr.setdefault(f_label, Counter())[f"{tname}: {reason}"] += 1
                                # 対象は Bash なら先頭のサブコマンド、ファイル系ツールならファイル名。
                                # 1 失敗につき 1 つに決めるため、内訳の合計は件数と一致する。
                                if tname == "Bash":
                                    raw_cmd = tool_use_cmd.get(c.get("tool_use_id"), "")
                                    labels = _deny_subcmd_labels(raw_cmd)
                                    target = labels[0][0] if labels else (_bash_head(raw_cmd) or "—")
                                    if reason == REASON_PERMISSION:
                                        _tally_deny_subcmds(raw_cmd, deny_subcmds, deny_examples)
                                else:
                                    target = tool_use_file.get(c.get("tool_use_id"), "—")
                                fail_detail_by_attr.setdefault(f_label, Counter())[
                                    (tname, reason, target)] += 1
                            # AskUserQuestion の回答（毎回同じ選択なら問いかけ自体が不要）
                            if (isinstance(c, dict) and c.get("type") == "tool_result"
                                    and not c.get("is_error")
                                    and tool_use_names.get(c.get("tool_use_id")) == "AskUserQuestion"):
                                raw = c.get("content")
                                if isinstance(raw, list):
                                    raw = " ".join(x.get("text", "") for x in raw
                                                   if isinstance(x, dict))
                                raw = str(raw or "").split("You can now continue")[0]
                                for q, a in ASK_ANSWER_RE.findall(raw):
                                    key = _norm_question(q)
                                    if not key:
                                        continue
                                    ask_answers.setdefault(key, Counter())[_norm_answer(a)] += 1
                                    ask_samples.setdefault(key, q)
                    tur = o.get("toolUseResult")
                    if isinstance(tur, dict):
                        if tur.get("interrupted"):
                            bash_interrupts += 1
                        if "userModified" in tur:
                            edits_total += 1
                            if tur["userModified"]:
                                edits_user_modified += 1
                        sp = tur.get("structuredPatch")
                        if isinstance(sp, list):
                            for h in sp:
                                if not isinstance(h, dict):
                                    continue
                                for ln in (h.get("lines") or []):
                                    if isinstance(ln, str):
                                        if ln.startswith("+"):
                                            lines_added += 1
                                        elif ln.startswith("-"):
                                            lines_removed += 1
                            if tur.get("filePath"):
                                changed_files.add(tur["filePath"])
                    if not side and INTERRUPT_PREFIX in txt:
                        esc_interrupts += 1
                    for cm in CMD_RE.findall(txt):
                        commands[cm.strip()] += 1
                    if o.get("promptSource") == "typed":
                        prompt_lens.append(len(txt))
                        # 日別はユーザー入力（typed プロンプト）のみを数える
                        daily[dt.strftime("%Y-%m-%d")] += 1
                        # 自然言語プロンプトのみ定性分析へ（コマンド/メタは除外）
                        if txt.strip() and not txt.lstrip().startswith("<"):
                            entry = {"time": dt.strftime("%m-%d %H:%M"), "text": txt}
                            prompts.append(entry)
                            if REWORK_RE.search(txt):
                                rework_hits.append(entry)

    # エージェント別関連プロンプトは時刻順に整列する（昇格候補理由の素材。DATA_FILE には保存しない）
    for ps in agent_prompts.values():
        ps.sort(key=lambda p: p["time"])

    # 期間内セッションのみに絞ったセッションテーマ一覧（サブエージェント化・スキル化の気づき用。DATA_FILE には保存しない）
    session_themes = sorted({title for sid, title in session_titles.items() if sid in sessions})

    pstats = {}
    if prompt_lens:
        pstats = {
            "count": len(prompt_lens),
            "mean": round(statistics.mean(prompt_lens)),
            "median": round(statistics.median(prompt_lens)),
        }

    # 会話密度（聞き返し傾向の素材）: 極短プロンプト率・セッション平均プロンプト数・
    # AskUserQuestion 回数（Claude 側からの事前確認の頻度）
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
            "ask_user": tools.get("AskUserQuestion", 0),
        }

    # 手戻りシグナル（完了時間・手戻り削減の素材）: 語彙マッチ（やり直し・撤回・訂正）と、
    # 行動ベースの中断（ESC 中断・Bash 中断）・再編集集中の 2 本立て。
    # assistant 出力は読めないためユーザー側の行動から推定する。
    # 語彙マッチの分母は自然言語プロンプト数（正規表現は自然言語プロンプトのみに適用するため）。
    rework = {}
    if prompts or esc_interrupts or bash_interrupts:
        max_reedit = max(edit_files.items(), key=lambda kv: kv[1]) if edit_files else None
        rework = {
            "typed_nl_total": len(prompts),
            "hit_count": len(rework_hits),
            "hit_ratio": round(len(rework_hits) / len(prompts) * 100, 1) if prompts else 0,
            "esc_interrupts": esc_interrupts,
            "bash_interrupts": bash_interrupts,
            "max_reedit": max_reedit,  # (ファイル名, 編集回数)
            "examples": [
                {"time": p["time"], "text": " ".join(p["text"][:120].split())}
                for p in rework_hits[:8]
            ],
        }

    # ターン所要時間（完了時間・手戻り削減の素材）: メインセッションの turn_duration イベント
    turns = {}
    if turn_durs:
        turns = {
            "count": len(turn_durs),
            "total_ms": round(sum(turn_durs)),
            "mean_ms": round(statistics.mean(turn_durs)),
            "median_ms": round(statistics.median(turn_durs)),
            "max_ms": round(max(turn_durs)),
        }

    # コード変更量（産出）と AI 編集へのユーザー手直し率
    code_output = {
        "lines_added": lines_added,
        "lines_removed": lines_removed,
        "files_changed": len(changed_files),
        "edits_total": edits_total,
        "edits_user_modified": edits_user_modified,
    }

    # ツール失敗・権限拒否（無駄トークンと権限設定の摩擦）
    tool_health = {
        "calls_total": sum(tools.values()),
        "errors": tool_errors,
        "denials": dict(tool_denials),
        "error_detail": [
            {"tool": k[0], "reason": k[1], "count": v}
            for k, v in sorted(tool_error_detail.items(), key=lambda kv: (-kv[1], kv[0]))
        ],
        "deny_subcmds": [
            {"cmd": k, "count": v, "example": deny_examples.get(k, "")}
            for k, v in sorted(deny_subcmds.items(), key=lambda kv: (-kv[1], kv[0]))
        ],
        "error_by_attr": [
            {"attr": k, "count": v, "side": fail_side_by_attr.get(k, 0),
             "top_reason": _top_reason(fail_reason_by_attr.get(k))}
            for k, v in sorted(fail_by_attr.items(), key=lambda kv: (-kv[1], kv[0]))
        ],
        "error_detail_by_attr": [
            {"attr": a, "tool": t, "reason": r, "target": g, "count": c}
            for a, _ in sorted(fail_by_attr.items(), key=lambda kv: (-kv[1], kv[0]))[:5]
            for (t, r, g), c in fail_detail_by_attr.get(a, Counter()).most_common(3)
        ],
    }

    # --- 行動パターン（仕組み化候補）の導出 --------------------------------
    # ツール連鎖・蛇足行動はツール呼び出しの「並び」から出るため、集計ループ後に時系列で処理する。
    tool_events.sort(key=lambda e: (e[0], e[1]))
    chains = Counter()
    consecutive_edits = 0  # 同一ファイルへの連続 Edit（間に検証を挟まない＝まとめられる余地）
    reread_after_edit = 0  # 編集直後の同一ファイル再 Read（ハーネスが不要としている行動）
    read_counts = Counter()  # (sessionId, ファイル) → Read 回数（重複読み込み）
    prev = None  # (sessionId, ラベル, ファイル)
    just_edited = {}  # sessionId → 直前に編集したファイルの集合
    for sid, _dt, label, fpath in tool_events:
        # 同一ラベルの連続（Edit → Edit 等）は「連鎖」ではなく単なる反復であり、
        # 蛇足行動セクションで別に数えているため除外する。
        if prev and prev[0] == sid and prev[1] != label:
            chains[(prev[1], label)] += 1
        if label in ("Edit", "Write"):
            if prev and prev[0] == sid and prev[1] in ("Edit", "Write") and prev[2] == fpath and fpath:
                consecutive_edits += 1
            just_edited.setdefault(sid, set()).add(fpath)
        elif label == "Read" and fpath:
            read_counts[(sid, fpath)] += 1
            if fpath in just_edited.get(sid, ()):
                reread_after_edit += 1
                just_edited[sid].discard(fpath)
        prev = (sid, label, fpath)
    duplicate_reads = sum(v - 1 for v in read_counts.values() if v > 1)

    # 質問の回答一貫性（毎回同じ選択＝問いかけ自体が不要の候補）
    ask_consistency = sorted(
        (
            {
                "question": ask_samples.get(k, k),
                "total": sum(c.values()),
                "answers": dict(c.most_common()),
                "unanimous": len(c) == 1,
            }
            for k, c in ask_answers.items()
            if sum(c.values()) >= ASK_MIN
        ),
        key=lambda r: (-r["total"], r["question"]),
    )

    mechanization = {
        "ask_consistency": ask_consistency,
        "ask_total": sum(sum(c.values()) for c in ask_answers.values()),
        "chains": [
            {"pair": f"{a} → {b}", "count": n}
            for (a, b), n in chains.most_common(12) if n >= CHAIN_MIN
        ],
        "repeat_cmds": [
            {"cmd": c, "count": n}
            for c, n in repeat_cmds.most_common(10) if n >= REPEAT_CMD_MIN
        ],
        "waste": {
            "cd_mixed": cd_mixed,
            "bash_total": tools.get("Bash", 0),
            "consecutive_edits": consecutive_edits,
            "reread_after_edit": reread_after_edit,
            "duplicate_reads": duplicate_reads,
            "read_total": sum(read_counts.values()),
        },
    }

    # 走査対象ディレクトリとカバレッジ（前方一致で束ねているため、対象は必ずレポートに明示する）
    scan_info = [
        {"dir": os.path.basename(d), "sessions": len(dir_sessions.get(d, ())),
         "reason": scan_reasons.get(d, "")}
        for d in scan_dirs
    ]

    return {
        "range": {"start": start, "end": end},
        "branch": git_branch(),
        "sessions": len(sessions),
        "scan_dirs": scan_info,
        "mechanization": mechanization,
        "tokens": dict(tok),
        "side_tokens": dict(side_tok),
        "tok_by_model": {k: dict(v) for k, v in tok_by_model.items()},
        "attr_turns": dict(attr_turns),
        "attr_tok": {a: {mid: dict(c) for mid, c in mm.items()} for a, mm in attr_tok.items()},
        "convo": convo,
        "rework": rework,
        "turns": turns,
        "code_output": code_output,
        "tool_health": tool_health,
        "models": dict(models),
        "tools": dict(tools),
        "mcp": dict(mcp),
        "commands": dict(commands),
        "agents": dict(agents),
        "subagent_types": dict(subagent_types),
        "skill_tool_calls": dict(skill_tool_calls),
        "workflow_tool_calls": dict(workflow_tool_calls),
        "daily": dict(daily),
        "edit_files": dict(edit_files),
        "bash_cmds": dict(bash_cmds),
        "verify_cmds": dict(verify_cmds),
        "pmodes": dict(pmodes),
        "efforts": dict(efforts),
        "prompt_stats": pstats,
        "prompts": prompts,
        "agent_prompts": agent_prompts,
        "session_themes": session_themes,
    }


def _bash_head(cmd):
    """Bash コマンド先頭の実行コマンド名を取り出す（環境変数代入はスキップ）。

    パッケージランナー（RUNNER_CMDS）は後続の非オプショントークンを最大 2 つ連結して返す
    （`pnpm turbo test` と `pnpm studio` がどちらも `pnpm` に潰れて区別できなくなるのを防ぐ）。
    `--filter <pkg>` の引数はコマンド名ではないためスキップする。
    """
    words = []
    skip_next = False
    for token in (cmd or "").strip().split()[:20]:
        if skip_next:
            skip_next = False
            continue
        if not words:
            if re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", token):
                continue  # 先頭の環境変数代入
            words.append(token.split("/")[-1])
            if words[0] not in RUNNER_CMDS:
                break
            continue
        if token in ("--filter", "-F"):
            skip_next = True
            continue
        if token.startswith("-"):
            continue
        words.append(token)
        if len(words) >= 3:
            break
    return " ".join(words) or None


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

    # プラグイン由来のエージェントは `<プラグイン名>:<エージェント名>` で記録される。
    # .claude/agents/ に実体が無いため names に現れず、そのままでは集計から落ちる。
    plugin_names = sorted({k for k in subagent_types if ":" in k})

    if not names and not plugin_names:
        return f"### {title}\n\n（該当なし）\n"

    lines = []
    if names:
        rows = sorted(names, key=lambda n: (-subagent_types.get(n, 0), n))
        lines += [f"### {title}\n", "| エージェント | 起動回数 |", "| --- | --- |"]
        for name in rows:
            lines.append(f"| {name} | {subagent_types.get(name, 0)} |")
        lines.append("")
        lines.append("> 0回のエージェントは期間内に Agent ツールの subagent_type として一度も指定されていない。"
                     "継続して0回なら削除を検討する。\n")
    else:
        lines.append(f"### {title}\n\n（プロジェクトスコープのエージェントなし）\n")

    if plugin_names:
        lines.append("### 永続カスタムエージェント別起動回数（プラグイン由来）\n")
        lines.append(
            "> `<プラグイン名>:<エージェント名>` 形式。実体はプラグインのキャッシュ側にあるため、"
            "上の表には現れない。呼ばれた分しか記録に残らないため 0 回は検出できない。\n"
        )
        lines += ["| エージェント | 起動回数 |", "| --- | --- |"]
        for name in sorted(plugin_names, key=lambda n: (-subagent_types.get(n, 0), n)):
            lines.append(f"| {name} | {subagent_types.get(name, 0)} |")
        lines.append("")
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
        lines.append("> 現在の `.claude/workflows/` に存在しない実行名（リネーム・削除済みの可能性）:\n")
        for name, count in sorted(stale.items(), key=lambda kv: -kv[1]):
            lines.append(f"> - {name}: {count}回")
        lines.append("")
    return "\n".join(lines)


def render_ask_consistency(mech):
    """質問の回答一貫性（毎回同じ選択＝問いかけ不要の候補）を整形する。"""
    title = "確認プロンプトの回答一貫性"
    rows = (mech or {}).get("ask_consistency") or []
    total = (mech or {}).get("ask_total", 0)
    if not rows:
        return (f"### {title}\n\n（AskUserQuestion の回答が {ASK_MIN} 回以上"
                f"記録された質問なし。総回答数 {total}）\n")
    fixed = [r for r in rows if r["unanimous"]]
    split = [r for r in rows if not r["unanimous"]]
    lines = [f"### {title}\n",
             f"総回答数 {total} 件のうち、同じ質問が {ASK_MIN} 回以上聞かれたものを集計。\n"]
    if fixed:
        lines += ["#### 毎回同じ選択 → 問いかけ自体が不要（既定値にできる）\n",
                  "| 質問（代表例） | 回数 | 常に選ばれた回答 |", "| --- | --- | --- |"]
        for r in fixed:
            ans = next(iter(r["answers"]))
            lines.append(f"| {_cell(r['question'])} | {r['total']} | {_cell(ans, 40)} |")
        lines.append("")
    if split:
        lines += ["#### 回答が分かれる → 聞く価値がある（残すべき）\n",
                  "| 質問（代表例） | 回数 | 回答の分布 |", "| --- | --- | --- |"]
        for r in split:
            dist = " / ".join(f"{_cell(a, 24)}: {n}" for a, n in r["answers"].items())
            lines.append(f"| {_cell(r['question'])} | {r['total']} | {dist} |")
        lines.append("")
    lines.append("> 毎回同じ選択をしている確認は、スキル側で既定値にするか確認自体を削れる"
                 "（該当スキルの SKILL.md から AskUserQuestion の手順を外す）。"
                 "回答が分かれる確認は判断が実際に揺れている箇所なので残す。"
                 "質問文は可変部（PR 番号・ブランチ名など）を落として同種を束ねているため、"
                 "表記が異なる同じ趣旨の質問も同一行に集約される。\n")
    return "\n".join(lines)


def render_mechanization(mech):
    """定型パターン（ツール連鎖・反復コマンド）を整形する。hooks・スクリプト化の候補。"""
    title = "定型パターン（仕組み化の候補）"
    mech = mech or {}
    chains = mech.get("chains") or []
    repeats = mech.get("repeat_cmds") or []
    if not chains and not repeats:
        return f"### {title}\n\n（閾値を超える定型パターンなし）\n"
    lines = [f"### {title}\n"]
    if chains:
        lines += [f"#### 頻出ツール連鎖（{CHAIN_MIN} 回以上・同一セッション内で"
                  f"異なるツールへ移った連続 2 手。同一ツールの反復は蛇足行動側で計上）\n",
                  "| 連鎖 | 回数 |", "| --- | --- |"]
        for r in chains:
            lines.append(f"| {r['pair']} | {r['count']} |")
        lines.append("")
        lines.append("> 「編集 → 特定コマンド」が繰り返されているなら `PostToolUse` hook"
                     "（ツール実行後に任意のコマンドを走らせる仕組み）で自動化できる。"
                     "`settings.json` の `hooks.PostToolUse` に `matcher: \"Edit|Write\"` を書く。\n")
    if repeats:
        lines += [f"#### 反復 Bash コマンド（同一コマンドが {REPEAT_CMD_MIN} 回以上）\n",
                  "| コマンド | 回数 |", "| --- | --- |"]
        for r in repeats:
            lines.append(f"| `{_cell(r['cmd'], 90)}` | {r['count']} |")
        lines.append("")
        lines.append("> 同じコマンドを何度も打っているなら、`permissions.allow` へ追加して"
                     "確認を省くか、スクリプト・custom skill として定型化する候補。\n")
    return "\n".join(lines)


def render_waste(mech):
    """蛇足行動（成果物に影響しない無駄な手数）を整形する。"""
    title = "蛇足行動（品質に影響しない手数）"
    w = (mech or {}).get("waste") or {}
    if not w:
        return f"### {title}\n\n（該当なし）\n"
    bash_total = w.get("bash_total", 0)
    read_total = w.get("read_total", 0)
    cd_pct = (w.get("cd_mixed", 0) / bash_total * 100) if bash_total else 0
    dup_pct = (w.get("duplicate_reads", 0) / read_total * 100) if read_total else 0
    lines = [
        f"### {title}\n",
        "| 行動 | 回数 | なぜ蛇足か |",
        "| --- | --- | --- |",
        f"| `cd` を混ぜた Bash 呼び出し | {w.get('cd_mixed', 0)} / {bash_total}"
        f"（{cd_pct:.1f}%） | Claude Code では複合コマンドの `cd` が権限プロンプトを誘発する。"
        "絶対パス指定に変えれば結果は同じで確認だけ消える |",
        f"| 同一ファイルへの連続 Edit | {w.get('consecutive_edits', 0)} |"
        " 間に検証を挟まない連続編集。1 回の Edit にまとめれば往復が減る |",
        f"| 編集直後の同一ファイル再 Read | {w.get('reread_after_edit', 0)} |"
        " Edit は失敗時にエラーを返すため、確認目的の再読み込みは不要。"
        "読んだ分がそのままコンテキストに乗る |",
        f"| 同一ファイルの重複 Read | {w.get('duplicate_reads', 0)} / {read_total}"
        f"（{dup_pct:.1f}%） | 同じセッション内で同じファイルを読み直した回数。"
        "一度読めばコンテキストに残っている |",
    ]
    lines.append("")
    lines.append("> いずれも「やめても成果物が変わらない」行動に限定している。"
                 "回数が多いものから順に、プロンプトの指示・output styles・"
                 "hooks のいずれで抑えられるかを検討する。\n")
    return "\n".join(lines)


def render_scan_dirs(scan):
    """走査対象のセッションログディレクトリとカバレッジを整形する。"""
    title = "走査対象ログ（カバレッジ）"
    if not scan:
        return f"### {title}\n\n（走査対象なし）\n"
    lines = [f"### {title}\n", "| ログディレクトリ | 期間内セッション | 判定 |",
             "| --- | --- | --- |"]
    for row in scan:
        lines.append(f"| `{row['dir']}` | {row['sessions']} | {row.get('reason', '')} |")
    lines.append("")
    lines.append("> 同一リポジトリでもクローン先・worktree ごとに別ディレクトリへ記録されるため、"
                 "cwd の分だけでは大半を取りこぼす。各ディレクトリのログから元の cwd を読み、"
                 "その cwd の `git remote origin` が現在のリポジトリと一致するものを対象にしている"
                 "（判定「origin 一致」）。cwd が既に消えている・git 管理外で照合できない場合のみ、"
                 "ディレクトリ名の前方一致で推定する（判定「プレフィックス推定」）。\n")
    lines.append("> **意図した作業ディレクトリがこの表に無い場合、その分は集計から漏れている。**"
                 "`--project-dirs <名前> [...]` で明示指定できる。"
                 "逆に無関係な別リポジトリが混ざっている場合も同オプションで絞る。\n")
    return "\n".join(lines)


def render_tokens(tok, side_tok=None):
    """トークン内訳テーブル（種別ごとの割合付き）とキャッシュ効率コメントを整形する。"""
    order = [
        ("input", "input",
         "キャッシュに載らず新規に送信した入力。単価は素の入力単価"),
        ("output", "output",
         "Claude が生成した応答と思考。**単価が最も高い**（入力の約 5 倍）"),
        ("cache_read", "cache_read",
         "キャッシュから再利用した入力。**単価は input の 0.1 倍**なので割合が高いほど安い"),
        ("cache_creation", "cache_creation",
         "キャッシュへ書き込んだ入力。単価は input の 1.25 倍（5分TTL）。以降の再利用で回収する"),
    ]
    total = sum(tok.get(k, 0) for k, _, _ in order)
    lines = ["### トークン内訳\n", "| 種別 | トークン | 割合 | 説明 |",
             "| --- | --- | --- | --- |"]
    for key, label, desc in order:
        v = tok.get(key, 0)
        pct = (v / total * 100) if total else 0
        lines.append(f"| {label} | {v:,} | {pct:.1f}% | {desc} |")
    lines.append(f"| **合計** | **{total:,}** | **100%** | |")
    side_total = sum((side_tok or {}).get(k, 0) for k, _, _ in order)
    if side_total:
        side_pct = side_total / total * 100 if total else 0
        lines.append(f"| うちサブエージェント・Workflow 分 | {side_total:,} | {side_pct:.1f}% |"
                     f" メインの内訳に含まれる再掲。別コンテキストで動いた分 |")
    lines.append("")
    input_side = tok.get("input", 0) + tok.get("cache_read", 0) + tok.get("cache_creation", 0)
    eff = (tok.get("cache_read", 0) / input_side * 100) if input_side else 0
    lines.append(f"> キャッシュ効率: 入力側トークンの **{eff:.1f}%** がキャッシュ読み出し"
                 f"（高いほど @import やコンテキストの再利用が効いている）\n")
    lines.append("> **読み方**: cache_read の割合が高いのは good（同じコンテキストを"
                 "1/10 の単価で再利用できている）。ただし *割合* が良くても *総量* が大きければ"
                 "費用は増えるため、`cache_read ÷ ターン数` で 1 ターンあたりの"
                 "コンテキスト量も見る。output は単価が最も高いので、割合が小さくても"
                 "費用インパクトは割合以上になる。cache_creation の割合が高い場合は"
                 "コンテキストが頻繁に変わって（＝キャッシュが効かず）書き直しが"
                 "発生しているサインで、`/clear` の頻度やファイル読み込みの仕方を見直す余地がある。\n")
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


def _fmt_dur(ms):
    """ミリ秒を「1時間23分」「4分32秒」「12秒」の形式に整形する。"""
    s = round(ms / 1000)
    if s >= 3600:
        return f"{s // 3600}時間{s % 3600 // 60}分"
    if s >= 60:
        return f"{s // 60}分{s % 60}秒"
    return f"{s}秒"


def render_turns(turns):
    """メインセッションのターン所要時間テーブルを整形する（完了時間・手戻り削減の素材）。"""
    title = "ターン所要時間（メインセッション）"
    if not turns:
        return f"### {title}\n\n（turn_duration イベントなし）\n"
    return (
        f"### {title}\n\n"
        "| 指標 | 値 |\n| --- | --- |\n"
        f"| ターン数 | {turns['count']} |\n"
        f"| 合計 | {_fmt_dur(turns['total_ms'])} |\n"
        f"| 平均 | {_fmt_dur(turns['mean_ms'])} |\n"
        f"| 中央値 | {_fmt_dur(turns['median_ms'])} |\n"
        f"| 最長 | {_fmt_dur(turns['max_ms'])} |\n\n"
        "> 1 ターン = ユーザー入力から応答完了まで。平均・中央値が長いほど 1 指示あたりの"
        "作業粒度が大きい（良し悪しではなく、往復回数と合わせて完了時間の観点で読む）。"
        "**ここでの「ターン」はメインセッションのみで、サブエージェント・Workflow 実行分を含まない。**"
        "コスト試算・effort 分布の「ターン数」はサブエージェント分を含むため桁が変わる（母数が別物）。\n"
    )


def render_tool_health(th):
    """ツール失敗・権限拒否テーブルを整形する（無駄トークンと権限設定の摩擦の素材）。"""
    title = "ツール失敗・権限拒否"
    if not th or not th.get("calls_total"):
        return f"### {title}\n\n（ツール呼び出しなし）\n"
    err_pct = th["errors"] / th["calls_total"] * 100
    lines = [
        f"### {title}\n",
        "| 指標 | 値 |",
        "| --- | --- |",
        f"| ツール呼び出し総数 | {th['calls_total']:,} |",
        f"| 失敗（is_error）数 | {th['errors']}（{err_pct:.1f}%） |",
    ]
    for kind, count in sorted((th.get("denials") or {}).items(), key=lambda kv: -kv[1]):
        lines.append(f"| 権限拒否: {kind} | {count} |")
    lines.append("")
    detail = th.get("error_detail") or []
    if detail:
        lines.append("失敗・拒否の内訳（ツール × 事由）:\n")
        lines.append("| ツール | 事由 | 件数 |")
        lines.append("| --- | --- | --- |")
        for row in detail[:12]:
            lines.append(f"| {row['tool']} | {row['reason']} | {row['count']} |")
        if len(detail) > 12:
            lines.append(f"| （他 {len(detail) - 12} 種） | | |")
        lines.append("")
        lines.append("> 事由の読み方: **ユーザーが拒否**＝提案そのものが不要だった"
                     "（確認の設計を見直す）。**deny ルールで禁止 / 権限未許可**＝"
                     "settings.json の allow 追加、またはそのコマンドを使わない手順への"
                     "置き換えで消せる。**パス・ファイルが存在しない**＝前提の思い込みで、"
                     "プロンプト側で対象パスを明示すれば減る。**読み込みサイズ上限超過**＝"
                     "1 ファイルが Read の上限を超えており、`offset` / `limit` での分割や "
                     "`grep` での絞り込みに手順を変える必要がある。**コマンドが異常終了**＝"
                     "実装・環境側の問題で、往復の無駄としては最も正当なもの。\n")
    deny_cmds = th.get("deny_subcmds") or []
    if deny_cmds:
        lines.append("権限未許可で止まった Bash サブコマンド（allow 追加の判断材料）:\n")
        lines.append("| サブコマンド | 件数 | 実際のコマンド例 |")
        lines.append("| --- | --- | --- |")
        for row in deny_cmds[:10]:
            lines.append(f"| `{row['cmd']}` | {row['count']} | `{row['example']}` |")
        if len(deny_cmds) > 10:
            lines.append(f"| （他 {len(deny_cmds) - 10} 種） | | |")
        lines.append("")
        lines.append("> 権限未許可で止まった Bash コマンドを、許可判定の単位（サブコマンド）に"
                     "割って数えたもの。複合コマンドは各サブコマンドが独立に許可ルールへ一致する"
                     "必要がある一方、どのサブコマンドで止まったかはログに残らないため、含まれる"
                     "サブコマンドを全部数えている（1 コマンド内の重複は 1 回。合計は拒否件数と"
                     "一致しない）。既定でプロンプトなしに通る読み取り専用コマンド"
                     "（`ls` `cat` `grep` 等）とシェル構文は除外しているが、settings.json の "
                     "`permissions.deny` に書かれているものは拒否の原因になるため集計に含める。"
                     "許可するなら `settings.json` の `permissions.allow` に `Bash(git status:*)` の形で"
                     "書く（`:*` は末尾ワイルドカードと等価）。ただし削除・上書き系（`rm` `rmdir` 等）は"
                     "まとめて許可せず、確認を残すか対象パスを限定したルールにする。\n")
    by_attr = th.get("error_by_attr") or []
    if by_attr:
        lines.append("失敗・拒否の発生箇所（スキル帰属）:\n")
        lines.append("| 発生箇所 | 件数 | うちサブエージェント | 最多の事由 |")
        lines.append("| --- | --- | --- | --- |")
        for row in by_attr[:10]:
            lines.append(f"| {row['attr']} | {row['count']} | {row['side']} | {row['top_reason']} |")
        if len(by_attr) > 10:
            lines.append(f"| （他 {len(by_attr) - 10} 件） | | | |")
        lines.append("")
        lines.append("> 失敗した呼び出しを、それを出した assistant ターンの attributionSkill で束ねたもの"
                     "（＝どのスキルの実行中に起きたか）。特定のスキルに偏っているなら、"
                     "そのスキルの手順側（コマンドの書き方・前提パス・必要な権限）に原因がある。"
                     "「うちサブエージェント」はサブエージェント・Workflow 実行中に起きた分で、"
                     "この場合はスキルの手順ではなくサブエージェントへの指示文を見る。\n")
    detail_attr = th.get("error_detail_by_attr") or []
    if detail_attr:
        lines.append("発生箇所ごとの失敗内訳（上位 5 箇所 × 上位 3 件）:\n")
        lines.append("| 発生箇所 | ツール | 事由 | 対象 | 件数 |")
        lines.append("| --- | --- | --- | --- | --- |")
        for row in detail_attr:
            lines.append(f"| {row['attr']} | {row['tool']} | {row['reason']} | "
                         f"`{row['target']}` | {row['count']} |")
        lines.append("")
        lines.append("> 「対象」は Bash なら許可判定の単位に割った先頭のサブコマンド、"
                     "Read / Write / Edit ならファイル名。1 失敗につき 1 つに決めているため、"
                     "各発生箇所の内訳の合計は上の件数に収まる（上位 3 件までの表示）。"
                     "スキル名と具体的な対象が揃うため、そのスキルの SKILL.md の該当手順"
                     "（実行するコマンド・読むファイルのパス）を直す入口として使う。\n")
    lines.append("> 失敗した呼び出しは往復分のトークンが無駄になる。権限拒否（permission-rule）が"
                 "多い場合は settings.json の allow 追加で再発防止できないか検討する。\n")
    return "\n".join(lines)


def render_code_output(co):
    """コード変更量（産出）と AI 編集へのユーザー手直し率を整形する。"""
    title = "コード変更量（産出）"
    if not co or not (co.get("lines_added") or co.get("lines_removed") or co.get("edits_total")):
        return f"### {title}\n\n（Edit/Write の実行なし）\n"
    lines = [
        f"### {title}\n",
        "| 指標 | 値 |",
        "| --- | --- |",
        f"| 追加行数 | +{co['lines_added']:,} |",
        f"| 削除行数 | -{co['lines_removed']:,} |",
        f"| 変更ファイル数 | {co['files_changed']} |",
    ]
    if co.get("edits_total"):
        mod_pct = co["edits_user_modified"] / co["edits_total"] * 100
        lines.append(f"| AI 編集へのユーザー手直し | {co['edits_user_modified']} / {co['edits_total']} 件（{mod_pct:.1f}%） |")
    lines.append("")
    lines.append("> Edit/Write の実行結果（structuredPatch）から集計した概算。tmp やドキュメント等の"
                 "非プロダクトファイルも含む。ユーザー手直し率が高いほど AI の編集がそのまま受け入れ"
                 "られていない（プロンプトの前提不足の可能性）。"
                 "**トークン量あたりの行数は指標として置かない。**分母にキャッシュ読み出しが入ると"
                 "使い回すほど数値が下がり、スキル整備・調査が主な期間は行数が成果を表さないため"
                 "（費用対効果はコスト試算とこの表を並べて読む）。\n")
    return "\n".join(lines)


def render_verify(verify_cmds):
    """検証コマンド（テスト・型・Lint・ビルド）の実行回数テーブルを整形する。"""
    title = "検証コマンド実行回数"
    if not verify_cmds:
        return (f"### {title}\n\n（検出なし）\n\n"
                "> 期間内にテスト・型チェック・Lint・ビルドの実行が検出されていない。"
                "AI に書かせたコードを検証せずに終えていないか確認する。\n")
    lines = [f"### {title}\n", "| カテゴリ | 実行回数 |", "| --- | --- |"]
    for cat, _ in VERIFY_CATEGORIES:
        if cat in verify_cmds:
            lines.append(f"| {cat} | {verify_cmds[cat]} |")
    lines.append("")
    lines.append("> Bash コマンド全文の語彙マッチによる概算（実行回数であり成否は含まない）。"
                 "`&&` 連結は該当カテゴリすべてに計上する。\n")
    return "\n".join(lines)


def render_attr_cost(d):
    """スキル別コスト帰属テーブルを整形する（attributionSkill ベース）。

    Skill 別実行回数（起動回数のみ）と違い「どのスキルがどれだけトークン（＝費用）を
    使ったか」を見る。プラグイン由来スキル（aidd:* 等）も捕捉できる。
    帰属しない通常作業分は「(スキル帰属なし)」として差分で出す。
    """
    title = "スキル別コスト帰属"
    attr_turns = d.get("attr_turns") or {}
    attr_tok = d.get("attr_tok") or {}
    if not attr_turns:
        return f"### {title}\n\n（スキル帰属の assistant ターンなし）\n"
    pricing = d.get("pricing")
    end = d["range"]["end"]

    def _tok_cost(model_map):
        tokens = sum(sum(c.values()) for c in model_map.values())
        cost = None
        if pricing:
            cost = 0.0
            for model_id, c in model_map.items():
                price = _model_price(model_id, end, pricing)
                if price is not None:
                    cost += _cost_usd(c, price)
        return tokens, cost

    rows = []
    for skill, turns in attr_turns.items():
        tokens, cost = _tok_cost(attr_tok.get(skill, {}))
        rows.append((skill, turns, tokens, cost))
    rows.sort(key=lambda r: -(r[3] if r[3] is not None else r[2]))
    total_tok_all = sum(d["tokens"].get(k, 0) for k in ("input", "output", "cache_read", "cache_creation"))
    attr_tok_sum = sum(r[2] for r in rows)
    total_cost = total_cost_usd(d) if pricing else None
    attr_cost_sum = sum(r[3] for r in rows if r[3] is not None) if pricing else None

    def _cost_cell(cost):
        if not pricing:
            return "（単価未取得）"
        return f"${cost:,.2f}（¥{cost * pricing['usd_jpy']:,.0f}）"

    lines = [
        f"### {title}\n",
        "| スキル | 帰属ターン数 | 帰属トークン | 概算コスト |",
        "| --- | --- | --- | --- |",
    ]
    for skill, turns, tokens, cost in rows:
        lines.append(f"| {skill} | {turns} | {tokens:,} | {_cost_cell(cost)} |")
    rest_tok = max(total_tok_all - attr_tok_sum, 0)
    if pricing and total_cost is not None:
        rest_cost_cell = _cost_cell(max(total_cost - attr_cost_sum, 0.0))
    else:
        rest_cost_cell = "（単価未取得）"
    lines.append(f"| (スキル帰属なし・通常作業) |  | {rest_tok:,} | {rest_cost_cell} |")
    lines.append("")
    lines.append("> assistant ターンの attributionSkill 単位の集計。起動回数が少なくてもコストの"
                 "大きいスキルは中身（手順・読み込むファイル量）の見直し余地がある。\n")
    return "\n".join(lines)


def _model_family(model_id, families):
    """モデル ID から、渡された単価表にあるファミリー名を取り出す。該当が無ければ None。

    ハイフン区切りのトークンで照合するため、新旧どちらの命名
    （claude-opus-5 / claude-3-5-sonnet-20241022）でもファミリーを拾える。
    """
    return next((t for t in model_id.lower().split("-") if t in families), None)


def _display_name(model_id):
    """モデル ID を表示名に整える（claude-opus-4-8 → Opus 4.8）。

    claude・日付サフィックス・バージョン数字を除いた残りをファミリー名とみなす。
    単価表を参照しないので、単価が未取得でも未知のファミリーでも表示名は崩れない。
    想定外の形（<synthetic> など）は元の ID をそのまま返す。
    """
    tokens = [t for t in re.sub(r"-\d{8}$", "", model_id).lower().split("-") if t != "claude"]
    words = [t for t in tokens if not t.isdigit()]
    if len(words) != 1:
        return model_id
    return f"{words[0].capitalize()} {'.'.join(t for t in tokens if t.isdigit())}".strip()


def _intro_price(model_id, end, pricing):
    """期間 END 日に適用される導入価格 ((input, output), 適用終了日) を返す。対象外は None。"""
    entry = pricing["intro"].get(re.sub(r"-\d{8}$", "", model_id))
    if entry and end <= entry[1]:
        return entry
    return None


def _model_price(model_id, end, pricing):
    """モデル ID の (input, output) USD/1M 単価を返す。単価表に無いファミリーは None。"""
    intro = _intro_price(model_id, end, pricing)
    if intro is not None:
        return intro[0]
    return pricing["family"].get(_model_family(model_id, pricing["family"]))


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
    """モデル別トークンから総概算コスト(USD)を返す（単価が引けないモデルは除外）。"""
    pricing = d.get("pricing")
    if not pricing:
        return 0.0
    end = d["range"]["end"]
    total = 0.0
    for model_id, tok in d.get("tok_by_model", {}).items():
        price = _model_price(model_id, end, pricing)
        if price is not None:
            total += _cost_usd(tok, price)
    return total


def render_cost(d):
    """モデル別のターン数・トークン・概算コスト（推定）を整形する。単価はレポート生成時に調べた値。

    サブエージェント・Workflow 実行分のトークンも含む実費ベース。
    単価未取得（--pricing 無し）の場合もモデル別ターン数・トークンの表は出す。
    """
    pricing = d.get("pricing")
    tbm = d.get("tok_by_model", {})
    if not tbm:
        return "### コスト試算（推定）\n\n（モデル別トークンなし）\n"
    usd_jpy = pricing["usd_jpy"] if pricing else None
    # 調査時点は collect が単価を受け取った時刻。無い場合（旧データ）は従来の文面へフォールバックする
    asof = d.get("pricing_asof")
    asof_txt = f"は {asof} 調査時点の値" if asof else "は本レポート生成時に調べた値"
    end = d["range"]["end"]
    lines = ["### コスト試算（推定）\n"]
    if pricing:
        lines.append(
            f"> 推定値。単価・為替{asof_txt}（円換算は 1 USD = {usd_jpy} 円）。"
            f"cache は書き込み input×{CACHE_WRITE_MULT}（5分TTL）・読み出し input×{CACHE_READ_MULT} で算出。"
            "サブエージェント・Workflow 実行分を含む。\n")
    else:
        lines.append("> 単価を取得できなかったためコスト列は省略（`collect` に `--pricing` を渡すと算出される）。\n")
    lines += [
        "| モデル | ターン数（サブエージェント含む） | input | output | cache作成 | cache読取 | 概算コスト |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]
    # ターン数もコストと同じく表示名で束ねる（モデル別 assistant ターン数の旧テーブルを統合）
    turns_by_disp = Counter()
    for model_id, count in (d.get("models") or {}).items():
        turns_by_disp[_display_name(model_id)] += count
    # 表示名で束ねる（Haiku 4.5 の日付あり/なし ID など、同一表示名の複数 ID を合算）。
    # 単価はモデル ID 単位で引くため、束ねたグループの代表 ID を保持する（同一表示名＝同一単価前提）。
    merged = {}  # 表示名 → [トークン Counter, 代表 model_id]
    for model_id, tok in tbm.items():
        # <synthetic> のようにトークンを一切持たない内部レコードは、
        # 表と「単価未登録」警告のノイズにしかならないため除く
        if sum(tok.values()) == 0:
            continue
        disp = _display_name(model_id)
        slot = merged.setdefault(disp, [Counter(), model_id])
        for k, v in tok.items():
            slot[0][k] += v
    total_usd = 0.0
    intro_notes = []  # (表示名, (input, output), 適用終了日)
    unknown = []
    for disp, (tok, model_id) in sorted(merged.items(), key=lambda kv: -sum(kv[1][0].values())):
        inp, out = tok.get("input", 0), tok.get("output", 0)
        cw, cr = tok.get("cache_creation", 0), tok.get("cache_read", 0)
        turns = turns_by_disp.get(disp, 0)
        price = _model_price(model_id, end, pricing) if pricing else None
        if price is None:
            if pricing:
                unknown.append(disp)
            cell = "単価不明" if pricing else "—"
            lines.append(f"| {disp} | {turns} | {inp:,} | {out:,} | {cw:,} | {cr:,} | {cell} |")
            continue
        usd = _cost_usd(tok, price)
        total_usd += usd
        intro = _intro_price(model_id, end, pricing)
        if intro is not None:
            intro_notes.append((disp, intro[0], intro[1]))
            disp += " *"
        lines.append(f"| {disp} | {turns} | {inp:,} | {out:,} | {cw:,} | {cr:,} | ${usd:,.2f}（¥{usd * usd_jpy:,.0f}） |")
    if pricing:
        lines.append(f"| **合計** |  |  |  |  |  | **${total_usd:,.2f}（¥{total_usd * usd_jpy:,.0f}）** |")
    lines.append("")
    for name, (intro_in, intro_out), until in intro_notes:
        lines.append(f"> \\* {name} は導入価格（input ${intro_in:.2f} / output ${intro_out:.2f}・〜{until}）を適用。\n")
    if unknown:
        lines.append(f"> 単価不明: {', '.join(unknown)}。調査時にこのファミリーの単価が取れていません。\n")
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
        f"| 極短プロンプト率 | {convo['short_ratio']}% |\n"
        f"| AskUserQuestion 回数（Claude からの事前確認） | {convo.get('ask_user', 0)} |\n\n"
        "> セッション平均や極短プロンプト率が高いほど、短い往復（聞き返し）が多い傾向。"
        "AskUserQuestion は着手前の前提確認の頻度（多いこと自体は健全だが、プロンプトで前提を"
        "先に与えれば減らせる）。トークン効率・コスト最適化と、完了時間・手戻り削減の両観点で参照する。\n"
    )


def _eval_rework_ratio(ratio):
    """修正語彙の検出率から評価文を返す。"""
    if ratio == 0:
        return "**手戻りなし**。指示の前提が足りており、やり直しを求める発話が出ていない"
    if ratio < 10:
        return "**軽微**。ほぼ一発で通っている"
    if ratio < 25:
        return "**やや多い**。着手前に完成条件・対象ファイルを渡す余地がある"
    return "**多い**。plan mode で着手前に方針を合意する運用を検討したい"


def _eval_interrupts(count, what):
    """中断回数から評価文を返す（what は「ターンを止めた」等の動作説明）。"""
    if count == 0:
        return f"**中断なし**。{what}場面は発生していない"
    if count <= 2:
        return f"**軽微**。{what}のは数回のみで、方針転換によるものも含む"
    if count <= 5:
        return f"**やや多い**。{what}回数が目立つため、指示の粒度を見直す余地がある"
    return f"**多い**。{what}頻度が高く、着手前の合意形成が不足している疑い"


def _eval_reedit(count):
    """最多再編集回数から評価文を返す。"""
    if count <= 3:
        return "**集中なし**。試行錯誤の偏りは見られない"
    if count <= 9:
        return "**やや集中**。同一ファイルでの試行錯誤の可能性"
    return "**集中**。検証手段の不足を疑う（テスト・型チェックの自動化で短縮できる）"


def render_rework(rework):
    """手戻りシグナル（語彙マッチ＋行動ベースの中断・再編集）テーブルを整形する。"""
    if not rework:
        return "### 手戻りシグナル\n\n（自然言語プロンプトなし）\n"
    ratio = rework["hit_ratio"]
    esc = rework.get("esc_interrupts", 0)
    bash_int = rework.get("bash_interrupts", 0)
    lines = [
        "### 手戻りシグナル（修正語彙・中断・再編集）\n",
        "| 指標 | 値 | 評価 |",
        "| --- | --- | --- |",
        f"| 自然言語プロンプト数 | {rework['typed_nl_total']} | 下の各率の母数 |",
        f"| 修正語彙の検出数 | {rework['hit_count']} | — |",
        f"| 修正語彙の検出率 | {ratio}% | {_eval_rework_ratio(ratio)} |",
        f"| ESC 中断（ターン中断）数 | {esc} | {_eval_interrupts(esc, 'ターンを止めた')} |",
        f"| Bash 実行の中断数 | {bash_int} | {_eval_interrupts(bash_int, 'コマンドを止めた')} |",
    ]
    if rework.get("max_reedit"):
        fname, count = rework["max_reedit"]
        lines.append(f"| 最多再編集ファイル | {fname}（{count}回） | {_eval_reedit(count)} |")
    lines.append("")
    if rework.get("examples"):
        lines.append("検出プロンプト（抜粋）:\n")
        for e in rework["examples"]:
            lines.append(f"- [{e['time']}] {e['text']}")
        lines.append("")
    lines.append(
        "> 修正語彙は保守的な語彙マッチで誤検知・取りこぼしを含む。ESC 中断・Bash 中断は"
        "「意図と違う動きを止めた」行動ベースのシグナルで、言葉遣いに依存しない。"
        "同一ファイルへの編集集中は試行錯誤の可能性。assistant の出力本文は読めないため、"
        "いずれもユーザー側の行動から手戻りを推定する材料。完了時間・手戻り削減の観点で参照する。\n"
    )
    return "\n".join(lines)


def render_prompt_stats(ps):
    """typed プロンプト文字数の統計（件数・平均・中央値）テーブルを整形する。"""
    if not ps:
        return "### プロンプト傾向\n\n（typed プロンプトなし）\n"
    return (
        "### プロンプト傾向（typed プロンプトの文字数）\n\n"
        "| 指標 | 値 |\n| --- | --- |\n"
        f"| 件数 | {ps['count']} |\n"
        f"| 平均 | {ps['mean']} 文字 |\n"
        f"| 中央値 | {ps['median']} 文字 |\n"
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
    elif any(k in n for k in ("deploy", "デプロイ", "s3")):
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


def render_promotion_candidates(agents_counter, threshold, reasons_dict=None, top=20):
    """サブエージェント起動回数（description 別）と昇格候補を 1 表に整形する。

    閾値以上の行に「★候補」と候補理由を付ける。候補理由は reasons_dict
    （定性パートの PROMOTION_REASONS）があればそれを使い、無ければ
    _promotion_reason() の自動生成にフォールバックする。実際に渡した指示文
    （prompt）は collect の stdout に別途出力されるので、そちらを読んで
    候補理由を書く。
    """
    header = "### サブエージェント起動回数と昇格候補\n\n"
    if not agents_counter:
        return header + "（該当なし）\n"
    rows = sorted(agents_counter.items(), key=lambda x: -x[1])[:top]
    lines = [
        header,
        "> エージェントは Agent ツール呼び出し時の description（3〜5語の短い説明）で集計。"
        "**description は起動ごとに書き起こされるため、同じ作業でも表記が揺れて別行になる**"
        "（「単価と為替を調査」と「Research pricing and USD/JPY」が別行になる等）。"
        "回数だけで判断せず、意味が同じ行は読み手が束ねて評価する。",
        f"> {threshold} 回以上を昇格候補（★）とする。実際に渡した指示文は collect 実行時の"
        "「Agent 起動の関連プロンプト」を参照する。",
        "> 同じ指示で繰り返し生成しているなら `.claude/agents/<name>.md` に昇格させる。",
        "> Workflow スクリプトを再利用するなら `/workflows` → `s` で `.claude/workflows/` に保存する。",
        "",
        "| エージェント | 起動回数 | 昇格 | 候補理由 |",
        "| --- | --- | --- | --- |",
    ]
    # 閾値未満でも、定性パートに理由が書かれていれば表示する。閾値に届く
    # エージェントが 1 つも無いと書いた内容が丸ごと捨てられてしまうため。
    written = reasons_dict or {}
    used = set()
    for name, count in rows:
        reason = written.get(name, "")
        if reason:
            used.add(name)
        if count < threshold:
            lines.append(f"| {name} | {count} |  | {_cell(reason)} |")
            continue
        lines.append(f"| {name} | {count} | ★候補 | "
                     f"{_cell(reason or _promotion_reason(name, count, threshold))} |")
    # 名前が一致せず反映できなかった記述は、黙って落とさず残骸として明示する
    leftover = sorted(set(written) - used)
    if leftover:
        lines.append("")
        lines.append("> 定性パートの PROMOTION_REASONS に記述があったが、起動記録の"
                     f"エージェント名と一致しなかったため未反映: {', '.join(leftover)}")
    return "\n".join(lines) + "\n"


# cmd_collect / cmd_report で共有する定量セクションの出力順
SECTION_ORDER = [
    "highlights", "scan_dirs", "tokens", "cost", "daily", "turns", "tools", "tool_health", "verify",
    "mcp", "commands", "promotion_candidates", "custom_agents",
    "skill_usage", "attr_cost", "workflow_usage", "bash",
    "edit_files", "code_output", "pmodes", "efforts", "prompt_stats", "convo", "rework",
    "ask_consistency", "mechanization", "waste",
]


def quant_sections(d, reasons_dict=None):
    """定量セクション（python 生成）の dict を返す。"""
    tok = d["tokens"]
    pricing = d.get("pricing")
    total_tok = sum(tok.get(k, 0) for k in ("input", "output", "cache_read", "cache_creation"))
    cost = total_cost_usd(d)
    cost_cell = f"${cost:,.2f}（¥{cost * pricing['usd_jpy']:,.0f}）" if pricing else "（単価未取得）"
    turns = d.get("turns") or {}
    turns_cell = (f"{turns['count']} ターン / {_fmt_dur(turns['total_ms'])}"
                  if turns else "（turn_duration なし）")
    co = d.get("code_output") or {}
    code_cell = (f"+{co.get('lines_added', 0):,} / -{co.get('lines_removed', 0):,} 行"
                 f"（{co.get('files_changed', 0)} ファイル）")
    highlights = (
        "### ハイライト\n\n"
        "| 指標 | 値 |\n| --- | --- |\n"
        f"| 分析期間 | {d['range']['start']} 〜 {d['range']['end']} |\n"
        f"| 対象セッション数 | {d['sessions']} |\n"
        f"| 総ターン数（メインのみ）/ 合計所要時間 | {turns_cell} |\n"
        f"| 総トークン（サブエージェント含む） | {total_tok:,} |\n"
        f"| 概算コスト（推定） | {cost_cell} |\n"
        f"| typed プロンプト数 | {d['prompt_stats'].get('count', 0)} |\n"
        f"| コード変更量 | {code_cell} |\n"
        "\n"
        "> **typed プロンプト数**とは、期間内のセッションでユーザーが入力した指示の件数"
        "（スキル実行・`!` のコマンド実行・ツール実行結果は含まない）。単体ではなく比で読む指標で、"
        "`総トークン ÷ typed プロンプト数` は 1 指示あたりの消費量、"
        "`typed プロンプト数 ÷ セッション数` は会話密度（聞き返しの多さ）を表す。\n"
    )
    edit_files_md = render_table("編集ファイル（作業の重心）", Counter(d["edit_files"]),
                                 headers=("ファイル", "編集回数"), top=15)
    if d["edit_files"]:
        edit_files_md += ("\n> 同一ファイルへの編集集中（1 ファイル多数回）は試行錯誤の可能性。"
                          "手戻りシグナルの「最多再編集ファイル」と合わせて読む。\n")
    return {
        "highlights": highlights,
        "scan_dirs": render_scan_dirs(d.get("scan_dirs") or []),
        "tokens": render_tokens(tok, d.get("side_tokens")),
        "cost": render_cost(d),
        "convo": render_convo(d.get("convo", {})),
        "rework": render_rework(d.get("rework", {})),
        "ask_consistency": render_ask_consistency(d.get("mechanization", {})),
        "mechanization": render_mechanization(d.get("mechanization", {})),
        "waste": render_waste(d.get("mechanization", {})),
        "turns": render_turns(turns),
        "tool_health": render_tool_health(d.get("tool_health", {})),
        "verify": render_verify(d.get("verify_cmds", {})),
        "code_output": render_code_output(co),
        "attr_cost": render_attr_cost(d),
        "daily": render_daily(d["daily"]),
        "tools": render_barlist("ツール使用回数", Counter(d["tools"]), top=15),
        "mcp": render_table("MCP 使用回数", Counter(d["mcp"]), headers=("MCP ツール", "回数")),
        "commands": render_table("Skill / スラッシュコマンド実行回数",
                                 Counter(d["commands"]), headers=("コマンド", "回数")),
        "promotion_candidates": render_promotion_candidates(Counter(d["agents"]), PROMOTION_THRESHOLD, reasons_dict),
        "custom_agents": render_custom_agents(d.get("subagent_types", {})),
        "skill_usage": render_skill_usage(Counter(d["commands"]), Counter(d.get("skill_tool_calls", {}))),
        "workflow_usage": render_workflow_usage(Counter(d.get("workflow_tool_calls", {}))),
        "bash": render_table("Bash コマンド種別", Counter(d["bash_cmds"]),
                             headers=("コマンド", "回数"), top=15),
        "edit_files": edit_files_md,
        "pmodes": render_table("permissionMode 分布", Counter(d["pmodes"]),
                               headers=("モード", "回数")),
        "efforts": render_table("effort 分布（assistant ターン / サブエージェント含む）",
                                Counter(d.get("efforts", {})),
                                headers=("effort", "ターン数"))
        + ("\n> effort を持たないモデル（Haiku 等）のターンは構造的に集計から落ちるため、"
           "合計はコスト試算のターン数と一致しない。ハイライトの総ターン数は"
           "メインセッションのみの別集計。\n" if d.get("efforts") else ""),
        "prompt_stats": render_prompt_stats(d["prompt_stats"]),
    }


# --- サブコマンド -----------------------------------------------------------

def cmd_collect(start, end, pricing, project_dirs=None):
    """collect サブコマンド。集計して一時データ(DATA_FILE)を保存し、定量サマリと typed プロンプト一覧を stdout に出力する。

    単価は --pricing で受け取り、中間データに載せて report まで引き継ぐ。
    レポート 1 本を通して同じ単価で計算するため、report 側で調べ直さない。
    """
    d = collect_metrics(start, end, project_dirs)
    d["pricing"] = pricing
    d["pricing_asof"] = datetime.now(TZ).strftime("%Y-%m-%d %H:%M JST") if pricing else None
    agent_prompts = d.pop("agent_prompts", {})  # stdout 出力用。DATA_FILE には含めない
    session_themes = d.pop("session_themes", [])  # stdout 出力用。DATA_FILE には含めない
    os.makedirs(out_dir(), exist_ok=True)
    with open(os.path.join(out_dir(), DATA_FILE), "w", encoding="utf-8") as fh:
        json.dump(d, fh, ensure_ascii=False, indent=1)

    sec = quant_sections(d)
    print(f"# 定量サマリ（{start} 〜 {end} / branch: {d['branch']}）\n")
    for key in SECTION_ORDER:
        print(sec[key])

    print("\n# typed プロンプト一覧（定性分析の素材）\n")
    if not d["prompts"]:
        print("（自然言語プロンプトなし）")
    for i, p in enumerate(d["prompts"], 1):
        text = p["text"]
        if len(text) > PROMPT_CAP:
            text = text[:PROMPT_CAP] + f" …（残り {len(p['text']) - PROMPT_CAP} 文字省略）"
        print(f"--- [{i}] {p['time']} ---\n{text}\n")

    # Agent 起動の関連プロンプトを出力（PROMOTION_REASONS 執筆の素材）。
    # 起動回数で絞らないのは、description が毎回書き起こされて表記が揺れるため、
    # 回数で門番すると「1 回 × 複数行」に散った同一作業が判断材料に出てこないから。
    agents_all = sorted(d["agents"].items(), key=lambda x: (-x[1], x[0]))
    if agents_all:
        shown = agents_all[:AGENT_PROMPT_MAX_AGENTS]
        print("\n# Agent 起動の関連プロンプト（PROMOTION_REASONS 執筆用）\n")
        print("定性分析ファイルに `<!-- PROMOTION_REASONS -->` ブロックを追加し、\n"
              "候補理由を 1 行で書いてください（形式: `エージェント名: 理由`）。\n")
        print(f"**表記が違うだけの同一作業は複数行に散っています**"
              f"（例: 「単価と為替を調査」と「Research pricing and USD/JPY」）。\n"
              f"下のプロンプト本文を読んで意味で束ね、束ねた各行に同じ理由を書いてください"
              f"（理由文に合計回数を添える）。起動回数 {PROMOTION_THRESHOLD} 回以上の行には"
              f"レポート側で ★ が付きますが、★ が無い行にも理由を書けます。\n")
        for name, count in shown:
            agent_ps = agent_prompts.get(name, [])
            mark = " ★" if count >= PROMOTION_THRESHOLD else ""
            print(f"## {name}（{count}回起動{mark}）\n")
            if agent_ps:
                for p in agent_ps[-AGENT_PROMPT_PER_AGENT:]:  # 新しい順の上限件数
                    text = p["text"]
                    if len(text) > 300:
                        text = text[:300] + "…"
                    print(f"[{p['time']}] {text}\n")
            else:
                print("（関連プロンプトなし）\n")
        if len(agents_all) > len(shown):
            print(f"（他 {len(agents_all) - len(shown)} エージェントは省略）\n")

    print("\n# セッションテーマ一覧（サブエージェント化・スキル化の気づき用。SUMMARY 執筆の素材）\n")
    print("セッションの自動タイトル（完全一致では重複しないため件数の閾値判定はしない生の一覧）。\n"
          "意味的に似た作業テーマが複数あれば、SUMMARY に「サブエージェント化・スキル化を検討」と"
          "1 文添えてください。無ければこの言及自体を省略してください。\n")
    if session_themes:
        for name in session_themes:
            print(f"- {name}")
    else:
        print("（該当なし）")

    print(f"\n# 次のアクション")
    print(f"出力先: {out_dir()}/")
    print(f"定性分析を {out_dir()}/{QUAL_FILE} に Write したのち "
          f"`report {start} {end}` を実行してください。\n"
          f"SUMMARY / PROMPTS に加え、トークン効率・コスト最適化は TOKEN_EFFICIENCY ブロック、"
          f"完了時間・手戻り削減は WORKFLOW_EFFICIENCY ブロック、"
          f"ワークフローの仕組み化・短縮は MECHANIZATION ブロック、"
          f"昇格候補理由は PROMOTION_REASONS ブロックを同ファイルに含めてください。")


def cmd_report(start, end, pricing=None):
    """report サブコマンド。一時データと Claude 執筆の定性パートを結合し、タイムスタンプ付きレポートを新規出力する。

    期間・単価とも collect 済みデータを正とする（期間の引数とのズレは警告）。
    出力後に一時ファイルを削除する。
    """
    data_path = os.path.join(out_dir(), DATA_FILE)
    if not os.path.exists(data_path):
        sys.exit(f"エラー: {data_path} が無い。先に `collect {start} {end}` を実行してください。")
    with open(data_path, encoding="utf-8") as fh:
        d = json.load(fh)
    if pricing:  # collect 時の単価を差し替えたいときだけ明示的に上書きする
        d["pricing"] = pricing
        d["pricing_asof"] = datetime.now(TZ).strftime("%Y-%m-%d %H:%M JST")

    # 期間は collect 済みデータを正とする（引数とのズレは警告）
    d_start, d_end = d["range"]["start"], d["range"]["end"]
    if (d_start, d_end) != (start, end):
        print(f"警告: 引数の期間 {start}〜{end} は collect 済みデータ {d_start}〜{d_end} "
              f"と異なります。データ側の期間でレポートします。", file=sys.stderr)
    start, end = d_start, d_end

    summary_md, prompts_md, token_eff_md, workflow_eff_md = "", "", "", ""
    mechanization_md = ""
    reasons_dict = {}
    qual_path = os.path.join(out_dir(), QUAL_FILE)
    if os.path.exists(qual_path):
        qual = open(qual_path, encoding="utf-8").read()
        ms, mp = SUMMARY_RE.search(qual), PROMPTS_RE.search(qual)
        mr = PROMOTION_REASONS_RE.search(qual)
        mt = TOKEN_EFFICIENCY_RE.search(qual)
        mw = WORKFLOW_EFFICIENCY_RE.search(qual)
        mm = MECHANIZATION_RE.search(qual)
        if ms:
            summary_md = ms.group(1).strip()
        if mp:
            prompts_md = mp.group(1).strip()
        if mt:
            token_eff_md = mt.group(1).strip()
        if mw:
            workflow_eff_md = mw.group(1).strip()
        if mm:
            mechanization_md = mm.group(1).strip()
        if mr:
            for line in mr.group(1).strip().splitlines():
                line = line.strip()
                if not line:
                    continue
                # エージェント名自体にコロンを含む（marketplace:research 等）ため、
                # 区切りは「コロン + 半角空白」を優先し、無い場合だけ最後のコロンで割る
                if ": " in line:
                    name, reason = line.split(": ", 1)
                else:
                    name, _, reason = line.rpartition(":")
                name, reason = name.strip(), reason.strip()
                if name and reason:
                    reasons_dict[name] = reason
        if not any((ms, mp, mt, mr, mw, mm)):  # マーカー無し: 全文を改善提案へ
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
        *[sec[key] for key in SECTION_ORDER],
        "## トークン効率・コスト最適化",
        "",
        token_eff_md or "（未記入）",
        "",
        "## 完了時間・手戻り削減",
        "",
        workflow_eff_md or "（未記入）",
        "",
        "## ワークフローの仕組み化・短縮",
        "",
        mechanization_md or "（未記入）",
        "",
        "## プロンプト改善提案",
        "",
        prompts_md or "（未記入）",
        "",
    ]
    report = "\n".join(parts)

    fname = f"your-ai-report-{now.strftime('%Y%m%d-%H%M%S')}.md"
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
    usage = ("usage: analyze.py collect <START YYYY-MM-DD> <END YYYY-MM-DD> [--pricing <JSON>]\n"
             "                          [--project-dirs <NAME> [<NAME> ...]]\n"
             "       analyze.py report  <START YYYY-MM-DD> <END YYYY-MM-DD>")
    argv = sys.argv[1:]
    pricing = None
    project_dirs = None
    if "--project-dirs" in argv:
        i = argv.index("--project-dirs")
        rest = []
        j = i + 1
        while j < len(argv) and not argv[j].startswith("--"):
            rest.append(argv[j])
            j += 1
        if not rest:
            sys.exit(usage)
        project_dirs = rest
        del argv[i:j]
    if "--pricing" in argv:
        i = argv.index("--pricing")
        if i + 1 >= len(argv):
            sys.exit(usage)
        pricing = parse_pricing(argv[i + 1])
        del argv[i:i + 2]
    if len(argv) != 3 or argv[0] not in ("collect", "report"):
        sys.exit(usage)
    sub, start, end = argv
    try:
        parse_range(start, end)
    except ValueError:
        sys.exit("エラー: 日付は YYYY-MM-DD 形式で指定してください。")
    if sub == "collect":
        cmd_collect(start, end, pricing, project_dirs)
    else:
        cmd_report(start, end, pricing)


if __name__ == "__main__":
    main()
