---
name: mod-output-customize
description: config に同梱した mod（入力欄の上のボタンで、応答の書き方・外に書き出す文書の書き方・読み取り専用のチャットモードを切り替える）を ~/.claude/mods/ にコピーし、~/.claude/settings.json の CLAUDE_CODE_PLUGIN_DIRS に足して読み込ませる。mod を使い始める時、mod を更新したい時、または外したい時に使用する
disable-model-invocation: true
allowed-tools: Read, Bash(diff:*), Bash(claude plugin validate:*)
argument-hint: "[する操作（任意。省略時は導入・更新。例: 外す）]"
---

# mod の導入（mod-output-customize）

config に同梱した mod を、ユーザー全体で読み込まれるように入れる。config を入れただけでは効かず、このスキルで入れた人にだけ効く。**既存のファイル・設定は承認なしに上書きしない**。

| 入れる先 | 値 |
| --- | --- |
| mod のフォルダ | `~/.claude/mods/mod-output-customize/`（同梱版をコピーする） |
| `~/.claude/settings.json` の `env.CLAUDE_CODE_PLUGIN_DIRS` | 上のフォルダのパス（`~/.claude/mods/mod-output-customize`）を含める |

`CLAUDE_CODE_PLUGIN_DIRS` に書いたフォルダは、起動のたびに `--plugin-dir` と同じように読み込まれる。複数のパスは区切り文字でつなぐ（Windows は `;`、macOS・Linux は `:`）。`~` も使える。ユーザーの `settings.json` の `env` とプロセスの環境変数からだけ読まれ、プロジェクトの設定に書いても読まれない。

## 参照ファイル

| ファイル | 役割 |
| --- | --- |
| `${CLAUDE_PLUGIN_ROOT}/skills/mod-output-customize/files/mod-output-customize/` | mod の本体（コピー元） |

## mod の機能

| ボタン | キー | 動き |
| --- | --- | --- |
| チャットモード | `0` | `Edit`・`Write`・`NotebookEdit`、読み取り用以外の `Bash`、読み取り用と判断できない MCP ツールを拒否し、読み取り専用にする。セッションをまたいで持ち越さない |
| 応答カスタム | `1` | 応答を `### 簡潔版`・`### 概要`・`## 次アクション` に分けて書かせる。`✅`・`❌`・`==語句==`・`{{仕様}}` を赤・緑で表示する。on / off は次のセッションへ持ち越す |
| 文書を簡潔に | `2` | Issue・PR・README など外に書き出す文書を、短く平易に書かせる指示を足す。on / off は次のセッションへ持ち越す |

- 既定は、応答カスタムと文書を簡潔にが ON、チャットモードが OFF
- 指示はプロンプトを送るたびに添える。端末に描かない実行（`-p` など）では、指示を何も足さない

## 引数の解釈

| 引数 | 動き |
| --- | --- |
| 省略 | 導入・更新（手順 1〜5） |
| `外す` / `アンインストール` 等 | 外す（「外す」の節） |

## 手順

### 1. 現状を確認する

1. `~/.claude/settings.json` を Read する。無い場合は新規作成になる
1. `env.CLAUDE_CODE_PLUGIN_DIRS` の値を区切り文字で分け、パスの一覧にする。`~` は展開して比べる
1. `~/.claude/mods/mod-output-customize/` があれば、同梱版との差分を取る

    ```bash
    diff -ru "${CLAUDE_PLUGIN_ROOT}/skills/mod-output-customize/files/mod-output-customize" ~/.claude/mods/mod-output-customize
    ```

    `.claude-plugin/types/` は差分から外して読む。Claude Code が mod を読み込むたびに書き出すもののため

1. 一覧のほかのパスに、同じ mod が無いかを確かめる。各パスの `.claude-plugin/plugin.json` を Read し、`name` が `mod-output-customize` か、以前の名前の `color-emphasis` なら同じ mod とみなす。残すと 2 重に読み込まれる

### 2. 状態を判定する

| 項目 | 同一 | 未設定 | 異なる |
| --- | --- | --- | --- |
| mod のフォルダ | 同梱版と差分なし（Claude Code の書き出し物は除く） | フォルダが無い | 差分あり |
| `CLAUDE_CODE_PLUGIN_DIRS` | mod のフォルダのパスを含む | キーが無い、またはパスを含まない | なし |
| 同じ mod の別のパス | なし | なし | ある |

#### 全部「同一」なら終了する

mod のフォルダと `CLAUDE_CODE_PLUGIN_DIRS` が「同一」で、別のパスも無ければ、現状だけを報告して**終了する**。承認を求めず、書き込み・コピーもしない。

```markdown
mod はすでに同梱版と同じものが入っているため、変更はありません。

| 項目 | 現在 |
| --- | --- |
| mod のフォルダ | `~/.claude/mods/mod-output-customize/`（同梱版と同一） |
| `CLAUDE_CODE_PLUGIN_DIRS` | `<今の値>` |
```

