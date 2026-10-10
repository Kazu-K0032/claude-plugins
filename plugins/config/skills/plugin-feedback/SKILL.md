---
name: plugin-feedback
description: kazu マーケットプレイスのプラグイン（aidd・config・project）の不具合・改善案を、既存の Issue と照らし合わせて下書きし、承認後に（ユーザーが承認を省くよう求めた場合は省いて）Kazu-K0032/claude-plugins へ Issue として作成する（関連する Issue があればコメントで追記する）。ユーザーが起票に同意した時、または起票を頼まれた時に使用する
disable-model-invocation: false
allowed-tools: Read, AskUserQuestion, Bash(gh auth status:*), Bash(gh issue list:*), Bash(gh issue view:*), Bash(gh label list:*), Bash(gh repo view:*), Bash(git rev-parse:*), Bash(printenv CLAUDE_PLUGIN_FEEDBACK_SKIP_APPROVAL)
argument-hint: "[起票したい内容（任意。省略時はこのセッションの内容から候補を挙げる。例: gas スキルのトリガー登録で迷った）]"
---

# プラグインの不具合・改善案の起票（plugin-feedback）

セッション中に分かった kazu マーケットプレイスのプラグインの不具合・改善案を、`Kazu-K0032/claude-plugins` の Issue にする。既存の Issue と照らし合わせ、関連する Issue があればコメントで追記する。**GitHub への書き込みは、下書きの承認を取ってから行う**。承認を省くのは、ユーザーが省くよう求めたときだけ（手順 7）。

| 種類 | 例 |
| --- | --- |
| 不具合（`bug`） | スキルの手順どおりに動かない・チェックが誤検出する・書かれていない挙動でつまずいた |
| 改善案（`enhancement`） | 「こういう機能があったら便利」・手順やテンプレートの改善 |

対象外は 2 つ。Claude Code 本体の不具合（組み込みの `/feedback` で Anthropic へ送る）と、利用先のプロジェクト自身の不具合。

起票の提案は、config の SessionStart フックが入れる文面（`${CLAUDE_PLUGIN_ROOT}/hooks/plugin-feedback.md`）に沿って行われる。このスキルは、ユーザーが同意した後の起票を受け持つ。ユーザーがこのスキルを直接呼んだときは、起票に同意したものとして扱う。ただし、呼んだことを下書きの承認（手順 7）の代わりにはしない。公開リポジトリに載る本文を、ユーザーはまだ見ていないため。

## 参照ファイル

| ファイル | 役割 |
| --- | --- |
| `${CLAUDE_PLUGIN_ROOT}/skills/plugin-feedback/references/issue-format.md` | Issue・コメントの本文の型と、公開前の点検項目 |

## 引数の解釈

| 引数 | 対象 |
| --- | --- |
| 省略 | このセッションで分かった不具合・改善案から候補を挙げる |
| 起票したい内容 | その件だけを扱う。会話にある経緯・エラー文・根拠も使う |

## 手順

### 1. 前提を確かめる

```bash
gh auth status
```

