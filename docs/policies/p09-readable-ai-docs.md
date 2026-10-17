# P9 AI が読む文書も、人が読んで判断に使える形にすること

| 区分 | 内容 |
| --- | --- |
| 対象 | 3 プラグインの `SKILL.md`・同梱の参照ファイル・配る規約（`skills/*/files/.claude/rules/`）。このリポジトリの `.claude/skills/`。`project:init-repo` が配る `.claude/rules/ai-docs.md` |
| 価値 | [V2](../values/v02-understand-before-accept.md)・[V4](../values/v04-record-reasons.md)・[V5](../values/v05-mechanisms-over-habits.md) |

AI が書く `SKILL.md`・規約も、人が読み切って技術判断に使える形で書く。本筋と細部を分け、本文（frontmatter を除く）は 5,000 文字以内にする。書き方は `.claude/rules/ai-docs.md`（`init-repo` にも同じもの）。

- 冒頭に、何をするか・外へ書き込むもの・人がすることを書く
- 手順は本筋だけにし、例外・失敗時の扱いは別ファイルに分ける
- Claude が一般に知っていることは書かない
- 理由は消さず、1 つの規則に 1 文で添える
- 上限を超えると、`check.py` が WARN を出す

## 理由

- 【読み手】長い手順書は読まれず、人が中身を分からないまま使い続けるから
- 【精度】公式の手引きも、`SKILL.md` を概要にし、細部を必要なときに読む別ファイルへ分けるよう勧めるから（[Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)）
- 【判断の記録】理由を消して短くすると、人も AI もあとで判断をたどれないから
- 【数える仕組み】目で見て削るだけでは、長さがそろわないから

## 変えたいとき

- 利用先では、`.claude/rules/ai-docs.md` を書き換えるか、外す
- このリポジトリの上限超えは WARN のため、CI は止まらない

## Q&A

### Q. 細部を別ファイルに移すと、Claude が読み落とさないか

本文から 1 段で参照し、どの場面で読むかを書く（例：「失敗したら `errors.md` を読む」）。参照先から、さらに別のファイルを参照しない。2 段先のファイルは、一部しか読まれないことがあるため。

### Q. 5,000 文字に収まらない

細部を移しても収まらないなら、1 つのスキルが多くを受け持ちすぎている。スキルを分ける。

### Q. 既存の文書が上限を超えている

ほかの変更と分け、プラグインごとの PR で縮める。規則は消さず、規則ごとに移した先を一覧にして示す。消し忘れを、レビューで見つけられるようにするため。

### Q. 上限の数を変えたい

次をすべて同じ数に直す。直したら、上限を超えた既存の文書も新しい上限に合わせて縮める。漏れは `git grep -n "5,000 文字"` で確かめる。

- 検査：`.claude/skills/marketplace-update/scripts/check.py` の `DOC_LIMIT` と、同じスキルの `SKILL.md` の WARN の説明
- 規約：`.claude/rules/ai-docs.md` と、`init-repo` の `files/.claude/rules/ai-docs.md`・`README.md`（収録物の表）
- 監査の物差し：`plugins/aidd/references/harness-principles.md`
- この方針のファイル

### Q. `docs-type`（人向け・AI 向けの区分）は使わないのか

使わない。AI だけが読む区分を認めると、人が読めない文書が残るため。`init-repo` は `docs-type` を配らず、`aidd:docs-sync` も検査しない。
