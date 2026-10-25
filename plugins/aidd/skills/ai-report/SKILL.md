---
name: ai-report
description: このリポジトリの Claude Code セッションログを分析し、利用状況や改善点を図表付きレポートにする。AI 利用実績の振り返り・トークンコストの棚卸しを求められた時に使用する
model: opus
disable-model-invocation: true
allowed-tools: Bash(date:*), Read, Agent, Edit(tmp/*/.ai-report-qualitative.md), AskUserQuestion
argument-hint: "[開始日 終了日（任意。省略時は期間を質問する。例: 2026-09-01 2026-09-30）]"
---

# Claude Code 利用分析レポート

このリポジトリのセッションログを、指定の期間で分析してレポートにする。定量の集計・図表・ファイルの出力は `analyze.py` が担い、Claude は typed プロンプトを読んで定性パート（総評サマリ・トークン効率／コスト最適化・完了時間／手戻り削減・ワークフローの仕組み化／短縮・プロンプト改善提案）だけを書く。

- 外へ書き込むもの：`tmp/<ブランチ名>/` の下のレポートと、途中のファイル（定性パート・`analyze.py` の中間データ。消さずに残す）
- 人がすること：期間を選ぶ（引数で渡さないとき）。レポートを読む。`tmp/` の中間ファイルを削除する

## 参照ファイル

| ファイル | いつ読むか |
| --- | --- |
| `${CLAUDE_PLUGIN_ROOT}/skills/ai-report/pricing.md` | 手順 1 で、単価と為替を調べて JSON にするとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/ai-report/scripts/analyze.py` | 手順 3・5 で実行する（定量の集計・図表・レポートの出力） |
| `${CLAUDE_PLUGIN_ROOT}/skills/ai-report/log-coverage.md` | 手順 3 で、「走査対象ログ（カバレッジ）」を確かめるとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/ai-report/output-template.md` | 手順 4 で、定性パートを書くとき（ブロックごとの書き方とマーカーの形） |
| `${CLAUDE_PLUGIN_ROOT}/references/ai-research.md` | 手順 4 で、提案する機能の仕様を書くとき（未検証の値を断定しない） |
| `${CLAUDE_PLUGIN_ROOT}/references/plain-language.md` | 手順 4 で、機能名などをかみ砕くとき（平易化の技法） |
| `${CLAUDE_PLUGIN_ROOT}/skills/ai-report/errors.md` | 単価の調査に失敗した・世代ごとに単価が分かれていたとき、`python3` が動かないとき、定性が「（未記入）」になった・`report` が失敗したとき |

本文の `analyze.py`・`output-template.md` と、`output-template.md` が「プラグインの `references/...`」と書いている箇所は、どれも上の表のパスを指す。

## 想定している引数

`$ARGUMENTS` は、開始日と終了日（`YYYY-MM-DD`）。両方取れなければ、手順 2 で期間を聞く。

## 出力先

`tmp/<ブランチ名>/` に書く。ブランチ名の `/` は `-` に置き換える（規約は `aidd` の `README.md` の「ブランチ名の `/` は `-` に置き換える」）。実際のパスは、手順 3 の出力の末尾「出力先」に出る。

- `your-ai-report-<YYYYMMDD-HHMMSS>.md`：レポート（手順 5 で `analyze.py` が書く）
- `.ai-report-qualitative.md`：定性パート（手順 4 で Claude が書く）
- `.ai-report-data.json`：中間データ（手順 3 の `collect` が書く）

中間データと定性パートは、`work/<目的>/` ではなく、レポートと同じ `tmp/<ブランチ名>/` の直下に置く。`analyze.py` の `collect` と `report` が `out_dir()` の直下の決まった名前で 2 つを受け渡し、`allowed-tools` の `Edit(tmp/*/.ai-report-qualitative.md)` も 1 階層だけに当たるため。

## 手順

### 1. 単価と為替を調べる

`pricing.md` に従い、`aidd:research` サブエージェントで単価と為替を調べ、JSON 1 行に組み立てる。単価と為替は時間経過だけで古くなるため、レポートを作るたびに調べ、手順 3 の `collect` に渡す。

### 2. 期間を決める

`$ARGUMENTS` から開始日・終了日を両方取れたら、そのまま使う。欠けていれば、`AskUserQuestion` で次の 4 つから選んでもらう。選んだ後、`date +%Y-%m-%d` で今日の日付を取り、START・END を決める。

| 選択肢 | START | END |
| --- | --- | --- |
| 今週（月曜〜今日） | 今日 - (曜日番号 - 1) 日（月=1, 火=2 … 日=7） | 今日 |
| 過去7日間（今日を含む直近7日間） | 今日 - 6 日 | 今日 |
| 今日だけ | 今日 | 今日 |
| 期間を指定（`YYYY-MM-DD` `YYYY-MM-DD`） | 入力された開始日 | 入力された終了日 |

### 3. 集計する（collect）

```bash
python3 -B "${CLAUDE_PLUGIN_ROOT}/skills/ai-report/scripts/analyze.py" collect <START> <END> --pricing '<手順 1 で組み立てた JSON>'
```

`python3` が動かないときは、`errors.md` の「`python3` が動かないとき」に従う。

標準出力に、定量のサマリ・typed プロンプトの一覧・出力先のパスが出る。出力の冒頭の「走査対象ログ（カバレッジ）」を必ず確かめ、`log-coverage.md` に従って、意図したディレクトリが含まれているかを見る。

### 4. 定性パートを書く

typed プロンプトの一覧・昇格候補エージェントの関連プロンプト・セッションテーマの一覧を読み、`output-template.md` の「定性パート」に従って `.ai-report-qualitative.md` を Write する。各ブロックの根拠にする集計と観点は、`output-template.md` のブロックごとの節にある。

- 改善策を出すブロックでは、Claude Code の標準機能・設定で仕組み化できないかを必ず 1 つの軸として検討し、機能の現在の仕様は `aidd:research` サブエージェントか公式ドキュメントで裏を取る（「改善提案の共通軸」）
- 総評で数値に触れるときは、手順 3 の出力をそのまま引用し、推測で作らない
- 「セッションテーマ一覧」に意味の似た作業テーマが複数あれば、サブエージェント化・スキル化の検討を `SUMMARY` に 1 文添える（無ければ触れない）

### 5. レポートを作る（report）

手順 4 の Write を終えてから実行する。同じメッセージで並列に実行しない。並列だと定性パートを読む前に走り、定性が「（未記入）」になるため。`python3` は、手順 3 で動いたもの（`python`・`py -3`）に替える。

```bash
python3 -B "${CLAUDE_PLUGIN_ROOT}/skills/ai-report/scripts/analyze.py" report <START> <END>
```

標準出力に出たレポートのパスを、ユーザーに伝える。パスの前後は、半角スペースか改行で区切る（規約は `aidd` の `README.md` の「出力先のパスは、前後を区切って伝える」）。

## 保守

コスト試算の単価・為替は、リポジトリにもスクリプトにも持たない。集計ロジックは一度書けば基本的に更新が要らないのに対し、単価と為替は時間経過だけで陳腐化するため、値を持たずに毎回調べる。

- 人もスクリプトも単価を保守しない。手順 1 が毎回調べ、`collect --pricing` で渡す
- 単価はモデル ID 単位ではなく、ファミリー単位で扱う。新しい世代が出ても、調査結果の形が変わらないため
- 表示名（`claude-opus-4-8` → `Opus 4.8`）は、モデル ID から作る。単価が取れなくても、表示は崩れない
- キャッシュ単価の倍率（書き込み 1.25× / 読み出し 0.10×）だけは、価格改定ではなく prompt caching の仕様側の値のため、`analyze.py` の定数に置く
- 厳密には、利用実績のあった時点の単価を使うべきだが、このレポートは概算のため、調査時点の単価で通す
