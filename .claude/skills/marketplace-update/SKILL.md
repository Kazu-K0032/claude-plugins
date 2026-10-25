---
name: marketplace-update
description: claude-plugins マーケットプレイスを更新する時に、init-repo テンプレートの権限設定と各スキルの allowed-tools・出力先・参照パス・カタログ記載・テンプレートの収録物表・重複ファイル・入力ヒントの書き方・版の整合をチェックして修正し、スキルが同梱する mod の検証とテストを流す。プラグインやテンプレートを編集した後、push する前に使用する
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(git status:*), Bash(python .claude/skills/marketplace-update/scripts/check.py:*), Bash(python3 .claude/skills/marketplace-update/scripts/check.py:*), Bash(claude plugin validate:*), Bash(claude plugin test:*)
argument-hint: "[重点的に見たい範囲（任意。省略時はすべてのチェックを同じ重さで見る。例: init-repo のテンプレート / 重複ファイル）]"
---

# マーケットプレイス更新チェック

このリポジトリ（claude-plugins）の変更を push する前に、**テンプレートの権限設定と各スキルの整合**を検査して直し、スキルが同梱する mod を検証・テストする。`init-repo` が配る deny は導入先で常に効く。スキルが deny に当たるコマンドを使うと、導入先でそのスキルだけが動かなくなる。両者は別ファイルのため、片方だけ直すとずれる。

- 外へ書き込むもの：なし。直すのは、手順 3〜5 で見つけたこのリポジトリのファイル
- 人がすること：deny を緩めるか・食い違いを直さずに残すかの判断、前から上限を超えている文書を縮めるかの判断、`git fetch origin`（`--base` を付けるとき）、コミット・push

## 参照ファイル

| ファイル | いつ読むか |
| --- | --- |
| `.claude/skills/marketplace-update/scripts/check.py` | 手順 2 で実行する。NG・WARN が何を見ているかを確かめるときに読む |
| `.claude/skills/marketplace-update/ng-warn.md` | 手順 3・4 で、カテゴリごとの NG・WARN の直し方と、WARN を残してよい場合を調べるとき |
| `docs/release.md` | `version` の NG を直すとき（版を上げてよいブランチを確かめる） |

## 想定している引数

- `$ARGUMENTS` には、重点的に見たい範囲（例：`init-repo` のテンプレート・重複ファイル）が入る。指定があっても、ほかのチェックは省かない
- 空なら、すべてのチェックを同じ重さで見る

## 出力先

ファイルには書き出さない。NG・WARN と、それぞれを直したか・残したかを、会話で利用者に伝える。

## 手順

### 1. 変更を把握する

`git status --short` と `git diff` で、今の変更を把握する。

### 2. 機械チェックを実行する

`check.py` で、NG と WARN を洗い出す。NG が 1 件でもあれば、終了コードは 1 になる。

```bash
python .claude/skills/marketplace-update/scripts/check.py
```

- `python3` しか無い環境では、そちらで実行する
- 見るのは、`plugins/` 配下の全プラグイン（`aidd`・`config`・`project`）、このリポジトリと `plugins/project/skills/init-repo/files/` が配る 2 つの `.claude/settings.json`（deny の `PowerShell(...)` の組・2 つの食い違い）、`.claude/rules/duplicated-files.md` に載っている重複ファイルの組、各スキル（`.claude/skills/` を含む）の入力ヒント（`argument-hint`）と `allowed-tools` の前方一致、`SKILL.md` と規約（`.claude/rules/` と配る規約）の本文の長さ、各プラグインの版（`version`）
- deny との衝突は、`allowed-tools` と、スキルが手順として読む md の本文を見る（範囲は `ng-warn.md` の `deny-conflict`）
- 版を上げるブランチ（リリースの前に版を上げる PR と `hotfix/`）と `release/` のブランチでは、`--base origin/main` を付けて版の上げ忘れも見る。先に利用者に `git fetch origin` を頼み、`origin/main` を最新にしておく

```bash
python .claude/skills/marketplace-update/scripts/check.py --base origin/main
```

### 3. NG を直す

NG を 1 件ずつ直す。直し方は、`ng-warn.md` の「NG の直し方」を読む。

### 4. WARN を直す

WARN を 1 件ずつ直す。直し方と、残してよい場合は、`ng-warn.md` の「WARN の判断」を読む。それ以外で残すのは、利用者が決めたときだけ。

### 5. 機械チェックが見ない箇所を確かめて直す

次の箇所を目で確かめ、食い違いがあれば直す。

