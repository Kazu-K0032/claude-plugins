---
name: ai-report
description: このリポジトリの Claude Code セッションログを分析し、利用状況や改善点を図表付きレポートにする。AI 利用実績の振り返り・トークンコストの棚卸しを求められた時に使用する
model: opus
disable-model-invocation: true
allowed-tools: Bash(date:*), Read, Write(tmp/*/.ai-report-qualitative.md), AskUserQuestion
argument-hint: "[開始日 YYYY-MM-DD] [終了日 YYYY-MM-DD]"
---

# Claude Code 利用分析レポート

カレントディレクトリのプロジェクトのセッションログを指定期間で分析しレポート化する。定量集計・図表生成・ファイル出力は `analyze.py` が担う。Claude の担当は typed プロンプトを読んで定性パート（総評サマリ・トークン効率／コスト最適化・完了時間／手戻り削減・プロンプト改善提案）を書くことだけ。

## 参照ファイル

| ファイル | 役割 |
| --- | --- |
| `${CLAUDE_PLUGIN_ROOT}/skills/ai-report/scripts/analyze.py` | 定量集計・図表生成・レポート出力 |
| `${CLAUDE_PLUGIN_ROOT}/skills/ai-report/output-template.md` | 定性パートの書き方とマーカー形式 |
| `${CLAUDE_PLUGIN_ROOT}/references/ai-research.md` | 未検証値を断定しないための規約 |
| `${CLAUDE_PLUGIN_ROOT}/references/plain-language.md` | 平易化の技法 |

`output-template.md` が「プラグインの `references/...`」と書いている箇所は、上表の実パスに読み替える。

## 前提

セッションログは `~/.claude/projects/<カレントディレクトリのパスをハイフン化した名前>/` から読む。**そのプロジェクトで Claude Code を起動した履歴が無いと対象ゼロになる。** 出力先は `tmp/<ブランチ名>/`。

## 手順

### Step 1: 期間の確定

`$ARGUMENTS` から開始日・終了日（`YYYY-MM-DD`）を両方取れた場合はそのまま使う。

欠けていれば `AskUserQuestion` で次の選択肢を提示する。

1. 今週（月曜〜今日） — 実行日が属する週の月曜から今日まで
2. 過去7日間 — 今日を含む直近7日間
3. 今日だけ
4. 期間を指定（YYYYMMDD〜YYYYMMDD）

選択後、`Bash` で今日の日付を取得して START・END を確定する。

```bash
date +%Y-%m-%d
```

| 選択肢 | START の算出 | END |
| --- | --- | --- |
| 今週 | 今日 - (曜日番号 - 1) 日（月=1, 火=2 … 日=7） | 今日 |
| 過去7日間 | 今日 - 6 日 | 今日 |
| 今日だけ | 今日 | 今日 |
| 期間を指定 | 入力値を `YYYY-MM-DD` 形式に変換（例: `20260601` → `2026-06-01`） | 同左 |

### Step 2: collect

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/ai-report/scripts/analyze.py" collect <START> <END>
```

stdout に定量サマリ・typed プロンプト一覧・ブランチ名が出る。

### Step 3: 定性パートの執筆

typed プロンプト一覧・昇格候補エージェントの関連プロンプト・セッションテーマ一覧を読み、`output-template.md` の「定性パート」に従って `tmp/<ブランチ名>/.ai-report-qualitative.md` を `Write` する。

改善策を出すブロック（`PROMPTS` / `TOKEN_EFFICIENCY` / `WORKFLOW_EFFICIENCY`）では、Claude Code の標準機能・設定で仕組み化できないかを必ず 1 軸として検討し、機能の現在仕様は技術調査（`research` skill / `aidd-research` エージェント）・公式ドキュメントで裏取りする（`output-template.md` の「改善提案の共通軸」）。

- `SUMMARY` / `PROMPTS` ブロック: typed プロンプト一覧から良い点・改善点を執筆する。総評で数値に触れるときは Step 2 の出力をそのまま引用し、推測で作らない。「セッションテーマ一覧」に意味的に似た作業テーマが複数あれば、`agent-promote` での永続エージェント化の検討を SUMMARY に 1 文添える（無ければ言及しない）
- `TOKEN_EFFICIENCY` ブロック: Step 2 の「コスト試算」「トークン内訳」「会話密度」を根拠に、トークン（＝費用）を減らす観点で評価・提案する
- `WORKFLOW_EFFICIENCY` ブロック: Step 2 の「手戻りシグナル」「会話密度」「permissionMode 分布」を根拠に、意図しない実装のやり直しと往復を減らし、タスクを最短で正しく終える観点で評価・提案する（費用の話は TOKEN_EFFICIENCY に譲る）
- `PROMOTION_REASONS` ブロック: Step 2 の「昇格候補エージェント 関連プロンプト」セクションを読み、各候補の理由を 1 行で書く

各ブロックの詳細ルールは `output-template.md` の該当セクションを参照する。

### Step 4: report

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/ai-report/scripts/analyze.py" report <START> <END>
```

レポートを `tmp/<ブランチ名>/your-ai-report-<yyyymmdd_hhmmss>.md` に出力する。stdout の出力パスをユーザーに報告する。

> 注意: `report` は `collect` が書く中間データ `.ai-report-data.json` と定性パート `.ai-report-qualitative.md` を読み、生成後に両ファイルを削除する（consume-and-delete）。このため Step 3 の `Write` を完了させてから Step 4 を実行する（同一メッセージで並列実行しない。並列だと定性パートを読む前に走り「（未記入）」になる）。定性が「（未記入）」になる・`report` が「`.ai-report-data.json` が無い」で失敗する場合は、Step 2 の `collect` からやり直す（単独の `report` 再実行では直らない）。

## プラグイン由来コンポーネントの扱い

`analyze.py` は `.claude/agents/`・`.claude/skills/`・`.claude/workflows/` を走査してプロジェクト側のコンポーネント一覧を作る。マーケットプレイス経由で導入した Skill は実体がプラグインのキャッシュ側にあるため、この一覧には現れない。

そのため呼び出し名にコロンを含むもの（`<プラグイン名>:<スキル名>`）を別表「Skill 別実行回数（プラグイン由来）」へ集計する。Workflow はプラグイン由来と判別できないため、`.claude/workflows/` に無い実行名として警告欄にまとめて出る。

## 単価・為替の保守

コスト試算の単価は `analyze.py` の `MODEL_PRICING` に定数として持つ。**単価の唯一の情報源は Anthropic 公式の [Models overview](https://platform.claude.com/docs/en/about-claude/models/overview)**（`claude-api` skill のキャッシュ表でも確認できるが、キャッシュ日が古い場合があるため公式ページを正とする）。

新しいモデルが出たら、または単価が変わったら次を更新する。

| 定数 | 内容 |
| --- | --- |
| `MODEL_PRICING` | モデル ID → (input, output) USD / 100万トークン |
| `MODEL_NAME_MAP` | モデル ID → レポート上の表示名 |
| `PRICING_ASOF` | 単価を確認した日 |
| `SONNET5_INTRO` / `SONNET5_INTRO_END` | 期間限定の導入価格 |
| `USD_JPY` / `FX_ASOF` | 円換算レートと設定日 |

未登録のモデルは金額が 0 で計上され、`> 単価未登録: <モデル名>` の警告が出る。この警告が出たら公式ページで単価を確認して追記する。

**推測で単価を書かない**（未検証値を断定しない方針は `${CLAUDE_PLUGIN_ROOT}/references/ai-research.md` を参照）。

## 保守

`allowed-tools` に `analyze.py` の `Bash` パターンを含めていない。プラグインの実体パスは `${CLAUDE_PLUGIN_ROOT}` で解決するが、この変数が `allowed-tools` の frontmatter で展開されるかは公式に記載がないため、当てにせず通常の許可プロンプトを通す。

$ARGUMENTS
