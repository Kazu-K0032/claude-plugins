---
name: harness-audit
description: リポジトリ全体が、本マーケットプレイスの設計思想（AIDD × DocDD）とそのリポジトリの規約に合うかを監査する。規約違反・価値に反する箇所・規約のずれ・土台の仕組みの欠けと、ファイル間の値の矛盾・重複記述・参照方向違反を見る。実行前に対象の件数・総量・エージェント数の見込みを示して続けるかを聞き、Workflow（harness-audit-run）で各指摘を敵対的に検証して tmp/<ブランチ名>/harness-audit_<yyyymmdd_hhmmss>.md に出力する。init-repo から作り直した後や、統合ブランチ（develop・stg・main）へのマージ前の最終チェックに使用する
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, AskUserQuestion
argument-hint: "[対象のパス（任意。省略時は追跡中の全テキストファイル。例: plugins/aidd docs）]"
---

# ハーネス監査（harness-audit）

リポジトリ全体が、本マーケットプレイスの設計思想（AIDD × DocDD）と、そのリポジトリの規約に合っているかを監査する。設計思想の質を保つための最終チェックで、`/project:init-repo` からハーネスやツールを作り直した後と、統合ブランチ（develop・stg・main など）へマージする前に使う。

- 外へ書き込むもの：`tmp/<ブランチ名>/harness-audit_<yyyymmdd_hhmmss>.md`（Workflow が出力するレポート）
- 人がすること：見込みを見て、続けるかを選ぶ（全部・markdown だけ・絞る・中止）。レポートの指摘を直す（このスキルはファイルを直さない）

## 参照ファイル

| ファイル | いつ読むか |
| --- | --- |
| `${CLAUDE_PLUGIN_ROOT}/references/harness-principles.md` | 手順 4 で Read し、本文を Workflow の `principles` に渡す（監査の物差しになる、設計思想の要約） |
| `${CLAUDE_PLUGIN_ROOT}/workflows/harness-audit-run.js` | 手順 2・3 で見込みを数えるとき。手順 4 で Workflow として呼ぶ。段ごとのモデルと effort は `MODELS`、束ね方は `BATCH`、横断の突合の分け方は `DETECT_GROUP`、体数の上限は `planned` の式と `AGENT_PLAN_LIMIT` が正典 |
| `${CLAUDE_PLUGIN_ROOT}/skills/harness-audit/audit-scope.md` | 利用者に何を見るかを聞かれたとき。監査の観点を直すとき |

## 想定している引数

`$ARGUMENTS` は、対象を絞るパス（空白区切り）。省くと、追跡中の全テキストファイルが対象になる。

## 出力先

レポートは `tmp/<ブランチ名>/harness-audit_<yyyymmdd_hhmmss>.md` に、Workflow が出力する。ブランチ名の `/` は `-` に置き換える。規約は `aidd` の `README.md` の「ブランチ名の `/` は `-` に置き換える」。

## 手順

監査の本体は Workflow の `harness-audit-run` で、このスキルはその入口になる。実行前に見込みを示して続けるかを聞く。なぜなら、Workflow からは利用者に質問できないからだ。

検出とレポートだけを行い、ファイルは直さない。リンク切れ・markdown 規約などの機械チェックは Lint の担当で、この監査は扱わない。

### 1. 対象を列挙する

リポジトリのルートで、追跡中のテキストファイルを列挙する。引数があれば、`--` の後ろにそのパスを並べて絞る。

```bash
git grep -I -z --name-only -e '' -- <引数のパス（無ければ省く）> \
  | tr '\0' '\n' \
  | grep -vE '(^|/)(node_modules|vendor|dist|build|tmp)/' \
  | grep -viE '\.(svg|map)$|\.min\.(js|css)$|(^|/)(package-lock\.json|pnpm-lock\.yaml|[^/]*\.lock)$'
```

- テキストかどうかは、拡張子ではなく中身で決める（`-I` はバイナリのファイルを飛ばす）。画像・Excel などを、拡張子の一覧に頼らずに除くため。中身が空のファイルも出ない
- `-z` を付けて、日本語などのファイル名をそのまま出す。付けないと、`"\350\250\255..."` のような記号付きの形になり、後の段で開けないため
- 依存・生成物・`tmp/`・圧縮済みのファイル・lock ファイルも除く。人が書いたテキストではなく、規約を当てても意味が無いため
- 一覧の各ファイルの大きさ（バイト）を `wc -c` で取る。Workflow が、小さいファイルを束ねるのに使う
- 0 件なら、その旨を伝えて終わる

### 2. 見込みを出す

手順 1 の一覧から、次を数える。トークン数は事前に分からないため、件数・総量・エージェント数で示す。

