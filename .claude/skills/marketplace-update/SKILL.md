---
name: marketplace-update
description: claude-plugins マーケットプレイスを更新する時に、init-repo テンプレートの権限設定と各スキルの allowed-tools・出力先・参照パス・カタログ記載・テンプレートの収録物表・重複ファイル・入力ヒントの書き方・版の整合をチェックして修正し、スキルが同梱する mod の検証とテストを流す。プラグインやテンプレートを編集した後、push する前に使用する
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(git status:*), Bash(python .claude/skills/marketplace-update/scripts/check.py:*), Bash(python3 .claude/skills/marketplace-update/scripts/check.py:*), Bash(claude plugin validate:*), Bash(claude plugin test:*)
argument-hint: "[重点的に見たい範囲（任意。省略時はすべてのチェックを同じ重さで見る。例: init-repo のテンプレート / 重複ファイル）]"
---

# マーケットプレイス更新チェック

このリポジトリ（claude-plugins）の変更を push する前に、**テンプレートの権限設定と各スキルの整合**を検査して直す。`init-repo` が配るテンプレートは導入先で常時効く deny を持ち、スキルが deny に一致するコマンドを使うと導入先でそのスキルだけ動かなくなるが、両者は別ファイルで、片方だけ直すとずれるため。

- 外へ書き込むもの：NG・WARN を直すための、このリポジトリのファイル（`plugins/`・`.claude/`・README・`marketplace.json` など）
- 人がすること：`--base` を使うときの `git fetch origin`、コミットと push、テンプレートの `permissions.deny` を緩める承認

## 参照ファイル

| ファイル | いつ読むか |
| --- | --- |
| `categories.md` | 手順 3 で NG を直すとき、手順 4 で WARN を判断するとき。検査の対象の一覧も、ここにある |

## 想定している引数

重点的に見たい範囲（任意）を受け取る。省略時は、すべてのチェックを同じ重さで見る。

$ARGUMENTS

## 手順

### 1. 変更を把握する

```bash
git status --short
git diff
```

`git diff` は `--output` で書き込めるため、`allowed-tools` に入れていない（P1 の「確認なしで任せる操作」）。

### 2. 機械チェックを実行する

```bash
python .claude/skills/marketplace-update/scripts/check.py
```

`python3` しか無い環境ではそちらで実行する。NG が 1 件でもあれば終了コードは 1。

版を上げるブランチ（リリースの前に版を上げる PR と `hotfix/`）と `release/` のブランチでは、`--base origin/main` を付けて版の上げ忘れも見る。先に利用者に `git fetch origin` を頼み、`origin/main` を最新にしておく。

```bash
python .claude/skills/marketplace-update/scripts/check.py --base origin/main
```

### 3. NG を直す

NG は、`categories.md` の「NG を直す」の表で、カテゴリごとの直し方を確かめて直す。

### 4. WARN を判断する

WARN は機械的に白黒を付けられないもの。1 件ずつ見て、直すか残すかを決める。カテゴリごとの判断は、`categories.md` の「WARN を判断する」に従う。`doc-length` だけは、ここに書く。

- `doc-length` — `SKILL.md` か規約の本文が 5,000 文字を超える。今の変更で超えたなら、細部を別ファイルに分ける（`.claude/rules/ai-docs.md`）。前から超えているものは、縮めるかを利用者に聞き、縮めるならほかの変更と分ける

### 5. 機械チェックが見ない箇所を確認する

- 各プラグインの `.claude-plugin/plugin.json` の `description` と、`marketplace.json` の `description` が、現在の収録スキルと合っているか
- ルート `README.md` の収録プラグイン表と案内文が実態と合っているか
- テンプレートを持つスキル（`init-repo`・`gas` 等）の README の「除外したもの」「前提と制約」が、テンプレートの現状と合っているか
- テンプレート（`files/`）に、導入先で書き換える箇所として `TODO:` が残っているか（プロジェクト固有の値を埋め込んでいないか）
- 入力ヒントに書いた「省略時は〜」が、本文の実際の動きと合っているか（機械チェックは書き方だけを見る）
- プラグインを追加・改名した場合、起票の対象として名前を挙げている箇所（`plugins/config/hooks/plugin-feedback.md` と、`plugins/config/skills/plugin-feedback/SKILL.md` の `description`）も直したか
- 変更が `docs/policies/` の方針に反していないか。新しく決めた方針・認めた例外を、方針のファイルと一覧（`docs/policies/README.md`・`.claude/rules/policy-lookup.md`）に書いたか
- スキル・フックが利用先で触れるもの（`tmp/` 以外への書き込み・設定ファイル・`gh` / `git` の書き込み系・環境変数）か、`init-repo` の権限・フック・`.gitignore` を変えた場合、`docs/policies/permissions.md` を直し、ほかのプラグインの操作を止めていないかを確かめたか（機械チェックは `allowed-tools` と本文のコマンドだけを見る）
  - deny・フックの線引きを変えた場合は、配る規約 `plugins/project/skills/init-repo/files/.claude/rules/permissions.md` と、監査の物差し `plugins/aidd/references/harness-principles.md`（「土台の仕組み」）も直したか（機械チェックの `deny-sync` は、物差しの例に当たる deny がテンプレートに残っているかだけを見る）

### 6. マニフェストを検証し、テストを動かす

```bash
claude plugin validate --strict .
claude plugin validate plugins/config/skills/mod-output-customize/files/mod-output-customize
claude plugin test plugins/config/skills/mod-output-customize/files/mod-output-customize
```

スキルが導入する mod は、テンプレート（`skills/<スキル名>/files/`）として同梱している。マーケットプレイスのプラグインではないため `claude plugin validate .` では読まれず、mod のフォルダを直接渡す。`--strict`（警告も失敗にする）はマーケットプレイスにだけ付ける。mod は情報の警告が出るため付けない。`claude plugin test` は、mod のテスト（`*.test.ts`・`*.test.tsx`）を、mod が動くのと同じ環境で動かす。mod（`hooks/hooks.json` の `modules`）の無いフォルダを渡すと失敗するため、mod のフォルダだけを並べる。

手順 2 の機械チェックと、この手順のコマンドは、PR でも `.github/workflows/plugin-checks.yml` が動かす。CI は、`main` へ向けた PR と、リリースの Issue（`release.yml` から呼ぶとき）で `--base` を付ける。mod を増やしたら、ここと `plugin-checks.yml` の両方に足す。

### 7. コミットする

コミットメッセージは `/aidd:commit` に任せる。**このスキルはコミットも push もしない**。

利用者に届くのは、版を上げて `main` にリリースした後（手順は `docs/release.md`）。利用側は次で取得する。

```bash
/plugin marketplace update kazu
/reload-plugins
```

## 禁止事項

- ❌ ユーザーの承認なしにテンプレートの `permissions.deny` を緩める（セキュリティ方針の変更に当たる）
- ❌ このスキルからコミット・push を実行する
- ❌ NG を「実害が無さそう」で見送る。直すか、直さない理由をユーザーに説明して判断を仰ぐ

## 保守

権限規則の仕様（`Edit()` と `Read()` だけが判定に使われること、deny → ask → allow の評価順、allow で deny の例外を作れないこと）は [Configure permissions](https://code.claude.com/docs/ja/permissions) が正典。
