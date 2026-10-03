---
name: setup-global
description: ユーザー全体の Claude Code 設定（~/.claude/settings.json）に、Powerline 風の 2 行ステータスライン（モデルと推論の強さ・コンテキスト使用率のバー・ブランチ・累計トークン・コスト・経過時間・利用上限の消費率）と日本語での応答を設定する。新しい PC で Claude Code を使い始める時、またはステータスラインのスクリプトを更新したい時に使用する
disable-model-invocation: true
allowed-tools: Read, Bash(node --version:*), Bash(diff:*)
argument-hint: "[入れる設定（任意。省略時は statusline と language の両方。例: statusline だけ / language だけ）]"
---

# グローバル設定の導入（setup-global）

ユーザースコープの設定ファイル `~/.claude/settings.json` に、次の 2 つを入れる。**既存の値は承認なしに上書きしない**。

| 設定 | 値 | 効果 |
| --- | --- | --- |
| `statusLine` | `{"type": "command", "command": "node ~/.claude/statusline/statusline.js"}` | 画面下部に 2 行のステータスラインを出す |
| `language` | `"japanese"` | Claude の応答言語を日本語にする |

## 参照ファイル

| ファイル | 役割 |
| --- | --- |
| `${CLAUDE_PLUGIN_ROOT}/skills/setup-global/scripts/statusline.js` | ステータスラインの本体（Node.js・外部パッケージなし） |

## ステータスラインの表示内容

```text
 Model: Opus 5.5 (high)  Ctx: ▓▓▓░░░░░░░ 29% 57.0k  claude-plugins  issues/1-usage-feedback
 Total: 797.0k  Cost: $0.66  Time: 1h23m (API 12m)  Limit: 5h 24% ↻16:56 / 7d 84% ↻10/7 02:16
```

| 項目 | 内容 | 入力元 |
| --- | --- | --- |
| `Model` | モデルの表示名と、括弧内に推論の強さ（`low`〜`max`。対応しないモデルでは出ない） | `model.display_name`・`effort.level` |
| `Ctx` | 現在のコンテキストの使用率（10 マスのバーと %）と、載っている入力トークン数。使用率が 50% 以上で黄、80% 以上で橙になる | `context_window.used_percentage` / `total_input_tokens` |
| ディレクトリ・ブランチ | 作業ディレクトリ名と git ブランチ（長い場合は先頭を `…` で省略） | `workspace.current_dir`・`git branch --show-current` |
| `Total` | セッション内の全 API 呼び出しで処理したトークン数（入力・キャッシュ作成・出力。キャッシュ読み込みは含めない） | `transcript_path` の各応答の `usage` を合算 |
| `Cost` | セッションの推定コスト（USD） | `cost.total_cost_usd` |
| `Time` | セッションの経過時間と、括弧内に API の応答待ちの合計時間 | `cost.total_duration_ms` / `total_api_duration_ms` |
| `Limit` | 利用上限の 5 時間枠・7 日枠の消費率と、リセットされる時刻（`↻`）。高いほうの消費率で色が変わる（基準は `Ctx` と同じ） | `rate_limits.five_hour` / `seven_day` |

`Limit` は claude.ai の Pro / Max プランでのみ、セッションの最初の応答の後から表示される。

