---
name: commit
description: ステージング済みの差分を分析し、Conventional Commits 形式のコミットメッセージを提案する。コミットメッセージの作成やステージング済み変更のレビューを求められた時に使用する
disable-model-invocation: true
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Read, Read(tmp.md), Write(tmp.md)
argument-hint: "[補足指示（省略可）]"
---

# コミット提案

`${CLAUDE_PLUGIN_ROOT}/skills/commit/commit-rule.md` のルールに従って、コミットメッセージを提案する。

## 手順

1. `git status` でステージングされたファイルを確認する
2. `${CLAUDE_PLUGIN_ROOT}/skills/commit/scripts/check-symlinks.sh` を実行する。シンボリックリンクが検出された場合は処理を中断し、「リンク元（実体）を更新してください」とだけ案内する（状況の詳細列挙・コミット方針の確認は行わない）
3. `git diff --cached` でステージング済みの差分を確認する
4. `git log --oneline -5` で直近のコミットメッセージのスタイルを確認する
5. リポジトリに commitlint 設定（`commitlint.config.*` / `.commitlintrc.*` / `package.json` の `commitlint`）があれば `Read` し、行長上限・許可 type を確認する
6. コミット分割が必要か判断する（下記ルール参照）
7. `commit-rule.md` の Conventional Commits 形式に従い、コミットメッセージを提案する
8. 提案したコミットメッセージをプロジェクトルート直下の `tmp.md` に書き込む。**既存の `tmp.md` がある場合は、上書き前に必ず `Read` してから `Write` する**（新規時はそのまま作成）

## コミット分割のルール

以下の場合はコミットを分割することを提案する:

- body の What が 5 項目を超える場合
- 異なる目的の変更が混在している場合（例: バグ修正 + リファクタリング）
- subject に「〜と〜」「〜および〜」が含まれる場合

分割を提案する場合は、どのファイルをどのコミットに含めるかを具体的に示す。

## 出力形式

### 1コミットにまとめる場合

`tmp.md` にコミットメッセージを1つの ` ```bash ` ブロックで書き込む。

````markdown
```bash
<type>: <subject>

Why:
- ...

What:
- ...
```
````

### 複数コミットに分割する場合

コミットごとに `git add` コマンドブロックとメッセージブロックをセットで記載する。ブロック直前に「コミット N — ステージ対象ファイル」を記載する。**最初のコミットの `git add` ブロックは `git reset` を先頭に入れ、既存のステージ状態を解除してから add する**（全ファイルがステージ済みでも分割を確実にするため）。

````markdown
コミット 1 — `<fileA>` `<fileB>`

```bash
git reset
git add <fileA> <fileB>
```

```bash
<type>: <subject>

Why:
- ...

What:
- ...
```

コミット 2 — `<fileC>`

```bash
git add <fileC>
```

```bash
<type>: <subject>

Why:
- ...

What:
- ...
```
````

## 判断基準

- ステージングされたファイルがない場合は、その旨を伝えて処理を終了する
- `<type>: <subject>` の形式を厳守する（scope は使用しない）
- `tmp.md` に書く前に、各行（subject・body・footer）が行長上限以内か、footer の前に空行があるか確認する（commitlint 違反で commit が弾かれるため。詳細は `commit-rule.md` の「commitlint の制約」）
- コミットメッセージは `tmp.md` に書き込むのみで、**直接コミットを実行しない**

## 保守

`allowed-tools` に `check-symlinks.sh` の `Bash` パターンを含めていない。プラグインの実体パスは `${CLAUDE_PLUGIN_ROOT}` で解決するが、この変数が `allowed-tools` の frontmatter で展開されるかは公式に記載がないため、当てにせず通常の許可プロンプトを通す。

$ARGUMENTS
