---
name: marketplace-update
description: claude-plugins マーケットプレイスを更新する時に、init-repo テンプレートの権限設定と各スキルの allowed-tools・出力先・参照パス・カタログ記載の整合をチェックして修正する。プラグインやテンプレートを編集した後、push する前に使用する
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(git status:*), Bash(git diff:*), Bash(python .claude/skills/marketplace-update/scripts/check.py:*), Bash(python3 .claude/skills/marketplace-update/scripts/check.py:*), Bash(claude plugin validate:*)
argument-hint: "[重点的に見たい範囲（任意）]"
---

# マーケットプレイス更新チェック

このリポジトリ（claude-plugins）の変更を push する前に、**テンプレートの権限設定と各スキルの整合**を検査して直す。対象は `plugins/aidd/` 配下と、`plugins/aidd/skills/init-repo/files/` が配る `.claude/settings.json`。

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
| `rule-form` | `allowed-tools` に `Write()` / `NotebookEdit()` / `Glob()` のパス規則がある | 書き込みは `Edit(<パス>)`、検索は `Read(<パス>)` に置き換える。これらのパス規則は権限判定に使われない |
| `deny-conflict` | スキルが事前許可するコマンドが、テンプレートの deny に一致する | スキル側のコマンドを読み取り系に変えるか、deny の見直しをユーザーに確認する（**deny を無断で緩めない**） |
| `plugin-root-ref` | `${CLAUDE_PLUGIN_ROOT}/...` の参照先が無い | パスの誤り・ファイルの移動漏れを直す |
| `catalog` | スキル名・README の一覧・`marketplace.json` の source がずれている | 実体に合わせて README か名前を直す |
| `template-inventory` | `init-repo` の README にある `files/...` が存在しない | 収録物表か実ファイルのどちらが正かを判断して揃える |

### 4. WARN を判断する

WARN は機械的に白黒を付けられないもの。1 件ずつ見て、直すか残すかを決める。

- `deny-conflict`（本文）— そのコマンドを **Claude に実行させる**のか、**人が手で実行する例示**なのかで判断する。実行させるなら deny との整合が要る。例示なら残してよい
- `output-path` — 書き込み許可のパスが `tmp/` の外にある。出力先を固定できているか、白紙委任になっていないかを確認する
- `template-inventory` — テンプレートに増やしたファイルが `init-repo` の README の収録物表に載っていない。表に行を足す

### 5. 機械チェックが見ない箇所を確認する

- `plugins/aidd/.claude-plugin/plugin.json` の `description` が、現在の収録スキルと合っているか
- ルート `README.md` の収録プラグイン表と案内文が実態と合っているか
- `init-repo` の README の「除外したもの」「前提と制約」が、テンプレートの現状と合っているか
- テンプレート（`files/`）に、導入先で書き換える箇所として `TODO:` が残っているか（プロジェクト固有の値を埋め込んでいないか）

### 6. マニフェストを検証する

```bash
claude plugin validate .
```

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
