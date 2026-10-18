# GitHub への書き込みと承認の設定

手順 1・9・10 の細部。`gh` の確認、下書きの承認を省く設定、承認の取り方、作成のコマンド、`gh` で書き込めない場合を扱う。

## 1. 前提を確かめる

```bash
gh auth status
```

| 結果 | 対応 |
| --- | --- |
| `gh` が無い（`command not found` 等） | [GitHub CLI](https://cli.github.com/) のインストールと `gh auth login` を案内する。今すぐ起票したい場合は「`gh` で書き込めない場合」に進む |
| ログインしていない | `gh auth login` を案内する。今すぐ起票したい場合は同上 |
| `Token:` が `github_pat_` で始まり、アカウントが `Kazu-K0032` 以外 | fine-grained トークンは、メンバーでない公開リポジトリに書き込めない。`gh auth login`（ブラウザでのログイン）か classic トークンへの切り替えを案内する。切り替えない場合は「`gh` で書き込めない場合」に進む |
| それ以外 | 下の「承認の設定」へ進む |

### 承認の設定

下書きの承認（手順 9）を省くかは、環境変数 `CLAUDE_PLUGIN_FEEDBACK_SKIP_APPROVAL` で切り替える。値が `true` か `on`（大文字・小文字は問わない）なら省き、それ以外（`off`・未設定など）は承認を取る。ユーザーが省くよう指示しているとき（引数・会話・CLAUDE.md・記憶）も省く。実行のたびに次の順で確かめ、どうするかをユーザーに伝えてから手順 2 へ進む。

1. 作業ディレクトリ（Claude Code を起動したディレクトリ）の `.claude/settings.local.json` を `Read` し、`env` に `CLAUDE_PLUGIN_FEEDBACK_SKIP_APPROVAL` があるかを見る。セッションの途中で書き換えた値も拾えるよう、環境変数より先にファイルを見る
1. ファイルに無ければ、ほかの場所（`~/.claude/settings.json`・起動したシェルなど）で設定されていないかを確かめる

    ```bash
    printenv CLAUDE_PLUGIN_FEEDBACK_SKIP_APPROVAL
    ```

1. 次の表で使う値を決める

    | 状態 | 使う値 | 伝えるときの設定場所 |
    | --- | --- | --- |
    | `settings.local.json` にある | ファイルの値 | `.claude/settings.local.json` |
    | ファイルに無く、`printenv` が値を返す | 環境変数の値。`settings.local.json` には書き込まない | 環境変数（`~/.claude/settings.json` など） |
    | どちらにも無い（初めての実行） | `off`。`settings.local.json` の `env` に `"CLAUDE_PLUGIN_FEEDBACK_SKIP_APPROVAL": "off"` を書き込む | `.claude/settings.local.json` |

1. 承認を省く指示が、引数・会話・CLAUDE.md・記憶に無いかを確かめる
1. 次の形でユーザーに伝える
    - 値が `true`・`on` のとき：「<設定場所> で `CLAUDE_PLUGIN_FEEDBACK_SKIP_APPROVAL` が `<値>` になっているので、下書きの承認を取らずに起票します。承認を取りたい場合は `off` に戻してください」
    - 値はそれ以外だが、省く指示があるとき：「<設定場所> で `CLAUDE_PLUGIN_FEEDBACK_SKIP_APPROVAL` は `<値>` ですが、<指示のある場所> の指示に従い、下書きの承認を取らずに起票します」
    - どちらでもないとき：「<設定場所> で `CLAUDE_PLUGIN_FEEDBACK_SKIP_APPROVAL` が `<値>` になっているので、下書きの承認を取ってから起票します。承認が要らなければ `true` に変えてください」
    - 初めての実行で書き込んだときは、頭に「初めての実行なので、`.claude/settings.local.json` に `CLAUDE_PLUGIN_FEEDBACK_SKIP_APPROVAL` を `off` で書き込みました。」を付ける

`settings.local.json` への書き込みは、次のとおりに行う。

- 書き込むのは初めての実行のときだけ。ファイルが無ければ作り（`.claude/` が無ければそれも作る）、あれば `env` にこのキーだけを足す。ほかのキーと書式は変えない
- ファイルに無くても `printenv` が値を返すときは書き込まない。`settings.local.json` はほかの場所の設定より優先されるため、書き込むと `~/.claude/settings.json` などの設定を上書きしてしまう
- `settings.local.json` が JSON として読めないときは書き込まず、値を `off` として扱い、読めなかったことを伝える
- 書き込みを断られた・止められた（許可プロンプトで断られた・deny やフックで止められた）ときは、値を `off` として扱い、書き込めなかったことを伝えて続ける。値がどこにも無いままだと、次の実行でも書き込もうとする。止めるには `~/.claude/settings.json` の `env` にこの変数を入れればよい（`off` でもよい）ことも伝える

## 9. 承認を取る

1. ラベルを付けられるかを確かめる（新しい Issue の場合だけ）。リポジトリ名は必ず付ける。付けないと、今いる利用先のリポジトリの権限が返る

    ```bash
    gh repo view Kazu-K0032/claude-plugins --json viewerPermission
    ```

    - `ADMIN`・`MAINTAIN`・`WRITE` なら、付けるラベルが実在することを `gh label list --repo Kazu-K0032/claude-plugins` で確かめる
    - それ以外（`TRIAGE`・`READ` 等）なら、ラベルは付けずに作者に任せる。書き込み権限が無いと、指定したラベルはエラーにならずに捨てられるため

1. 次を表示する
    - 起票先（新しい Issue か、`#<番号>` へのコメントか）と、そう判断した理由。関連する Issue があればその URL
    - 手順 4・5 で伝えた、同じ件の Issue の閉じた理由・方針とのずれ（あれば）
    - タイトルとラベル（コメントなら無し。ラベルを付けられない場合は「作者が付ける」と書く）
    - 本文の全文
    - 手順 8 で消した・言い換えた箇所
1. `AskUserQuestion` で「作成する / 直してから作成する / やめる」を聞く。「直してから作成する」なら、指摘を反映し、手順 8 の数えるところからやり直す

## 10. 作成する

承認された本文（承認を省いた場合は、手順 7・8 で作った下書き）を**一字一句そのまま**、引用符付きのヒアドキュメントで標準入力から渡す。下書きのファイルは作らない。利用先のリポジトリや `~/.claude` に下書きを残さないため。

新しい Issue の場合（ラベルを付けられない場合は `--label` を外す）：

```bash
gh issue create --repo Kazu-K0032/claude-plugins --title "<タイトル>" --label <ラベル> --body-file - <<'__ISSUE_BODY__'
<本文>
__ISSUE_BODY__
```

既存の Issue へのコメントの場合：

```bash
gh issue comment <番号> --repo Kazu-K0032/claude-plugins --body-file - <<'__ISSUE_BODY__'
<本文>
__ISSUE_BODY__
```

`gh` が失敗したら、エラーを示して「`gh` で書き込めない場合」に進む。`Resource not accessible by personal access token` などの 403 は、手順 1 の fine-grained トークンが原因のことが多い。

## `gh` で書き込めない場合

`gh` が無い・ログインしていない・トークンで書き込めない場合は、下書きを作ってユーザーに手で起票してもらう。

1. 手順 2・6〜8 で下書きを作る。`gh` が使えて読み取りだけできる場合（fine-grained トークン等）は、手順 3〜5 も行う。使えない場合は、[Issue の一覧](https://github.com/Kazu-K0032/claude-plugins/issues?q=is%3Aissue) で同じ件が無いかを確かめるよう伝える
1. タイトルと本文を、そのまま貼り付けられる形で示す
1. 貼り付け先を案内して終える。新しい Issue なら [新しい Issue の画面](https://github.com/Kazu-K0032/claude-plugins/issues/new)、コメントなら既存の Issue の URL
