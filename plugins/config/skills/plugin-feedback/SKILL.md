---
name: plugin-feedback
description: kazu マーケットプレイスのプラグイン（aidd・config・project）の不具合・改善案を、既存の Issue の状況とマーケットプレイスの方針（価値・設計の方針）に照らし合わせて下書きし、承認後に（ユーザーが承認を省くよう求めた場合は省いて）Kazu-K0032/claude-plugins へ Issue として作成する（関連する Issue があればコメントで追記する）。ユーザーが起票に同意した時、または起票を頼まれた時に使用する
disable-model-invocation: false
allowed-tools: Read, AskUserQuestion, Bash(gh auth status:*), Bash(gh issue list:*), Bash(gh issue view:*), Bash(gh pr list:*), Bash(gh label list:*), Bash(gh repo view:*), Bash(git rev-parse:*), Bash(printenv CLAUDE_PLUGIN_FEEDBACK_SKIP_APPROVAL)
argument-hint: "[起票したい内容（任意。省略時はこのセッションの内容から候補を挙げる。例: gas スキルのトリガー登録で迷った）]"
---

# プラグインの不具合・改善案の起票（plugin-feedback）

セッション中に分かった kazu マーケットプレイスのプラグインの不具合・改善案を、`Kazu-K0032/claude-plugins` の Issue にする。既存の Issue と照らし合わせ、関連する Issue があればコメントで追記する。

- 外へ書き込むもの：`Kazu-K0032/claude-plugins` の Issue・コメント（`gh issue create`・`gh issue comment`）。初めての実行のときだけ、作業ディレクトリの `.claude/settings.local.json` の `env` にも書く
- 人がすること：下書きの承認（省くのは、ユーザーが省くよう求めたときだけ）。`gh` で書き込めないときは、下書きを Web の画面に貼って起票する

## 参照ファイル

| ファイル | いつ読むか |
| --- | --- |
| `${CLAUDE_PLUGIN_ROOT}/skills/plugin-feedback/references/github-write.md` | 手順 1・9・10 で読む。`gh` の確認と承認の設定・ラベルの確認と承認で示す項目・作成のコマンド・`gh` で書き込めない場合 |
| `${CLAUDE_PLUGIN_ROOT}/skills/plugin-feedback/references/triage.md` | 手順 2 で読む。種類と対象外・原因の分け方 |
| `${CLAUDE_PLUGIN_ROOT}/skills/plugin-feedback/references/research.md` | 手順 3〜6 で読む。既存の Issue の探し方・状況の伝え方・方針との照らし方・起票の形 |
| `${CLAUDE_PLUGIN_ROOT}/skills/plugin-feedback/references/issue-format.md` | 手順 7・8 で読む。Issue・コメントの本文の型と、公開前の点検項目 |
| `${CLAUDE_PLUGIN_ROOT}/skills/plugin-feedback/references/short-body.md` | 手順 7 で読む。本文の長さの上限・数え方・書き方 |
| `${CLAUDE_PLUGIN_ROOT}/skills/plugin-feedback/references/check-and-report.md` | 手順 8・11 で読む。利用先の特定と本文を数える手順・報告の項目 |
| `${CLAUDE_PLUGIN_ROOT}/skills/plugin-feedback/scripts/body_length.js` | 手順 8 で、本文の文字数を数えるときに実行する |

## 想定している引数

| 引数 | 対象 |
| --- | --- |
| 省略 | このセッションで分かった不具合・改善案から候補を挙げる |
| 起票したい内容 | その件だけを扱う。会話にある経緯・エラー文・根拠も使う |

## 出力先

新しい Issue か、既存の Issue へのコメントとして、`Kazu-K0032/claude-plugins` に書く。下書きのファイルは作らず、本文は標準入力で渡す。

## 手順

**GitHub への書き込みは、下書きの承認を取ってから行う**。承認を省くのは、ユーザーが省くよう求めたときだけ（手順 9）。

起票の提案は、config の SessionStart フックが入れる文面（`${CLAUDE_PLUGIN_ROOT}/hooks/plugin-feedback.md`）に沿って行われる。このスキルは、ユーザーが同意した後の起票を受け持つ。ユーザーがこのスキルを直接呼んだときは、起票に同意したものとして扱う。ただし、呼んだことを下書きの承認（手順 9）の代わりにはしない。公開リポジトリに載る本文を、ユーザーはまだ見ていないため。

### 1. 前提を確かめる

`gh auth status` で `gh` が使えるかを確かめ、下書きの承認を省くかを「承認の設定」で調べて、どうするかをユーザーに伝える。手順は `github-write.md` を読む。`gh` が無い・ログインしていない・トークンで書き込めない場合は、同じファイルの「`gh` で書き込めない場合」に従う。