- 件数：全部と、markdown（`.md`）だけの 2 通り
- 総量：行数と KB
- 束の数：参照ファイルの `BATCH` の決め方で数える（小さいファイルを束ね、大きいファイルは 1 件で 1 束）
- 横断の群の数：件数が `DETECT_GROUP` の上限以下なら 1。超えたら、ディレクトリで分けた群の数の目安
- エージェント数：参照ファイルの `planned` の式で数える。見込みの数え方の正典は `harness-audit-run.js` のため、段ごとの内訳はここに書き写さない。モデルと effort は、参照ファイルの `MODELS` を読んで書く

1 体ごとに共通の前提を読むため、体数が費用の目安になることを添える。

### 3. 続けるかを聞く

見込みを示し、`AskUserQuestion` で次から選んでもらう。最終チェックは全体を一度に見るのが目的のため、「全部」を先頭に置き、ラベルに「(Recommended)」を付ける。

| 選択肢 | 次の動き |
| --- | --- |
| 全部（N 件） | 手順 1 の一覧のまま手順 4 へ |
| markdown だけ（M 件） | 一覧を `.md` だけにして手順 4 へ |
| 絞る | 上位のディレクトリごとの件数を示し、対象のパスを聞く。絞った一覧で手順 2 からやり直す |
| 中止 | 何もせずに終わる |

- 「絞る」には、分けて実行すると、グループをまたぐ矛盾は見つからないことを説明に添える
- 参照ファイルの `planned` の式で数えた体数が `AGENT_PLAN_LIMIT` を超えそうなら、「全部」は出さない。Workflow のエージェント数の上限に当たるため、Workflow 側でも止まる

### 4. Workflow を呼ぶ

`${CLAUDE_PLUGIN_ROOT}/references/harness-principles.md` を Read し、本文をそのまま `principles` に入れる。Workflow ツールで、`name` に `aidd:harness-audit-run`、`args` に対象の一覧と要約を渡して呼ぶ。`args` は JSON の値のまま渡す（文字列にしない）。

`confirmed` は、手順 3 で利用者が続けると選んだときだけ `true` にする。Workflow は、これが無い呼び出しを走らせない。見込みの確認を飛ばした実行を止めるため。

```json
{
  "files": [{ "path": "README.md", "bytes": 1820 }, { "path": "docs/README.md", "bytes": 940 }],
  "principles": "<harness-principles.md の本文>",
  "confirmed": true
}
```

- 名前で呼べなければ、`scriptPath` に `${CLAUDE_PLUGIN_ROOT}/workflows/harness-audit-run.js` を渡して呼ぶ
- どちらでも呼べなければ、エラーを伝えて終わる
- 実行の前に、Workflow の許可プロンプトが出る。`allowed-tools` に `Workflow` を入れていないため

### 5. 報告する

Workflow の戻り値から、次を伝えて終わる。

戻り値に `stopped` があれば、監査の前に止まっている。指摘が 0 件だったとは伝えず、理由と次の手だけを伝えて終わる。

| `stopped` | 伝えること |
| --- | --- |
| `not-confirmed` | 確認の印が渡っていない。手順 4 の `confirmed` を確かめて呼び直す |
| `no-files` | 対象が渡っていない。手順 1 の一覧を確かめて呼び直す |
| `too-many-agents` | 対象が多すぎる。手順 3 で「絞る」を選んで呼び直す |
| `rubric-failed` | チェックリストを作る段が止まった。呼び直す |

`stopped` が無ければ、次を伝える。

- レポートのパス（「出力先」のとおり）
- 監査したファイル数・確定した指摘の数・指摘の候補の数
- 仕組みの欠けを見たか（`presence`。`checked` は見た、`not-installed` は印が無く見ていない、`no-principles` は要約が無く見ていない、`failed` は判定の段が止まった。`failed` なら再実行を勧める）
- 当てはまる規約が無かったファイルの数と、検証していない候補の数（0 でなければ）
- 途中で止まった段の件数（`failed`・`notInspected`・`detectFailed`）と、反証できなかった仕組みの欠けの数（`uncheckedMissing`）。0 でなければ伝え、再実行を勧める。その分は見ていないため
- `file` が `null` なら、レポートを書けなかったことを伝え、上の件数を戻り値から伝える

## 禁止事項

- ❌ 見込みを示して聞かずに、Workflow を呼ぶ
- ❌ 利用者に伝えずに、対象を減らす（除いたファイル・当てはまる規約が無いファイルは件数を示す）
- ❌ 監査の結果を受けて、対象のファイルを直す（レポートの出力だけにとどめる）
- ❌ 設計思想の要約にも、このリポジトリの規約にも無い根拠で指摘する
