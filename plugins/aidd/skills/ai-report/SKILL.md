---
name: ai-report
description: このリポジトリの Claude Code セッションログを分析し、利用状況や改善点を図表付きレポートにする。AI 利用実績の振り返り・トークンコストの棚卸しを求められた時に使用する
model: opus
disable-model-invocation: true
allowed-tools: Bash(date:*), Read, Agent, Edit(tmp/**/.ai-report-qualitative.md), AskUserQuestion
argument-hint: "[開始日 YYYY-MM-DD] [終了日 YYYY-MM-DD]"
---

# Claude Code 利用分析レポート

本リポジトリのセッションログを指定期間で分析しレポート化する。定量集計・図表生成・ファイル出力は `analyze.py` が担う。集計はメインセッションに加えサブエージェント・Workflow 実行分（`<sessionId>/subagents/**` のログ）も含む実費・実績ベース。

走査対象は cwd のログディレクトリだけではなく、**同一リポジトリの全クローン・worktree 分**を束ねる。クローンを分けて作業していると cwd 分だけでは大半を取りこぼすため。判定は各ログディレクトリのレコードに含まれる元の `cwd` を読み、その `cwd` の `git remote origin` が現在のリポジトリと一致するかで行う（ディレクトリ名は `/` → `-` の非可逆エンコードでパスを復元できないが、レコード自体が `cwd` を絶対パスで持っている）。`cwd` が既に消えている・git 管理外で照合できない場合のみ、ディレクトリ名の前方一致で推定する（この推定はディレクトリ名の規約に依存するため外れることがある）。

走査したディレクトリと判定根拠はレポートの「走査対象ログ（カバレッジ）」に出るので、意図した作業ディレクトリが含まれているかを必ず確認する。含まれていない・逆に無関係なリポジトリが混ざる場合は `--project-dirs` で明示指定する。

Claude の担当は typed プロンプトを読んで定性パート（総評サマリ・トークン効率／コスト最適化・完了時間／手戻り削減・ワークフローの仕組み化／短縮・プロンプト改善提案）を書くことだけ。

## 参照ファイル

| ファイル | 役割 |
| --- | --- |
| `${CLAUDE_PLUGIN_ROOT}/skills/ai-report/scripts/analyze.py` | 定量集計・図表生成・レポート出力 |
| `${CLAUDE_PLUGIN_ROOT}/skills/ai-report/output-template.md` | 定性パートの書き方とマーカー形式 |
| `${CLAUDE_PLUGIN_ROOT}/references/ai-research.md` | 未検証値を断定しないための規約 |
| `${CLAUDE_PLUGIN_ROOT}/references/plain-language.md` | 平易化の技法 |

本文中の `analyze.py` / `output-template.md`、および `output-template.md` が「プラグインの `references/...`」と書いている箇所は、いずれも上表の実パスを指す。

## 手順

### Step 0: 単価・為替の取得

コスト試算に使う単価と為替は時間経過だけで陳腐化するため、リポジトリにもスクリプトにも保持せず、レポート生成のたびに調べて Step 2 の `collect` に渡す（`collect` は単価を受け取った時刻を調査時点として記録し、コスト試算の注記に出す）。

`aidd:research` サブエージェント（本プラグイン同梱）を 1 回起動し、次の 2 つをまとめて調べさせる。調査ログをメインに持ち込まず、サマリだけ受け取るため。

- Anthropic API の現行モデルの単価（input / output・USD per 100万トークン）を、モデルファミリー（`opus` / `sonnet` / `haiku` / `fable` / `mythos` など）ごとに。期間限定の導入価格があればその金額と適用終了日も
- USD/JPY の直近レート

結果を次の形の JSON 1 行に組み立てる。Step 2 で `--pricing` に渡す。

```json
{"usd_jpy":159.6,"family":{"opus":[5.0,25.0],"sonnet":[3.0,15.0],"haiku":[1.0,5.0],"fable":[10.0,50.0],"mythos":[10.0,50.0]},"intro":{"claude-sonnet-5":{"price":[2.0,10.0],"until":"2026-08-31"}}}
```

- `family` のキーはモデル ID に現れるファミリー名（`claude-opus-5` なら `opus`）。値は `[input, output]`
- `intro` は期間限定の導入価格。適用終了日を過ぎたものは含めない。無ければ `{}`
- **同一ファミリー内で世代ごとに単価が分かれていた場合、`family` では表現できない。** 勝手にどちらかを採用せず、ユーザーに報告して判断を仰ぐ
- 調査に失敗した場合は `--pricing` を付けずに実行してよい。コスト試算セクションだけが省略され、他の集計は通常どおり出る。その旨をユーザーに伝える

### Step 1: 期間の確定

`$ARGUMENTS` から開始日・終了日（`YYYY-MM-DD`）を両方取れた場合はそのまま使う。

欠けていれば `AskUserQuestion` で次の選択肢を提示する：

1. 今週（月曜〜今日） — 実行日が属する週の月曜から今日まで
2. 過去7日間 — 今日を含む直近7日間
3. 今日だけ
4. 期間を指定（`YYYY-MM-DD` `YYYY-MM-DD`）

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

