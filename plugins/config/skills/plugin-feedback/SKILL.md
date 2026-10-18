---
name: plugin-feedback
description: kazu マーケットプレイスのプラグイン（aidd・config・project）の不具合・改善案を、既存の Issue の状況とマーケットプレイスの方針（価値・設計の方針）に照らし合わせて下書きし、承認後に（ユーザーが承認を省くよう求めた場合は省いて）Kazu-K0032/claude-plugins へ Issue として作成する（関連する Issue があればコメントで追記する）。ユーザーが起票に同意した時、または起票を頼まれた時に使用する
disable-model-invocation: false
allowed-tools: Read, AskUserQuestion, Bash(gh auth status:*), Bash(gh issue list:*), Bash(gh issue view:*), Bash(gh pr list:*), Bash(gh label list:*), Bash(gh repo view:*), Bash(git rev-parse:*), Bash(printenv CLAUDE_PLUGIN_FEEDBACK_SKIP_APPROVAL)
argument-hint: "[起票したい内容（任意。省略時はこのセッションの内容から候補を挙げる。例: gas スキルのトリガー登録で迷った）]"
---

# プラグインの不具合・改善案の起票（plugin-feedback）

セッション中に分かった kazu マーケットプレイスのプラグインの不具合・改善案を、`Kazu-K0032/claude-plugins` の Issue にする。関連する Issue があればコメントで追記し、下書きの前に、同じ件の Issue の状況と方針とのずれを伝える（手順 4・5）。

- 外へ書き込むもの：`Kazu-K0032/claude-plugins` の Issue・コメント。初めての実行だけ、作業ディレクトリの `.claude/settings.local.json` の `env`
- 人がすること：候補が複数なら、起票する件を選ぶ。下書きを承認する（**GitHub への書き込みは承認の後**。省くのは、ユーザーが省くよう求めたときだけ）。対応しないと決めた件・方針とずれる件なら、求める理由を書く。`gh` で書き込めないときは、手で起票する

## 参照ファイル

| ファイル | いつ読むか |
| --- | --- |
| `${CLAUDE_PLUGIN_ROOT}/skills/plugin-feedback/references/gh-access.md` | 手順 1 で `gh` の状態を見るとき、手順 9 でラベルの権限を見るとき、手順 10 で失敗したとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/plugin-feedback/references/approval.md` | 手順 1 で承認の設定を確かめるとき、手順 9 で承認を省くかを決め、承認を取るとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/plugin-feedback/references/triage.md` | 手順 2 で起票する件を決めるとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/plugin-feedback/references/existing-issues.md` | 手順 3・4・6 で既存の Issue を探し、扱いを決めるとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/plugin-feedback/references/policy-check.md` | 手順 5 で方針と照らすとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/plugin-feedback/references/issue-format.md` | 手順 7 で下書きを作るとき、手順 8 で公開前に点検するとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/plugin-feedback/references/short-body.md` | 手順 8 で本文の長さを確かめるとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/plugin-feedback/scripts/body_length.js` | 手順 8 で本文の文字数を数えるとき |

## 想定している引数

| 引数 | 対象 |
| --- | --- |
| 省略 | このセッションで分かった不具合・改善案から候補を挙げる |
| 起票したい内容 | その件だけを扱う。会話にある経緯・エラー文・根拠も使う |

扱う件は次の 2 種類。対象外は、Claude Code 本体の不具合（組み込みの `/feedback` で Anthropic へ送る）と、利用先のプロジェクト自身の不具合。

| 種類 | 例 |
| --- | --- |
| 不具合（`bug`） | スキルの手順どおりに動かない・チェックが誤検出する・書かれていない挙動でつまずいた |
| 改善案（`enhancement`） | 「こういう機能があったら便利」・手順やテンプレートの改善 |

## 出力先

新しい Issue か、既存の Issue へのコメント。どちらも `--repo Kazu-K0032/claude-plugins` に書く。下書きのファイルは作らず、本文は標準入力から渡す。利用先のリポジトリや `~/.claude` に下書きを残さないため。

## 手順

### 1. 前提を確かめる

`gh auth status` を実行し、結果ごとの扱いを `gh-access.md` で決める。書き込めるなら、`approval.md` の「承認の設定を確かめる」と「`settings.local.json` への書き込み」で承認を省くかを決め、ユーザーに伝えてから手順 2 へ進む。

### 2. 起票する件を決める

引数か会話から起票する件を拾い、件ごとに種類と対象（例：`project:gas`）を決める。決め方は、件の数に関わらず `triage.md` を読む（候補の選び方・原因の分け方・対象外の扱い・分からないことを補ってもらう）。ユーザーがこのスキルを直接呼んだときは、起票に同意したものとして扱う。

### 3. 既存の Issue を探す

語を変えて、クローズ済みも含めて検索し、読んだ Issue を「同じ件」「関連する件」「無関係」に分ける。コマンドと分け方は `existing-issues.md` の「探す」を読む。

### 4. 同じ件の Issue の状況を伝える

同じ件の Issue があれば、下書きを作る前に、状態ごとの扱いを伝える。無ければ手順 5 へ進む。状態ごとに伝えることとその後は、`existing-issues.md` の「同じ件の Issue の状況」を読む。

### 5. 方針と照らす

件が、マーケットプレイスの価値（`docs/values/`）・設計の方針（`docs/policies/`）とずれないかを、`policy-check.md` の手順で確かめる。ずれの判断は Claude の判断のため、起票を止めない。ずれを伝えて聞くところまでにとどめる。

### 6. 起票の形を決める

新しい Issue にするか、既存の Issue にコメントで追記するかを、`existing-issues.md` の「起票の形」で決める。

### 7. 下書きを作る

`issue-format.md` の型で、タイトル・ラベル・本文を作る。コメントの場合は本文だけ。書くのは、会話・エラー文・ファイル・引用元で裏が取れたことだけ。手順 4・5 でユーザーが書いた理由は、型の「承知の上で求める理由」の節に入れる。

### 8. 公開してよいか点検する

`issue-format.md` の「公開前の点検」に従い、利用先の情報を下書きから消すか言い換える。利用先は `git rev-parse --show-toplevel` と `gh repo view --json nameWithOwner,isPrivate` で特定し、どちらも失敗したら（Git の管理外など）作業ディレクトリ名とする。今いるのが `Kazu-K0032/claude-plugins` 自身なら、リポジトリ名は言い換えなくてよい。

点検を終えたら本文を数え、超えていたら縮めて数え直す。3 回直しても収まらなければ、承認を取るときは手順 9、省くときは手順 11 で超えた箇所を示す。Node.js が無い・実行を断られたときは、数えずに進み、手順 11 で伝える。

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/plugin-feedback/scripts/body_length.js" - <<'__ISSUE_BODY__'
<本文>
__ISSUE_BODY__
```

