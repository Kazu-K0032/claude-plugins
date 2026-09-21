---
name: docs-sync
description: 現在のブランチ（基準ブランチ以外）の差分を分析し、コード・インフラ変更に追従して更新すべき md ドキュメントを特定して更新を提案する。ブランチの変更にドキュメントが追従しているか点検したい時に使用する。基準ブランチでは停止する
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(git branch:*), Bash(git diff:*), Bash(date:*), Edit(tmp/*/docs-sync_*.md)
---

# ドキュメント追従チェック（docs-sync）

現在のブランチの差分（コード・インフラ・md）を分析し、**変更に追従して更新すべき md ドキュメントを特定**して `tmp/<ブランチ名>/docs-sync_<yyyymmdd_hhmmss>.md` に出力する。検出と提案のみで、ドキュメントの自動修正は行わない。

## 基準ブランチでの停止

基準ブランチ（`origin/HEAD` が指す既定ブランチ、または `main` / `master`）では差分の基準が無いため**フローを停止する**。`run-checks.sh` が `STOP` を返したら、その旨をユーザーに伝えて終了する。

## 参照ファイル

| ファイル | 役割 |
| --- | --- |
| `${CLAUDE_PLUGIN_ROOT}/skills/docs-sync/scripts/run-checks.sh` | 差分列挙・機械チェック |
| `${CLAUDE_PLUGIN_ROOT}/skills/docs-sync/docdd-design.md` | チェック対象・判定範囲・PASS/FAIL 基準 |
| `${CLAUDE_PLUGIN_ROOT}/skills/docs-sync/output-template.md` | レポートの出力フォーマット |
| `${CLAUDE_PLUGIN_ROOT}/references/document.md` | 重複排除（SSOT）・文体・構造ルール |
| `${CLAUDE_PLUGIN_ROOT}/references/markdown.md` | markdown 書式規約 |

## 役割分担

| フェーズ | 担当 | 対象 |
| --- | --- | --- |
| 差分列挙・機械チェック | `run-checks.sh` | ブランチ差分の列挙・変更 md の相対リンク切れ・markdown 規約、および全 md のリンク切れ・SSOT 一覧ポインタ（全走査・差分非依存） |
| 追従要否の判定 | LLM | 非 md 変更（コード・インフラ）に追従して更新すべき md の特定・更新提案 |
| レポート出力 | LLM | スクリプト出力と LLM 判定を統合して `tmp/<ブランチ名>/docs-sync_<yyyymmdd_hhmmss>.md` に整形 |

## 前提条件

- リポジトリのルートで実行されること
- `git` / `bash` / `perl` / `awk` が利用可能であること
- 基準ブランチ以外のフィーチャーブランチであること

## 手順

### Step 1: 差分列挙・機械チェック実行

次のコマンドを実行し、標準出力を保持する。

```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/docs-sync/scripts/run-checks.sh"
```

スクリプトは以下を出力する。

- 基準ブランチ上の場合は `STOP` と表示し終了コード 3。**この場合は以降を実施せず、停止理由をユーザーに伝えて終了する**
- 基準ブランチ・変更ファイル総数
- 「## 変更された md」「## 変更された非 md（docs 追従判断の入力）」のファイル一覧
- 変更 md に対する「相対リンク切れ」「markdown 規約」「docs-type フロントマター」の PASS/FAIL
- 全走査（差分非依存）の「全 docs リンク切れ」「SSOT 一覧ポインタ存在」の PASS/FAIL
- 「## サマリ」配下に各カテゴリの FAIL 件数

終了コードは、機械チェック FAIL があれば `1`、基準ブランチでの停止なら `3`、すべて PASS なら `0`。

**`SKIP` の扱い**: `docs-type` と `SSOT 一覧ポインタ` は、そのリポジトリが該当の規約を使っていない場合 `SKIP` を返す。これは異常ではないため FAIL として扱わず、レポートには「対象外」と記す。

### Step 2: 追従要否の判定（LLM）

スクリプトが出力した「変更された非 md」のファイル群を `Read` / `git diff` で確認し、`docdd-design.md` の「追従判定範囲」に従って次を判定する。

判定の前に、**このリポジトリの規約を Glob / Grep で探す**（パスはリポジトリごとに違うため固定しない）。

- ドキュメント更新の判断軸・情報と唯一の情報源の対応表: `CLAUDE.md`・`docs/README.md`・`AGENTS.md` 等
- ドキュメント階層の責務・参照方向の規約: `.claude/rules/*.md`・`docs/strategies/*.md`・`CONTRIBUTING.md` 等

見つからない観点は、一般的なベストプラクティスで判定し**規約違反としては挙げない**。

判定内容:

1. 変更されたコード・インフラが、既存 md の記述と食い違っていないか
2. 食い違う場合、**どの md を・どう更新すべきか**（対応表があれば唯一の情報源に該当するファイルを優先的に特定）
3. 変更 md 自体が、関連する他の md（索引のリンク・参照先）との整合を崩していないか
4. 追従すべきだが未更新の md（ドリフト）を重大度付きで列挙する

変更 md の機械チェックは Step 1 のスクリプトで検出済みのため LLM では重複点検しない。

### Step 3: レポート出力

1. `git branch --show-current` で現在のブランチ名を取得する（出力パス用。`/` は `-` に置換する）
2. `date +%Y%m%d_%H%M%S` でタイムスタンプを取得する
3. `output-template.md` のテンプレートに従い、Step 1 のスクリプト出力と Step 2 の判定結果を統合して `tmp/<ブランチ名>/docs-sync_<yyyymmdd_hhmmss>.md` に書き込み、出力パスをユーザーに報告する

## 判断基準

- 基準ブランチでは Step 1 の `STOP` で終了する（レポートは作らない）
- 機械チェック（Step 1）または追従判定（Step 2）のいずれかに指摘があれば総合判定 FAIL
- スクリプトの終了コードのみで総合判定せず、Step 2 の LLM 判定結果を必ず合算する
- `SKIP` は FAIL に数えない（規約を使っていないリポジトリの正常状態）
- レポートは `tmp/` 配下に書き込むのみで、検出した問題の自動修正は行わない

## 禁止事項

- ❌ 基準ブランチでフローを継続する（必ず停止する）
- ❌ 検出した問題を自動修正する（レポート出力のみに留める）
- ❌ 機械チェック（Step 1）の判定範囲を LLM 判定（Step 2）で重複点検する（役割分担を崩さない）
- ❌ `tmp/<ブランチ名>/docs-sync_<yyyymmdd_hhmmss>.md` 以外のファイルを書き換える
- ❌ Step 1 が FAIL でも Step 2 を省略する（停止時を除き、必ず両方実施して合算）
- ❌ `SKIP` を FAIL として報告する
- ❌ このリポジトリに存在しない規約を根拠に指摘する

## 使用する引数

引数は受け取らない。スクリプトが対象差分を自動列挙する。

## 補完関係

- 全ドキュメントの横断的な重複記述・値の矛盾を網羅監査するなら `docs-consistency-audit` workflow を使う（差分ではなく全ドキュメントが対象）
- 本 Skill は「このブランチの変更にドキュメントが追従しているか」に特化する

## 保守

`allowed-tools` に `run-checks.sh` の `Bash` パターンを含めていない。プラグインの実体パスは `${CLAUDE_PLUGIN_ROOT}` で解決するが、この変数が `allowed-tools` の frontmatter で展開されるかは公式に記載がないため、当てにせず通常の許可プロンプトを通す。
