# 変更を送るときのルール

このリポジトリに変更を送るときの、ブランチと PR の決まり。`main` をリリース専用にし、普段の変更は `develop` に溜める。リリースの手順は [docs/release.md](docs/release.md) にある。

## ブランチの役割

| ブランチ | 役割 |
| --- | --- |
| `main` | リリースした内容だけを置く。利用者のマーケットプレイスが取得する。GitHub の既定ブランチ |
| `develop` | 次のリリースに入れる変更を溜める。普段の PR のマージ先 |

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

- マージ先は `develop` にする。GitHub の既定のマージ先は `main` のため、PR を作るときに変える
- `main` に向けてよいのは、`release/`・`hotfix/` のブランチだけ

## PR をマージする場合

- merge commit でマージする。squash と rebase は使わない
- `develop` へのマージでは、PR の `Closes #<番号>` で Issue が閉じない。マージした人が手で閉じる
