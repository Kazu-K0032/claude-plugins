# P2 ユーザー全体の設定は config、リポジトリの設定は project が扱うこと

| 区分 | 内容 |
| --- | --- |
| 対象 | `config`・`project` |
| 例外 | `.claude/settings.local.json` への書き込みは、[P1](p01-operation-boundary.md) の条件に従う |

`config` はユーザー全体の設定（`~/.claude/`）を扱い、`project` はリポジトリごとの設定（`.claude/`・`.github/` など）を扱う。

## 理由

- 【設定の分担】どのリポジトリでも共通の設定と、リポジトリごとに違う設定を、別々に管理したいから

## Q&A

### Q. 新しいスキルを、`config` と `project` のどちらに入れる？

書き込む先で決める。`~/.claude/` に書くなら `config`、リポジトリの `.claude/`・`.github/` などに書くなら `project` に入れる。設定を書かない開発の定型作業（コミット文・PR の下書きなど）は `aidd` に入れる。

### Q. `config` のスキルで、リポジトリの設定にも書き込みたい

個人用の設定（`.claude/settings.local.json`）なら、[P1](p01-operation-boundary.md) の条件で書き込める。それ以外は、例外にしてよいかを利用者に聞く。認めたら、冒頭の表の「例外」に理由を書く。
