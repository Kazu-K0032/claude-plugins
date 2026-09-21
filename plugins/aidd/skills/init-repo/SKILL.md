---
name: init-repo
description: リポジトリに Claude Code のハーネス設定（.claude/settings.json・hooks・rules）と GitHub の定型ファイル（.github/）、CLAUDE.md / README.md の骨組みを導入する。新しいリポジトリを立ち上げる時、または既存リポジトリへ規約一式を後から入れる時に使用する
disable-model-invocation: true
allowed-tools: Read, Glob, Bash(git rev-parse:*), Bash(git status:*), Bash(diff:*)
argument-hint: "[導入したい範囲・除外したいファイル]"
---

# リポジトリ初期セットアップ（init-repo）

同梱テンプレート（`${CLAUDE_PLUGIN_ROOT}/skills/init-repo/files/`）を、実行中のリポジトリのルートへコピーする。**既存ファイルは承認なしに上書きしない**。

Markdown の書式は `${CLAUDE_PLUGIN_ROOT}/references/markdown.md` を Read し、その規約に従う。

## 参照ファイル

| ファイル | 役割 |
| --- | --- |
| `${CLAUDE_PLUGIN_ROOT}/skills/init-repo/scripts/install.sh` | 状態判定（NEW / SAME / DIFF）とコピーの実行 |
| `${CLAUDE_PLUGIN_ROOT}/skills/init-repo/files/` | コピー元のテンプレート一式 |
| `${CLAUDE_PLUGIN_ROOT}/skills/init-repo/README.md` | 収録物の一覧・除外したものとその理由・導入後の調整項目 |

## 前提条件

- リポジトリの**ルート**で実行すること（サブディレクトリで実行するとスクリプトが停止する）
- `git` / `bash` が利用可能であること
- 導入するフックは実行時に [`jq`](https://jqlang.org/) を使う。未インストールの環境ではフックが失敗する

## 手順

### 1. 現状を確認する

```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/init-repo/scripts/install.sh" --check
```

出力は 1 行 1 ファイル。ラベルの意味は次のとおり。

| ラベル | 意味 |
| --- | --- |
| `NEW` | 導入先に存在しない。コピー対象 |
| `SAME` | 既存ファイルと内容が一致。何もしない |
| `DIFF` | 既存ファイルと内容が異なる。**自動では触らない** |

### 2. 導入計画を提示して承認を得る（必須）

`--check` の結果を、次の 3 つに分けてユーザーへ提示する。

- これから新規作成するファイル（`NEW`）
- 既存のまま残すファイル（`SAME`）
- 衝突していて判断が要るファイル（`DIFF`）

`CLAUDE.md` / `README.md` が既にあるリポジトリでは、ほぼ確実に `DIFF` になる。**テンプレートで上書きすると既存の記述が失われる**ことを明示したうえで承認を求める。

ユーザーが一部だけを希望した場合は、`--only` で対象を絞る（手順 3）。

### 3. コピーする

承認を得たら、まだ存在しないファイルだけをコピーする。

```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/init-repo/scripts/install.sh" --apply
```

対象を絞る場合、または `DIFF` のファイルを上書きする場合は `--only` に相対パスを列挙する。`--only` は「差分を承知で上書きする」という明示指定として扱われる。

```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/init-repo/scripts/install.sh" --apply --only .github/labels.yml .claude/rules/comment.md
```

### 4. 衝突したファイルを片付ける

`DIFF` は 1 件ずつ差分を見せ、ユーザーに「上書き / 手でマージ / 据え置き」を選ばせる。

```bash
diff -u <既存ファイル> "${CLAUDE_PLUGIN_ROOT}/skills/init-repo/files/<同じ相対パス>"
```

`CLAUDE.md` / `README.md` は、テンプレートの見出し構成に既存の記述を差し込む形でマージするのが基本。既存の内容を捨てない。

### 5. 導入後にやることを伝える

コピーが終わったら、次を残作業としてユーザーに提示する。

1. `CLAUDE.md` / `README.md` / `.claude/rules/env.md` の `TODO:` 行を、このリポジトリの実態に書き換える（埋めたら行ごと削除する）
2. `.claude/settings.json` の `permissions.deny` を、このリポジトリの秘匿ファイル配置に合わせる
3. `.claude/hooks/post-edit-lint.sh` 冒頭の `LINT_DIR` / `TARGET_PREFIX` を、lint ツールの置き場所に合わせる
4. `.claude/hooks/guard-destructive.sh` の `patterns` に、このプロジェクト固有の破壊的操作（クラウド CLI の削除系・本番ホストへの接続等）を追記する
5. `commitlint.config.js` を使うなら、`@commitlint/cli` と `@commitlint/config-conventional` を devDependencies に追加し、`commit-msg` フックから呼ぶ
6. `.github/workflows/` には「シークレットスキャン」と「ラベル同期」しか入っていない。ビルド・テストの CI はプロジェクト側で作る

`guard-git-write.sh` は配線していない。`git commit` / `git push` をラッパースクリプト経由まで含めて塞ぎたい場合のみ、`settings.json` の `PreToolUse` に追加するよう案内する。

## 禁止事項

- `--only` の明示指定なしに既存ファイルを上書きしない
- テンプレートに含まれないディレクトリを勝手に作らない
- コピー結果をコミットしない（コミットは人が行う）
