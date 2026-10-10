# config

ユーザー全体（`~/.claude/`）の Claude Code 設定を整える Skill 集。どのリポジトリで作業していても共通の設定（ステータスライン・応答言語）を入れること、スコープをまたいだ設定の衝突・重複を点検すること、このマーケットプレイスのプラグインで見つけた不具合・改善案を Issue にすることを扱う。

リポジトリ単位の設定（`.claude/`・`.github/` 等）は [project](../project/README.md) の `/project:init-repo` が扱う。

## 収録スキル

| スキル | 用途 |
| --- | --- |
| `/config:setup-global` | `~/.claude/settings.json` に 2 行のステータスラインと日本語での応答（`language`）を設定 |
| `/config:conflicts` | settings.json の各スコープ・権限ルール・フック・MCP サーバー・スキル・CLAUDE.md を横断して、衝突・重複を点検 |
| `/config:plugin-feedback` | セッション中に見つけた、このマーケットプレイスのプラグインの不具合・改善案を、下書きの承認後に `Kazu-K0032/claude-plugins` の Issue にする（関連する Issue があればコメントで追記。承認は省くこともできる） |

標準の `/doctor` とは見る観点が違う。`/doctor` はインストールの状態・壊れた設定ファイル・使われていない拡張機能・コンテキストの使用量を点検する。`/config:conflicts` は、スコープ間の上書き・deny に覆われた allow・フックや MCP の重複定義・CLAUDE.md 同士の矛盾など、**設定どうしがぶつかって効いていないもの**と、書き方の誤りで意図したコマンドに一致しない権限ルールを点検する。

`/config:plugin-feedback` も、標準の `/feedback` とは送り先が違う。`/feedback` は Claude Code 本体の不具合を Anthropic へ送る。`/config:plugin-feedback` は、このマーケットプレイスのプラグイン（`aidd`・`config`・`project`）の不具合・改善案をこのリポジトリの Issue にする。

## 起票の提案

config を入れると、セッションの開始時にフック（`hooks/hooks.json`）が短い文面を Claude の文脈に入れる。これにより、プラグインの不具合や改善案が分かったとき、Claude が作業の区切りで「Issue にしますか？」と 1 行で尋ねるようになる。Claude が気づいたときだけでなく、ユーザーがプラグインへの要望（「〜してほしい」など）を述べたときも尋ねる。スキルの結果にユーザーが違和感を示したとき（「何か違くない？」など）も、原因がスキル側にあるか、同じずれが繰り返していれば尋ねる。起票するのは、同意して `/config:plugin-feedback` の下書きを承認したときだけ（承認を省く方法は後述）。`/config:plugin-feedback` を直接呼んだときは、起票するかは尋ねず、下書きの承認だけを取る。

config を入れて最初のセッションだけ、報告の窓口（`/config:plugin-feedback` とこのリポジトリへのリンク）をユーザーにも画面で知らせる。表示済みの印は、プラグインのデータ用フォルダ（`~/.claude/plugins/data/` 配下。プラグインの更新後も残り、アンインストールで消える）に置く。

提案が要らない場合は、環境変数 `CLAUDE_PLUGIN_FEEDBACK=off` を設定する（`~/.claude/settings.json` の `env` に入れればよい）。フックは Node.js で動く。Node.js が無い環境では何もせずに終わり、提案が出ないだけになる。

下書きの承認を省くかは、環境変数 `CLAUDE_PLUGIN_FEEDBACK_SKIP_APPROVAL` で切り替える。`true` なら承認を省いてそのまま起票し、それ以外（`off`・未設定など）なら承認を取る。

- `/config:plugin-feedback` を初めて実行したとき、作業ディレクトリの `.claude/settings.local.json` の `env` に `off` を書き込む。ほかの場所（`~/.claude/settings.json` など）で既に設定していれば書き込まない
- 実行のたびに、今の値と設定場所、変え方（「承認が要らなければ `true` に変えてください」など）を伝える
- どのプロジェクトでも省くなら、`~/.claude/settings.json` の `env` に `true` を入れる。ただし、そのプロジェクトの `settings.local.json` に書き込み済みの `off` があれば、そちらが優先される
- その回だけ省くなら、会話で「そのまま起票して」と伝える。CLAUDE.md や auto memory に残した指示でも省ける
- 省いたときは、省いた理由と、公開前に言い換えた箇所を起票後に報告する

作者（Kazu-K0032）以外が起票する場合の違いは次のとおり。

