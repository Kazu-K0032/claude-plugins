---
name: commit
description: ステージング済みの差分を分析し、Conventional Commits 形式のコミットメッセージを提案する。コミットメッセージの作成やステージング済み変更のレビューを求められた時に使用する
disable-model-invocation: true
allowed-tools: Bash(git status:*), Bash(git branch --show-current), Bash(git check-ignore:*), Bash(date:*), Bash(gh pr checks:*), Read, Read(tmp.md), Edit(tmp.md), Edit(tmp/*/commit/*.patch)
argument-hint: "[補足指示（任意。省略時はステージ済みの差分と会話の経緯から提案する。例: Issue#5 を参照に付ける / 1 コミットにまとめる）]"
---

# コミット提案

ステージ済みの差分と会話の経緯から、`commit-rule.md` のルールに従ってコミットメッセージを提案し、`tmp.md` に書く。

- 外へ書き込むもの：プロジェクトルートの `tmp.md`。ファイルの中の変更を分けるときは、`tmp/<ブランチ名>/commit/` のパッチ
- 人がすること：`tmp.md` の手順でステージを整え、コミットする

## 参照ファイル

| ファイル | いつ読むか |
| --- | --- |
| `${CLAUDE_PLUGIN_ROOT}/skills/commit/commit-rule.md` | 手順 6〜8 でメッセージを作るとき（形式・commitlint の制約・type ごとの例） |
| `${CLAUDE_PLUGIN_ROOT}/skills/commit/output-format.md` | 手順 9 で `tmp.md` に書くとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/commit/split-within-file.md` | 手順 6 で、1 つのファイルの中の変更を別々のコミットに分けるとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/commit/ci-run-url.md` | 手順 7 で、CI の失敗を直すコミットに失敗した実行の URL を添えるとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/commit/scripts/check-symlinks.sh` | 手順 2 で実行する |
| `${CLAUDE_PLUGIN_ROOT}/references/tmp-ignore.md` | 手順 1 の前に、`tmp/`・`tmp.md` の除外を確かめるとき |

## 想定している引数

`$ARGUMENTS` は補足指示（参照に付ける Issue・コミットのまとめ方など）。省くと、ステージ済みの差分と会話の経緯から提案する。

## 出力先

- コミットメッセージ：プロジェクトルート直下の `tmp.md`
- パッチ：`tmp/<ブランチ名>/commit/<ts>_<N>.patch`。ファイルの中の変更を分けるときだけ書く。`<ブランチ名>` は `git branch --show-current` で取り、`/` は `-` に置き換える（例：`issues/5-sample` → `issues-5-sample`。規約は `aidd` の `README.md` の「ブランチ名の `/` は `-` に置き換える」）。`<ts>` は `date +%Y%m%d_%H%M%S` で取る

手順 1 の前に、`tmp-ignore.md` で `tmp/`・`tmp.md` の除外を確かめる。

## 手順

### 1. ステージ済みのファイルを確かめる

`git status` で確かめる。ステージ済みのファイルが無ければ、その旨を伝えて終わる。

### 2. シンボリックリンクを確かめる

`check-symlinks.sh` を `sh` で実行する。ステージのモードで見るため、Windows でも見つかる。

```bash
sh "${CLAUDE_PLUGIN_ROOT}/skills/commit/scripts/check-symlinks.sh"
```

ほかの手順（`issue-start` など）からこのファイルを読んだときは、`${CLAUDE_PLUGIN_ROOT}` が置き換わらない。この `SKILL.md` の 2 つ上のフォルダ（プラグインの場所）に読み替える。そのままでは、スクリプトが見つからないため。

実行できなければ、確かめずに進めず中断する。リンクを見逃したままコミットされるため。`sh` が無いときは Git Bash などの `sh` が要ると、スクリプトが見つからないときはそのパスを伝える。シンボリックリンクが見つかったら中断し、「リンク先（実体）を更新してください」とだけ案内する（状況の詳細の列挙・コミット方針の確認は行わない）。

### 3. 差分を読む

`git diff --cached` で、ステージ済みの差分を読む。

### 4. 直近のコミットのスタイルを確かめる

`git log --oneline -5` で確かめる。

### 5. commitlint の設定を読む

リポジトリに commitlint の設定（`commitlint.config.*`・`.commitlintrc.*`・`package.json` の `commitlint`）があれば Read し、行長の上限・許可する type を確かめる。

### 6. コミットを分けるかを決める

次のどれかに当たるときは、コミットを分けるよう提案する。分けるときは、どのファイルをどのコミットに入れるかを具体的に示す。

- body の What が 5 項目を超える
- 異なる目的の変更が混ざっている（例：バグ修正とリファクタリング）
- subject に「〜と〜」「〜および〜」が含まれる

1 つのファイルの中に目的の違う変更が混ざっているときは、ファイルの中の変更も分ける。`split-within-file.md` の手順でパッチを書く。

### 7. CI の失敗を直すコミットかを判断する

会話の経緯から、GitHub Actions の失敗を直すコミットかを判断する（例：失敗した実行のログを読んで直した、補足指示で CI の修正と言われた）。差分だけでは判断できないため、会話にそうした経緯が無ければ、通常のコミットとして扱う。CI の修正なら、Why に CI の失敗を書き（`commit-rule.md` の「CI の失敗を直すコミット」）、`ci-run-url.md` で URL を取る。

### 8. メッセージを作る

`commit-rule.md` の Conventional Commits の形式で作る。`<type>: <subject>` の形を守り、scope は使わない。`tmp.md` に書く前に、各行（subject・body・footer）が行長の上限以内か、footer の前に空行があるかを確かめる。commitlint に違反すると commit が弾かれるため（`commit-rule.md` の「commitlint の制約」）。

### 9. `tmp.md` に書く

`output-format.md` の形で書く。既存の `tmp.md` があれば、上書きする前に必ず Read してから Write する（新規ならそのまま作る）。`tmp.md` が除外されていなければ、上書きの前に `tmp-ignore.md` のとおり聞く。

## 禁止事項

- ❌ コミットを実行すること（メッセージは `tmp.md` に書くだけにする）
- ❌ `git reset` と、`--check` の無い `git apply` を実行すること。パッチは書くだけにする。ステージを動かすのは、`tmp.md` の手順を実行する人のため
- ❌ 書いたパッチを消すこと。削除は禁止のため、`tmp/` を片付けるときに人がまとめて消す

## 保守

- `allowed-tools` に `check-symlinks.sh` の `Bash` パターンを含めていない。プラグインの実体パスは `${CLAUDE_PLUGIN_ROOT}` で解決するが、この変数が `allowed-tools` の frontmatter で展開されるかは公式に記載がないため、当てにせず通常の許可プロンプトを通す
- `git apply` は `allowed-tools` に載せていない。`--check` を付けても、後ろに `--apply` を付けるとパッチを当て、ステージを書き換えるため、前方一致では許可できない。パッチの確かめ（`git apply --check`）は、許可プロンプトを通す

$ARGUMENTS
