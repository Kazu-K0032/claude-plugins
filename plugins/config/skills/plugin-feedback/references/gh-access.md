# `gh` で読み書きできるかで変わる扱い

`gh` の状態と権限で、起票の進め方が変わる。手順 1 で `gh auth status` の結果を見るとき、手順 9 でラベルを付けられるかを確かめるとき、手順 10 で `gh` が失敗したときに読む。

## `gh auth status` の結果

| 結果 | 対応 |
| --- | --- |
| `gh` が無い（`command not found` 等） | [GitHub CLI](https://cli.github.com/) のインストールと `gh auth login` を案内する。今すぐ起票したい場合は「`gh` で書き込めない場合」に進む |
| ログインしていない | `gh auth login` を案内する。今すぐ起票したい場合は同上 |
| `Token:` が `github_pat_` で始まり、アカウントが `Kazu-K0032` 以外 | fine-grained トークンは、メンバーでない公開リポジトリに書き込めない。`gh auth login`（ブラウザでのログイン）か classic トークンへの切り替えを案内する。切り替えない場合は「`gh` で書き込めない場合」に進む |
| それ以外 | 手順 1 の続き（承認の設定を確かめる）へ進む |

## ラベルを付けられるか

新しい Issue の場合だけ、手順 9 の承認の前に確かめる。リポジトリ名は必ず付ける。付けないと、今いる利用先のリポジトリの権限が返る。

```bash
gh repo view Kazu-K0032/claude-plugins --json viewerPermission
```

- `ADMIN`・`MAINTAIN`・`WRITE` なら、付けるラベルが実在することを `gh label list --repo Kazu-K0032/claude-plugins` で確かめる
- それ以外（`TRIAGE`・`READ` 等）なら、ラベルは付けずに作者に任せる。書き込み権限が無いと、指定したラベルはエラーにならずに捨てられるため

## `gh` が失敗した場合

手順 10 で `gh` が失敗したら、エラーを示して「`gh` で書き込めない場合」に進む。`Resource not accessible by personal access token` などの 403 は、上の表の fine-grained トークンが原因のことが多い。

## `gh` で書き込めない場合

`gh` が無い・ログインしていない・トークンで書き込めない場合は、下書きを作ってユーザーに手で起票してもらう。

1. 手順 2・6〜8 で下書きを作る。`gh` が使えて読み取りだけできる場合（fine-grained トークン等）は、手順 3〜5 も行う。使えない場合は、[Issue の一覧](https://github.com/Kazu-K0032/claude-plugins/issues?q=is%3Aissue) で同じ件が無いかを確かめるよう伝える
1. タイトルと本文を、そのまま貼り付けられる形で示す
1. 貼り付け先を案内して終える。新しい Issue なら [新しい Issue の画面](https://github.com/Kazu-K0032/claude-plugins/issues/new)、コメントなら既存の Issue の URL
