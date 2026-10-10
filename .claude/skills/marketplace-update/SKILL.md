---
name: marketplace-update
description: claude-plugins マーケットプレイスを更新する時に、init-repo テンプレートの権限設定と各スキルの allowed-tools・出力先・参照パス・カタログ記載・テンプレートの収録物表・重複ファイル・入力ヒントの書き方の整合をチェックして修正し、スキルが同梱する mod の検証とテストを流す。プラグインやテンプレートを編集した後、push する前に使用する
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(git status:*), Bash(git diff:*), Bash(python .claude/skills/marketplace-update/scripts/check.py:*), Bash(python3 .claude/skills/marketplace-update/scripts/check.py:*), Bash(claude plugin validate:*), Bash(claude plugin test:*)
argument-hint: "[重点的に見たい範囲（任意。省略時はすべてのチェックを同じ重さで見る。例: init-repo のテンプレート / 重複ファイル）]"
---

# マーケットプレイス更新チェック

このリポジトリ（claude-plugins）の変更を push する前に、**テンプレートの権限設定と各スキルの整合**を検査して直す。対象は `plugins/` 配下の全プラグイン（`aidd`・`config`・`project`）と、`plugins/project/skills/init-repo/files/` が配る `.claude/settings.json`、`.claude/rules/duplicated-files.md` に載っている重複ファイルの組、各スキル（`.claude/skills/` を含む）の入力ヒント（`argument-hint`）、スキルが同梱する mod（`claude plugin validate`・`claude plugin test`）。

## なぜ必要か

`init-repo` が配るテンプレートは、導入先で**常時効く deny**を持つ。スキル側が deny に一致するコマンドを使うと、導入先でそのスキルだけ動かなくなる。両者は別ファイルのため、片方だけ直すとずれる。

## 手順

### 1. 変更を把握する

```bash
git status --short
git diff
```

### 2. 機械チェックを実行する

```bash
python .claude/skills/marketplace-update/scripts/check.py
```

`python3` しか無い環境ではそちらで実行する。NG が 1 件でもあれば終了コードは 1。

### 3. NG を直す

| カテゴリ | 内容 | 直し方 |
| --- | --- | --- |
| `rule-form` | `allowed-tools` に `Write()` / `NotebookEdit()` / `MultiEdit()` / `Glob()` のパス規則がある | 書き込みは `Edit(<パス>)`、検索は `Read(<パス>)` に置き換える。これらのパス規則は権限判定に使われない |
| `deny-conflict` | スキルが事前許可するコマンドが、テンプレートの deny の Bash 規則に一致する（`PowerShell()`・`Edit()` などの規則は照合しない） | スキル側のコマンドを読み取り系に変えるか、deny の見直しをユーザーに確認する（**deny を無断で緩めない**） |
| `plugin-root-ref` | `${CLAUDE_PLUGIN_ROOT}/...` の参照先が無い | パスの誤り・ファイルの移動漏れを直す |
| `catalog` | スキル名・README の一覧・`marketplace.json` の source がずれている、または `plugins/` 配下のプラグインが `marketplace.json` に登録されていない | 実体に合わせて README か名前を直す。未登録なら `marketplace.json` の `plugins` にエントリを追加する |
| `template-inventory` | テンプレートを持つスキル（`skills/<スキル名>/files/`）の README にある `files/...` が存在しない、または README が無い | 収録物表か実ファイルのどちらが正かを判断して揃える |
| `duplicated-files` | 重複ファイルの組の片方が存在しない、または `duplicated-files.md` の `paths` に載っていない | 表と `paths` を実際のパスに合わせる |
| `argument-hint` | 入力ヒントの引数が `[]` か `<>` で囲まれていない、`[]` に「（任意。省略時は」が無い、または `<>` に「任意」「省略」がある | `.claude/rules/argument-hint.md` の書き方に直す。省略時の動きは本文を読んで確かめてから書く |

### 4. WARN を判断する

WARN は機械的に白黒を付けられないもの。1 件ずつ見て、直すか残すかを決める。

