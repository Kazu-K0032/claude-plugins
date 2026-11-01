---
paths:
  - ".github/workflows/**/*.yml"
  - ".github/workflows/**/*.yaml"
---

# GitHub Actions に関するルール

`.github/workflows/` のワークフローの、権限・アクションの固定・値の渡し方・トリガー・名前の書き方を決める。ワークフローはリポジトリの権限とシークレットを扱い、書き方を誤ると、乗っ取りや秘匿値の漏えい、無駄な実行につながるため。

## ワークフローを書く場合

- ワークフローの内容を、リポジトリの CI/CD ドキュメント（`docs/architecture/ci-cd.md` 等）と整合させる
- テスト・ビルド・デプロイはジョブを分ける。権限とシークレットのスコープを最小化するため
- 【必須】の 3 つ（`permissions: {}`・SHA の固定・`timeout-minutes`）は、`pr-checks.yml` の「ワークフローの検査」が PR ごとに確かめる。SHA の固定は zizmor が、残りの 2 つは `.github/scripts/check-workflows.sh` が見る。書いた後は、手元でも同じ検査を流してよい

## 検査の指摘を無視する場合

- 直せる指摘は直す。意図して使う書き方（`pull_request_target` など）だけ、その行に `# zizmor: ignore[<監査名>]` を付け、すぐ上のコメントに理由を書く。理由の無い無視は、レビューで意図か見落としかを見分けられないため
- 設定ファイル（`zizmor.yml`）で監査ごと止めない。ほかの行の同じ問題も見えなくなるため

## 権限を付ける場合

- 【必須】全ワークフローのトップレベルに `permissions: {}` を置き、ジョブレベルで必要最小限の権限だけ付与する
- `pull_request` イベントのジョブには `write` 権限を与えない。フォーク PR は信頼できないコードを実行するため
- `pull_request_target` は、フォーク PR でもラベル付けなどの書き込みが要るときだけ使い、次をすべて守る。このイベントはフォーク PR にも書き込みの権限とシークレットを渡すため、PR の中身を動かすと乗っ取られる
  - PR のコードを checkout しない（`ref` に PR の head を渡すことも含む）
  - PR のタイトル・本文・ブランチ名など外から来る値は、`env:` 経由で渡す（下の「値を run に渡す場合」）
  - 権限は、ジョブに必要なもの（例：`pull-requests: write`）だけにする
- 公開リポジトリで `pull_request_target` を使うときは、Actions のイベントポリシーで許可する。2026-12-02 から GitHub が既定で止め、許可しないとワークフローが動かないため。許可はリポジトリの設定の変更のため、人が行う

```yaml
permissions: {}   # ワークフローレベルで全無効化

jobs:
  deploy:
    permissions:
      contents: read  # checkout に必要な最小権限
```

## 外部のアクションを使う場合

- 【必須】外部アクションはタグ指定（`@v4`）ではなく **full commit SHA** で固定する（`@abc1234...` 形式）。タグ（`@v6`）はリポジトリオーナーが書き換え可能な可変参照で、供給網攻撃（CVE-2025-30066）で実害が確認されているため
- 同じアクションを複数のワークフローで使う場合、すべて同一バージョン（SHA）に統一する。セキュリティ上の問題がなければ最新の安定版を採用し、古いワークフローも合わせてアップグレードする
- SHA の実体は各ワークフローの `uses:` を正とする。一覧を別ファイルへ転記すると、Dependabot が SHA を上げるたびに陳腐化するため置かない
- 同じアクションが複数行に出て SHA がずれていたら揃える。通常は `.github/dependabot.yml` が月次でまとめて更新 PR を出すため、手で上げる必要はない

```yaml
# NG
- uses: actions/checkout@v6

# OK
- uses: actions/checkout@1af3b93b6815bc44a9784bd300feb67ff0d1eeb3 # v6.0.0
```

SHA の取得方法と、使用中の SHA の調べ方:

```bash
git ls-remote https://github.com/actions/checkout.git refs/tags/v6.0.0
grep -rhoE 'uses: [^ ]+@[0-9a-f]{40} # .+' .github/workflows/ | sort -u
```

## 値を run に渡す場合

- 【禁止】`${{ secrets.XXX }}` や `${{ github.event.xxx }}` を `run:` の文字列に直接展開する（コマンドインジェクション）。必ず `env:` セクション経由で渡す

```yaml
# NG: secrets を run: に直接展開するとインジェクションを受ける
- run: echo "Deploying to ${{ secrets.DEPLOY_ENV }}"

# OK: env: セクション経由で渡す
env:
  DEPLOY_ENV: ${{ secrets.DEPLOY_ENV }}
steps:
  - run: echo "Deploying to $DEPLOY_ENV"
```

## シークレットを使う場合

- 機密値は GitHub Secrets に登録し、`env:` 経由で使う
- 構造化データ（JSON・YAML）をシークレットに入れない。一部参照するとマスクが外れてログに漏れるため
- Long-Lived Token は使わない。漏洩した際の被害期間を最小化するため

## YAML の値を書く場合

値にコロンと空白の並び（`:` の後に空白）を含む、または `{` `[` `*` `&` `#` `@` `` ` `` `!` `|` `>` `%` `"` `'` `?` `-`（＋空白）で始まるスカラーは**クオートで囲む**（ダブル/シングルどちらでも可。特殊文字を含む値はダブルが無難）。囲まないと YAML パーサが mapping やアンカー等と誤解釈し、構文エラーになるため。`name:` や `run:` の値に `:`（コロン）を書くときは特に注意する。

```yaml
# NG: 値の中の ": " を mapping と誤解釈してパースエラー
name: fix: ラベルを修正
run: echo DocDD: を導入

# OK: コロンを含む文字列はクオートする
name: "fix: ラベルを修正"
run: 'echo DocDD: を導入'
```

## 実行時間の上限を決める場合

- 【必須】全ジョブに `timeout-minutes` を設定する。デフォルト 360 分はコスト無駄遣いになるため
- ジョブの想定実行時間の 1.5 倍を目安に設定する

```yaml
jobs:
  deploy:
    timeout-minutes: 10   # 想定 ~6 分のジョブなら 10 分
```

## トリガーを決める場合

不要なトリガーを排除して無駄な実行を防ぐ。

- `push` は対象ブランチ・対象パスを絞る
- `pull_request` は `types: [opened, reopened, synchronize]` に絞る（`closed` 等の不要なトリガーを除外）
- 保護ブランチ（GitHub の ruleset）を変えたら、`pull_request` の `branches` と、lefthook の pre-push のガード（使っていれば）の一覧もそろえる。ずれると、保護したブランチへの PR で検査が動かないため。ruleset は GitHub の画面で人が変える

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

## 名前を付ける場合

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
