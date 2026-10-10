# リリース手順

プラグインの利用者に、リリースした内容だけを届けるための手順。ブランチの使い方・版の上げ方・リリースの流れを決める。

マージ・push・Release の作成は人が行う（[P1](policies/p01-operation-boundary.md)）。Claude は、ブランチの作成・版の書き換え・PR の作成までを手伝う。

## ブランチの役割

| ブランチ | 役割 |
| --- | --- |
| `main` | リリースした内容だけを置く。利用者のマーケットプレイスが取得する。GitHub の既定ブランチ |
| `develop` | 次のリリースに入れる変更を溜める。普段の PR のマージ先 |

| ブランチ名 | 用途 | 作成元 | PR のマージ先 |
| --- | --- | --- | --- |
| `issues/<Issue番号>-<説明>` | 普段の変更 | `develop` | `develop` |
| `release/v<version>` | リリース | `develop` | `main` |
| `release/<YYYY-MM-DD>` | `plugins/` 以外（README・docs など）だけを `main` に出す | `develop` | `main` |
| `hotfix/<Issue番号>-<説明>` | リリース済みの版の急ぎの修正 | `main` | `main` |

- PR はすべて merge commit でマージする。squash と rebase は使わない
- `release/`・`hotfix/` を `main` にマージしたら、`main` から `develop` へ PR を出してマージする
- `develop` へのマージでは、PR の `Closes #<番号>` で Issue が閉じない。マージした人が手で閉じる

## 版

- 版は `plugins/<プラグイン>/.claude-plugin/plugin.json` の `version` だけに書く。`.claude-plugin/marketplace.json` には書かない
- 3 つのプラグインで同じ版を使い、まとめて上げる
- [Semantic Versioning](https://semver.org/lang/ja/) に従う

| 種類 | 対象 |
| --- | --- |
| MAJOR | スキルの削除・改名、引数の互換が無い変更、導入済みのテンプレートと組み合わせると動かなくなる変更 |
| MINOR | スキルの追加、互換を保った機能の追加 |
| PATCH | 不具合の修正、文言・説明の修正 |

PR の CI（`.github/workflows/plugin-checks.yml`）が、次の場合に落ちる。

- 3 つの `plugin.json` の版がそろっていない、または `marketplace.json` に版がある
- `main` への PR で、`plugins/` を変えたのに版を上げていない

## リリースの流れ

1. `develop` から `release/v<version>` を作る。`--no-track` は、上流を `origin/develop` にしないため

   ```bash
   git fetch origin
   git switch -c release/v1.1.0 --no-track origin/develop
   ```

1. `git log --oneline origin/main..origin/develop` で入る変更を見て、上の表で版を決める
1. 3 つの `plugin.json` の `version` を上げ、コミットして push する
1. `main` へ PR を作り（タイトル例：`v1.1.0 をリリース`）、マージする。ブランチを作った後に `develop` へ入った変更は、このリリースに入らない
1. マージした `main` のコミットに、GitHub Release を作る（下の「Release の作り方」）
1. `main` から `develop` へ PR を作り、マージする。上げた版を `develop` に戻すため

`plugins/` を変えずに README や docs だけを出すときは、版を上げず、Release も作らない。ブランチ名は `release/<YYYY-MM-DD>` にする。`develop` に未リリースの `plugins/` の変更があると CI が落ちるため、そのときは次のリリースに含める。

## 急ぎの修正（hotfix）

`develop` に溜まった変更を待たずに、リリース済みの版を直す手順。

1. `main` から `hotfix/<Issue番号>-<説明>` を作る

   ```bash
   git fetch origin
   git switch -c hotfix/12-fix-commit-skill --no-track origin/main
   ```

1. 直して、版を PATCH で上げる
1. `main` へ PR を作ってマージし、リリースの流れの 5・6 と同じく Release を作って `develop` に取り込む

## Release の作り方

1. GitHub の **Releases** で **Draft a new release** を開く
1. **Choose a tag** に `v1.1.0` と入れ、**Create new tag: v1.1.0 on publish** を選ぶ
1. **Target** は `main` にする
1. タイトルは `v1.1.0` にする。説明は **Generate release notes** で自動生成する
1. **Publish release** を押す。下書きのままではタグができない

コマンドなら `gh release create v1.1.0 --target main --title v1.1.0 --generate-notes` でも同じになる。

- タグ名は `v<version>`（例：`v1.1.0`）
- 変更点は Release の説明だけに書き、CHANGELOG は持たない。説明は、前のタグから入った PR のタイトルの一覧になる

## 理由

- 【main をリリース専用にする】利用者が更新したときに届くのは、その時点の `main` の中身だから。版を上げるだけでは、リリースの後に `main` へ入れた変更まで同じ版で届く
- 【既定ブランチを main のままにする】利用者は ref なしで登録しており、既定ブランチを取得するから。変えると登録し直しが要る
- 【release ブランチで版を上げる】`develop` で版を上げてからマージすると、その間に入った変更まで新しい版に混ざるから。ブランチを作った時点で中身を固定する
- 【版は plugin.json だけに書く】`marketplace.json` にも書けるが、`plugin.json` が優先され、書く場所が 2 つになるから
- 【3 つのプラグインで 1 つの版にする】ref を指定して戻すと、カタログ全体がその時点に戻るから。プラグインごとに版を分けても戻せる単位は変わらず、タグと Release が増えるだけになる。プラグインの間に版の範囲付きの依存を足すときは、公式のタグの形（`<プラグイン>--v<version>`）への切り替えを考える
- 【タグは Release で付ける】利用者が Releases のページで版の一覧と変更点を見られるから
- 【merge commit でマージする】squash や rebase では `main` に新しいコミットができ、`develop` と履歴がずれて、取り込みで衝突するから
- 【CI で版を確かめる】版を上げ忘れると、`main` にマージしても既存の利用者に届かないから

公式の説明：[Versions and updates](https://code.claude.com/docs/en/plugins/loading#versions-and-updates)・[Keep users up to date](https://code.claude.com/docs/en/plugins/host-marketplace#keep-users-up-to-date)
