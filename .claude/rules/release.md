# ブランチの起点とリリースに関するルール

このリポジトリでは、`main` をリリース専用にし、普段の変更は `develop` に溜める。作業ブランチの起点・PR のマージ先・版を上げる時期を決める。手順と理由は [docs/release.md](../../docs/release.md) が正典。

## 作業ブランチを作る場合

- 普段の変更は `develop` から作る。`gh issue develop` では `--base develop` を渡す
- 名前は `.claude/rules/branch.md` に従う。リリースと急ぎの修正だけは、次の名前にする

| ブランチ名 | 作成元 |
| --- | --- |
| `release/v<version>`（`plugins/` を変えないときは `release/<YYYY-MM-DD>`） | `develop` |
| `hotfix/<Issue番号>-<説明>` | `main` |

- `hotfix/` のブランチで Issue 番号が要るときは、`hotfix/` の後ろの番号を使う

## PR を作る場合

- マージ先は `develop` にする。`main` に向けてよいのは `release/`・`hotfix/` のブランチだけ
- 差分やコミットの一覧は、マージ先のブランチと比べる（例：`git diff origin/develop...HEAD`）
- `develop` に向けた PR の `Closes #<番号>` では Issue が閉じない。マージ後に手で閉じるよう、利用者に伝える

## 版を変える場合

- `plugin.json` の `version` は、`release/v<version>` と `hotfix/` のブランチでだけ上げる。普段の変更では触らない
- 3 つのプラグインの `plugin.json` を同じ版にする。`marketplace.json` には書かない
- マージ・push・Release の作成は利用者が行う。Claude は手順とコマンドを示す