- 起票した Issue にラベルは付かない。書き込み権限が無いと、GitHub が指定したラベルを黙って捨てるため。ラベルは作者が付ける
- `gh` が無い・ログインしていない・fine-grained トークンで書き込めない場合は、下書きを作り、Web の起票画面に貼り付けてもらう

## 導入

ユーザー全体の設定を扱うため、**user スコープ**でインストールする。

```bash
/plugin install config@kazu
```

## ディレクトリ構成

```text
config/
├── .claude-plugin/
│   └── plugin.json          # プラグインのマニフェスト
├── hooks/
│   ├── hooks.json           # SessionStart で plugin-feedback.js を実行する（Node.js が無ければ何もしない）
│   ├── plugin-feedback.js   # 起票の提案の文面と、初回だけのお知らせを出す（CLAUDE_PLUGIN_FEEDBACK=off なら出さない）
│   └── plugin-feedback.md   # 起票の提案の文面
└── skills/
    ├── setup-global/
    │   ├── SKILL.md
    │   └── scripts/
    │       └── statusline.js  # ステータスラインの本体（~/.claude/statusline/ へコピーして使う）
    ├── conflicts/
    │   ├── SKILL.md
    │   └── scripts/
    │       └── conflicts.js   # 衝突・重複・書き方の誤りを JSON で出力する点検スクリプト
    └── plugin-feedback/
        ├── SKILL.md
        └── references/
            └── issue-format.md  # Issue・コメントの本文の型と、公開前の点検項目
```

## 設計上の決めごと

- **スクリプトは Node.js で書き、外部パッケージを使わない**。ステータスラインは描画のたびに実行されるため、`jq` のような追加ツールに頼らず、Windows・macOS・Linux で同じように動くようにする
- **ステータスラインのスクリプトは `~/.claude/` へコピーして使う**。プラグインは `statusLine` を設定できず、ユーザーの `settings.json` では `${CLAUDE_PLUGIN_ROOT}` が展開されないため。プラグインの更新後は `/config:setup-global` を再実行してコピーし直す
- **既存の設定は承認なしに上書きしない**。`setup-global` は変更前後の値を表で見せてから書き込む
- **`conflicts` は読み取り専用**。修正案は出すが、設定ファイルは書き換えない。`~/.claude.json` は認証情報を含むため、スクリプトが MCP の起動方法だけを抜き出して渡す
- **起票の提案は SessionStart フックで入れる**。SessionStart の出力はそのまま Claude の文脈に入り、プラグインと一緒に更新・削除される。ほかの方法は次の理由で採らない
  - SessionEnd フック：出力が Claude にもユーザーにも届かない
  - Stop フック：毎ターン発火し、作業に割り込む
  - `~/.claude/rules/` にルールを置く：保護されたパスのため書き込むたびに承認が要る。プラグインを更新しても中身が古いまま残る
- **GitHub へ書き込む前に、下書きの承認を取る**。`plugin-feedback` は下書きの全文を見せて承認を取る。`gh issue create` / `gh issue comment` は `allowed-tools` に載せず、通常の許可プロンプトも通す
  - 承認を省くのは、ユーザーが省くよう求めたとき（`CLAUDE_PLUGIN_FEEDBACK_SKIP_APPROVAL=true` か、会話・CLAUDE.md・記憶での指示）だけ。省いたら、理由を起票後の報告に書く。結果だけを見たユーザーにも、確認が無かった理由が分かるようにするため
  - スキルを直接呼んだことは、起票への同意とはみなすが、下書きの承認とはみなさない。公開リポジトリに載る本文（公開前に言い換えた後のもの）を、ユーザーはまだ見ていないため
  - 承認を省く切り替えは、提案を止める `CLAUDE_PLUGIN_FEEDBACK` とは別の変数にする。同じ変数に値を足すと、「提案は止める」と「承認は省く」を同時に指定できないため
  - 初めての実行で `settings.local.json` に既定値（`off`）を書き込み、実行のたびに今の値と変え方を伝える。切り替えがあることに、README を読まなくても気づけるようにするため。書き込むときは通常の許可プロンプトを通し、ほかのキーは変えない
  - ほかの場所で既に設定していれば、`settings.local.json` には書き込まない。`settings.local.json` はユーザー全体の設定より優先されるため、書き込むと `~/.claude/settings.json` の設定を上書きしてしまう
  - 値は、環境変数より先に `settings.local.json` から読む。環境変数はセッションの開始時に決まるため、途中でファイルを書き換えた値を拾えない
- **起票先は `--repo Kazu-K0032/claude-plugins` に固定する**。既存の Issue の本文・ラベルは変えない。公開リポジトリのため、利用先のリポジトリ名・トークン・業務のファイルの中身は下書きから消す