### 3. 変更計画を提示して承認を得る（必須）

「同一」以外の項目について、現状と選択肢を示し、`AskUserQuestion` で選んでもらう。「同一」の項目は「変更なし」と表に載せるだけにする。

| 状態 | 示す内容 | 選択肢 |
| --- | --- | --- |
| mod のフォルダが未設定 | コピー先と、mod の機能（上の表） | 入れる / 入れない |
| mod のフォルダが異なる | 差分の要点（ボタン・指示文のどこが変わるか）。手で書き換えた形跡があれば明示する | 同梱版に更新 / 据え置き |
| `CLAUDE_CODE_PLUGIN_DIRS` が未設定 | 変更前後の値 | 足す / 足さない |
| 同じ mod の別のパスがある | そのパスと、2 重に読み込まれること | 一覧から外す / 残す |

- 「入れない」を選んだら、`CLAUDE_CODE_PLUGIN_DIRS` にも足さない。無いフォルダを読み込ませないため
- 「同梱版に更新」を選んだら、手で書き換えた箇所は消える。前のフォルダは手順 4 で `.bak` として残す

### 4. 入れる

承認を得た項目だけを実行する。「同一」と「据え置き」の項目には触らない。

1. mod をコピーする（入れる・更新する場合のみ）。既存のフォルダを置き換える場合は、先に日時付きの `.bak` に移す。再実行で前回のバックアップを上書きしないため。`.bak` のフォルダは `CLAUDE_CODE_PLUGIN_DIRS` に無いため読み込まれない

    ```bash
    mkdir -p ~/.claude/mods
    [ -d ~/.claude/mods/mod-output-customize ] && mv ~/.claude/mods/mod-output-customize ~/.claude/mods/mod-output-customize.$(date +%Y%m%d%H%M%S).bak
    cp -r "${CLAUDE_PLUGIN_ROOT}/skills/mod-output-customize/files/mod-output-customize" ~/.claude/mods/mod-output-customize
    ```

1. `~/.claude/settings.json` の `env.CLAUDE_CODE_PLUGIN_DIRS` を直す
    - 値があれば、区切り文字を挟んで末尾に `~/.claude/mods/mod-output-customize` を足す。「一覧から外す」を選んだパスは、ここで取り除く
    - `env` はあってキーが無ければ、キーを足す。`env` も無ければ `env` ごと足す
    - 既存ファイルがある場合は Edit でこのキーだけを変える。他のキー・並び順・インデントは触らない
    - ファイルが無い場合は次の内容で作成する

    ```json
    {
      "env": {
        "CLAUDE_CODE_PLUGIN_DIRS": "~/.claude/mods/mod-output-customize"
      }
    }
    ```

### 5. 確かめて報告する

mod をコピーした場合だけ、Claude Code が受け付ける形かを確かめる。エラーが出たら、内容と `.bak` から戻す方法を報告して止まる。

```bash
claude plugin validate ~/.claude/mods/mod-output-customize
```

最後に次を報告する。

- 項目ごとの結果（入れた / 更新した / 足した / 外した / 据え置いた / 変更なし）と、`CLAUDE_CODE_PLUGIN_DIRS` の変更前の値
- Claude Code を起動し直すと、入力欄の上にボタンが出る。各ボタンの既定と、キー（`0`〜`2`）で切り替えられること
- config を更新して mod が変わったら、このスキルを再実行すると差分を確かめて更新できる

## 外す

引数で外すよう指示されたときの手順。

1. `~/.claude/settings.json` を Read し、`env.CLAUDE_CODE_PLUGIN_DIRS` に mod のフォルダのパスがあるかを確かめる
1. 外す内容（`CLAUDE_CODE_PLUGIN_DIRS` の変更前後の値と、消すフォルダ）を示し、`AskUserQuestion` で選んでもらう
    - 外して、フォルダも消す
    - 外して、フォルダは残す
    - やめる
1. `CLAUDE_CODE_PLUGIN_DIRS` からパスだけを取り除く。値が空になったらキーを消す。他のパスと他のキーは触らない
1. 「フォルダも消す」を選んだ場合だけ、フォルダを消す

    ```bash
    rm -rf ~/.claude/mods/mod-output-customize
    ```

1. 起動し直すとボタンが消えることを報告する

## 禁止事項

- 承認なしに、既存の mod のフォルダや `CLAUDE_CODE_PLUGIN_DIRS` を上書き・削除しない
- すべて「同一」のときに、承認を求めたり書き込み・コピーをしたりしない
- `CLAUDE_CODE_PLUGIN_DIRS` の他のパスと、`~/.claude/settings.json` の他のキーを変更・整形しない（2 重に読み込まれるパスを外すと承認された場合を除く）
- プロジェクトの `.claude/settings.json` には書き込まない（`CLAUDE_CODE_PLUGIN_DIRS` はユーザーの設定からしか読まれない）
- 同梱版（`${CLAUDE_PLUGIN_ROOT}` 配下）を編集しない

$ARGUMENTS
