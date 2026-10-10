# mod-output-customize

サイドバーのボタンで、応答の書き方・外に書き出す文書の書き方・読み取り専用のチャットモードを切り替える mod を、ユーザー全体に入れる Skill。

`files/mod-output-customize/` が mod の本体。スキルがこれを `~/.claude/mods/mod-output-customize/` にコピーし、`~/.claude/settings.json` の `env.CLAUDE_CODE_PLUGIN_DIRS` に足して読み込ませる。

## 使い方

```text
/config:mod-output-customize
```

現状の確認 → 計画の提示 → 承認 → コピーと設定 → `claude plugin validate` での確認、の順に進む。Claude Code を起動し直すと、サイドバー（置けないときは入力欄の上）にボタンが出る。ボタンの動きと既定は [SKILL.md](SKILL.md) の「mod の機能」を参照。

| 引数の例 | 動き |
| --- | --- |
| 省略 | 入れる。入っていれば、同梱版との差分を見せて更新する |
| `外す` | `CLAUDE_CODE_PLUGIN_DIRS` からパスを外す。フォルダを消すかは選べる |

## 収録物

| パス | 内容 |
| --- | --- |
| `files/mod-output-customize/.claude-plugin/plugin.json` | mod のマニフェスト |
| `files/mod-output-customize/hooks/` | `hooks.json`（`modules` で `register.tsx` を読む）、ボタンと指示の本体（`register.tsx`）、色分けする行の解析（`emphasis.ts`）、チャットモードで通すコマンド・MCP ツールの判定（`readonly.ts`）、次アクションから入力欄の候補にする依頼文の取り出し（`sections.ts`） |
| `files/mod-output-customize/types/index.d.ts` | mod が持つ 3 つの on / off と、入力欄の候補に出す依頼文の型 |
| `files/mod-output-customize/tests/` | `claude plugin test` で動かすテスト |
| `files/mod-output-customize/tsconfig.json` | エディタでの型チェック用。Claude Code が mod を読み込むと書き出す `.claude-plugin/types/` を参照する |

## 前提と制約

- mod の API は早期提供で、リリースの間で予告なく変わることがある。Claude Code を更新して動かなくなったら、config を更新してからこのスキルで同梱版に更新する
- config を更新しても、コピーした mod は変わらない。更新はこのスキルを再実行する
- 読み込みは `--plugin-dir` と同じ扱いになる。対話のセッションではフォルダが見張られ、Claude Code が `.claude-plugin/types/` などを書き出す