### 2. 起票する件を決める

引数か会話から起票する件を拾い、種類（不具合 `bug`・改善案 `enhancement`）と対象を決める。対象外の件は起票しない。種類の表・対象外・原因の分け方は `triage.md` を読む。

### 3. 既存の Issue を探す

語を変えて 2〜3 回検索し、関係がありそうな Issue を本文とコメントまで読んで、「同じ件」「関連する件」「無関係」に分ける。コマンドは `research.md` を読む。

### 4. 同じ件の Issue の状況を伝える

同じ件の Issue があれば、下書きを作る前に、状態ごとに状況を伝える。無ければ手順 5 へ進む。伝える内容は `research.md` の表に従う。

### 5. 方針と照らす

件が、マーケットプレイスの価値（`docs/values/`）・設計の方針（`docs/policies/`）とずれないかを確かめ、ずれるときはユーザーに聞く。読み方と聞き方は `research.md` を読む。

### 6. 起票の形を決める

既存の Issue との関係から、コメントで追記するか、新しい Issue を作るかを決める。表は `research.md` を読む。

### 7. 下書きを作る

`references/issue-format.md` の型で、タイトル・ラベル・本文を作る。コメントの場合は本文だけ。書くのは、会話・エラー文・ファイル・引用元で裏が取れたことだけ。手順 4・5 でユーザーが書いた理由は、型の「承知の上で求める理由」の節に入れる。

### 8. 公開してよいか点検する

下書きを公開してよい形に直し、本文の長さを数える。`Kazu-K0032/claude-plugins` は公開リポジトリである。`references/issue-format.md` の「公開前の点検」に従い、利用先の情報を下書きから消すか言い換える。利用先の特定と、本文の数え方は `check-and-report.md` を読む。

### 9. 承認を取る

新しい Issue ならラベルを付けられるかを確かめ（`github-write.md`）、承認を省くかを決める。

| 条件 | 扱い |
| --- | --- |
| 手順 1 の「承認の設定」で、省くと伝えた（値が `true`・`on`、または省く指示がある） | 承認を省いて手順 10 へ進む |
| 手順 1 の後に、ユーザーが省くよう指示した（「下書きはいらない、そのまま起票して」など） | 省くことを伝えてから、手順 10 へ進む |
| それ以外（スキルを直接呼んだだけの場合を含む） | 承認を取る |

承認を省くときも、手順 4・5 の問い（対応しないと決めた件・方針とずれる件を起票するか）は省かない。承知で求める理由は、ユーザーにしか書けないため。

省かないときは、下書きの全文と判断の根拠を示し、`AskUserQuestion` で「作成する / 直してから作成する / やめる」を聞く。表示する項目は `github-write.md` を読む。

### 10. 作成する

承認された本文（承認を省いた場合は、手順 7・8 で作った下書き）を**一字一句そのまま**、`gh` で作成する。コマンドは `github-write.md` を読む。`gh` が失敗したら、同じファイルの「`gh` で書き込めない場合」に従う。

### 11. 報告する

作成した Issue・コメントの URL と、ラベル・承認の省略・方針とのずれ・起票しなかった候補などの経緯をユーザーに報告する。項目は `check-and-report.md` を読む。

## 禁止事項

- 承認を取る前に `gh issue create` / `gh issue comment` を実行しない（手順 9 で承認を省くと決めた場合を除く）
- スキルを呼ばれたことだけを理由に、承認を省かない
- 初めての実行のとき以外に、`settings.local.json` へ書き込まない。書き込むときも、ほかのキーを変えない
- `--repo Kazu-K0032/claude-plugins` を省かない。利用先や他のリポジトリに起票しない
- 既存の Issue の本文の編集・クローズ・ラベルの変更をしない（追記はコメントだけ）
- 承認された本文（承認を省いた場合は、手順 7・8 で作った下書き）を書き換えて投稿しない
- 書き込み権限が無いのに `--label` を付けて、ラベルが付いたように報告しない
- 対応しないと決めて閉じた件・方針とずれる件を、ユーザーに聞かずに起票しない
- 裏の取れない原因・再現手順を書かない
- 手順 8 で数えずに、承認を取る・作成する（Node.js が無い・実行を断られたときを除く）
- 利用先の非公開の情報（リポジトリ名・メールアドレス・トークン・業務のファイルの中身）を書かない

## 保守

- `gh api` は書き込みもできるため、`allowed-tools` に入れていない。読むたびに許可プロンプトが出る。

$ARGUMENTS
