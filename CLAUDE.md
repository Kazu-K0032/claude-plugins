# CLAUDE.md

このリポジトリの規約と方針が、どのファイルにあるかを示す案内。規約の本文はここに写さない。2 か所に書くと、片方だけが直されて食い違うため。

## 変更を書く・レビューする場合

- 触るファイルに関係する規約を下の「規約」の表から、方針を `.claude/rules/plugin-policies.md` の 2 つの表から探し、そのファイルを読んで照らす
- `plugins/project/skills/init-repo/files/` の下の `CLAUDE.md`・`.claude/rules/` は、利用先に配る雛形で、このリポジトリの規約ではない。雛形そのものを直すときだけ、`plugin-changes.md` と方針に照らす

## 規約（`.claude/rules/`）

`paths` の無い規約は常に読み込まれる。`paths` の有る規約は、対象のファイルを開いたときだけ読み込まれる。

| ファイル | 決めること | 対象 |
| --- | --- | --- |
| `plugin-changes.md` | プラグインを変えるときに守ること（方針の確かめ方・権限の対応表・変更を終えたときの扱い） | 常に |
| `plugin-policies.md` | 触るファイル・場面から、読む方針（`docs/policies/`）を探す表 | 常に |
| `ai-docs.md` | `SKILL.md`・規約・`CLAUDE.md` など AI が読む文書の骨組みと長さ | 常に |
| `base-branch.md` | 作業ブランチの起点と PR のマージ先（`develop`） | 常に |
| `branch.md` | ブランチ名（`issues/<番号>-<説明>`） | 常に |
| `tmp-output.md` | レポート・下書き・作業ファイルの置き場所（`tmp/<ブランチ名>/`） | 常に |
| `argument-hint.md` | `SKILL.md` の `argument-hint` の書き方 | `SKILL.md` |
| `duplicated-files.md` | 同じ内容を持つファイルの組と、片方を直したときの同期 | 組のファイル |

## 方針と価値

- `docs/policies/`：プラグインが何をして何をしないかと、その理由（P1〜P12）。理由を書く唯一の場所。一覧は `docs/policies/README.md`
- `docs/values/`：方針の土台になる AI 駆動開発の価値（V1〜V5）
- `CONTRIBUTING.md`：ブランチと PR の決まり。`docs/release.md`：リリースの手順
