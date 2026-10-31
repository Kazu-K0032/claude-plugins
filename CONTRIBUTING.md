# 変更を送るときのルール

このリポジトリに変更を送るときの、ブランチと PR の決まり。`main` をリリース専用にし、普段の変更は `develop` に溜める。リリースの手順は [docs/release.md](docs/release.md) にある。

## ブランチの役割

| ブランチ | 役割 |
| --- | --- |
| `main` | リリースした内容だけを置く。利用者のマーケットプレイスが取得する。GitHub の既定ブランチ |
| `develop` | 次のリリースに入れる変更を溜める。普段の PR のマージ先 |

- `main` は、ブランチの保護ルール（[.github/rulesets/](.github/rulesets/README.md)）で、直接の push・force push・削除を止めている

## ブランチを作る場合

| ブランチ名 | 用途 | 作成元 | PR のマージ先 |
| --- | --- | --- | --- |
| `issues/<Issue番号>-<説明>` | 普段の変更と、版を上げる変更 | `develop` | `develop` |
| `release/v<version>` | リリース。`.github/workflows/release.yml` が作る | `develop` | `main` |
| `release/<YYYY-MM-DD>` | `plugins/` 以外（README・docs など）だけを `main` に出す | `develop` | `main` |
| `hotfix/<Issue番号>-<説明>` | リリース済みの版の急ぎの修正 | `main` | `main` |

- `<説明>` は、Issue の要点を英語 2〜4 語で書く。小文字にし、語の間は `-` でつなぐ（例：`issues/5-argument-hint`）
- `release/v<version>` は手で作らない

## PR を作る場合

- マージ先は `develop` にする。GitHub の既定のマージ先は `main` のため、PR を作るときに変える。作った後に変えても、CI は新しいマージ先で動き直す
- `main` に向けてよいのは、`release/`・`hotfix/` のブランチだけ

## PR をマージする場合

- merge commit でマージする。squash と rebase は使わない
- `develop` へのマージでは、GitHub は `Closes #<番号>` で Issue を閉じない。代わりに `.github/workflows/close-linked-issues.yml` が、PR 本文の `Closes #<番号>` などを読んで閉じる
- 閉じたくない Issue は、`Closes` でなく `Ref: Issue #<番号>` と書く。PR の画面で Issue を紐づけているときは、その紐づけも外す
- 閉じられなかったとき（fork からの PR など）は、マージした人が手で閉じる

## Claude の bot に頼む場合

bot を使えるようにする準備（App・environment・secret）、確かめ方、トークンの更新、止め方は [docs/claude-bot.md](docs/claude-bot.md) にある。

- Issue のコメントに `@claude` と書くと、GitHub Actions の Claude が Issue を実装し、`develop` 向けの PR を作る（[.github/workflows/claude-issue-to-pr.yml](.github/workflows/claude-issue-to-pr.yml)。手順は [.claude/skills/issue-to-pr/SKILL.md](.claude/skills/issue-to-pr/SKILL.md)）。頼めるのは、リポジトリに書き込める人だけ
- bot は Issue の本文とコメントを読んで動く。決めたこと・変えるファイル・確かめ方を Issue に書いておくと、意図どおりに動きやすい
- bot のブランチ名は `issues/<Issue番号>-claude-<日時>` になる
- bot は、まず下書きの PR を作る。CI が落ちたら、bot がログを読んで直す（最大 3 回）
- CI が通ると PR はレビュー待ちになり、セキュリティレビュー（`/security-review`）とコードレビュー（公式の code-review）が動く。直すべき指摘があれば bot が 1 回だけ直し、もう一度 CI が通るまで直す（最大 3 回）
- 最後の CI が通らなければ、PR は下書きに戻る。どちらの場合も、計画・CI・レビューの記録が PR にコメントされる
- マージは、ほかの PR と同じく人が行う
- `.github/workflows/`・`.github/scripts/`・`.claude/settings.json` の変更は、PR の本文に diff で届く。人が確かめて当てる
- PR を作れなかったときは、理由が Issue にコメントされる
- 動くのは `main` にあるワークフローのため、ワークフローを変えたら、リリースするまで反映されない
- 手元の Claude は、`@claude` を含むコメントを書かない。deny とフック（`.claude/hooks/guard-claude-mention.sh`）で止めている
