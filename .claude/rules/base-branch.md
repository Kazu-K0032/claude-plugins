# 作業ブランチの起点と PR のマージ先に関するルール

このリポジトリでは、`main` をリリース専用にし、普段の変更は `develop` に溜める。そのため、作業ブランチは `develop` から作り、PR も `develop` に向ける。ブランチの決まりは [CONTRIBUTING.md](../../CONTRIBUTING.md) が正典。

## 作業ブランチを作る場合

- `develop` から作る。`gh issue develop` では `--base develop` を渡す
- 名前は `.claude/rules/branch.md` に従う

## PR を作る場合

- マージ先は `develop` にする。`main` に向けてよいのは `release/`・`hotfix/` のブランチだけ
- 差分やコミットの一覧は、マージ先のブランチと比べる（例：`git diff origin/develop...HEAD`）
- `develop` に向けた PR をマージすると、`.github/workflows/close-linked-issues.yml` が本文の `Closes #<番号>` の Issue を閉じる。手で閉じるよう伝えるのは、このワークフローが失敗したときだけ

## リリース・hotfix を頼まれた場合

- [docs/release.md](../../docs/release.md) を読み、その手順に従う
