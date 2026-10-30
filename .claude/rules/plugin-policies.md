# プラグインの方針の探し方に関するルール

プラグインを変更する前に読む方針を、触るファイルや場面から探せるよう、方針の一覧をここに置く。方針の中身と理由は `docs/policies/` の各ファイルが正典（理由を書く唯一の場所）のため、ここには書かない。

## 方針を探す場合

- 下の 2 つの表（「触るファイルから探す」「方針の一覧」）から、関係する方針を探す
- 方針の土台になる考え方は、[docs/values/](../../docs/values/README.md)（AI駆動開発の価値）にある
- 用語（deny・`allowed-tools`・許可プロンプト・`guard-git-write.sh`）は、[docs/policies/README.md](../../docs/policies/README.md) の「用語」を見る

### 触るファイルから探す

| 触るファイル・書く内容 | 読む方針・文書 |
| --- | --- |
| 新しいスキルを `plugins/<プラグイン>/skills/` に足す | [P2](../../docs/policies/p02-settings-scope.md) |
| `SKILL.md` の `allowed-tools` | [P1](../../docs/policies/p01-operation-boundary.md) の「確認なしで任せる操作」 |
| `SKILL.md` の手順で、コマンドを実行する・ファイルを書き出す・GitHub に書き込む | [P1](../../docs/policies/p01-operation-boundary.md)、[P4](../../docs/policies/p04-tmp-output.md)、[permissions.md](../../docs/policies/permissions.md) |
| `init-repo` の `files/.claude/settings.json`・`files/.claude/hooks/`・`files/.claude/rules/permissions.md`・`files/.gitignore` | [P1](../../docs/policies/p01-operation-boundary.md)、[permissions.md](../../docs/policies/permissions.md)、`plugins/aidd/references/harness-principles.md` の「土台の仕組み」 |
| `plugins/project/skills/*/files/` にテンプレートを足す、技術別のスキルが土台のファイルに足す手順を書く | [P6](../../docs/policies/p06-common-template.md)、そのスキルの README の「除外したもの」 |
| `init-repo` の `files/docs/` の雛形（`*.template.*`）・`docs/README.md` の「雛形から実物を作るとき」 | [P10](../../docs/policies/p10-template-lifecycle.md)、[P6](../../docs/policies/p06-common-template.md)、[P7](../../docs/policies/p07-readme-guide.md) |
| `references/` など、ほかのプラグインと同じ内容のファイル | [P5](../../docs/policies/p05-standalone-plugin.md)、`.claude/rules/duplicated-files.md` |
| ADR など、置き場所がプロジェクトで決まるファイルを作る手順 | [P3](../../docs/policies/p03-check-placement.md) |
| `init-repo` の `README.md`・`docs/README.md`・`.claude/rules/readme.md`、README を作る手順 | [P7](../../docs/policies/p07-readme-guide.md) |
| Issue・PR の本文やコメントを書く手順、`init-repo` の PR・Issue のテンプレート、mod の「文書を簡潔に」 | [P8](../../docs/policies/p08-short-body.md) |
| `SKILL.md` の「想定している引数」・`argument-hint` | [P11](../../docs/policies/p11-options-and-supplements.md)、`.claude/rules/argument-hint.md` |
| `SKILL.md`・同梱の参照ファイル・規約（`.claude/rules/`・`files/.claude/rules/`）の本文 | [P9](../../docs/policies/p09-readable-ai-docs.md)、`.claude/rules/ai-docs.md` |
| `plugins/aidd/references/harness-principles.md`（`harness-audit` の物差し） | [docs/values/](../../docs/values/README.md)、[P1](../../docs/policies/p01-operation-boundary.md)・[P3](../../docs/policies/p03-check-placement.md)・[P4](../../docs/policies/p04-tmp-output.md)・[P7](../../docs/policies/p07-readme-guide.md)・[P8](../../docs/policies/p08-short-body.md)・[P9](../../docs/policies/p09-readable-ai-docs.md)、`init-repo` の README の「収録物」 |

### 方針の一覧

| 番号 | 方針 | 読む場面 |
| --- | --- | --- |
| [P1](../../docs/policies/p01-operation-boundary.md) | Claude に任せる操作と、人が行う操作を分けること | コマンドや外部への操作を、Claude に任せてよいか迷うとき |
| [P2](../../docs/policies/p02-settings-scope.md) | ユーザー全体の設定は config、リポジトリの設定は project が扱うこと | 新しいスキルを、どのプラグインに入れるか決めるとき |
| [P3](../../docs/policies/p03-check-placement.md) | ADR などの文書は、プロジェクトの規約どおりの場所に置くこと | ADR など、置き場所がプロジェクトごとに違うファイルを作るとき |
| [P4](../../docs/policies/p04-tmp-output.md) | スキルの下書きやレポートは tmp に出し、コミットに混ぜないこと | レポート・下書き・一時ファイルの置き場所を決めるとき |
| [P5](../../docs/policies/p05-standalone-plugin.md) | どのプラグインも、単独で入れて動くようにすること | ほかのプラグインのファイルを使いたいとき |
| [P6](../../docs/policies/p06-common-template.md) | 土台には設計思想だけを入れ、技術に依るものは技術別のスキルで重ねること | テンプレートにファイルを足すとき、技術別のスキルが土台のファイルに足すとき、`init-repo` が配らないファイルを別のスキルで作るとき |
| [P7](../../docs/policies/p07-readme-guide.md) | README には本文を書かず、どこに何があるかの案内にとどめること | README のひな形・規約を直すとき、README を作るスキルを足すとき |
| [P8](../../docs/policies/p08-short-body.md) | Issue・PR の本文は、人が読み切れる長さにすること | Issue・PR の本文やコメントを書く手順・テンプレートを直すとき |
| [P9](../../docs/policies/p09-readable-ai-docs.md) | AI が読む文書も、人が読んで判断に使える形にすること | `SKILL.md`・参照ファイル・規約を書く・直すとき |
| [P10](../../docs/policies/p10-template-lifecycle.md) | 雛形は、実物を作ったら削除を提案し、削除は人が行うこと | `init-repo` の `docs/` に雛形を足す・直すとき |
| [P11](../../docs/policies/p11-options-and-supplements.md) | 動きはオプションで切り替え、自然な言葉の補足は承認の前に示すこと | スキルの引数（「想定している引数」・`argument-hint`）を足す・直すとき |