| 結果 | 対応 |
| --- | --- |
| `gh` が無い（`command not found` 等） | [GitHub CLI](https://cli.github.com/) のインストールと `gh auth login` を案内する。今すぐ起票したい場合は「`gh` で書き込めない場合」に進む |
| ログインしていない | `gh auth login` を案内する。今すぐ起票したい場合は同上 |
| `Token:` が `github_pat_` で始まり、アカウントが `Kazu-K0032` 以外 | fine-grained トークンは、メンバーでない公開リポジトリに書き込めない。`gh auth login`（ブラウザでのログイン）か classic トークンへの切り替えを案内する。切り替えない場合は「`gh` で書き込めない場合」に進む |
| それ以外 | 下の「承認の設定」へ進む |

#### 承認の設定

下書きの承認（手順 7）を省くかは、環境変数 `CLAUDE_PLUGIN_FEEDBACK_SKIP_APPROVAL` で切り替える。値が `true` か `on`（大文字・小文字は問わない）なら省き、それ以外（`off`・未設定など）は承認を取る。ユーザーが省くよう指示しているとき（引数・会話・CLAUDE.md・記憶）も省く。実行のたびに次の順で確かめ、どうするかをユーザーに伝えてから手順 2 へ進む。

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

### 2. 起票する件を決める

1. 引数か会話から、起票する件を拾う。候補が複数あれば `AskUserQuestion` で選んでもらう。複数を選んだ場合は、1 件ずつ手順 3〜8 を繰り返す
1. 件ごとに次を決める
    - 種類：不具合（`bug`）か改善案（`enhancement`）か
    - 対象：プラグインとスキル（例：`project:gas`）。導入したテンプレート・ルールが対象なら、プラグイン内のパスも決める（例：`plugins/project/skills/gas/files/.claude/rules/gas.md`）
1. スキルの結果へのユーザーの違和感・不満（「何か違くない？」「毎回おかしい」など）から始まった件は、そのスキルの本文・規約と結果を突き合わせて原因を分け、扱いを決める

    | 原因 | 扱い |
    | --- | --- |
    | 規約どおりの結果だが、規約がユーザーの期待と違う | 改善案（`enhancement`）として、規約の見直しを起票する |
    | 規約に反した結果が繰り返し出る | 指示が守られにくい書き方だとして、改善案（`enhancement`）にする |
    | 規約に反した結果が 1 回だけ出て、直したら済んだ | 起票しない（その場の Claude の間違い） |
    | 利用先のプロジェクトだけの好み | 起票するかをユーザーに聞く。他の人にも役立つなら改善案にする |

1. 対象外の件は起票しない。Claude Code 本体の不具合なら、組み込みの `/feedback` を案内する
1. 何が起きたか・再現の手順が会話から分からない件は、ユーザーに補ってもらう。推測で埋めない

### 3. 既存の Issue を探す

語を変えて 2〜3 回検索する。語の例は、プラグイン名とスキル名・エラー文やつまずいた挙動の要点・改善案の名詞。クローズ済みも含める。

```bash
gh issue list --repo Kazu-K0032/claude-plugins --state all --search "<語>" --json number,title,state,labels,url --limit 20
```

関係がありそうな Issue は、本文とコメントまで読む。`gh issue view --comments` は端末以外から実行するとコメントしか出ないため、`--json` で取る。

```bash
gh issue view <番号> --repo Kazu-K0032/claude-plugins --json number,title,body,comments,state,labels,url
```

### 4. 起票の形を決める

| 既存の Issue | 形 |
| --- | --- |
| 同じ件で open | 新しく分かったこと（別の再現条件・根拠など）だけをコメントで追記する。新しいことが無ければ、既存の Issue の URL を伝えて終える |
| 関連する件で open（同じプラグイン・スキル・テーマで、まとめて直すのが自然なもの） | コメントで追記する |
| 同じ件・関連する件で closed | 新しい Issue を作り、本文の末尾に `関連: #<番号>` を書く |
| 無い・無関係 | 新しい Issue を作る |

判断に迷ったら、候補の Issue を示して `AskUserQuestion` で選んでもらう。

### 5. 下書きを作る

`references/issue-format.md` の型で、タイトル・ラベル・本文を作る。コメントの場合は本文だけ。書くのは、会話・エラー文・ファイル・引用元で裏が取れたことだけ。

### 6. 公開してよいか点検する

`Kazu-K0032/claude-plugins` は公開リポジトリである。`references/issue-format.md` の「公開前の点検」に従い、利用先の情報を下書きから消すか言い換える。利用先のリポジトリは次で特定する。

```bash
git rev-parse --show-toplevel
gh repo view --json nameWithOwner,isPrivate
```

どちらも失敗した場合（Git の管理外など）は、作業ディレクトリ名を利用先の名前として扱う。今いるのが `Kazu-K0032/claude-plugins` 自身なら、リポジトリ名は言い換えなくてよい。

### 7. 承認を取る

1. ラベルを付けられるかを確かめる（新しい Issue の場合だけ）。リポジトリ名は必ず付ける。付けないと、今いる利用先のリポジトリの権限が返る

    ```bash
    gh repo view Kazu-K0032/claude-plugins --json viewerPermission
    ```

    - `ADMIN`・`MAINTAIN`・`WRITE` なら、付けるラベルが実在することを `gh label list --repo Kazu-K0032/claude-plugins` で確かめる
    - それ以外（`TRIAGE`・`READ` 等）なら、ラベルは付けずに作者に任せる。書き込み権限が無いと、指定したラベルはエラーにならずに捨てられるため

1. 承認を省くかを決める

    | 条件 | 扱い |
    | --- | --- |
    | 手順 1 の「承認の設定」で、省くと伝えた（値が `true`・`on`、または省く指示がある） | 承認を省いて手順 8 へ進む |
    | 手順 1 の後に、ユーザーが省くよう指示した（「下書きはいらない、そのまま起票して」など） | 省くことを伝えてから、手順 8 へ進む |
    | それ以外（スキルを直接呼んだだけの場合を含む） | 承認を取る |

1. 次を表示する
    - 起票先（新しい Issue か、`#<番号>` へのコメントか）と、そう判断した理由。関連する Issue があればその URL
    - タイトルとラベル（コメントなら無し。ラベルを付けられない場合は「作者が付ける」と書く）
    - 本文の全文
    - 手順 6 で消した・言い換えた箇所
1. `AskUserQuestion` で「作成する / 直してから作成する / やめる」を聞く。「直してから作成する」なら、指摘を反映して手順 7 をやり直す

### 8. 作成する

承認された本文（承認を省いた場合は、手順 5・6 で作った下書き）を**一字一句そのまま**、引用符付きのヒアドキュメントで標準入力から渡す。下書きのファイルは作らない。利用先のリポジトリや `~/.claude` に下書きを残さないため。

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

### 9. 報告する

- 作成した Issue・コメントの URL
- ラベルを付けなかった場合は、その理由（書き込み権限が無いため、作者が付ける）
- 承認を省いた場合は、その理由（`CLAUDE_PLUGIN_FEEDBACK_SKIP_APPROVAL` の値と設定場所・どこにあったどんな指示か）と、手順 6 で消した・言い換えた箇所
- 起票しなかった候補と、その理由（断られた・既存の Issue と同じ件だった等）

## `gh` で書き込めない場合

`gh` が無い・ログインしていない・トークンで書き込めない場合は、下書きを作ってユーザーに手で起票してもらう。

1. 手順 2・4〜6 で下書きを作る。`gh` が使えて読み取りだけできる場合（fine-grained トークン等）は、手順 3 の検索も行う。使えない場合は、[Issue の一覧](https://github.com/Kazu-K0032/claude-plugins/issues?q=is%3Aissue) で同じ件が無いかを確かめるよう伝える
1. タイトルと本文を、そのまま貼り付けられる形で示す
1. 貼り付け先を案内して終える。新しい Issue なら [新しい Issue の画面](https://github.com/Kazu-K0032/claude-plugins/issues/new)、コメントなら既存の Issue の URL

## 禁止事項

- 承認を取る前に `gh issue create` / `gh issue comment` を実行しない（手順 7 で承認を省くと決めた場合を除く）
- スキルを呼ばれたことだけを理由に、承認を省かない
- 初めての実行のとき以外に、`settings.local.json` へ書き込まない。書き込むときも、ほかのキーを変えない
- `--repo Kazu-K0032/claude-plugins` を省かない。利用先や他のリポジトリに起票しない
- 既存の Issue の本文の編集・クローズ・ラベルの変更をしない（追記はコメントだけ）
- 承認された本文（承認を省いた場合は、手順 5・6 で作った下書き）を書き換えて投稿しない
- 書き込み権限が無いのに `--label` を付けて、ラベルが付いたように報告しない
- 裏の取れない原因・再現手順を書かない
- 利用先の非公開の情報（リポジトリ名・メールアドレス・トークン・業務のファイルの中身）を書かない

$ARGUMENTS
