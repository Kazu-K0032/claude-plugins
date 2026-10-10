# プラグインを変更するときのルール

このリポジトリの 3 つのプラグイン（`aidd`・`config`・`project`）は、すべてを同じ環境に入れて使う前提で作っている。そのため、変更が `docs/policies/` の方針や、ほかのプラグインの動きとぶつからないようにする。ここには、変更の種類ごとに守ることを書く。

方針の中身と理由は、`docs/policies/` の各ファイルが正典（理由を書く唯一の場所）。方針の土台になる考え方は、[docs/values/](../../docs/values/README.md)（AI駆動開発の価値）にある。用語（deny・`allowed-tools`・許可プロンプト・`guard-git-write.sh`）は [docs/policies/README.md](../../docs/policies/README.md) の「用語」を見る。

## スキルやテンプレートを変更する場合

- 変更する前に、下の 2 つの表から関係する方針を探し、そのファイルを読む。迷う場面は、そのファイルの Q&A に従う
- 変更が方針に反するときは、実装する前に利用者に伝え、次の 3 つから選んでもらう
  - 変更のほうを、方針に合わせる
  - 方針を変える（下の「方針を足す・変える場合」）
  - 例外として認める。方針のファイルの冒頭の表の「例外」に、理由とともに書く

### 触るファイルから探す

| 触るファイル・書く内容 | 読む方針・文書 |
| --- | --- |
| 新しいスキルを `plugins/<プラグイン>/skills/` に足す | [P2](../../docs/policies/p02-settings-scope.md) |
| `SKILL.md` の `allowed-tools` | [P1](../../docs/policies/p01-operation-boundary.md) の「確認なしで任せる操作」 |
| `SKILL.md` の手順で、コマンドを実行する・ファイルを書き出す・GitHub に書き込む | [P1](../../docs/policies/p01-operation-boundary.md)、[P4](../../docs/policies/p04-tmp-output.md)、[permissions.md](../../docs/policies/permissions.md) |
| `init-repo` の `files/.claude/settings.json`・`files/.claude/hooks/`・`files/.gitignore` | [P1](../../docs/policies/p01-operation-boundary.md)、[permissions.md](../../docs/policies/permissions.md) |
| `plugins/project/skills/*/files/` にテンプレートを足す | [P6](../../docs/policies/p06-common-template.md)、そのスキルの README の「除外したもの」 |
| `references/` など、ほかのプラグインと同じ内容のファイル | [P5](../../docs/policies/p05-standalone-plugin.md)、`.claude/rules/duplicated-files.md` |
| ADR など、置き場所がプロジェクトで決まるファイルを作る手順 | [P3](../../docs/policies/p03-check-placement.md) |

### 方針の一覧

| 番号 | 方針 | 読む場面 |
| --- | --- | --- |
| [P1](../../docs/policies/p01-operation-boundary.md) | Claude に任せる操作と、人が行う操作を分けること | コマンドや外部への操作を、Claude に任せてよいか迷うとき |
| [P2](../../docs/policies/p02-settings-scope.md) | ユーザー全体の設定は config、リポジトリの設定は project が扱うこと | 新しいスキルを、どのプラグインに入れるか決めるとき |
| [P3](../../docs/policies/p03-check-placement.md) | ADR などの文書は、プロジェクトの規約どおりの場所に置くこと | ADR など、置き場所がプロジェクトごとに違うファイルを作るとき |
| [P4](../../docs/policies/p04-tmp-output.md) | スキルの下書きやレポートは tmp に出し、コミットに混ぜないこと | レポート・下書き・一時ファイルの置き場所を決めるとき |
| [P5](../../docs/policies/p05-standalone-plugin.md) | どのプラグインも、単独で入れて動くようにすること | ほかのプラグインのファイルを使いたいとき |
| [P6](../../docs/policies/p06-common-template.md) | 共通のテンプレートには、どのプロジェクトでも使うものだけを入れること | テンプレートにファイルを足すとき、`init-repo` が配らないファイルを別のスキルで作るとき |

## 権限設定や、スキルが利用先で触れるものを変更する場合

次のどちらかを変えたら、[docs/policies/permissions.md](../../docs/policies/permissions.md) の対応表を直す。

- `init-repo` の `settings.json`（deny）・フック・`.gitignore`
- スキルが利用先で触れるもの（`tmp/` 以外への書き込み・設定ファイル・`gh` や `git` での書き込み・環境変数）

## 方針を足す・変える場合

- 新しい方針を決めたとき（会話で「〜はしない」「〜は人が行う」と決めたなど）は、`docs/policies/` に方針のファイルを足し、このファイルと `docs/policies/README.md` の一覧にも足す。書き方は `docs/policies/README.md` の「ファイルの書き方」に従う
- 方針を足す・変えるときは、`docs/values/` のどの価値に基づくか、どの価値にも反しないかを確かめ、方針の冒頭の表の「価値」に番号を書く。価値に反する方針になるときは、実装する前に利用者に伝える
- 価値（`docs/values/`）を足す・変えるのは、利用者が決める。Claude からは提案にとどめる。書き方は `docs/values/README.md` の「ファイルの書き方」に従う
- 方針を変えるときは、方針のファイルを直し、その方針に沿って書いた場所（README・`SKILL.md`・テンプレート・`check.py`）もすべて直す
- ある方針が 1 つのプラグインにしか書かれていないのに、ほかのプラグインで同じ場面が出てきたら、その方針をほかのプラグインにも広げるかを利用者に聞く

## 食い違いを見つけた場合

今は直さないときは、下の「既知の食い違い」に書く。直したら消す。

## 変更を終えた場合

- 利用者に、push する前に `/marketplace-update` を実行するよう勧める。このスキルは `disable-model-invocation: true` のため、Claude からは呼べない
- PR では `.github/workflows/plugin-checks.yml` が、`check.py`・マニフェストの検証・mod のテストを動かす。`/marketplace-update` の手順 5（機械チェックが見ない箇所の確認）は CI では動かないため、CI があっても省かない
- `check.py` だけなら、Claude が `python .claude/skills/marketplace-update/scripts/check.py` で実行して、NG・WARN を確かめてよい

## 既知の食い違い

- `aidd:ai-report` の同梱スクリプトが、`tmp/` に自分で書いた途中のファイル（`.ai-report-data.json`・`.ai-report-qualitative.md`）を、レポートを作った後に消している。P1 の「削除は禁止」と食い違う。スクリプトの中で消すため、deny では止まらない
