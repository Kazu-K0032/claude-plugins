---
paths:
  - ".github/workflows/**/*.yml"
  - ".github/workflows/**/*.yaml"
docs-type: ai-doc
---

# GitHub Actions 実装ルール

`.github/workflows/` 配下のワークフローファイルを読み書きするとき常時適用する。

## ルール

- ワークフローの内容を、リポジトリの CI/CD ドキュメント（`docs/architecture/ci-cd.md` 等）と整合させる

## 絶対遵守

- 【必須】全ワークフローのトップレベルに `permissions: {}` を置き、ジョブレベルで必要最小限の権限だけ付与する
- 【必須】外部アクションはタグ指定（`@v4`）ではなく **full commit SHA** で固定する（`@abc1234...` 形式）
- 【禁止】`${{ secrets.XXX }}` や `${{ github.event.xxx }}` を `run:` の文字列に直接展開する（コマンドインジェクション）。必ず `env:` セクション経由で渡す
- 【必須】全ジョブに `timeout-minutes` を設定する。デフォルト 360 分はコスト無駄遣いになる

## permissions（最小権限）

ワークフローレベルで全権限を無効化し、ジョブレベルで必要なものだけ付与する。

```yaml
permissions: {}   # ワークフローレベルで全無効化

jobs:
  deploy:
    permissions:
      contents: read  # checkout に必要な最小権限
```

`pull_request` イベントのジョブには `write` 権限を与えない。フォーク PR は信頼できないコードを実行するため。

## SHA 固定

タグ（`@v6`）はリポジトリオーナーが書き換え可能な可変参照。供給網攻撃（CVE-2025-30066）で実害が確認されているため、full commit SHA で固定する。

```yaml
# NG
- uses: actions/checkout@v6

# OK
- uses: actions/checkout@1af3b93b6815bc44a9784bd300feb67ff0d1eeb3 # v6.0.0
```

SHA の取得方法:

```bash
git ls-remote https://github.com/actions/checkout.git refs/tags/v6.0.0
```

## コマンドインジェクション対策

```yaml
# NG: secrets を run: に直接展開するとインジェクションを受ける
- run: echo "Deploying to ${{ secrets.DEPLOY_ENV }}"

# OK: env: セクション経由で渡す
env:
  DEPLOY_ENV: ${{ secrets.DEPLOY_ENV }}
steps:
  - run: echo "Deploying to $DEPLOY_ENV"
```

## YAML スカラーのクオート

値にコロン+空白（`: `）を含む、または `{` `[` `*` `&` `#` `@` `` ` `` `!` `|` `>` `%` `"` `'` `?` `-`（＋空白）で始まるスカラーは**クオートで囲む**（ダブル/シングルどちらでも可。特殊文字を含む値はダブルが無難）。囲まないと YAML パーサが mapping やアンカー等と誤解釈し、構文エラーになる。

```yaml
# NG: 値の中の ": " を mapping と誤解釈してパースエラー
name: fix: ラベルを修正
run: echo DocDD: を導入

# OK: コロンを含む文字列はクオートする
name: "fix: ラベルを修正"
run: 'echo DocDD: を導入'
```

`name:` や `run:` の値に `:`（コロン）を書くときは特に注意する。

## timeout-minutes

ジョブの想定実行時間の 1.5 倍を目安に設定する。

```yaml
jobs:
  deploy:
    timeout-minutes: 10   # 想定 ~6 分のジョブなら 10 分
```

## イベントトリガー

不要なトリガーを排除して無駄な実行を防ぐ。

```yaml
# NG: 全 push で起動（README 変更だけでも動く）
on:
  push:

# OK: 対象ブランチ・対象パスを絞る
on:
  push:
    branches: [main]
    paths:
      - "src/**"
```

`pull_request` は `types: [opened, reopened, synchronize]` に絞る（`closed` 等の不要なトリガーを除外）。

## ジョブ分割

テスト・ビルド・デプロイはジョブを分ける。権限とシークレットのスコープを最小化するため。

## シークレット

- 機密値は GitHub Secrets に登録し、`env:` 経由で使う
- 構造化データ（JSON・YAML）をシークレットに入れない。一部参照するとマスクが外れてログに漏れる
- Long-Lived Token は使わない。漏洩した際の被害期間を最小化するため

## バージョン統一

プロジェクト内で同じアクションを複数のワークフローで使う場合、すべて同一バージョン（SHA）に統一する。セキュリティ上の問題がなければ最新の安定版を採用し、古いワークフローも合わせてアップグレードする。

### 使用中の SHA の調べ方

SHA の実体は各ワークフローの `uses:` を正とする。一覧を別ファイルへ転記すると、Dependabot が SHA を上げるたびに陳腐化するため置かない。

```bash
grep -rhoE 'uses: [^ ]+@[0-9a-f]{40} # .+' .github/workflows/ | sort -u
```

同じアクションが複数行に出て SHA がずれていたら揃える。通常は `.github/dependabot.yml` が月次でまとめて更新 PR を出すため、手で上げる必要はない。

## 命名

ワークフロー名・ジョブ名・ステップ名はすべて日本語で書く。GitHub Actions の UI に表示される人間向けラベルのため。

```yaml
# NG
name: Deploy Theme
jobs:
  deploy:
    name: Deploy & Build
    steps:
      - name: Set up SSH

# OK
name: 本番環境へデプロイする
jobs:
  deploy:
    name: デプロイ & ビルド
    steps:
      - name: SSH を準備
```
