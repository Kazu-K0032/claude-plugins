# Claude の bot の設定手順

Issue のコメントの `@claude` で動く bot（`.github/workflows/claude-issue-to-pr.yml`）を使えるようにするための手順。準備・入れた後の確かめ方・動かないとき・トークンの更新・止め方を決める。頼み方と、bot が作る PR の扱いは [CONTRIBUTING.md](../CONTRIBUTING.md) の「Claude の bot に頼む場合」にある。

bot に任せるのは、作業ブランチへのコミット・push と PR の作成まで（[P1](policies/p01-operation-boundary.md) の例外）。マージは人が行う。この文書の準備は、リポジトリの設定と secret の変更のため、人が行う。Claude は行わない（P1）。

## 動く条件

- ワークフローが `main` にある。Issue・コメントのイベントでは、既定ブランチ（`main`）のワークフローが使われるため、`develop` にマージしただけでは動かない。`main` へは [docs/release.md](release.md) の手順で出す
- 手順のスキル（`.claude/skills/issue-to-pr/`）と、CI を待つスクリプト（`.github/scripts/wait-pr-checks.sh`）が `develop` にある。ワークフローは `develop` を checkout して使う
- 下の「準備（一度だけ）」が済んでいる
- 頼む人が、リポジトリに書き込める。書き込めない人のコメントでは、action が何もせずに終わる

## 準備（一度だけ）

上から順に行う。特に、environment を作って `main` に絞る手順（3・4）は、トークンの登録（6）より先に行う。environment が無いままワークフローが動くと、GitHub が制限の無い environment を自動で作るため、後から secret だけを登録すると、ほかのブランチのワークフローからもトークンを読めてしまう。

1. **Settings** → **Actions** → **General** の **Actions permissions** で、外部の action を使えることを確かめる。**Allow all actions** のままでよい。絞っているなら、`anthropics/claude-code-action` と `actions/checkout` を許す
1. [Claude GitHub App](https://github.com/apps/claude) を開き、**Install** でこのリポジトリに入れる。App は、Actions・Workflows の書き込みなどの広い権限を求め、一部だけを受け入れることはできない（[GitHub App permissions](https://code.claude.com/docs/en/github-actions#github-app-permissions)）
1. **Settings** → **Environments** → **New environment** で、`claude` という名前の environment を作る
1. 作った environment の **Deployment branches and tags** で **Selected branches and tags** を選び、`main` だけを足す
1. 手元で次を実行し、トークンを作る。Pro・Max などの Claude のサブスクリプションが要る。有効期限は 1 年

   ```bash
   claude setup-token
   ```

1. 作ったトークンを、environment `claude` の **Environment secrets** に `CLAUDE_CODE_OAUTH_TOKEN` という名前で登録する。**Repository secrets** には置かない。どのワークフローからも読めてしまうため。コマンドで登録するときは、次を実行してトークンを貼る

   ```bash
   gh secret set CLAUDE_CODE_OAUTH_TOKEN --env claude
   ```

1. トークンを作った日を、更新の目安としてカレンダーなどに残す（下の「トークンを更新する」）

## 入れた後に確かめる

人が行う。`@claude` を書くことはワークフローの実行にあたり、Claude には任せないため（P1）。

1. テスト用の小さな Issue を作る（例：README の誤字を 1 か所直す）
1. その Issue に `@claude この Issue を実装して` とコメントする
1. **Actions** に「Claude による Issue の実装」の実行が出て、Issue に Claude の進み具合のコメントが付くか
1. `develop` 向けの下書きの PR ができ、CI が通った後にレビュー待ちに変わるか
1. PR に、code-review のコメントと、Claude の作業記録（計画・CI・レビュー・直し）のコメントが付くか
1. 書き込み権限の無いアカウントのコメントでは、動かないか

確かめた PR は、ほかの PR と同じく中身を見て、マージするか閉じる。

## 動かないとき

| 見え方 | 原因と直し方 |
| --- | --- |
| **Actions** に実行が出ない | ワークフローが `main` に無い。コメントに `@claude` が無い（`@claude-bot` のように語が続くものは別の名前として扱われる）。PR へのコメントで頼んだ（Issue のコメントでだけ動く） |
| Issue に「トークンが空か空白だけです」とコメントされる | secret が登録されていないか、名前が違う。準備の 6 |
| 実行が environment の保護ルールで失敗する | environment の **Deployment branches** に `main` が無い。準備の 4 |
| Issue に「PR を作れませんでした」とコメントされる | コメントの「理由」と実行のログを見る。認証のエラーなら、トークンの期限切れ（下の「トークンを更新する」）か、App が入っていない（準備の 2） |
| PR が下書きのまま残る | 最後の CI が通らなかった。作業記録のコメントにある CI のログを見て、人が直すか、Issue を詳しく書いて頼み直す |
| bot の push で CI が動かない | App のトークンで push できていない。App が入っているかを確かめる（準備の 2） |

## トークンを更新する

- トークンの有効期限は 1 年。期限が近づいたら、準備の 5・6 をやり直し、同じ名前の secret を上書きする
- bot は、トークンを作った人のサブスクリプションの使用量で動く。担当を代えるときも、新しい担当がトークンを作り直す

## 止める

- しばらく止める：**Actions** → 「Claude による Issue の実装」→ **…** → **Disable workflow**。戻すときは **Enable workflow**
- 動いている実行を止める：実行の画面の **Cancel workflow**
- やめる：ワークフローとスキルを消す PR を出し、environment `claude`（と secret）を消す。App は、ほかの機能で使っていなければ、**Settings** → **GitHub Apps** から外す。secret を消しても、トークン自体は期限まで有効のまま

## 使う量の目安

- 1 回の依頼で、Claude は最大 10 回動く（実装 1 回、CI の直し 3 回 × 2、レビュー 2 回、レビューの直し 1 回）。ジョブの上限は 300 分
- 使うのは、トークンを作った人のサブスクリプションの使用量と、Actions の時間。公開リポジトリでは、GitHub の標準のランナーの時間は無料
- Issue に、決めたこと・変えるファイル・確かめ方を詳しく書くと、直しの回数が減りやすい
