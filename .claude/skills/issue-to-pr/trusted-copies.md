# 写しで動く作り

このスキルが、作業ツリーの版ではなく、ワークフローが取り分けた写しで動く理由と、写しの置き場所を示す。bot が書き換えた設定・フック・スクリプトを、同じ実行の中のトークンを持つ段で動かさないため。

## 写しの置き場所

ワークフローは、bot が動く前に、`develop` から次のファイルを `$RUNNER_TEMP/trusted/`（`SKILL.md` の `<trusted>`）に写す。

| 写し | 元のファイル | 使い方 |
| --- | --- | --- |
| `<trusted>/issue-to-pr/` | `.claude/skills/issue-to-pr/` | 実装・直し・仕上げの段が、`SKILL.md` と参照ファイル（`unchangeable-paths.md`・`fix-requests.md`・`finish-checks.md`・この文書）を Read で読む |
| `<trusted>/issue-to-pr/scripts/verify.sh`・`<trusted>/check.py` | `verify.sh`・`.claude/skills/marketplace-update/scripts/check.py` | 手順 5・9 で `verify.sh` を流す。写しの `verify.sh` は、写しの `check.py` を流す。写しが無ければ NG にし、作業ツリーの版は流さない |
| `<trusted>/body_length.js` | `plugins/aidd/scripts/body_length.js` | 手順 7・9・10 で、本文の概要を数えるときに流す |
| `<trusted>/claude-hooks/` | `.claude/hooks/` | 設定の写しから呼ばれる |
| `<trusted>/claude-settings.json`・`claude-settings-edit.json` | `.claude/settings.json` | どの段も `--setting-sources user` とこの写し（`--settings`）で動く。`-edit` は、ファイルを直す段（実装・直し）にだけ渡す。commit・push の deny を外し、protected paths の編集を許可するフックを足したもの |

## 写しで動く場合の決まり

- `--setting-sources user` で動くため、作業ツリーの `settings.json`・`settings.local.json`・フック・スキル・エージェント・`CLAUDE.md`・`.claude/rules/` は自動では読み込まれない。実装の段は手順 1 で、直しの段は `fix-requests.md` の「規約を読む」で、`CLAUDE.md` と関係する規約を Read で読む
- このスキルは `Skill` では呼ばれない。frontmatter の `allowed-tools`・`hooks` や `!` のコマンドを足しても効かない。使えるコマンドは、ワークフローの `--allowedTools` で決まる
- このスキルの参照ファイルも、写しの版を読む。bot が書き換えた手順に、同じ実行の後の段が従わないようにするため
- `CLAUDE.md`・規約・ほかのスキルの決まり（`commit-rule.md` など）は、作業ツリーの版を読む。写していないため。bot がこれらを変えた PR は、マージの前に人が差分を確かめる
- `claude plugin test` は流さない。mod のテストは mod の本体も動かすため、PR の CI（`plugin-checks.yml`。トークンは `read`、secret なし）に任せる
- 作業ツリーの検査のスクリプト（`verify.sh`・`check.py`・`body_length.js`）は流さない。bot が書き換えた版を、トークンを持つ段で動かさないため
- bot が変えた設定・フック・スクリプトは、同じ実行の中では効かない。動かして確かめられないため、PR の本文に、確かめていないことを書く

## 保守

- 写すファイルや設定の写しの作りを変えるときは、この文書と、ワークフローの「ワークフローのスクリプトを取り分ける」「Claude の設定の写しを作る」step を一緒に直す
- 写しのパス（`$RUNNER_TEMP`）を使うコマンドを直しの段に許すときは、job の env の `FIX_TOOLS_BASE` ではなく、「直しの許可を決める」step に足す。job の env では、`runner` の文脈も `$RUNNER_TEMP` も展開されないため
