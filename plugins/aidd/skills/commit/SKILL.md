---
name: commit
description: ステージング済みの差分を分析し、Conventional Commits 形式のコミットメッセージを提案する。コミットメッセージの作成やステージング済み変更のレビューを求められた時に使用する
disable-model-invocation: true
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(gh pr checks:*), Read, Read(tmp.md), Edit(tmp.md)
argument-hint: "[補足指示（任意。省略時はステージ済みの差分と会話の経緯から提案する。例: Issue#5 を参照に付ける / 1 コミットにまとめる）]"
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
7. 会話の経緯から、GitHub Actions の失敗を直すコミットかを判断する（例: 失敗した実行のログを読んで直した、補足指示で CI の修正と言われた）。差分だけでは判断できないため、会話にそうした経緯が無ければ通常のコミットとして扱う。CI の修正であれば、Why に CI の失敗を書き（`commit-rule.md` の「CI の失敗を直すコミット」）、下記「失敗した実行の URL の取り方」で URL を取る
8. `commit-rule.md` の Conventional Commits 形式に従い、コミットメッセージを提案する
9. 提案したコミットメッセージをプロジェクトルート直下の `tmp.md` に書き込む。**既存の `tmp.md` がある場合は、上書き前に必ず `Read` してから `Write` する**（新規時はそのまま作成）

## 失敗した実行の URL の取り方

会話の経緯に失敗した実行の URL が出ていれば、それを使う（ジョブの URL なら末尾の `/job/<job_id>` を削る）。出ていなければ、現在のブランチの PR のチェック結果から、失敗した GitHub Actions の実行をワークフロー名と URL の組で取り出す。

```bash
gh pr checks --json bucket,link,workflow -q '[.[] | select(.bucket == "fail" and .workflow != "") | "\(.workflow) \(.link | sub("/job/[0-9]+$"; ""))"] | unique | .[]'
```

- `link` は失敗したジョブの URL のため、末尾の `/job/<job_id>` を削って実行の URL にし、同じ実行は 1 つにまとめている
- `workflow` が空のチェックは GitHub Actions 以外（外部の CI・GitHub App）のため除いている
- 複数の実行が出たときは、ワークフロー名と会話の経緯から、このコミットで直した失敗の実行だけを選ぶ
- 何も出力されない、またはコマンドが失敗した（PR が無い等）ときは、URL の行を書かない。失敗の後に新しいコミットを push していると、失敗した実行が結果に出ないことがある
- 書き方（`Ref:` を 2 行に分ける・行長の上限を超えたら書かない）は `commit-rule.md` の「CI の失敗を直すコミット」に従う

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
