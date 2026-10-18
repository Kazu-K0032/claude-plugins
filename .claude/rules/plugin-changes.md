# プラグインの変更に関するルール

このリポジトリの 3 つのプラグイン（`aidd`・`config`・`project`）を変更するときに守ることを、変更の種類ごとに決める。3 つは同じ環境に入れて使う前提のため、変更が `docs/policies/` の方針や、ほかのプラグインの動きとぶつからないようにする。

## スキルやテンプレートを変更する場合

- 変更する前に、`.claude/rules/plugin-policies.md` の 2 つの表から関係する方針を探し、そのファイルを読む。迷う場面は、そのファイルの Q&A に従う
- 変更が方針に反するときは、実装する前に利用者に伝え、次の 3 つから選んでもらう
  - 変更のほうを、方針に合わせる
  - 方針を変える（下の「方針を足す・変える場合」）
  - 例外として認める。方針のファイルの冒頭の表の「例外」に、理由とともに書く

## 権限設定や、スキルが利用先で触れるものを変更する場合

次のどちらかを変えたら、[docs/policies/permissions.md](../../docs/policies/permissions.md) の対応表を直す。deny・フックの線引きを変えたら、`init-repo` が配る `files/.claude/rules/permissions.md` と、監査の物差しの `plugins/aidd/references/harness-principles.md`（「土台の仕組み」）も直す。直したかは、`/marketplace-update` の手順 5 で確かめる。`check.py` の `deny-sync` が見るのは、2 つの `settings.json` の deny の食い違いと、物差しの例に当たる deny がテンプレートに残っているかだけ。

- `init-repo` の `settings.json`（deny）・フック・`.gitignore`
- スキルが利用先で触れるもの（`tmp/` 以外への書き込み・設定ファイル・`gh` や `git` での書き込み・環境変数）

## 方針を足す・変える場合

- 新しい方針を決めたとき（会話で「〜はしない」「〜は人が行う」と決めたなど）は、`docs/policies/` に方針のファイルを足し、`.claude/rules/plugin-policies.md` と `docs/policies/README.md` の一覧にも足す。書き方は `docs/policies/README.md` の「ファイルの書き方」に従う
- 方針を足す・変えるときは、`docs/values/` のどの価値に基づくか、どの価値にも反しないかを確かめ、方針の冒頭の表の「価値」に番号を書く。価値に反する方針になるときは、実装する前に利用者に伝える
- 価値（`docs/values/`）を足す・変えるのは、利用者が決める。Claude からは提案にとどめる。書き方は `docs/values/README.md` の「ファイルの書き方」に従う
- 方針を変えるときは、方針のファイルを直し、その方針に沿って書いた場所（README・`SKILL.md`・テンプレート・`check.py`）もすべて直す
- 価値・P1・P3・P4・P7・P8・P9、`init-repo` の土台の仕組みと印のファイルを変えたら、`plugins/aidd/references/harness-principles.md` の要約も直す。利用先の監査は、この要約を物差しにするため
- ある方針が 1 つのプラグインにしか書かれていないのに、ほかのプラグインで同じ場面が出てきたら、その方針をほかのプラグインにも広げるかを利用者に聞く

## 食い違いを見つけた場合

今は直さないときは、下の「既知の食い違い」に書く。直したら消す。

## 変更を終えた場合

- 1 つの目的の変更を終え、検査が通ったら、その変更で直したファイルだけを `git add` でステージに置き、`plugins/aidd/skills/commit/SKILL.md` の手順でコミットメッセージを `tmp.md` に書く。コミット・push は利用者が行う
- 利用者に、push する前に `/marketplace-update` を実行するよう勧める。このスキルは `disable-model-invocation: true` のため、Claude からは呼べない
- PR のマージ先は `develop` にし、`plugin.json` の版は上げない。版は、リリースの前に版を上げるための PR で上げる（`docs/release.md`）
- PR では `.github/workflows/plugin-checks.yml` が、`check.py`（版の検査を含む）・マニフェストの検証・mod のテストを動かす。`/marketplace-update` の手順 5（機械チェックが見ない箇所の確認）は CI では動かないため、CI があっても省かない
- `check.py` だけなら、Claude が `python .claude/skills/marketplace-update/scripts/check.py` で実行して、NG・WARN を確かめてよい

## 既知の食い違い

- `aidd:ai-report` の同梱スクリプトが、`tmp/` に自分で書いた途中のファイル（`.ai-report-data.json`・`.ai-report-qualitative.md`）を、レポートを作った後に消している。P1 の「削除は禁止」と食い違う。スクリプトの中で消すため、deny では止まらない
