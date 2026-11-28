# P14 bot の PR は、自動でマージしないこと

| 区分 | 内容 |
| --- | --- |
| 対象 | このリポジトリの GitHub Actions の Claude（`.github/workflows/claude-issue-to-pr.yml`）と、その手順の `.claude/skills/issue-to-pr/` |
| 価値 | [V3](../values/v03-human-judgment.md)・[V5](../values/v05-mechanisms-over-habits.md) |

bot が作った PR は、bot もワークフローも自動でマージしない。ワークフローが PR をレビュー待ちにしても、マージは、人が差分を見て承認してから行う。

## 理由

- マージは、ほかの人やサービスに効き、取り消しにくい判断のため、人が持つから（V3）
- マージの後に問題が見つかると、revert の手間が増え、コミットの履歴も汚れるから。マージの前なら、人が差分を見て違和感に気づける
- ワークフローの検査は、機械で見られる範囲しか確かめず、最後にこれでよいと決めるのは人だから（V3）
- マージの禁止は、bot への指示だけに頼らず、deny（`gh pr merge` など）でも止めるから（V5）

## 変えたいとき

- bot にマージを任せたくなったら、この方針を変える。あわせて、次を直す
  - [P1](p01-operation-boundary.md) の「例外」と Q&A
  - `.claude/settings.json` の deny（`gh pr merge`・`enablePullRequestAutoMerge` など）
  - `.claude/skills/issue-to-pr/SKILL.md` の禁止事項
  - [docs/claude-bot.md](../claude-bot.md) の流れ

## Q&A

### Q. ワークフローの検査が全部通っていれば、自動でマージしてよい？

しない。検査が通っても、最後にこれでよいと決めるのは人のため。検査（`check.py`・マニフェストの検証など）は、機械で見られる範囲だけを確かめる。

### Q. bot に、GitHub の自動マージ（auto-merge）を有効にさせてよい？

しない。有効にすると、人が承認しなくてもマージが進むため。`gh api` の `enablePullRequestAutoMerge` は、deny にも入れてある。