- `deny-conflict`（本文）— そのコマンドを **Claude に実行させる**のか、**人が手で実行する例示**なのかで判断する。実行させるなら deny との整合が要る。例示なら残してよい
- `output-path` — 書き込み許可のパスが `tmp/` の外にある。出力先を固定できているか、白紙委任になっていないかを確認する
- `template-inventory` — テンプレートに増やしたファイルが、そのスキルの README の収録物表に載っていない。表に行を足す
- `duplicated-files` — 重複ファイルの組の内容が違う。片方の変更をもう片方にも入れるか、意図的な差分なら `duplicated-files.md` の表の「意図的な差分」に理由を書く
- `argument-hint` — 本文で `$ARGUMENTS` を使うのに入力ヒントが無い。引数を受け取るならヒントを書き、受け取らないなら `$ARGUMENTS` を消して本文に「引数は受け取らない」と書く

### 5. 機械チェックが見ない箇所を確認する

- 各プラグインの `.claude-plugin/plugin.json` の `description` と、`marketplace.json` の `description` が、現在の収録スキルと合っているか
- ルート `README.md` の収録プラグイン表と案内文が実態と合っているか
- テンプレートを持つスキル（`init-repo`・`gas` 等）の README の「除外したもの」「前提と制約」が、テンプレートの現状と合っているか
- テンプレート（`files/`）に、導入先で書き換える箇所として `TODO:` が残っているか（プロジェクト固有の値を埋め込んでいないか）
- 入力ヒントに書いた「省略時は〜」が、本文の実際の動きと合っているか（機械チェックは書き方だけを見る）
- プラグインを追加・改名した場合、起票の対象として名前を挙げている箇所（`plugins/config/hooks/plugin-feedback.md` と、`plugins/config/skills/plugin-feedback/SKILL.md` の `description`）も直したか
- 変更が `docs/policies/` の方針に反していないか。新しく決めた方針・認めた例外を、方針のファイルと一覧（`docs/policies/README.md`・`.claude/rules/plugin-changes.md`）に書いたか
- スキル・フックが利用先で触れるもの（`tmp/` 以外への書き込み・設定ファイル・`gh` / `git` の書き込み系・環境変数）か、`init-repo` の権限・フック・`.gitignore` を変えた場合、`docs/policies/permissions.md` を直し、ほかのプラグインの操作を止めていないかを確かめたか（機械チェックは `allowed-tools` と本文のコマンドだけを見る）

### 6. マニフェストを検証し、テストを動かす

```bash
claude plugin validate .
claude plugin validate plugins/config/skills/mod-output-customize/files/mod-output-customize
claude plugin test plugins/config/skills/mod-output-customize/files/mod-output-customize
```

スキルが導入する mod は、テンプレート（`skills/<スキル名>/files/`）として同梱している。マーケットプレイスのプラグインではないため `claude plugin validate .` では読まれず、mod のフォルダを直接渡す。`claude plugin test` は、mod のテスト（`*.test.ts`・`*.test.tsx`）を、mod が動くのと同じ環境で動かす。mod（`hooks/hooks.json` の `modules`）の無いフォルダを渡すと失敗するため、mod のフォルダだけを並べる。

手順 2 の機械チェックと、この手順のコマンドは、PR でも `.github/workflows/plugin-checks.yml` が動かす。mod を増やしたら、ここと `plugin-checks.yml` の両方に足す。

### 7. コミットする

コミットメッセージは `/aidd:commit` に任せる。**このスキルはコミットも push もしない**。

push 後、利用側は次で取得する。

```bash
/plugin marketplace update kazu
/reload-plugins
```

## 禁止事項

- ❌ ユーザーの承認なしにテンプレートの `permissions.deny` を緩める（セキュリティ方針の変更に当たる）
- ❌ このスキルからコミット・push を実行する
- ❌ NG を「実害が無さそう」で見送る。直すか、直さない理由をユーザーに説明して判断を仰ぐ

## 参考

権限規則の仕様（`Edit()` と `Read()` だけが判定に使われること、deny → ask → allow の評価順、allow で deny の例外を作れないこと）は [Configure permissions](https://code.claude.com/docs/ja/permissions) が正典。

$ARGUMENTS
