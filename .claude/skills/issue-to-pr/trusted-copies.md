# 写しで動く作り

このスキルが、作業ツリーの版ではなく、ワークフローが取り分けた写しで動く理由と、写しの置き場所を示す。bot が書き換えた設定・フック・スクリプトを、同じ実行の中のトークンを持つ段で動かさないため。

## 写しの置き場所

ワークフローは、bot が動く前に、`develop` から次のファイルを `$RUNNER_TEMP/trusted/`（`SKILL.md` の `<trusted>`）に写す。

| 写し | 元のファイル | 使い方 |
| --- | --- | --- |
| `<trusted>/issue-to-pr/` | `.claude/skills/issue-to-pr/` | 実装・直し・仕上げの段が、`SKILL.md` を Read で読む |
| `<trusted>/issue-to-pr/scripts/verify.sh` と同じフォルダの `check.py` | `verify.sh`・`.claude/skills/marketplace-update/scripts/check.py` | 手順 5・9 で流す。`verify.sh` は、同じフォルダに `check.py` があればそれを流す |
| `<trusted>/body_length.js` | `plugins/aidd/scripts/body_length.js` | 手順 7・10 で流す |
| `<trusted>/claude-hooks/` | `.claude/hooks/` | 設定の写しから呼ばれる |
| `<trusted>/claude-settings.json`・`claude-settings-edit.json` | `.claude/settings.json` | どの段も `--setting-sources user` とこの写し（`--settings`）で動く。`-edit` は、ファイルを直す段（実装・直し）にだけ、protected paths の編集を許可するフックを足したもの |

## 写しで動く場合の決まり

- `--setting-sources user` で動くため、作業ツリーの `settings.json`・`settings.local.json`・フック・スキル・エージェント・`CLAUDE.md`・`.claude/rules/` は自動では読み込まれない。手順 1 で `CLAUDE.md` を Read で読み、そこから関係する規約を読む
- このスキルは `Skill` では呼ばれない。frontmatter の `allowed-tools`・`hooks` や `!` のコマンドを足しても効かない。使えるコマンドは、ワークフローの `--allowedTools` で決まる
- 参照ファイル（`unchangeable-paths.md` など）は作業ツリーの版を読む。実行されない文書のため
- `claude plugin test` は流さない。mod のテストは mod の本体も動かすため、PR の CI（`plugin-checks.yml`。トークンは `read`、secret なし）に任せる
- 作業ツリーの検査のスクリプト（`verify.sh`・`check.py`・`body_length.js`）は流さない。bot が書き換えた版を、トークンを持つ段で動かさないため
- bot が変えた設定・フック・スクリプトは、同じ実行の中では効かない。動かして確かめられないため、PR の本文に、確かめていないことを書く

## 保守

- 写すファイルや設定の写しの作りを変えるときは、この文書と、ワークフローの「ワークフローのスクリプトを取り分ける」「Claude の設定の写しを作る」step を一緒に直す
