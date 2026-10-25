---
name: harness-audit
description: リポジトリが、本マーケットプレイスの設計思想（AIDD × DocDD）とそのリポジトリの規約に合うかを、全体・差分（今のブランチの変更）・ディレクトリから範囲を選んで監査する。規約違反・価値に反する箇所・規約のずれ・土台の仕組みの欠けと、ファイル間の値の矛盾・重複記述・参照方向違反を見る。実行前にトークンを多く使うことと、対象の件数・総量・エージェント数の見込みを示して続けるかを聞き、Workflow（harness-audit-run）で各指摘を敵対的に検証して tmp/<ブランチ名>/harness-audit_<yyyymmdd_hhmmss>.md に出力する。init-repo から作り直した後や、統合ブランチ（develop・stg・main）へのマージ前の最終チェック（全体）と、PR の前の確認（差分）に使用する
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, AskUserQuestion, Bash(git branch --show-current), Bash(git check-ignore:*), Bash(gh pr view:*)
argument-hint: "[範囲（任意。省略時は全体・差分・ディレクトリから質問する。例: --diff、plugins/aidd docs）]"
---

# ハーネス監査（harness-audit）

リポジトリが、本マーケットプレイスの設計思想（AIDD × DocDD）と、そのリポジトリの規約に合っているかを監査する。範囲は全体・差分・ディレクトリから選べる。全体は、`/project:init-repo` からハーネスやツールを作り直した後と、統合ブランチ（develop・stg・main など）へマージする前の最終チェックに使う。差分は、PR の前に、ブランチで変えたファイルだけを安く見るために使う。

- 外へ書き込むもの：`tmp/<ブランチ名>/harness-audit_<yyyymmdd_hhmmss>.md` のレポート（Workflow が書く）。検出とレポートだけを行い、ファイルは直さない
- 人がすること：見込みを見て、続けるかを選ぶ。レポートの指摘を読み、直すかを決める

## 参照ファイル

| ファイル | いつ読むか |
| --- | --- |
| `${CLAUDE_PLUGIN_ROOT}/references/tmp-ignore.md` | 手順 1 の前に、`tmp/` の除外を確かめるとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/harness-audit/scope.md` | 手順 2・3 で、範囲を決めて対象を列挙するとき |
| `${CLAUDE_PLUGIN_ROOT}/references/base-branch.md` | 手順 3 で、差分のマージ先を決めるとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/harness-audit/viewpoints.md` | 監査で何を見るか（観点・物差し・範囲を絞ったときに見るもの・扱わないもの）を確かめる・説明するとき |
| `${CLAUDE_PLUGIN_ROOT}/workflows/harness-audit-run.js` | 手順 4・5 で見込みを出すとき。監査の本体。段ごとのモデルと effort は `MODELS`、束ね方は `BATCH`、横断の突合の分け方は `DETECT_GROUP`、体数の上限は `planned` の式と `AGENT_PLAN_LIMIT` が正典 |
| `${CLAUDE_PLUGIN_ROOT}/references/harness-principles.md` | 手順 6 で Workflow を呼ぶとき。監査の物差しになる、設計思想の要約。本文を Workflow に渡す |
| `${CLAUDE_PLUGIN_ROOT}/skills/harness-audit/errors.md` | 手順 1・6 で Workflow が使えないとき、手順 3 で差分が使えないとき、手順 7 で Workflow の戻り値に `stopped` があったとき |

## 想定している引数

`$ARGUMENTS` は、監査の範囲。`--diff` なら差分、パス（空白区切り）ならディレクトリ、空なら質問で選ぶ。`--diff` とパスが混ざっていたら、選び直してもらう（`scope.md`）。

## 出力先

Workflow が `tmp/<ブランチ名>/harness-audit_<yyyymmdd_hhmmss>.md` にレポートを書く。ブランチ名の `/` は `-` に置き換える（規約は `aidd` の `README.md` の「ブランチ名の `/` は `-` に置き換える」）。

手順 1 の前に、`tmp-ignore.md` で `tmp/` の除外を確かめる。

## 手順

### 1. Workflow が使えるかを確かめる

`Workflow` ツールが使えるツールの中に無ければ（遅延読み込みのツールは `ToolSearch` で探す）、`errors.md` の「Workflow が使えないとき」に従い、`/config` の設定を案内して終わる。範囲と見込みを決めた後で使えないと分かるのを避けるため。

### 2. 範囲を決める

`scope.md` の「範囲の種類」で、全体・差分・ディレクトリのどれかに決める。

### 3. 対象を列挙する

`scope.md` の「対象を列挙する」で、追跡中のテキストファイルを列挙する。差分なら、`scope.md` の「差分の対象を決める」で、マージ先と比べて変えたファイルに絞る。

### 4. 見込みを出す

先に、トークンを多く使うことを伝える。多数のエージェントを動かすため、通常の会話より多く使い、プランの利用上限に数えられる。続けて、手順 3 の一覧から、件数・総量・エージェント数を数える。トークン数は事前に分からないため。

