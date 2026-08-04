---
name: skill-check
description: プロジェクトの Skill を点検し、フロントマターの不足・スコープ逸脱・手順の矛盾・参照切れを検出して改善案と相談点を提示する。Skill のレビュー・棚卸しを求められた時に使用する
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(ls:*), Bash(wc:*), Bash(git branch:*), Bash(date:*), Write(tmp/*/skill-check_*.md), mcp__context7__resolve-library-id, mcp__context7__query-docs, WebFetch
argument-hint: "[対象 Skill 名（省略時は全件）]"
---

# Skill 点検

対象の `SKILL.md` を `${CLAUDE_PLUGIN_ROOT}/skills/skill-check/skills-rule.md` の基準で点検し、`${CLAUDE_PLUGIN_ROOT}/skills/skill-check/output-template.md` のフォーマットで `tmp/<ブランチ名>/skill-check_<yyyymmdd_hhmmss>.md` に書き出す。

## 参照ファイル

| ファイル | 役割 |
| --- | --- |
| `${CLAUDE_PLUGIN_ROOT}/skills/skill-check/skills-rule.md` | Skill 作成ルール（判定基準） |
| `${CLAUDE_PLUGIN_ROOT}/skills/skill-check/output-template.md` | レポートの出力形式 |
| `${CLAUDE_PLUGIN_ROOT}/skills/skill-check/excludes.md` | 除外リストの書式と探索先 |
| `${CLAUDE_PLUGIN_ROOT}/references/markdown.md` | markdown 規約 |
| `${CLAUDE_PLUGIN_ROOT}/references/document.md` | SSOT・文体・構造ルール |

## 点検対象の解決

Skill の置き場所はリポジトリの性格で異なる。次の順で解決する。

1. `.claude/skills/*/SKILL.md` があればそれを対象にする（通常のプロジェクト）
2. 無ければ `plugins/*/skills/*/SKILL.md` を Glob で探す（プラグインマーケットプレイスのリポジトリ）
3. どちらも無ければ「点検対象の Skill が見つからない」と報告して終了する

引数を Skill 名として解釈する。

| 引数 | 対象 |
| --- | --- |
| 省略 | 解決した置き場所の全件 |
| 1 つ指定（例: `adr`） | その名前の Skill のみ |
| カンマ区切り複数指定（例: `adr,commit`） | 指定された Skill のみ |

存在しない Skill 名が指定された場合は、「対象 SKILL.md が見つからない」と明示する。自分自身（`skill-check`）も対象に含める。

## 公式仕様確認のフォールバック

判定中に Claude Code 公式仕様（フィールド名・置換変数・制約値等）の確認が必要になったときは次の順で参照する。

1. `mcp__context7__resolve-library-id` → `query-docs` で `claude code skills` を引く
2. context7 が認証失敗・未接続で使えない場合は、レポート冒頭に `context7 に接続できないため Claude の組み込み知識で判定を続行` と警告文を 1 行入れて続行する（中断しない）
3. それでも不明確なら `WebFetch` で `skills-rule.md` の「参考公式情報」の URL を参照する

context7 の失敗は致命的エラーとして扱わない。判定は努力目標で続行する。

## 手順

### Step 1: 対象列挙

1. 「点検対象の解決」に従って置き場所を確定し、引数を解釈して対象 SKILL.md のパスを決める
2. `ls` で実在ディレクトリを確認する
3. 各 Skill ディレクトリ内のファイル一覧を `ls` で取得し、補助ファイル（テンプレート・スクリプト）も把握する
4. `wc -l <SKILL.md>` で本文行数を取得する

### Step 2: ルール・除外リスト読込

`${CLAUDE_PLUGIN_ROOT}/skills/skill-check/skills-rule.md` を読み込み、判定基準（チェックリスト・アンチパターン・運用方針）を確定する。

続けて `${CLAUDE_PLUGIN_ROOT}/skills/skill-check/excludes.md` を読み、そこに書かれた探索先からプロジェクト側の除外リストを Glob で探して読み込む。除外リストが無い場合は「除外なし」で進める。

仕様確認が必要になった場合は「公式仕様確認のフォールバック」に従う。

### Step 3〜6: 各観点で判定

`skills-rule.md` の各セクションに照らして、下表の観点で判定する。詳細な判定方針は本ファイルの「判定方針」を参照。

| Step | 観点 | 参照する skills-rule セクション |
| --- | --- | --- |
| 3 | フロントマター | 「フロントマター運用方針」「チェックリスト → フロントマター」 |
| 4 | スコープ | 「description の書き方」「単一目的の原則」 |
| 5 | 手順・参照 | 「ファイル構造」「Progressive Disclosure」「補助スクリプトの言語選択」 |
| 6 | 本文品質 | 「本文構造」「アンチパターン」 |

### Step 7: 除外適用・改善提案・相談点の抽出

1. Step 3〜6 で検出した WARN/FAIL から、除外リストに該当する項目を除外する
2. 除外後の項目数で判定区分（PASS/WARN/FAIL/要相談）を再計算する
3. 残った項目について以下を整理:
   - 追加した方が良いフロントマターと推奨値
   - `description` 改善案（変更影響を併記）
   - 本文構造改善案（補助ファイル分割など）
   - スコープ相談点（必ず A/B 案と推奨を提示）

### Step 8: レポート出力

1. `git branch --show-current` で現在のブランチ名を取得する（出力パス用）
2. `date +%Y%m%d_%H%M%S` でタイムスタンプを取得する
3. `output-template.md` のテンプレートに従い、`tmp/<ブランチ名>/skill-check_<yyyymmdd_hhmmss>.md` に書き出し（新規作成または上書き）、出力パスをユーザーに報告する。Step 2 で context7 等の参照に失敗していた場合は、冒頭の警告枠に該当の警告文を入れる

## 判定区分

| 判定 | 条件 |
| --- | --- |
| PASS | `skills-rule.md` のチェックリストを全て満たし、WARN もない |
| WARN | 必須は満たすが、改善余地あり（フロントマター未設定・description の曖昧さ・本文の冗長等） |
| FAIL | 次のいずれか: 必須項目欠落 / 出力先と権限の不一致 / 参照ファイル欠落 / スコープ逸脱 / 内部矛盾 / 本文 500 行超 / 多階層参照 |
| 要相談 | スコープを広げる / 絞る の判断が必要。必ず A/B 案を提示 |

## 判定方針

### フロントマターの判定

| 観点 | FAIL 条件 |
| --- | --- |
| `name` | ディレクトリ名と不一致、kebab-case 違反、予約語使用 |
| `description` | 欠落、一人称、「何を」「いつ」のいずれか欠落、公式文字数超過 |
| `allowed-tools` | 本文の実行コマンドが含まれていない（追加すべき具体パターンを必ず明記） |
| `argument-hint` | 本文に `$ARGUMENTS` があるのに未設定（WARN 扱い） |

プロジェクト独自のフロントマター規約（メタデータの必須化など）は、除外リストまたはリポジトリの規約から読み取る。**規約の存在が確認できないフィールドの欠落を指摘しない。**

### スコープの判定

| 観点 | 判定方法 |
| --- | --- |
| 逸脱 | description が言及しない操作・出力が本文にあるか |
| 不足 | 本文が扱う重要操作が description で発見不能か |
| 単一目的 | 「A と B を行う」のような複数関心事の混在 |
| 境界明示 | 「禁止事項」「対象外」が書かれているか |

### 手順・参照の判定

| 観点 | 判定方法 |
| --- | --- |
| 内部矛盾 | 「やる/やらない」「実行する/中断する」が衝突する記述 |
| 出力先と allowed-tools | 本文の `Write` 対象パスが権限に含まれているか（パスが可変で固定できない場合は指摘しない） |
| 参照ファイル実在 | 参照先（補助 .md、scripts/）が実ファイルとして存在するか。`${CLAUDE_PLUGIN_ROOT}` 起点の参照はプラグイン内の実体を確認する |
| コマンド権限 | 本文で実行する `bash` / CLI が `Bash(<pattern>:*)` に含まれているか |
| 本文行数 | `wc -l SKILL.md` で測定 |
| 参照階層 | SKILL.md → A → B の連鎖になっていないか |

### 本文品質の判定

| 観点 | 判定方法 |
| --- | --- |
| 用語一貫性 | 同義語の混在（grep で類義語チェック） |
| 自由度 | タスクの脆さと指示の細かさのマッチ |
| 時間依存表現 | 「YYYY 年 MM 月以前」のような日付固定 |
| フィードバックループ | 検証 → 修正 → 再検証 が必要なタスクで設定されているか |
| スクリプト言語 | シェル操作中心のものを Python で書いていないか |
| 出力形式の委譲 | `SKILL.md` 本文に出力テンプレート（markdown コードブロックでサンプル出力を抱えるもの）が直書きされていないか。直書きしている場合は `output-template.md` への切り出しを提案する（3 行以下の極小スニペットは例外） |

## 出力時のルール

- 全 Skill 共通で同じセクション構造を使う
- 該当なしの項目も「該当なし」と明示
- 改善提案は「何を」「どこに」「どう変えるか」まで書く（抽象的な指摘 NG）
- description の改善案は「変更影響（起動契機の変化）」を併記
- スコープ相談点では必ず A/B 案と推奨を提示
- 参照は `<file>:<line>` 形式を優先

## 禁止事項

- ❌ 対象 SKILL.md を自動で書き換える（提案までに留める）
- ❌ description の改善案だけ書いて、変更影響に触れない
- ❌ スコープ「要相談」を選択肢提示なしに丸投げする
- ❌ `allowed-tools` 不足の指摘で、追加すべき具体パターンを書かない
- ❌ 「適切に修正してください」のような抽象的な提案
- ❌ context7 等の参照失敗で判定を中断する（警告継続が原則）
- ❌ 除外リストの探索をせずに WARN/FAIL を確定する（探索は必須手順。見つからなければ「除外なし」と明示する）
- ❌ プロジェクトに存在しない規約を根拠に指摘する（独自フロントマターの欠落など）

$ARGUMENTS
