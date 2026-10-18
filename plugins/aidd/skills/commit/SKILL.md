---
name: commit
description: ステージング済みの差分を分析し、Conventional Commits 形式のコミットメッセージを提案する。コミットメッセージの作成やステージング済み変更のレビューを求められた時に使用する
disable-model-invocation: true
allowed-tools: Bash(git status:*), Bash(git branch --show-current), Bash(git apply --check:*), Bash(date:*), Bash(gh pr checks:*), Read, Read(tmp.md), Edit(tmp.md), Edit(tmp/*/commit/*.patch)
argument-hint: "[補足指示（任意。省略時はステージ済みの差分と会話の経緯から提案する。例: Issue#5 を参照に付ける / 1 コミットにまとめる）]"
---

# コミット提案

`${CLAUDE_PLUGIN_ROOT}/skills/commit/commit-rule.md` のルールに従って、コミットメッセージを提案する。

- 外へ書き込むもの：プロジェクトルート直下の `tmp.md`。ファイルの中の変更を分けるときは、`tmp/<ブランチ名>/commit/<ts>_<N>.patch` も
- 人がすること：`tmp.md` の手順で、ステージ（`git add`・`git apply --cached`）とコミットを実行する。パッチの削除

## 参照ファイル

| ファイル | いつ読むか |
| --- | --- |
| `${CLAUDE_PLUGIN_ROOT}/skills/commit/commit-rule.md` | 手順 3〜5 で、コミットメッセージを書くとき（形式・commitlint の制約・type ごとの例・CI の失敗を直すコミットの書き方） |
| `${CLAUDE_PLUGIN_ROOT}/skills/commit/output-format.md` | 手順 5 で、`tmp.md` に書くとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/commit/patch-split.md` | 手順 2 で、1 つのファイルの中の変更を別々のコミットに分けるとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/commit/ci-failure-url.md` | 手順 3 で、CI の失敗を直すコミットのとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/commit/scripts/check-symlinks.sh` | 手順 1 で、シンボリックリンクを確かめるとき（実行する） |

## 想定している引数

`$ARGUMENTS` は補足指示（任意）。あれば従い、省略されたときは、ステージ済みの差分と会話の経緯から提案する。

## 出力先

提案したコミットメッセージをプロジェクトルート直下の `tmp.md` に書き込む。**既存の `tmp.md` がある場合は、上書き前に必ず `Read` してから `Write` する**（新規時はそのまま作成）。形は `output-format.md`。

ファイルの中の変更を分けるときのパッチは、`tmp/<ブランチ名>/commit/<ts>_<N>.patch` に書く（`<ブランチ名>` の `/` は `-` に置き換える。規約は `aidd` の `README.md` の「ブランチ名の `/` は `-` に置き換える」）。書き方は `patch-split.md`。

## 手順

### 1. ステージ済みの変更を調べる

1. `git status` でステージングされたファイルを確認する。ステージングされたファイルがない場合は、その旨を伝えて処理を終了する
1. `${CLAUDE_PLUGIN_ROOT}/skills/commit/scripts/check-symlinks.sh` を実行する。シンボリックリンクが検出された場合は処理を中断し、「リンク元（実体）を更新してください」とだけ案内する（状況の詳細列挙・コミット方針の確認は行わない）
1. `git diff --cached` でステージング済みの差分を確認する
1. `git log --oneline -5` で直近のコミットメッセージのスタイルを確認する
1. リポジトリに commitlint 設定（`commitlint.config.*` / `.commitlintrc.*` / `package.json` の `commitlint`）があれば `Read` し、行長上限・許可 type を確認する

### 2. コミットを分けるかを判断する

コミット分割が必要か判断する。以下の場合はコミットを分割することを提案する:

- body の What が 5 項目を超える場合
- 異なる目的の変更が混在している場合（例: バグ修正 + リファクタリング）
- subject に「〜と〜」「〜および〜」が含まれる場合

分割を提案する場合は、どのファイルをどのコミットに含めるかを具体的に示す。

1 つのファイルの中に目的の違う変更が混ざっているときは、ファイルの中の変更も分ける。やり方は、`patch-split.md` に書く。

### 3. CI の失敗を直すコミットかを判断する

会話の経緯から、GitHub Actions の失敗を直すコミットかを判断する（例: 失敗した実行のログを読んで直した、補足指示で CI の修正と言われた）。差分だけでは判断できないため、会話にそうした経緯が無ければ通常のコミットとして扱う。CI の修正であれば、Why に CI の失敗を書き（`commit-rule.md` の「CI の失敗を直すコミット」）、`ci-failure-url.md` で URL を取る。

### 4. コミットメッセージを書く

`commit-rule.md` の Conventional Commits 形式に従い、コミットメッセージを提案する。`<type>: <subject>` の形式を厳守する（scope は使用しない）。

### 5. `tmp.md` に書き込む

`tmp.md` に書く前に、各行（subject・body・footer）が行長上限以内か、footer の前に空行があるか確認する（commitlint 違反で commit が弾かれるため。詳細は `commit-rule.md` の「commitlint の制約」）。書き込みの決まりと形は、「出力先」に従う。

## 禁止事項

- コミットメッセージは `tmp.md` に書き込むのみで、**直接コミットを実行しない**
- パッチは書くだけで、`git reset` と、`--check` の無い `git apply` は実行しない。ステージを動かすのは、`tmp.md` の手順を実行する人
- 書いたパッチは消さない。削除は禁止のため、`tmp/` を片付けるときに人がまとめて消す

## 保守

`allowed-tools` に `check-symlinks.sh` の `Bash` パターンを含めていない。プラグインの実体パスは `${CLAUDE_PLUGIN_ROOT}` で解決するが、この変数が `allowed-tools` の frontmatter で展開されるかは公式に記載がないため、当てにせず通常の許可プロンプトを通す。

`git apply` は、`--check` を付けた形だけを `allowed-tools` に載せている。`--check` が無いと、ステージを書き換えるため。

$ARGUMENTS
