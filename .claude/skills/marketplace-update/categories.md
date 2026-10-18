# 機械チェックの NG・WARN の直し方

`check.py` が出す NG・WARN を、カテゴリごとにどう直すか・どう判断するかをまとめる。`SKILL.md` の手順 3（NG）と手順 4（WARN）から読む。

## 検査の対象

対象は `plugins/` 配下の全プラグイン（`aidd`・`config`・`project`）と、`plugins/project/skills/init-repo/files/` が配る `.claude/settings.json`、`.claude/rules/duplicated-files.md` に載っている重複ファイルの組、各スキル（`.claude/skills/` を含む）の入力ヒント（`argument-hint`）、`SKILL.md` と規約（`.claude/rules/` と配る規約）の本文の長さ、各プラグインの版（`version`）、スキルが同梱する mod（`claude plugin validate`・`claude plugin test`）。

## NG を直す

| カテゴリ | 内容 | 直し方 |
| --- | --- | --- |
| `rule-form` | `allowed-tools` に `Write()` / `NotebookEdit()` / `MultiEdit()` / `Glob()` のパス規則がある | 書き込みは `Edit(<パス>)`、検索は `Read(<パス>)` に置き換える。これらのパス規則は権限判定に使われない |
| `deny-conflict` | スキルが事前許可するコマンドが、テンプレートの deny の Bash 規則に一致する（`PowerShell()`・`Edit()` などの規則は照合しない） | スキル側のコマンドを読み取り系に変えるか、deny の見直しをユーザーに確認する（**deny を無断で緩めない**） |
| `deny-powershell` | `settings.json`（このリポジトリとテンプレート）の deny に、`Bash(git ...)`・`Bash(gh ...)` の組になる `PowerShell(...)` が無い、または削除の別名（`Remove-Item`・`rm`・`rmdir`・`del`・`rd`・`ri`・`erase`）の `PowerShell(<名前> *)` が無い。`Bash(...)` の規則は PowerShell のツールには効かないため | 組を足す（P1） |
| `allowed-prefix` | `allowed-tools` に、書き込み・実行のオプションを持つコマンド（`git diff`・`git log`・`git show`・`git grep`・`gh api`）の前方一致か、`Bash(git branch:*)` がある | 外して許可プロンプトを通すか、`Bash(git branch --show-current)` のように完全一致で書く（P1 の「確認なしで任せる操作」） |
| `plugin-root-ref` | `${CLAUDE_PLUGIN_ROOT}/...` の参照先が無い | パスの誤り・ファイルの移動漏れを直す |
| `catalog` | スキル名・README の一覧・`marketplace.json` の source がずれている、または `plugins/` 配下のプラグインが `marketplace.json` に登録されていない | 実体に合わせて README か名前を直す。未登録なら `marketplace.json` の `plugins` にエントリを追加する |
| `template-inventory` | テンプレートを持つスキル（`skills/<スキル名>/files/`）の README にある `files/...` が存在しない、または README が無い | 収録物表か実ファイルのどちらが正かを判断して揃える |
| `duplicated-files` | 重複ファイルの組の片方が存在しない、または `duplicated-files.md` の `paths` に載っていない | 表と `paths` を実際のパスに合わせる |
| `argument-hint` | 入力ヒントの引数が `[]` か `<>` で囲まれていない、`[]` に「（任意。省略時は」が無い、または `<>` に「任意」「省略」がある | `.claude/rules/argument-hint.md` の書き方に直す。省略時の動きは本文を読んで確かめてから書く |
| `version` | `plugin.json` の版が `X.Y.Z` でない・プラグインの間でそろっていない、`marketplace.json` に版がある。`--base` を付けたときは、`plugins/` を変えたのに版が上がっていない | 3 つの `plugin.json` を同じ版にし、`marketplace.json` から消す。版を上げるのは、リリースの前に版を上げる PR と hotfix だけ（`docs/release.md`） |

## WARN を判断する

- `deny-conflict`（本文）— そのコマンドを **Claude に実行させる**のか、**人が手で実行する例示**なのかで判断する。実行させるなら deny との整合が要る。例示なら残してよい
- `deny-sync` — 2 つの `settings.json`（このリポジトリとテンプレート）の deny が食い違う、または `plugins/aidd/references/harness-principles.md` の「土台の仕組み」の例に当たる deny がテンプレートに無い。食い違いは、もう片方にも入れるか、意図した違いかを確かめる。物差しの例に当たる deny が無いときは、物差しの例を直すか、deny を戻す
- `output-path` — 書き込み許可のパスが `tmp/` の外にある。出力先を固定できているか、白紙委任になっていないかを確認する
- `template-inventory` — テンプレートに増やしたファイルが、そのスキルの README の収録物表に載っていない。表に行を足す
- `duplicated-files` — 重複ファイルの組の内容が違う。片方の変更をもう片方にも入れるか、意図的な差分なら `duplicated-files.md` の表の「意図的な差分」に理由を書く。理由を書いた組は frontmatter を除いて比べるため、本文の差分は WARN のまま残る
- `argument-hint` — 本文で `$ARGUMENTS` を使うのに入力ヒントが無い。引数を受け取るならヒントを書き、受け取らないなら `$ARGUMENTS` を消して本文に「引数は受け取らない」と書く
