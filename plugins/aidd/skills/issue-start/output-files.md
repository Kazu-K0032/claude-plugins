# `tmp/` に書くファイルの一覧

`issue-start` が `tmp/<ブランチ名>/` に書くファイルの名前と中身。置き場所の決まりは `SKILL.md` の「出力先」に書く。

| ファイル | 中身 |
| --- | --- |
| `issue-start/<ts>_issue_before.md` | 書き換える前の Issue の本文（手順 9・12 で、書き換えるたびに残す） |
| `issue-start/<ts>_issue.md` | 反映する Issue の本文 |
| `issue-start/<ts>_plan.md` | 計画モードに入れなかったときの計画（手順 7） |
| `pr-create_<ts>.md`・`pr-verify_<ts>.md` | PR 本文と検証コメント（手順 15） |
| `work/<目的>/` | 作業用の一時ファイル（スクリプト・中間ファイル・確認用の画像。手順 10） |