- 各プラグインの `.claude-plugin/plugin.json` の `description` と、`marketplace.json` の `description` が、現在の収録スキルと合っているか
- ルート `README.md` の収録プラグイン表と案内文が実態と合っているか
- テンプレートを持つスキル（`init-repo`・`gas` 等）の README の「除外したもの」「前提と制約」が、テンプレートの現状と合っているか
- テンプレート（`files/`）に、導入先で書き換える箇所として `TODO:` が残っているか（プロジェクト固有の値を埋め込んでいないか）
- 入力ヒントに書いた「省略時は〜」が、本文の実際の動きと合っているか（機械チェックは書き方だけを見る）
- プラグインを追加・改名した場合、起票の対象として名前を挙げている箇所（`plugins/config/hooks/plugin-feedback.md` と、`plugins/config/skills/plugin-feedback/SKILL.md` の `description`）も直したか
- 変更が `docs/policies/` の方針に反していないか。新しく決めた方針・認めた例外を、方針のファイルと一覧（`docs/policies/README.md`・`.claude/rules/plugin-policies.md`）に書いたか
- スキル・フックが利用先で触れるもの（`tmp/` 以外への書き込み・設定ファイル・`gh` / `git` の書き込み系・環境変数）か、`init-repo` の権限・フック・`.gitignore` を変えた場合、`docs/policies/permissions.md` を直し、ほかのプラグインの操作を止めていないかを確かめたか（機械チェックは `allowed-tools` と本文のコマンドだけを見る）
  - deny・フックの線引きを変えた場合は、配る規約 `plugins/project/skills/init-repo/files/.claude/rules/permissions.md` と、監査の物差し `plugins/aidd/references/harness-principles.md`（「土台の仕組み」）も直したか（機械チェックの `deny-sync` は、物差しの例に当たる deny がテンプレートに残っているかだけを見る）

直したら、手順 2 をもう一度実行する。今の変更より前からある食い違いを直したときは、今の変更と別のコミットにするよう伝える。目的の違う差分が混ざると、レビューで追いにくいため。

### 6. マニフェストを検証し、テストを動かす

マーケットプレイスと、スキルが同梱する mod を検証し、mod のテストを動かす。mod はマーケットプレイスのプラグインではなく `claude plugin validate .` では読まれないため、mod のフォルダを直接渡す。

```bash
claude plugin validate --strict .
claude plugin validate plugins/config/skills/mod-output-customize/files/mod-output-customize
claude plugin test plugins/config/skills/mod-output-customize/files/mod-output-customize
```

### 7. コミットを利用者に任せる

コミットメッセージは `/aidd:commit` に任せる。**このスキルはコミットも push もしない**。

利用者に届くのは、版を上げて `main` にリリースした後（手順は `docs/release.md`）。利用側は次で取得する。

```text
/plugin marketplace update kazu
/reload-plugins
```

## 禁止事項

- ❌ ユーザーの承認なしにテンプレートの `permissions.deny` を緩める（セキュリティ方針の変更に当たる）
- ❌ このスキルからコミット・push を実行する
- ❌ NG を「実害が無さそう」で見送る。直すか、直さない理由をユーザーに説明して判断を仰ぐ

## 保守

- 権限規則の仕様（`Edit()` と `Read()` だけが判定に使われること、deny → ask → allow の評価順、allow で deny の例外を作れないこと）は [Configure permissions](https://code.claude.com/docs/ja/permissions) が正典
- mod は、テンプレート（`skills/<スキル名>/files/`）として同梱している
- `--strict`（警告も失敗にする）は、マーケットプレイスにだけ付ける。mod は情報の警告が出るため付けない
- `claude plugin test` は、mod のテスト（`*.test.ts`・`*.test.tsx`）を、mod が動くのと同じ環境で動かす。mod（`hooks/hooks.json` の `modules`）の無いフォルダを渡すと失敗するため、手順 6 には mod のフォルダだけを並べる
- 手順 2 の機械チェックと手順 6 のコマンドは、PR でも `.github/workflows/plugin-checks.yml` が動かす。CI は、`main` へ向けた PR と、リリースの Issue（`release.yml` から呼ぶとき）で `--base` を付ける
- mod を増やしたら、手順 6 と `plugin-checks.yml` の両方に足す
- `check.py` に NG・WARN のカテゴリを足したら、`ng-warn.md` にも直し方・判断のしかたを足す
- `git diff` は `--output` で書き込めるため、`allowed-tools` に入れていない（P1 の「確認なしで任せる操作」）

$ARGUMENTS
