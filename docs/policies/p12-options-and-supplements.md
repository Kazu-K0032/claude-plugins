# P12 動きはオプションで切り替え、自然な言葉の補足は承認の前に示すこと

| 区分 | 内容 |
| --- | --- |
| 対象 | `aidd`・`config`・`project` のスキルの引数 |
| 対象外 | 引数全体が自由に書く中身のスキル（`adr`・`commit`・`research`・`plugin-feedback`・`conflicts`） |
| 価値 | [V1](../values/v01-quality-over-speed.md)・[V2](../values/v02-understand-before-accept.md) |

スキルの動き（モード・範囲）は、`--` で始まるオプションで切り替える。Anthropic のマーケットプレイスでよく使われる形に合わせ、自然な言葉からどの動きかを Claude が判断する場面をなくすため。

## 理由

- オプションで動きを切り替える形は、Anthropic の公式マーケットプレイスでよく使われている。慣習に合わせれば、利用者はほかのマーケットプレイスと同じ感覚で使える。例えば、`code-review` は `--comment` を付けたときだけ PR にコメントし、`code-modernization` の `modernize-assess` は `--portfolio` で調べる範囲を切り替える（[code-review.md](https://github.com/anthropics/claude-plugins-official/blob/fa4eb54397ee2faccb6940512a19c017cb1337f3/plugins/code-review/commands/code-review.md)・[modernize-assess.md](https://github.com/anthropics/claude-plugins-official/blob/fa4eb54397ee2faccb6940512a19c017cb1337f3/plugins/code-modernization/commands/modernize-assess.md)）
- 自然な言葉で動きを指定すると、どの動きに当たるかを Claude がその都度判断し、結果がぶれることがある。オプションなら、同じ指定は同じ手順を通る

## 決まり

- 動きを決めるのは、オプションと、`SKILL.md` の「想定している引数」の表に書いた言い方だけにする。オプションにする前からの言い方（「規約だけ」など）は、同じ扱いとして表に残す
- 結果がリポジトリの事情（Issue の中身・既存のファイル・要件など）で変わるスキル（`issue-start`・`init-repo`・`gas`・`terraform`・`wordpress`）だけ、自然な言葉を補足として受け付ける。補足をどう読んだかは、承認・確認の手順で示してから使う。書き込む前に見せれば、人がその場で直せるため
- どこでも同じ結果になるスキルと、補足を手順に渡せないスキル（`setup-global`・`mod-output-customize`・`harness-audit`）は、オプションだけにする。表に無い指定は使わず、使える指定を示して聞く
- 手順でできない補足と、知らない `--` のオプションは、推測で進めない
- 引数全体が自由に書く中身のスキル（`adr`・`commit`・`research`・`plugin-feedback`・`conflicts`）は、対象外にする

## Q&A

### Q. 新しいスキルに補足を受け付けるか迷う

同じ引数のまま、リポジトリによって手順の中身を変えたくなるかで決める。変えたくならないなら、オプションだけにする。

### Q. 補足をどこで示す

スキルの承認・確認の手順（計画・導入計画・続けるかの質問）に書く。`SKILL.md` の「想定している引数」に、どの手順で示すかを書く。

### Q. 補足が手順でできないことを求めている

できないと伝え、その補足は使わずに進めるか、止めるかを聞く。手順に無い動きを足すと、検査や承認を通らないため。

### Q. オプションの名前の付け方

`--` で始まる英語の小文字にし、語の間は `-` でつなぐ。範囲を絞るものは `--<対象>-only`（例：`--rules-only`）、既存物の扱いは `--keep-existing` のように、スキルをまたいで同じ名前にそろえる。同じ意味のオプションの名前がスキルごとに違うと、覚えにくいため。
