---
name: plugin-feedback
description: kazu マーケットプレイスのプラグイン（aidd・config・project）の不具合・改善案を、既存の Issue と照らし合わせて下書きし、承認後に Kazu-K0032/claude-plugins へ Issue として作成する（関連する Issue があればコメントで追記する）。ユーザーが起票に同意した時、または起票を頼まれた時に使用する
disable-model-invocation: false
allowed-tools: Read, AskUserQuestion, Bash(gh auth status:*), Bash(gh issue list:*), Bash(gh issue view:*), Bash(gh label list:*), Bash(gh repo view:*), Bash(git rev-parse:*)
argument-hint: "[起票したい内容（任意。省略時はこのセッションの内容から候補を挙げる。例: gas スキルのトリガー登録で迷った）]"
---

# プラグインの不具合・改善案の起票（plugin-feedback）

セッション中に分かった kazu マーケットプレイスのプラグインの不具合・改善案を、`Kazu-K0032/claude-plugins` の Issue にする。既存の Issue と照らし合わせ、関連する Issue があればコメントで追記する。**GitHub への書き込みは、下書きの承認を取ってから行う**。

| 種類 | 例 |
| --- | --- |
| 不具合（`bug`） | スキルの手順どおりに動かない・チェックが誤検出する・書かれていない挙動でつまずいた |
| 改善案（`enhancement`） | 「こういう機能があったら便利」・手順やテンプレートの改善 |

対象外は 2 つ。Claude Code 本体の不具合（組み込みの `/feedback` で Anthropic へ送る）と、利用先のプロジェクト自身の不具合。

起票の提案は、config の SessionStart フックが入れる文面（`${CLAUDE_PLUGIN_ROOT}/hooks/plugin-feedback.md`）に沿って行われる。このスキルは、ユーザーが同意した後の起票を受け持つ。

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
| それ以外 | 手順 2 へ進む |

### 2. 起票する件を決める

1. 引数か会話から、起票する件を拾う。候補が複数あれば `AskUserQuestion` で選んでもらう。複数を選んだ場合は、1 件ずつ手順 3〜8 を繰り返す
1. 件ごとに次を決める
    - 種類：不具合（`bug`）か改善案（`enhancement`）か
    - 対象：プラグインとスキル（例：`project:gas`）。導入したテンプレート・ルールが対象なら、プラグイン内のパスも決める（例：`plugins/project/skills/gas/files/.claude/rules/gas.md`）
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

1. 次を表示する
    - 起票先（新しい Issue か、`#<番号>` へのコメントか）と、そう判断した理由。関連する Issue があればその URL
    - タイトルとラベル（コメントなら無し。ラベルを付けられない場合は「作者が付ける」と書く）
    - 本文の全文
    - 手順 6 で消した・言い換えた箇所
1. `AskUserQuestion` で「作成する / 直してから作成する / やめる」を聞く。「直してから作成する」なら、指摘を反映して手順 7 をやり直す

### 8. 作成する

承認された本文を**一字一句そのまま**、引用符付きのヒアドキュメントで標準入力から渡す。下書きのファイルは作らない。利用先のリポジトリや `~/.claude` に下書きを残さないため。

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
- 起票しなかった候補と、その理由（断られた・既存の Issue と同じ件だった等）

## `gh` で書き込めない場合

`gh` が無い・ログインしていない・トークンで書き込めない場合は、下書きを作ってユーザーに手で起票してもらう。

1. 手順 2・4〜6 で下書きを作る。`gh` が使えて読み取りだけできる場合（fine-grained トークン等）は、手順 3 の検索も行う。使えない場合は、[Issue の一覧](https://github.com/Kazu-K0032/claude-plugins/issues?q=is%3Aissue) で同じ件が無いかを確かめるよう伝える
1. タイトルと本文を、そのまま貼り付けられる形で示す
1. 貼り付け先を案内して終える。新しい Issue なら [新しい Issue の画面](https://github.com/Kazu-K0032/claude-plugins/issues/new)、コメントなら既存の Issue の URL

## 禁止事項

- 承認を取る前に `gh issue create` / `gh issue comment` を実行しない
- `--repo Kazu-K0032/claude-plugins` を省かない。利用先や他のリポジトリに起票しない
- 既存の Issue の本文の編集・クローズ・ラベルの変更をしない（追記はコメントだけ）
- 承認された本文を書き換えて投稿しない
- 書き込み権限が無いのに `--label` を付けて、ラベルが付いたように報告しない
- 裏の取れない原因・再現手順を書かない
- 利用先の非公開の情報（リポジトリ名・メールアドレス・トークン・業務のファイルの中身）を書かない

$ARGUMENTS