- 範囲：全体・差分（比べた先）・ディレクトリ（パス）のどれか。差分とディレクトリは、全体の件数も添える
- 件数：全部と、markdown（`.md`）だけの 2 通り
- 総量：行数と KB
- 束の数：`BATCH` の決め方で数える（小さいファイルを束ね、大きいファイルは 1 件で 1 束）
- 横断の群の数：件数が `DETECT_GROUP` の上限以下なら 1。超えたら、ディレクトリで分けた群の数の目安
- エージェント数：`planned` の式で数える。見込みの数え方の正典は `harness-audit-run.js` のため、段ごとの内訳はここに書き写さない。モデルと effort は、`MODELS` を読んで書く

1 体ごとに共通の前提を読むため、体数が費用の目安になることを添える。

### 5. 続けるかを聞く

見込みを示し、`AskUserQuestion` で選んでもらう。Workflow からは利用者に質問できないため、このスキルで聞く。選んだ範囲を一度に見るのが目的のため、「全部」を先頭に置き、ラベルに「(Recommended)」を付ける。

| 選択肢 | 次の動き |
| --- | --- |
| 全部（N 件） | 手順 3 の一覧のまま手順 6 へ |
| markdown だけ（M 件） | 一覧を `.md` だけにして手順 6 へ |
| 範囲を選び直す | 手順 2 からやり直す。ディレクトリを選ぶときは、上位のディレクトリごとの件数を示す |
| 中止 | 何もせずに終わる |

- 「範囲を選び直す」には、範囲を分けて実行すると、範囲をまたぐ矛盾・重複は見つからないことを説明に添える
- `planned` の式で数えた体数が `AGENT_PLAN_LIMIT` を超えそうなら、「全部」は出さない。Workflow のエージェント数の上限に当たるため、Workflow 側でも止まる

### 6. Workflow を呼ぶ

`harness-principles.md` を Read し、本文をそのまま `principles` に入れる。Workflow ツールで、`name` に `aidd:harness-audit-run`、`args` に対象の一覧・範囲・要約を渡して呼ぶ。`args` は JSON の値のまま渡す（文字列にしない）。

`confirmed` は、手順 5 で利用者が続けると選んだときだけ `true` にする。Workflow は、これが無い呼び出しを走らせない。見込みの確認を飛ばした実行を止めるため。`scope` は、手順 2・3 で控えた範囲で、Workflow がレポートの注記に範囲と見ていないものを書くのに使う。

```json
{
  "files": [{ "path": "README.md", "bytes": 1820 }, { "path": "docs/README.md", "bytes": 940 }],
  "principles": "<harness-principles.md の本文>",
  "scope": { "kind": "diff", "base": "origin/develop", "total": 312 },
  "confirmed": true
}
```

- `scope.kind` は `all`・`diff`・`dir`。差分なら `base` に比べた先、ディレクトリなら `paths` にパスの配列を入れる。`total` は全体の件数。手順 5 で「markdown だけ」を選んだときは `markdownOnly` を `true` にする
- 名前で呼べなければ、`scriptPath` に `${CLAUDE_PLUGIN_ROOT}/workflows/harness-audit-run.js` を渡して呼ぶ
- どちらでも呼べなければ、`errors.md` の「Workflow が使えないとき」に従う

### 7. 報告する

Workflow の戻り値から、次を伝えて終わる。戻り値に `stopped` があれば、`errors.md` に従う。

- レポートのパス。前後は、半角スペースか改行で区切る（規約は `aidd` の `README.md` の「出力先のパスは、前後を区切って伝える」）
- 範囲（差分なら比べた先と根拠）と、範囲の外にした件数。範囲の外は見ていない
- 監査したファイル数・確定した指摘の数・指摘の候補の数
- 仕組みの欠けを見たか（`presence`。`checked` は見た、`not-installed` は印が無く見ていない、`no-principles` は要約が無く見ていない、`failed` は判定の段が止まった。`failed` なら再実行を勧める）
- 当てはまる規約が無かったファイルの数と、検証していない候補の数（0 でなければ）
- 途中で止まった段の件数（`failed`・`notInspected`・`detectFailed`）と、反証できなかった仕組みの欠けの数（`uncheckedMissing`）。0 でなければ伝え、再実行を勧める。その分は見ていないため
- `file` が `null` なら、レポートを書けなかったことを伝え、上の件数を戻り値から伝える

## 禁止事項

- ❌ 見込みを示して聞かずに、Workflow を呼ぶ
- ❌ 利用者に伝えずに、対象を減らす（範囲の外にしたファイル・除いたファイル・当てはまる規約が無いファイルは件数を示す）
- ❌ 範囲を絞ったのに、範囲の外との矛盾・重複が無かったと伝える（見つからないだけで、無いとは限らない）
- ❌ 監査の結果を受けて、対象のファイルを直す（レポートの出力だけにとどめる）
- ❌ 設計思想の要約にも、このリポジトリの規約にも無い根拠で指摘する

## 保守

- 監査の本体は Workflow の `harness-audit-run` で、このスキルはその入口になる
- 手順 6 の実行の前に、Workflow の許可プロンプトが出る。`allowed-tools` に `Workflow` を入れていないため
- `allowed-tools` の 3 つの `Bash` は、`docs-sync` と同じ読み取り。`git diff` は、前方一致の規則ではオプションを除けず書き込みも通すため、`git fetch` は書き込み先が `tmp/` に決まらないため入れず、許可プロンプトを通す（P1）
