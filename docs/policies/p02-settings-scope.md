# P2 設定の置き場所をプラグインで分けること

`config` はユーザー全体の設定（`~/.claude/`）を扱い、`project` はリポジトリごとの設定（`.claude/`・`.github/` など）を扱う。

## 理由

どのリポジトリでも共通の設定と、リポジトリごとに違う設定を、別々に管理するため。

## 対象と例外

- 対象：`config`・`project`
- 例外：`.claude/settings.local.json` への書き込みは、[P1](p01-operation-boundary.md) の条件に従う

## Q&A

### Q. 新しいスキルを、`config` と `project` のどちらに入れる？

書き込む先で決める。`~/.claude/` に書くなら `config`、リポジトリの `.claude/`・`.github/` などに書くなら `project` に入れる。設定を書かない開発の定型作業（コミット文・PR の下書きなど）は `aidd` に入れる。

### Q. `config` のスキルが、リポジトリの設定にも書き込みたい

個人用の設定（`.claude/settings.local.json`）なら、[P1](p01-operation-boundary.md) の条件で書き込める。それ以外は、例外にしてよいかを利用者に聞く。認めたら、この方針の「対象と例外」に理由を書く。
