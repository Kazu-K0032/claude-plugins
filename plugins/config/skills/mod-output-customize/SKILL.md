---
name: mod-output-customize
description: config に同梱した mod（サイドバーのボタンで、応答の書き方・外に書き出す文書の書き方・読み取り専用のチャットモードを切り替える。スキルの実行時に SKILL.md へのリンクを出す）を ~/.claude/mods/ にコピーし、~/.claude/settings.json の CLAUDE_CODE_PLUGIN_DIRS に足して読み込ませる。mod を使い始める時、mod を更新したい時、または外したい時に使用する
disable-model-invocation: true
allowed-tools: Read, Bash(diff:*), Bash(claude plugin validate:*)
argument-hint: "[する操作（任意。省略時は導入・更新。例: 外す）]"
---

# mod の導入（mod-output-customize）

config に同梱した mod を、ユーザー全体で読み込まれるように入れる。config を入れただけでは効かず、このスキルで入れた人にだけ効く。

- 外へ書き込むもの：`~/.claude/mods/mod-output-customize/`（置き換えるときは日時付きの `.bak` も）と、`~/.claude/settings.json` の `env.CLAUDE_CODE_PLUGIN_DIRS`
- 人がすること：変更計画の承認。**既存のファイル・設定は承認なしに上書きしない**。mod を外すときのフォルダの削除（`rm -rf`）。Claude Code の起動し直し

## 参照ファイル

| ファイル | いつ読むか |
| --- | --- |
| `${CLAUDE_PLUGIN_ROOT}/skills/mod-output-customize/files/mod-output-customize/` | 手順 1 で同梱版との差分を取り、手順 4 でコピーする（mod の本体。コピー元） |
| `${CLAUDE_PLUGIN_ROOT}/skills/mod-output-customize/mod-features.md` | 手順 3 で mod の機能を利用者に伝えるとき、手順 5 の報告に書くとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/mod-output-customize/uninstall.md` | 引数で外すよう指示されたとき。フォルダの削除は、Claude は実行せず利用者に示す |

## 想定している引数

| 引数 | 動き |
| --- | --- |
| 省略 | 導入・更新（手順 1〜5） |
| `外す` / `アンインストール` 等 | 外す（`uninstall.md` を読む） |

## 出力先

| 入れる先 | 値 |
| --- | --- |
| mod のフォルダ | `~/.claude/mods/mod-output-customize/`（同梱版をコピーする） |
| `~/.claude/settings.json` の `env.CLAUDE_CODE_PLUGIN_DIRS` | 上のフォルダのパス（`~/.claude/mods/mod-output-customize`）を含める |

`CLAUDE_CODE_PLUGIN_DIRS` に書いたフォルダは、起動のたびに `--plugin-dir` と同じように読み込まれる。複数のパスは区切り文字でつなぐ（Windows は `;`、macOS・Linux は `:`）。`~` も使える。ユーザーの `settings.json` の `env` とプロセスの環境変数からだけ読まれ、プロジェクトの設定に書いても読まれない。

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
| mod のフォルダが未設定 | コピー先と、mod の機能（`mod-features.md` の表）。スキルの手順書へのリンクが毎回出ること（ボタンは無く、止めるには mod を外す）も伝える | 入れる / 入れない |
| mod のフォルダが未設定なのに、`CLAUDE_CODE_PLUGIN_DIRS` にはパスがある | 無いフォルダを指すパスが残っていること | 入れる / パスを外す |
| mod のフォルダが異なる | 差分の要点（ボタン・指示文・手順書のリンクのどこが変わるか）。手で書き換えた形跡があれば明示する | 同梱版に更新 / 据え置き |
| `CLAUDE_CODE_PLUGIN_DIRS` が未設定 | 変更前後の値 | 足す / 足さない |
| 同じ mod の別のパスがある | そのパスと、2 重に読み込まれること | 一覧から外す / 残す |

- 「入れない」を選んだら、`CLAUDE_CODE_PLUGIN_DIRS` にも足さない。無いフォルダを読み込ませないため。同じ理由で、無いフォルダを指すパスは残さない
- 「同梱版に更新」を選んだら、手で書き換えた箇所は消える。前のフォルダは手順 4 で `.bak` として残す

### 4. 入れる

承認を得た項目だけを実行する。「同一」と「据え置き」の項目には触らない。

1. mod をコピーする（入れる・更新する場合のみ）。既存のフォルダを置き換える場合は、先に日時付きの `.bak` に移す。再実行で前回のバックアップを上書きしないため。`.bak` のフォルダは `CLAUDE_CODE_PLUGIN_DIRS` に無いため読み込まれない

    ```bash
    mkdir -p ~/.claude/mods && { [ ! -d ~/.claude/mods/mod-output-customize ] || mv ~/.claude/mods/mod-output-customize ~/.claude/mods/mod-output-customize.$(date +%Y%m%d%H%M%S).bak; } && cp -r "${CLAUDE_PLUGIN_ROOT}/skills/mod-output-customize/files/mod-output-customize" ~/.claude/mods/mod-output-customize
    ```

    途中で失敗したら、そこで止まる。`mv` が失敗したまま `cp -r` を進めると、残ったフォルダの中に入れ子でコピーされるため。`mv` が失敗したら、フォルダの名前を変えられなかったことを報告して止まり、mod を読み込んでいる Claude Code をすべて終了してから、もう一度実行するよう伝える

1. `~/.claude/settings.json` の `env.CLAUDE_CODE_PLUGIN_DIRS` を直す
    - 値があれば、区切り文字を挟んで末尾に `~/.claude/mods/mod-output-customize` を足す。「一覧から外す」「パスを外す」を選んだパスは、ここで取り除く
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

確かめたら、結果を報告する。報告に書く項目は `mod-features.md` を読む。

## 禁止事項

- 承認なしに、既存の mod のフォルダや `CLAUDE_CODE_PLUGIN_DIRS` を上書き・削除しない
- すべて「同一」のときに、承認を求めたり書き込み・コピーをしたりしない
- `CLAUDE_CODE_PLUGIN_DIRS` の他のパスと、`~/.claude/settings.json` の他のキーを変更・整形しない（2 重に読み込まれるパスを外すと承認された場合を除く）
- プロジェクトの `.claude/settings.json` には書き込まない（`CLAUDE_CODE_PLUGIN_DIRS` はユーザーの設定からしか読まれない）
- 同梱版（`${CLAUDE_PLUGIN_ROOT}` 配下）を編集しない

$ARGUMENTS
