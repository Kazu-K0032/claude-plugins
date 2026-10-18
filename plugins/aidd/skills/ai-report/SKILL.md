---
name: ai-report
description: このリポジトリの Claude Code セッションログを分析し、利用状況や改善点を図表付きレポートにする。AI 利用実績の振り返り・トークンコストの棚卸しを求められた時に使用する
model: opus
disable-model-invocation: true
allowed-tools: Bash(date:*), Read, Agent, Edit(tmp/*/.ai-report-qualitative.md), AskUserQuestion
argument-hint: "[開始日 終了日（任意。省略時は期間を質問する。例: 2026-09-01 2026-09-30）]"
---

# Claude Code 利用分析レポート

本リポジトリのセッションログを指定期間で分析しレポート化する。定量集計・図表生成・ファイル出力は `analyze.py` が担い、Claude の担当は typed プロンプトを読んで定性パート（総評サマリ・トークン効率／コスト最適化・完了時間／手戻り削減・ワークフローの仕組み化／短縮・プロンプト改善提案）を書くことだけ。

- 外へ書き込むもの：`tmp/<ブランチ名>/` のレポート `your-ai-report-<YYYYMMDD-HHMMSS>.md`・中間データ `.ai-report-data.json`・定性パート `.ai-report-qualitative.md`
- 人がすること：期間を選ぶ（引数で渡せば不要）。`tmp/` の中間ファイルを削除する

## 参照ファイル

| ファイル | いつ読むか |
| --- | --- |
| `${CLAUDE_PLUGIN_ROOT}/skills/ai-report/scripts/analyze.py` | 手順 2 の `collect` と手順 4 の `report` で実行する（定量集計・図表生成・レポート出力） |
| `${CLAUDE_PLUGIN_ROOT}/skills/ai-report/pricing.md` | 手順 1 で、単価・為替を調べるとき。単価の持ち方を直すとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/ai-report/scan-scope.md` | 手順 2 で、「走査対象ログ（カバレッジ）」に意図しないディレクトリが入った・抜けたとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/ai-report/output-template.md` | 手順 3 で、定性パートを書くとき（マーカー形式・各ブロックの根拠と書き方） |
| `${CLAUDE_PLUGIN_ROOT}/references/ai-research.md` | 手順 3 で、機能の現在仕様や未検証値を書くとき（未検証値を断定しないための規約。`output-template.md` が指す） |
| `${CLAUDE_PLUGIN_ROOT}/references/plain-language.md` | 手順 3 で、機能名に一言添えるとき（平易化の技法。`output-template.md` が指す） |

本文中の `analyze.py` / `output-template.md`、および `output-template.md` が「プラグインの `references/...`」と書いている箇所は、いずれも上表の実パスを指す。

## 想定している引数

`$ARGUMENTS` から開始日・終了日（`YYYY-MM-DD`）を両方取れた場合はそのまま使う。

欠けていれば `AskUserQuestion` で次の選択肢を提示する：

1. 今週（月曜〜今日） — 実行日が属する週の月曜から今日まで
1. 過去7日間 — 今日を含む直近7日間
1. 今日だけ
1. 期間を指定（`YYYY-MM-DD` `YYYY-MM-DD`）

選択後、`Bash` で今日の日付を取得して START・END を確定する。

```bash
date +%Y-%m-%d
```

| 選択肢 | START の算出 | END |
| --- | --- | --- |
| 今週 | 今日 - (曜日番号 - 1) 日（月=1, 火=2 … 日=7） | 今日 |
| 過去7日間 | 今日 - 6 日 | 今日 |
| 今日だけ | 今日 | 今日 |
| 期間を指定 | 入力された開始日をそのまま使う | 入力された終了日 |

## 出力先

レポートを `tmp/<ブランチ名>/your-ai-report-<YYYYMMDD-HHMMSS>.md` に出力する。ブランチ名の `/` は `-` に置換する。規約は `aidd` の `README.md` の「ブランチ名の `/` は `-` に置き換える」。実パスは手順 2 の stdout 末尾「出力先」に出る。

中間データ `.ai-report-data.json`（手順 2 の `collect` が書く）と定性パート `.ai-report-qualitative.md`（手順 3 で書く）は、`work/<目的>/` ではなく、レポートと同じ `tmp/<ブランチ名>/` の直下に置く。`analyze.py` の `collect` と `report` が `out_dir()` の直下の決まった名前で 2 つを受け渡し、`allowed-tools` の `Edit(tmp/*/.ai-report-qualitative.md)` も 1 階層だけに当たるため。

## 手順

### 1. 単価・為替を調べる

コスト試算に使う単価と為替は時間経過だけで陳腐化するため、リポジトリにもスクリプトにも保持せず、レポート生成のたびに調べて手順 2 の `collect` に渡す（`collect` は単価を受け取った時刻を調査時点として記録し、コスト試算の注記に出す）。

`aidd:research` サブエージェントを 1 回起動して単価と USD/JPY を調べ、結果を JSON 1 行に組み立てる。調べる内容・JSON の形・同一ファミリー内で単価が分かれていたとき・調査に失敗したときの扱いは、`pricing.md` に従う。

### 2. collect

```bash
python3 -B "${CLAUDE_PLUGIN_ROOT}/skills/ai-report/scripts/analyze.py" collect <START> <END> --pricing '<手順 1 で組み立てた JSON>'
```

stdout に定量サマリ・typed プロンプト一覧・出力先パスが出る。渡した単価は中間データに載って手順 4 の `report` へ引き継がれるため、`report` 側で調べ直す必要はない。

出力冒頭の「走査対象ログ（カバレッジ）」を必ず確認する。意図した作業ディレクトリが抜けている、または無関係なリポジトリが混ざっている場合は `--project-dirs` で対象を明示して再実行する（ディレクトリ名でも絶対パスでも可）。走査の仕組みと再実行の例は `scan-scope.md` にある。

### 3. 定性パートを書く

typed プロンプト一覧・昇格候補エージェントの関連プロンプト・セッションテーマ一覧を読み、`output-template.md` の「定性パート」に従って `tmp/<ブランチ名>/.ai-report-qualitative.md` を `Write` する（実パスは「出力先」のとおり）。各ブロックの根拠にする手順 2 の出力と、ブロックごとの書き方は、`output-template.md` の「各ブロックの根拠にする出力」と各ブロックの「書き方」にある。

### 4. report

```bash
python3 -B "${CLAUDE_PLUGIN_ROOT}/skills/ai-report/scripts/analyze.py" report <START> <END>
```

レポートは「出力先」に出力される。stdout の出力パスをユーザーに報告する。

> 注意: `report` は `collect` が書く中間データ `.ai-report-data.json` と定性パート `.ai-report-qualitative.md` を読む。両ファイルは消さずに残す（削除は人が行う）。前の実行の定性パートを使わないよう、中間データより古い定性パートは読まない。このため手順 3 の `Write` を完了させてから手順 4 を実行する（同一メッセージで並列実行しない。並列だと定性パートを読む前に走り「（未記入）」になる）。定性が「（未記入）」になったら、手順 3 の `Write` をやり直してから `report` を実行する。`report` が「`.ai-report-data.json` が無い」で失敗する場合は、手順 2 の `collect` からやり直す。

## 保守

コスト試算の単価・為替は、リポジトリにもスクリプトにも保持しない。理由と保守の決まりは、`pricing.md` の「単価・為替の保守」にある。
