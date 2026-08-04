---
name: pr-check
description: PRとIssueの紐づきを確認し、Issueの各タスクがPRで実装されているかと実装の完全性をチェックする。ユーザーがPRとIssueの整合性レビューを求めた時に使用する
argument-hint: "<Issue番号> <PR番号>"
disable-model-invocation: true
allowed-tools: Bash(gh issue view:*), Bash(gh pr view:*), Bash(gh pr diff:*), Bash(git branch:*), Bash(date:*), Read, Glob, Write(tmp/*/pr-check_*.md)
---

# PRとIssueの整合性チェック

`gh` CLI で PR と Issue にアクセスし、**Issue で定義したタスクが PR で実装されているか**（要件トレーサビリティ）を確認する。

深いコードレビュー（バグ・セキュリティ・規約準拠の網羅的検査）は本 Skill の役割ではない。「要件と実装の対応関係」と「実装の完全性」に絞る。

## 参照ファイル

| ファイル | 役割 |
| --- | --- |
| `${CLAUDE_PLUGIN_ROOT}/skills/pr-check/output-template.md` | レポートの出力フォーマット |

## バリデーション

- `$ARGUMENTS` が空、または番号が2つ揃っていない場合は追加質問する
- `gh issue view` / `gh pr view` で番号の実在を確認する

## 手順

1. `git branch --show-current` で現在のブランチ名を取得する（出力パス用）
2. `date +%Y%m%d_%H%M%S` でタイムスタンプを取得する
3. `gh pr view <PR番号>` で PR の内容（タイトル・本文・変更ファイル）を取得する
4. `gh pr diff <PR番号>` で差分を取得する
5. `gh issue view <Issue番号>` で Issue のタスク一覧を取得する
6. 以下のチェック項目に従い評価する
7. `${CLAUDE_PLUGIN_ROOT}/skills/pr-check/output-template.md` の報告形式に従い、結果を `tmp/<ブランチ名>/pr-check_<yyyymmdd_hhmmss>.md` に書き込み、出力パスと総合評価の要点をユーザーに報告する

## チェック項目

### 内容比較（必須）

- [ ] Issue で定義されたタスクの一覧化
- [ ] PR で実装された変更の一覧化
- [ ] タスクと実装内容の対応関係の確認
- [ ] 未実装・部分実装タスクの特定

### 実装の完全性（必須）

- [ ] 部分実装・TODO の残存がないか
- [ ] テストの有無（テスト基盤が未整備なら「追加が望ましい箇所」を指摘）
- [ ] ドキュメント更新の要否（唯一の情報源に影響する変更があるか）

### 成果物別の整合（該当する変更がある場合）

変更ファイルの種別に応じて、そのリポジトリの規約との整合を確認する。網羅的な詳細検査は行わない。

規約の在り処は `.claude/rules/`・`.github/instructions/`・`docs/` を Glob で探して特定する。見つからない場合はこの観点を「規約なし」として省略する。

| 変更の種別 | 確認する観点 |
| --- | --- |
| アプリケーションコード | 責務分離・入出力のエスケープ・命名 |
| ドキュメント（`docs/`・`.claude/`） | 唯一の情報源が崩れていないか・参照方向 |
| IaC（`*.tf` 等） | インフラ規約との整合・破壊的変更の有無 |
| CI 設定（`.github/workflows/`） | 既存ジョブへの影響 |

## 報告形式

`tmp/<ブランチ名>/pr-check_<yyyymmdd_hhmmss>.md` への出力構造は `${CLAUDE_PLUGIN_ROOT}/skills/pr-check/output-template.md` を参照する。

## 禁止事項

- ❌ 番号が揃わないままチェックを実行すること
- ❌ 推測に基づく評価（Issue・PR・差分の事実に基づく）
- ❌ 具体的な改善点を提示しない批判
- ❌ 忖度や配慮による甘い評価
- ❌ 網羅的コードレビューをここで行うこと（要件と実装の対応に絞る）

$ARGUMENTS