### Step 2: collect

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/ai-report/scripts/analyze.py" collect <START> <END> --pricing '<Step 0 で組み立てた JSON>'
```

stdout に定量サマリ・typed プロンプト一覧・出力先パスが出る。渡した単価は中間データに載って Step 4 の `report` へ引き継がれるため、`report` 側で調べ直す必要はない。

出力冒頭の「走査対象ログ（カバレッジ）」を必ず確認する。意図した作業ディレクトリが抜けている、または無関係なリポジトリが混ざっている場合は `--project-dirs` で対象を明示して再実行する（ディレクトリ名でも絶対パスでも可）。

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/ai-report/scripts/analyze.py" collect <START> <END> \
  --pricing '<JSON>' --project-dirs -home-user-repo -home-user-repo-2
```

### Step 3: 定性パートの執筆

typed プロンプト一覧・昇格候補エージェントの関連プロンプト・セッションテーマ一覧を読み、[output-template.md](output-template.md) の「定性パート」に従って `tmp/<ブランチ名>/.ai-report-qualitative.md` を `Write` する（出力先は commit / pr-create と同じ規約で、ブランチ名の `/` は置換せずサブディレクトリとして扱う。実パスは Step 2 の stdout 末尾「出力先」に出る）。

改善策を出すブロック（`PROMPTS` / `TOKEN_EFFICIENCY` / `WORKFLOW_EFFICIENCY`）では、Claude Code の標準機能・設定で仕組み化できないかを必ず 1 軸として検討し、機能の現在仕様は `aidd:research` サブエージェント／公式ドキュメントで裏取りする（[output-template.md](output-template.md) の「改善提案の共通軸」）。

- `SUMMARY` / `PROMPTS` ブロック: typed プロンプト一覧から良い点・改善点を執筆する。総評で数値に触れるときは Step 2 の出力をそのまま引用し、推測で作らない。「セッションテーマ一覧」に意味的に似た作業テーマが複数あれば、サブエージェント化・スキル化の検討を SUMMARY に 1 文添える（無ければ言及しない）。
- `TOKEN_EFFICIENCY` ブロック: Step 2 の「コスト試算」「トークン内訳」「スキル別コスト帰属」「ツール失敗・権限拒否」「会話密度」を根拠に、トークン（＝費用）を減らす観点で評価・提案する（文章の簡略化余地・聞き返し問題を標準機能で減らせるか・さらに減らす具体策。ルールは [output-template.md](output-template.md) の「TOKEN_EFFICIENCY ブロックの書き方」を参照）。
- `WORKFLOW_EFFICIENCY` ブロック: Step 2 の「ターン所要時間」「手戻りシグナル（修正語彙・中断・再編集）」「コード変更量（ユーザー手直し率）」「会話密度」「permissionMode 分布」を根拠に、意図しない実装のやり直しと往復を減らし、タスクを最短で正しく終える観点で評価・提案する（費用の話は TOKEN_EFFICIENCY に譲る）。ルールは [output-template.md](output-template.md) の「WORKFLOW_EFFICIENCY ブロックの書き方」を参照。
- `MECHANIZATION` ブロック: Step 2 の「確認プロンプトの回答一貫性」「定型パターン（仕組み化の候補）」「蛇足行動」「Skill / Workflow 実行回数」を根拠に、繰り返している判断・手順を標準機能へ落とし込む提案を書く（毎回同じ選択をしている確認の削除・既定値化、頻出ツール連鎖の hooks 化、蛇足行動の削減、0 回スキルの統合）。費用は TOKEN_EFFICIENCY、所要時間と手戻りは WORKFLOW_EFFICIENCY に譲り、ここでは「二度考えない仕組みにできるか」だけを扱う。ルールは [output-template.md](output-template.md) の「MECHANIZATION ブロックの書き方」を参照。
- `PROMOTION_REASONS` ブロック: Step 2 の「Agent 起動の関連プロンプト」セクションを読み、各候補の理由を 1 行で書く（形式・ルールは [output-template.md](output-template.md) の「PROMOTION_REASONS ブロックの書き方」を参照）。

### Step 4: report

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/ai-report/scripts/analyze.py" report <START> <END>
```

レポートを `tmp/<ブランチ名>/your-ai-report-<YYYYMMDD-HHMMSS>.md` に出力する。stdout の出力パスをユーザーに報告する。

> 注意: `report` は `collect` が書く中間データ `.ai-report-data.json` と定性パート `.ai-report-qualitative.md` を読み、生成後に両ファイルを削除する（consume-and-delete）。このため Step 3 の `Write` を完了させてから Step 4 を実行する（同一メッセージで並列実行しない。並列だと定性パートを読む前に走り「（未記入）」になる）。定性が「（未記入）」になる・`report` が「`.ai-report-data.json` が無い」で失敗する場合は、Step 2 の `collect` からやり直す（単独の `report` 再実行では直らない）。

## 単価・為替の保守

コスト試算の単価・為替はリポジトリにもスクリプトにも保持しない。集計ロジックは一度書けば基本的に更新不要なのに対し、単価と為替は時間経過だけで陳腐化するため、値を持たずに毎回調べる方式にしている。

- **人もスクリプトも単価を保守しない。** Step 0 が毎回調べ、`collect --pricing` で渡す
- 単価はモデル ID 単位ではなくファミリー単位で扱う。新しい世代が出ても調査結果の形が変わらないため
- 表示名（`claude-opus-4-8` → `Opus 4.8`）はモデル ID から生成する。単価が取れなくても表示は崩れない
- キャッシュ単価の倍率（書き込み 1.25× / 読み出し 0.10×）だけは価格改定ではなく prompt caching の仕様側の値なので、`analyze.py` の定数に置く
- 厳密には利用実績のあった時点の単価を使うべきだが、本レポートは概算なので調査時点の単価で通す
