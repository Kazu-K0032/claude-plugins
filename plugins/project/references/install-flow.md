# テンプレートのコピーの流れ

project プラグインのスキル（`init-repo`・`gas`・`wordpress`・`terraform`）が共通で使う、テンプレートの状態の確認・計画の提示・コピー・衝突の片付けの流れ。`<スキル名>` は、使っているスキルの名前に置き換える。

## 前提

- リポジトリのルートで実行する。サブディレクトリで実行すると、`install.sh` が止まる
- `git` と `bash` を使う
- `${CLAUDE_PLUGIN_ROOT}/scripts/install.sh` は、状態の判定（`NEW`・`SAME`・`DIFF`）とコピーを行う。project プラグインの全スキルで共有するため、`--skill <スキル名>` で対象を指定する

## 状態を確かめる

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/install.sh" --skill <スキル名> --check
```

出力は 1 行 1 ファイル。ラベルの意味は次のとおり。

| ラベル | 意味 |
| --- | --- |
| `NEW` | 導入先に存在しない。コピー対象 |
| `SAME` | 既存ファイルと内容が一致。何もしない |
| `DIFF` | 既存ファイルと内容が異なる。**自動では触らない** |

## 導入計画を示す

- `--check` の結果を、新規作成するファイル（`NEW`）・既存のまま残すファイル（`SAME`）・衝突していて判断が要るファイル（`DIFF`）に分けて示す
- テンプレートの中身を確かめられるよう、`https://github.com/Kazu-K0032/claude-plugins/tree/v<版>/plugins/project/skills/<スキル名>/files` も示す。`<版>` は `${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json` の `version` にする。入れている版と同じ中身を見せるため。リリース前の版ではタグが無く、開けない

## コピーする

承認を得たら、まだ存在しないファイルだけをコピーする。

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/install.sh" --skill <スキル名> --apply
```

対象を絞る場合、または `DIFF` のファイルを上書きする場合は、`--only` に相対パスを並べる。`--only` は「差分を承知で上書きする」という明示指定として扱われる。

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/install.sh" --skill <スキル名> --apply --only <相対パス> <相対パス>
```

- 範囲を絞るときは、`--check` の結果から対象ファイルの相対パスを確定する
- 範囲を絞るときに `--only` に並べるのは、`NEW` のファイルだけにする。`DIFF` のファイルを含めると上書きになるため。`DIFF` のファイルは、衝突の片付けで扱う

## 衝突したファイルを片付ける

`DIFF` は 1 件ずつ差分を見せ、利用者に「上書き / 手でマージ / 据え置き」を選んでもらう。

```bash
diff -u <既存ファイル> "${CLAUDE_PLUGIN_ROOT}/skills/<スキル名>/files/<同じ相対パス>"
```

引数に `既存は置き換えない` があれば、`DIFF` はすべて据え置き、この片付けを飛ばす。
