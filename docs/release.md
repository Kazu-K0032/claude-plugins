# リリース手順

プラグインの利用者に、リリースした内容だけを届けるための手順。版の上げ方・リリースの流れを決める。ブランチの役割・名前・マージの仕方は [CONTRIBUTING.md](../CONTRIBUTING.md) にある。

通常のリリースは、`.github/workflows/release.yml` が release ブランチ・PR・タグ・Release を作る。人が行うのは、リリースの Issue の作成と、PR のマージだけ。Claude は、マージ・push・Release の作成をしない（[P1](policies/p01-operation-boundary.md)）。手伝うのは、ブランチの作成・版の書き換え・PR の作成まで。

## 版

- 版は `plugins/<プラグイン>/.claude-plugin/plugin.json` の `version` だけに書く。`.claude-plugin/marketplace.json` には書かない
- 3 つのプラグインで同じ版を使い、まとめて上げる
- [Semantic Versioning](https://semver.org/lang/ja/) に従う
- 版は、リリースの前に `develop` で上げる（下の「リリースの流れ」）。hotfix では `hotfix/` のブランチで上げる

| 種類 | 対象 |
| --- | --- |
| MAJOR | スキルの削除・改名、引数の互換が無い変更、導入済みのテンプレートと組み合わせると動かなくなる変更 |
| MINOR | スキルの追加、互換を保った機能の追加 |
| PATCH | 不具合の修正、文言・説明の修正 |

CI（`.github/workflows/plugin-checks.yml`）が、次の場合に落ちる。

- 3 つの `plugin.json` の版がそろっていない、または `marketplace.json` に版がある
- `main` への PR とリリースの Issue で、`plugins/` を変えたのに版を上げていない

## リリースの流れ

1. `git log --oneline origin/main..origin/develop` で入る変更を見て、上の表で版を決める
1. Issue を作り、`develop` から `issues/<Issue番号>-<説明>`（例：`issues/60-v1-1-0`）を作る。3 つの `plugin.json` の `version` を上げ、`develop` へ PR を出してマージする
1. 版を上げた `develop` で `/aidd:harness-audit` を範囲「全体」で動かし、リポジトリ全体が設計思想に合うかを確かめる。直す指摘があれば、`develop` への PR で直してから進む。CI は機械の検査だけで、思想との整合は見ないため
1. Issue フォームの「リリース」で、リリースの Issue を作る。`release` ラベルが付く。書き込み権限のある人が作った Issue だけで動き、ほかの人の Issue では何も起きない
1. `release.yml` が次を行う。終わると、Issue に PR の URL がコメントされる
   - `plugin-checks.yml` と同じ検査を `develop` で動かす
   - `develop` から `release/v<version>` を作る
   - `main` へ PR（タイトル：`v<version> をリリース`）を作る。本文には Issue の本文と `Closes #<Issue番号>` が入る
1. PR の中身を確かめ、マージする。Issue を作った後に `develop` へ入った変更は、このリリースに入らない
1. `release.yml` が、マージした `main` のコミットにタグ `v<version>` と GitHub Release を作り、PR と Issue にコメントする

`main` から `develop` へ戻す PR は要らない。版は `develop` で上げてあるため。

手順 5 で失敗すると、Issue に Actions のログの URL がコメントされる。原因を直したら、Actions の画面でその実行を再実行する（**Re-run jobs**）。再実行では、検査も release ブランチも、その時点の `develop` から作り直される。ただし、`release/v<version>` を作った後に失敗したときは、そのブランチを消してから再実行する。

`plugins/` を変えずに README や docs だけを出すときは、版を上げず、Release も作らない。リリースの Issue は使わず、`develop` から `release/<YYYY-MM-DD>` を作り、`main` へ PR を出してマージする。`develop` に未リリースの `plugins/` の変更があると CI が落ちるため、そのときは次のリリースに含める。

```bash
git fetch origin
git switch -c release/2026-10-11 --no-track origin/develop
```

## 急ぎの修正（hotfix）

`develop` に溜まった変更を待たずに、リリース済みの版を直す手順。`release.yml` は使わず、手で行う。

1. `main` から `hotfix/<Issue番号>-<説明>` を作る

   ```bash
   git fetch origin
   git switch -c hotfix/12-fix-commit-skill --no-track origin/main
   ```

   コミットの `Ref:` などに Issue 番号が要るときは、`hotfix/` の後ろの番号を使う

1. 直して、版を PATCH で上げる
1. `main` へ PR を作ってマージする。`release` ラベルは付けない
1. マージした `main` のコミットに、GitHub Release を作る（下の「Release の作り方」）
1. `main` から `develop` へ PR を作り、マージする。修正と上げた版を `develop` に戻すため

## Release の作り方

hotfix で、手で Release を作るときの手順。通常のリリースでは `release.yml` が同じ形で作る。

1. GitHub の **Releases** で **Draft a new release** を開く
1. **Choose a tag** に `v1.1.0` と入れ、**Create new tag: v1.1.0 on publish** を選ぶ
1. **Target** は `main` にする
1. タイトルは `v1.1.0` にする。説明は **Generate release notes** で自動生成する
1. **Publish release** を押す。下書きのままではタグができない

コマンドなら `gh release create v1.1.0 --target main --title v1.1.0 --generate-notes` でも同じになる。

- タグ名は `v<version>`（例：`v1.1.0`）
- 変更点は Release の説明だけに書き、CHANGELOG は持たない。説明は、前のタグから入った PR のタイトルの一覧になる
- リリースの PR（`release` ラベル）は、`.github/release.yml` で説明の一覧から外す。中身の PR と重なるため

## 準備（一度だけ）

`release.yml` を動かす前に、リポジトリで次を設定する。

1. `release` ラベルを作る。無いと、Issue フォームでラベルが付かず、PR の作成も失敗する

   ```bash
   gh label create release --color 0E8A16 --description "main へのリリース"
   ```

1. **Settings** → **Actions** → **General** → **Workflow permissions** で、**Allow GitHub Actions to create and approve pull requests** を有効にする。無効だと、`release.yml` が PR を作れない
