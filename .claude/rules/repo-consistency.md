# リポジトリ全体の整合ルール

## このルールの目的

このリポジトリの 3 つのプラグイン（`aidd`・`config`・`project`）は、すべてを同じ環境に入れて使う前提で作っている。そのため、あるプラグインの決めごとが、別のプラグインの動きとぶつからないようにする。

ぶつかる例は、次の 2 種類がある。

- 権限のぶつかり：`init-repo` が配る `settings.json` で `.claude/settings.local.json` への書き込みを禁止すると、そこへ書き込む `config:plugin-feedback` が動かなくなる
- 方針のぶつかり：`init-repo` が理由があって作らないと決めたファイルを、別のスキルが作ってしまう

このルールは、リポジトリ全体で守る方針と、権限と操作の対応を 1 か所にまとめる。何かを変えるときは、ここと照らし合わせてから変える。

## 用語

| 用語 | 意味 |
| --- | --- |
| deny | `settings.json` の `permissions.deny`。ここに当たる操作は、Claude が実行できない |
| `allowed-tools` | スキルの冒頭（frontmatter）に書く、許可を聞かずに実行してよい操作の一覧 |
| 許可プロンプト | Claude が操作する前に、実行してよいかを利用者に聞く確認 |
| `guard-git-write.sh` | `init-repo` が配る、Git と GitHub への書き込みを止めるフック。既定では使われていない（`settings.json` に登録していない） |
| 正典 | その方針の経緯や理由を詳しく書いてある場所。方針を変えるときは、まず正典を直す |

## 方針の一覧

方針ごとに、何をするか（しないか）と、その理由を書く。続けて、正典の場所を書く。対象が全プラグインでないものと、例外を認めたものは、そのことも書く。

### P1 設定の置き場所をプラグインで分ける

`config` はユーザー全体の設定（`~/.claude/`）を扱い、`project` はリポジトリごとの設定（`.claude/`・`.github/` など）を扱う。どのリポジトリでも共通の設定と、リポジトリごとに違う設定を、別々に管理するため。

- 正典：`plugins/config/README.md` の冒頭、`README.md` の「収録プラグイン」
- 例外：`config:plugin-feedback` は、リポジトリの `.claude/settings.local.json` に書き込む。承認を省く切り替えを、プロジェクトごとに見える場所に置くため。理由の詳細は `plugins/config/README.md` の「設計上の決めごと」

### P2 既存のファイルを上書きしない

既存のファイルや設定は、承認なしに上書きしない。利用者が自分で書いた内容を、知らないうちに消さないため。

- 正典：`plugins/config/README.md` の「設計上の決めごと」、`plugins/project/README.md` の「インストーラは全 Skill で共有する」
- 対象：`config`・`project`

### P3 勝手にディレクトリを作らない

出力先のディレクトリが無いときは、勝手に作らずに利用者に聞く。置き場所はプロジェクトごとに違い、決め打ちで作ると規約と違う場所にできてしまうため。

- 正典：`plugins/aidd/README.md` の「出力先パスは固定しない」、`plugins/project/skills/init-repo/SKILL.md` の禁止事項
- 例外：`config:plugin-feedback` は、`.claude/` が無ければ作る。P1 の例外と同じ理由

### P4 コミットと push は人が行う

スキルは `git commit` / `git push` を実行しない。履歴に残す内容と、ほかの人へ共有するタイミングを、人が最後に確かめて決めるため。

- 正典：`plugins/project/skills/init-repo/files/.claude/settings.json` の deny、各スキルの禁止事項（`aidd:commit`・`project:init-repo`・`project:gas`）

### P5 GitHub などの外部へは、原則書き込まない

スキルの結果は `tmp/` に出し、GitHub への投稿は人が行う。プラグインは多くのリポジトリで使われ、どこでも同じ判断で外部へ書き込むのは危険なため。また、結果を読んで採否を決めるのは人だから。

- 例外：`aidd:issue-pr-sync`・`aidd:issue-start`・`config:plugin-feedback` は GitHub に書き込む。GitHub 上の状態を変えること自体がスキルの目的で、下書きを出すだけでは、人が同じ操作をやり直すことになるため
- 例外のスキルも、`gh` の書き込み系のコマンドは `allowed-tools` に入れず、許可プロンプトを通す
- 正典：`plugins/aidd/README.md` の「外部へ直接書き込まない」、`plugins/config/README.md` の「設計上の決めごと」

### P6 取り消しにくい gh 操作だけを禁止する