### 9. 承認を取る

新しい Issue なら、`gh-access.md` の「ラベルを付けられるか」を確かめる。`approval.md` の「承認を省くかを決める」で省くと決めたら手順 10 へ進み、省かないなら同じファイルの「承認を取る」で、下書きの全文を見せて承認を取る。

### 10. 作成する

承認された本文（承認を省いた場合は、手順 7・8 で作った下書き）を**一字一句そのまま**、引用符付きのヒアドキュメントで渡す。ラベルを付けられない場合は `--label` を外す。`gh` が失敗したら、`gh-access.md` の「`gh` が失敗した場合」を読む。

```bash
gh issue create --repo Kazu-K0032/claude-plugins --title "<タイトル>" --label <ラベル> --body-file - <<'__ISSUE_BODY__'
<本文>
__ISSUE_BODY__
```

既存の Issue へのコメントは `gh issue comment <番号> --repo Kazu-K0032/claude-plugins --body-file -` に同じ形で渡す。

### 11. 報告する

- 作成した Issue・コメントの URL
- ラベルを付けなかった場合は、その理由（書き込み権限が無いため、作者が付ける）
- 本文を数えられなかった・上限に収まらなかった場合は、そのことと理由
- 承認を省いた場合は、その理由（`CLAUDE_PLUGIN_FEEDBACK_SKIP_APPROVAL` の値と設定場所・どこにあったどんな指示か）と、手順 8 で消した・言い換えた箇所
- 方針とのずれを承知で起票した場合は、ずれた価値・方針の番号。方針を読めずに照らさなかった場合は、そのこと
- 起票しなかった候補と、その理由（断られた・既存の Issue と同じ件で対応待ちだった・対応しないと決めて閉じていた等）

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

- 起票の提案は、config の SessionStart フックが入れる文面（`${CLAUDE_PLUGIN_ROOT}/hooks/plugin-feedback.md`）に沿って行われる。このスキルは、ユーザーが同意した後の起票を受け持つ
- `gh api`（手順 5）は書き込みもできるため、`allowed-tools` に入れていない。読むたびに許可プロンプトが出る

$ARGUMENTS
