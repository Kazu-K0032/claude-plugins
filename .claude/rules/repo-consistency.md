# リポジトリ全体の整合ルール

## このルールの目的

このリポジトリの 3 つのプラグイン（`aidd`・`config`・`project`）は、すべてを同じ環境に入れて使う前提で作っている。そのため、あるプラグインの決めごとが、別のプラグインの動きとぶつからないようにする。

ぶつかる例は、次の 2 種類がある。

- 権限のぶつかり：`init-repo` が配る `settings.json` で `.claude/settings.local.json` への書き込みを禁止すると、そこへ書き込む `config:plugin-feedback` が動かなくなる
- 方針のぶつかり：`init-repo` が理由があって作らないと決めたファイルを、別のスキルが作ってしまう

方針の中身と理由は `docs/policies/` に 1 方針 1 ファイルで置き、そこを正典（その方針の理由を書く唯一の場所）とする。このファイルには、方針の一覧と、変えるときの流れを置く。何かを変えるときは、関係する方針のファイルを読んでから変える。

用語（deny・`allowed-tools`・許可プロンプト・`guard-git-write.sh`）は [docs/policies/README.md](../../docs/policies/README.md) の「用語」を見る。

## 方針の一覧

| 番号 | 方針 | 読む場面 |
| --- | --- | --- |
| [P1](../../docs/policies/p01-operation-boundary.md) | Claude に任せる操作と、人が行う操作を分けること | コマンドや外部への操作を、Claude に任せてよいか迷うとき |
| [P2](../../docs/policies/p02-settings-scope.md) | ユーザー全体の設定は config、リポジトリの設定は project が扱うこと | 新しいスキルを、どのプラグインに入れるか決めるとき |
| [P3](../../docs/policies/p03-check-placement.md) | ADR などの文書は、プロジェクトの規約どおりの場所に置くこと | ADR など、置き場所がプロジェクトごとに違うファイルを作るとき |
| [P4](../../docs/policies/p04-tmp-output.md) | スキルの下書きやレポートは tmp に出し、コミットに混ぜないこと | レポート・下書き・一時ファイルの置き場所を決めるとき |
| [P5](../../docs/policies/p05-standalone-plugin.md) | どのプラグインも、単独で入れて動くようにすること | ほかのプラグインのファイルを使いたいとき |
| [P6](../../docs/policies/p06-common-template.md) | 共通のテンプレートには、どのプロジェクトでも使うものだけを入れること | テンプレートにファイルを足すとき、`init-repo` が配らないファイルを別のスキルで作るとき |

スキルの操作と、`init-repo` が配る `settings.json`（deny）・フック・`.gitignore` との対応は、[docs/policies/permissions.md](../../docs/policies/permissions.md) にまとめている。

## 既知の食い違い

見つけたが、まだ直していないもの。直したら消す。

- `aidd:ai-report` の同梱スクリプトが、`tmp/` に自分で書いた途中のファイル（`.ai-report-data.json`・`.ai-report-qualitative.md`）を、レポートを作った後に消している。P1 の「削除は禁止」と食い違う。スクリプトの中で消すため、deny では止まらない

## 変更するときの流れ

1. 変更する前に、「方針の一覧」の「読む場面」から関係する方針を探し、そのファイルを読む。迷う場面は、そのファイルの Q&A に従う
1. 変更が方針に反するときは、実装する前に利用者に伝え、次の 3 つから選んでもらう
    - 変更のほうを、方針に合わせる
    - 方針を変える。方針のファイルを直し、その方針に沿って書いた場所（README・`SKILL.md`・テンプレート・`check.py`）もすべて直す
    - 例外として認める。方針のファイルの冒頭の表の「例外」に、理由とともに書く
1. 新しい方針を決めたとき（会話で「〜はしない」「〜は人が行う」と決めたなど）は、`docs/policies/` に方針のファイルを足し、このファイルと `docs/policies/README.md` の一覧にも足す。書き方は `docs/policies/README.md` の「ファイルの書き方」に従う
1. ある方針が 1 つのプラグインにしか書かれていないのに、ほかのプラグインで同じ場面が出てきたら、その方針をほかのプラグインにも広げるかを利用者に聞く
1. 次のどちらかを変えたら、`docs/policies/permissions.md` を直す
    - `init-repo` の `settings.json`（deny）・フック・`.gitignore`
    - スキルが利用先で触れるもの（`tmp/` 以外への書き込み・設定ファイル・`gh` や `git` での書き込み・環境変数）
1. 食い違いを見つけても今は直さないときは、「既知の食い違い」に書く

## 機械チェックで見ている範囲

push 前の `/marketplace-update` は、`check.py` で次の検査を自動で行う。ここでは、このファイルの方針に関わるものだけを挙げる。検査の全体は `.claude/skills/marketplace-update/SKILL.md` の手順 3・4 の表を見る。ここに無い方針は、上の流れで確かめる。

- `rule-form`：`allowed-tools` に、権限の判定に使われない書き方が無いか（P1）
- `deny-conflict`：スキルの `allowed-tools` や本文のコマンドが、`init-repo` の deny に当たっていないか（P1）
- `output-path`：`allowed-tools` の書き込み先が、`tmp/` の外になっていないか（P1・P4）
- `plugin-root-ref`：`${CLAUDE_PLUGIN_ROOT}` で指したファイルが、そのプラグインの中にあるか（P5）
- `duplicated-files`：重複ファイルの組がそろっているか（P5）