値が無い項目（初回応答前のコンテキストなど）は表示しない。入力の仕様は [ステータスラインの公式ドキュメント](https://code.claude.com/docs/ja/statusline) を参照。

区切りの斜め三角は Powerline グリフ（Nerd Font 等）を使う。対応フォントが無い端末で文字化けする場合は、環境変数 `CLAUDE_STATUSLINE_PLAIN=1` を設定すると区切りなしの色帯表示になる（`settings.json` の `env` に入れればよい）。

## 引数の解釈

| 引数 | 対象 |
| --- | --- |
| 省略 | `statusLine` と `language` の両方 |
| `statusline だけ` 等 | `statusLine` のみ |
| `language だけ` / `日本語化だけ` 等 | `language` のみ |

## 手順

### 1. 現状を確認する

1. `node --version` を実行し、Node.js が使えることを確認する。無い場合はステータスラインを導入せず、Node.js のインストールを案内する（`language` だけは導入できる）
1. `~/.claude/settings.json` を Read する。無い場合は新規作成になる
1. `~/.claude/statusline/statusline.js` が既にあれば、同梱版との差分を取る

    ```bash
    diff -u ~/.claude/statusline/statusline.js "${CLAUDE_PLUGIN_ROOT}/skills/setup-global/scripts/statusline.js"
    ```

1. `statusLine.command` が自作のスクリプト（`~/.claude/statusline/statusline.js` 以外のファイル）を指していれば、そのスクリプトを Read する

### 2. 項目ごとに状態を判定する

引数で対象になった項目それぞれを、次の 3 状態に分ける。

| 項目 | 同一 | 未設定 | 異なる |
| --- | --- | --- | --- |
| `statusLine` | `type` が `command` で、`command` が `~/.claude/statusline/statusline.js` を `node` で実行している（`~` を展開した絶対パスやクォートの有無は同一とみなす。`padding` 等の他のキーは問わない） | キーが無い | 上記以外（自作スクリプト・別のコマンド） |
| `language` | `"japanese"`（大文字小文字は問わない） | キーが無い | 別の言語 |
| `statusline.js`（`statusLine` が対象のときのみ） | 同梱版と差分なし | ファイルが無い | 差分あり |

#### 全部「同一」なら終了する

対象の項目がすべて「同一」なら、次のように現状だけを報告して**終了する**。承認を求めず、書き込み・コピー・動作確認もしない。

```markdown
設定はすでに同梱版と同じため、変更はありません。

| 項目 | 現在 |
| --- | --- |
| `statusLine` | `node ~/.claude/statusline/statusline.js`（同梱版と同一） |
| `language` | `"japanese"` |
```

ただし、プロジェクト側の設定（下記）に上書きされている場合は、その旨を報告に添える。

### 3. 変更計画を提示して承認を得る（必須）

「同一」以外の項目について、現状と選択肢を示す。「同一」の項目は「変更なし」と表に載せるだけにして、選択肢を出さない。

| 状態 | 示す内容 | 選択肢 |
| --- | --- | --- |
| 未設定 | 設定後の値 | 設定する / 設定しない |
| `statusLine` が異なる（自作スクリプト） | 今のスクリプトが表示している項目の要約と、同梱版との違い（同梱版に無い項目・同梱版にしか無い項目） | 置き換え / 据え置き / 今の表示項目を同梱版に足す（下記） |
| `statusLine` が異なる（スクリプト以外のコマンド） | 今の `command` の値と、それが表示するもの | 置き換え / 据え置き |
| `language` が異なる | 今の値 | `"japanese"` に置き換え / 据え置き |
| `statusline.js` が異なる | 差分の要点（どの表示が増える・減る・変わるか）。手で書き換えた形跡があれば明示する | 同梱版に更新 / 据え置き |

- 置き換えを選んだ場合、元の値は最後の報告に載せ、戻せるようにする。自作スクリプトのファイル自体は消さない
- 「今の表示項目を同梱版に足す」を選んだ場合は、同梱版をコピーしたうえで `~/.claude/statusline/statusline.js` に該当の表示を追加する案（どの行にどの項目を足すか）を示し、承認を得てから編集する。手を入れたスクリプトは次回このスキルを実行すると「異なる」と判定されることを伝える
- `.claude/settings.json`（プロジェクト）や `.claude/settings.local.json` に同じキーがあると、そちらが優先されてユーザー設定は効かない。カレントディレクトリにそれらがあれば Read して、上書きされる場合は伝える

### 4. 設定する

承認を得た項目だけを実行する。「同一」と「据え置き」の項目には触らない。

1. スクリプトを配置する（`statusLine` を設定・置き換え・更新する場合のみ）。既存の `statusline.js` を置き換える場合は、先に日時付きの `.bak` として残す（再実行で前回のバックアップを上書きしないため）

    ```bash
    mkdir -p ~/.claude/statusline
    [ -f ~/.claude/statusline/statusline.js ] && cp ~/.claude/statusline/statusline.js ~/.claude/statusline/statusline.js.$(date +%Y%m%d%H%M%S).bak
    cp "${CLAUDE_PLUGIN_ROOT}/skills/setup-global/scripts/statusline.js" ~/.claude/statusline/statusline.js
    ```

1. `~/.claude/settings.json` に `statusLine` / `language` のキーを追加または置換する
    - 既存ファイルがある場合は Edit で該当キーだけを変える。他のキー・並び順・インデントは触らない。`statusLine` 内の `padding` 等の既存キーも残す
    - 無い場合は次の内容で作成する（設定しない項目のキーは除く）

    ```json
    {
      "statusLine": {
        "type": "command",
        "command": "node ~/.claude/statusline/statusline.js"
      },
      "language": "japanese"
    }
    ```

`command` のパスはスラッシュ区切りで書く。Windows では Claude Code がステータスラインを Git Bash 経由で実行するため、バックスラッシュは区切りとして解釈されない。`~` は Windows でもホームディレクトリに展開される。

### 5. 動作を確認する

`statusline.js` を配置・編集した場合だけ、サンプル入力を流して、エラーなく 2 行が出ることを確認する。`pwd -W` は Git Bash で Windows 形式のパス（`C:/...`）を返す。Windows の Node.js は `/c/...` 形式を扱えず、ブランチが表示されなくなるため。

```bash
echo '{"model":{"display_name":"Opus"},"effort":{"level":"high"},"workspace":{"current_dir":"'"$(pwd -W 2>/dev/null || pwd)"'"},"cost":{"total_cost_usd":0.12,"total_duration_ms":754000,"total_api_duration_ms":120000},"context_window":{"total_input_tokens":12000,"used_percentage":6},"rate_limits":{"five_hour":{"used_percentage":23,"resets_at":'"$(( $(date +%s) + 3600 ))"'}}}' | node ~/.claude/statusline/statusline.js
```

最後に次を報告する。

- 項目ごとの結果（設定した / 置き換えた / 更新した / 据え置いた / 変更なし）と、置き換えた項目の元の値
- ステータスラインは次の描画（次のメッセージ送信など）から反映される。`language` は新しいセッションから効く
- プラグインを更新してスクリプトが変わった場合は、このスキルを再実行すると差分を確認して更新できる

## 禁止事項

- 承認なしに既存の `statusLine` / `language` / `statusline.js` を上書きしない
- すべて「同一」のときに、承認を求めたり書き込み・コピーをしたりしない
- ユーザーの自作スクリプトを削除・編集しない（同梱版への取り込みは `~/.claude/statusline/statusline.js` 側で行う）
- `~/.claude/settings.json` の他のキーを変更・整形しない
- プロジェクトの `.claude/settings.json` には書き込まない（このスキルはユーザースコープ専用）

$ARGUMENTS
