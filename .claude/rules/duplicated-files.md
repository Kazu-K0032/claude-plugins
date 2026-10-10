---
paths:
  - "plugins/aidd/references/markdown.md"
  - "plugins/project/references/markdown.md"
  - ".claude/rules/branch.md"
  - "plugins/project/skills/init-repo/files/.claude/rules/branch.md"
---

# 重複ファイルの同期ルール

プラグインはインストール時にそれぞれ単独でキャッシュへコピーされるため、別のプラグインのファイルを参照できない。そのため、同じ内容のファイルを複数のプラグインに置くことがある。このリポジトリ自身にも、テンプレートと同じ規約を置くことがある。片方だけ直して内容がずれるのを防ぐため、組になっているファイルをこの表で管理する。

## 同じ内容を持つファイルの組

| ファイル | 組になるファイル | 内容 | 意図的な差分 |
| --- | --- | --- | --- |
| `plugins/aidd/references/markdown.md` | `plugins/project/references/markdown.md` | markdownlint 準拠の書式 | なし |
| `.claude/rules/branch.md` | `plugins/project/skills/init-repo/files/.claude/rules/branch.md` | ブランチ名の規約 | なし |

## 組の片方を編集したとき

- もう片方にも同じ変更を入れるべきか検討する。プラグイン固有の事情が無い限り、同じ変更を入れる
- 入れない場合は、理由をユーザーに伝える。ずらしたままにすると決めたら、表の「意図的な差分」に何がなぜ違うかを書く
- push 前の `/marketplace-update` の機械チェック（`check.py` の `duplicated-files`）が、組の内容が一致しているかを検査する

## 組を増やす・減らすとき

- 新しく重複ファイルを作ったら、表に行を足し、frontmatter の `paths` にも両方のパスを足す
- 組の片方を移動・削除したら、表と `paths` を直す