`init-repo` の deny では、取り消しにくい `gh` の操作（PR のマージ・クローズ・レビュー、Issue のクローズ、リリース、リポジトリの作成・変更・削除）だけを禁止する。Issue・PR の作成・コメント・更新は Claude に任せる。やり直せる操作まで禁止すると、`aidd:issue-start` や `aidd:issue-pr-sync` が動かなくなるため。

- 正典：`plugins/project/skills/init-repo/README.md` の「前提と制約」

### P7 下書きとレポートは tmp に出す

レポートや下書きは `tmp/<ブランチ名>/` と `tmp.md` に書き、`.gitignore` でコミットから外す。作業中のファイルを、コミットに混ぜないため。

- 正典：`plugins/aidd/README.md` の「外部へ直接書き込まない」、`plugins/project/skills/init-repo/files/.gitignore`

### P8 allowed-tools に入れる操作をしぼる

スキルの `allowed-tools` には、書き込み先が決まっているもの（`tmp/` の下など）だけを入れる。書き込み先が決まらない操作を、確認なしで任せないため。同梱スクリプトの実行も入れない。スクリプトの場所はインストール先で変わり、`allowed-tools` で指せるかが公式に書かれていないため。

- 正典：`plugins/aidd/README.md` の「設計上の決めごと」

### P9 外部ツールでの反映やログインは人が行う

`clasp push` のように、リモートへ反映するコマンドや、ログインを伴うコマンドは、スキルが実行せずに人が行う。反映先のスクリプトを上書きしたり、認証情報を保存したりする操作のため。

- 正典：`plugins/project/skills/gas/SKILL.md` の禁止事項
- 対象：`project:gas`

### P10 常に効かせたい規約はリポジトリへコピーして配る

常に効かせたい規約は、スキルが導入先の `.claude/rules/` へコピーする。プラグインの仕組みでは `.claude/rules/` を配れないため。スキルの実行中にだけ使う判断基準は、プラグインの `references/` に置く。

- 正典：`plugins/project/README.md` の「規約はリポジトリへコピーして配る」、`plugins/aidd/README.md` の「references/ とは何か」

### P11 プラグインをまたぐファイルはコピーで持つ

ほかのプラグインのファイルを使いたいときは、同じ内容のコピーを自分のプラグインに置き、組を `.claude/rules/duplicated-files.md` で管理する。プラグインはそれぞれ単独でインストールされ、ほかのプラグインのファイルを参照できないため。

- 正典：`plugins/project/README.md` の「プラグインをまたぐファイルはコピーで持つ」

### P12 除外したものを作るときは除外の理由を確かめる

`init-repo`・`gas` の README の「除外したもの」には、わざと配らないファイルと、その理由を書いている。別のスキルがそのファイルを作るときは、その理由と食い違わないかを確かめる。決めた理由が、別の場所で知らないうちに崩れないようにするため。

- 例：「言語別の実装ルール」は、採用する技術によって違うため `init-repo` では配らない。`gas` が GAS 用のルールを配るのは、この理由に合っている
- 正典：`plugins/project/skills/init-repo/README.md`・`plugins/project/skills/gas/README.md` の「除外したもの」

## 権限と操作の照合

P4〜P7 は、`init-repo` が配る `settings.json`（deny）・フック・`.gitignore` で形にしている。これらが各スキルの操作を止めないように、スキルの操作ごとに、何をするか・なぜか・ほかの場所でそろえることを書く。

### tmp と tmp.md に書き込む

aidd の `commit`・`docs-sync`・`issue-pr-sync`・`pr-create`・`ai-report`・`pr-review`・`docs-consistency-audit` は、`tmp/<ブランチ名>/` と `tmp.md` に書き込む。P7 のため。

- そろえること：`init-repo` の `.gitignore` に `tmp/` と `tmp.md` を入れておく

### .claude/settings.local.json に書き込む

`config:plugin-feedback` は、初めての実行で `.claude/settings.local.json` の `env` に 1 行足す。承認を省く切り替え（`CLAUDE_PLUGIN_FEEDBACK_SKIP_APPROVAL`）を、利用者が見つけて変えられるようにするため。

- そろえること：`init-repo` の deny に、このファイルへの書き込み（`Edit`）を入れない。`.gitignore` には入れておく。個人用の設定をコミットしないため
- 止められたとき：書き込まずに、`off` として続ける

### ~/.claude/settings.json に書き込む

`config:setup-global` は、`~/.claude/settings.json` と `~/.claude/statusline/` に書き込む。どのリポジトリでも、同じステータスラインと応答言語を使うため。

