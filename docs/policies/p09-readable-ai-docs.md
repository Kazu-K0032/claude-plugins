# P9 AI が読む文書も、人が読んで判断に使える形にすること

| 区分 | 内容 |
| --- | --- |
| 対象 | 3 プラグインの `SKILL.md`・同梱の参照ファイル・配る規約（`skills/*/files/.claude/rules/`）。このリポジトリの `.claude/skills/`・`.claude/rules/`。`project:init-repo` が配る `.claude/rules/ai-docs.md` |
| 価値 | [V2](../values/v02-understand-before-accept.md)・[V4](../values/v04-decision-records.md)・[V5](../values/v05-mechanisms-over-habits.md) |

`SKILL.md` や規約は AI が読む文書だが、人も読み切って中身を確かめられる形で書く。チームで使うスキルの品質は、人が読んで意図どおりかを判断しなければ保てないため。

## 理由

- チームで使う以上、スキルが意図どおりに動くかは、人が読んで確かめるしかないから。人が読めない文書は、中身が分からないまま使い続けられる
- マーケットプレイスでは、多くの利用者が `SKILL.md` を開いて、何をするスキルかを把握しようとするから
- 理由を消して短くすると、人も AI も、あとで判断をたどれないから

## 書き方

書き方の正典は `.claude/rules/ai-docs.md`（`init-repo` が配るものも同じ）。要点は次の 3 つ。

- 冒頭の 1〜2 文で、何をするかを書く
- 本筋だけを書き、細部は別ファイルに分ける。`SKILL.md` と規約の本文（frontmatter を除く）は 5,000 文字以内にし、超えると `check.py` が WARN を出す。公式の手引きも、`SKILL.md` を概要にし、細部を別ファイルへ分けるよう勧めている（[Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)）
- 理由は消さず、1 つの規則に 1 文で添える

## 変えたいとき

- 利用先では、`.claude/rules/ai-docs.md` を書き換えるか、外す
- このリポジトリの上限超えは WARN のため、CI は止まらない
- 上限の数を変えるときは、次をすべて同じ数に直す。直したら、上限を超えた既存の文書も新しい上限に合わせて縮める。漏れは `git grep -n "5,000 文字"` で確かめる
  - 検査：`.claude/skills/marketplace-update/scripts/check.py` の `DOC_LIMIT` と、同じスキルの `ng-warn.md` の `doc-length` の説明
  - 規約：`.claude/rules/ai-docs.md` と、`init-repo` の `files/.claude/rules/ai-docs.md`・`README.md`（収録物の表）
  - 監査の物差し：`plugins/aidd/references/harness-principles.md`
  - この方針のファイル
- 人向け・AI 向けの区分（`docs-type`）は使わない。AI だけが読む区分を認めると、人が読めない文書が残るため