- 気をつけること：プロジェクトの `.claude/settings.json`・`settings.local.json` に同じ設定があると、そちらが優先される。スキルはそのことを利用者に伝える

### Issue を作る・コメントする

`config:plugin-feedback` は、`gh issue create` / `gh issue comment` で `Kazu-K0032/claude-plugins` に起票する。プラグインの不具合や改善案を、作者に届けるため。

- そろえること：`init-repo` の deny に入れない
- `guard-git-write.sh` を使うリポジトリでは：`create` が止まる。スキルは下書きを出し、利用者が Web の画面に貼り付ける

### Issue のブランチと担当者を用意する

`aidd:issue-start` は、`gh issue develop` / `gh issue edit` / `gh issue comment` を使う。Issue に取りかかる準備（作業用のブランチ・担当者・確認結果の記録）を済ませるため。

- そろえること：`init-repo` の deny に入れない
- `guard-git-write.sh` を使うリポジトリでは：`edit`（担当者の追加）だけが止まる

### Issue と PR の記述を更新する

`aidd:issue-pr-sync` は、`gh issue edit` / `gh pr edit` を使う。Issue と PR の記述を、実際の変更に合わせるため。

- そろえること：`init-repo` の deny に入れない
- `guard-git-write.sh` を使うリポジトリでは：反映が止まり、下書きを出すところまでになる

### コミットと push はどのスキルも実行しない

P4 のとおり、どのスキルも `git commit` / `git push` を実行しない。`aidd:commit` も、メッセージを `tmp.md` に書くだけ。

- そろえること：`init-repo` の deny に `git commit`・`git push` を入れておく

### 環境変数を読む

`config` のフックと `config:plugin-feedback` は、環境変数 `CLAUDE_PLUGIN_FEEDBACK`（起票の提案を止める）と `CLAUDE_PLUGIN_FEEDBACK_SKIP_APPROVAL`（承認を省く）を読む。利用者が動きを切り替えられるようにするため。

- そろえること：`init-repo` の `settings.json` の `env` には入れない。利用者が自分で決める値のため

## 既知の食い違い

見つけたが、まだ直していないもの。直したら消す。

- `tmp/` の出力先の作り方が、スキルによって違う（P7）。ブランチ名に `/` が入るとき、`docs-sync`・`pr-review`・`docs-consistency-audit` は `-` に置き換え、`issue-pr-sync`・`ai-report` はフォルダを分ける。後の 2 つは「`commit`・`pr-create` と同じ」と書いているが、その 2 つにはどちらとも書いていない

## 変更するときの流れ

1. 変更する前に、「方針の一覧」から関係する方針を探し、その正典を読む
1. 変更が方針に反するときは、実装する前に利用者に伝え、次の 3 つから選んでもらう
    - 変更のほうを、方針に合わせる
    - 方針を変える。正典を直し、その方針に沿って書いた場所（README・`SKILL.md`・テンプレート・`check.py`）もすべて直す
    - 例外として認める。正典に理由を書き、このファイルの方針に「例外」として書き足す
1. 新しい方針を決めたとき（会話で「〜はしない」「〜は人が行う」と決めたなど）は、正典に書き、このファイルにも方針を足す。正典にする場所が無ければ、いちばん関係するプラグインの README の「設計上の決めごと」に書く
1. ある方針が 1 つのプラグインにしか書かれていないのに、ほかのプラグインで同じ場面が出てきたら、その方針をほかのプラグインにも広げるかを利用者に聞く
1. 次のどちらかを変えたら、「権限と操作の照合」を直す
    - `init-repo` の `settings.json`（deny）・フック・`.gitignore`
    - スキルが利用先で触れるもの（`tmp/` 以外への書き込み・設定ファイル・`gh` や `git` での書き込み・環境変数）
1. 食い違いを見つけても今は直さないときは、「既知の食い違い」に書く

## 詳しい説明を docs に移すとき

方針の説明が長くなったときや、複数のプラグインにまたがるようになったときは、`docs/` などに方針の文書を作り、正典をそこへ移してよい。移したら、このファイルの正典の場所と、元の場所からのリンクを直す。

## 機械チェックで見ている範囲

push 前の `/marketplace-update` は、`check.py` で次の 3 つだけを自動で確かめる。それ以外は、上の流れで確かめる。

- スキルの `allowed-tools` や本文のコマンドが、`init-repo` の deny に当たっていないか（`deny-conflict`。P4・P6）
- `allowed-tools` の書き込み先が、`tmp/` の外になっていないか（`output-path`。P7・P8）
- 重複ファイルの組がそろっているか（`duplicated-files`。P11）
