---
paths:
  - "src/**/*.js"
  - "src/**/*.html"
  - "src/appsscript.json"
---

# GAS の実行時間とトリガーに関するルール

Google Apps Script（GAS）の、実行時間の上限を前提にした処理の作り方と、トリガーの登録の仕方を決める。上限を超えると処理が途中で止まり、トリガーの登録を誤ると処理が止まったり 2 回動いたりするため。ファイルの書き分けと関数の命名は `.claude/rules/gas.md` にある。

## 時間のかかる処理を書く場合

実行時間には、呼び出し元ごとの上限がある。超えると、処理は途中で止まる。Ref: [Simple triggers](https://developers.google.com/apps-script/guides/triggers)・[Quotas for Google Services](https://developers.google.com/apps-script/guides/services/quotas)

| 呼び出し元 | 上限 |
| --- | --- |
| シンプルトリガー（`onOpen`・`onEdit`） | 1 回 30 秒 |
| カスタム関数（セルの数式から呼ぶ関数） | 1 回 30 秒 |
| 上記以外の実行（インストール型トリガー・カスタムメニュー・`google.script.run` など） | 1 回 6 分 |
| 時間主導型トリガーの合計 | 1 日 90 分（個人アカウント）・6 時間（Google Workspace） |

- シートの読み書きは `getValues` / `setValues` でまとめて行い、セル・行・列ごとのループで API を呼ばない。書式や結合も、`setBackgrounds`・`setNumberFormats`・`mergeAcross` のように範囲や配列でまとめて呼ぶ
- 書き込みの合間に読み取り（`getValue`・`getColumnWidth` など）を挟まない。読んだ値や自分で決めた値は変数に控えて使い回す。読み書きを交互に行うと遅いため。Ref: [Best Practices](https://developers.google.com/apps-script/guides/support/best-practices)
- 行数・列数で呼び出しが増える処理は、想定する最大のデータ量で呼び出しの数を見積もる。かかる時間が上限の半分（シンプルトリガーなら 15 秒、それ以外の実行なら 3 分）以内に収まる作りにする
- 上限を超えうる処理には、締め切りの判定を置く。締め切りは上限の 8 割（シンプルトリガーなら 24 秒、それ以外の実行なら 4 分 48 秒）とし、過ぎたら一部を省いて必ず終える（例：装飾を省き、値の書き込みだけで終える）
- 開始時刻を控え、終わったら、かかった秒数を `console.log` に残す。時刻は `SpreadsheetApp.flush()` で書き込みを反映してから見る。反映前に見ると、かかった時間を少なく見積もるため。Ref: [SpreadsheetApp.flush()](https://developers.google.com/apps-script/reference/spreadsheet/spreadsheet-app#flush())
- 作り直す処理は、新しい内容を作り終えてから古いものを消す。消してから描き直すと、途中で止まったときに空のシートが残るため
- 6 分を超えうる処理は分割する。処理済みの位置をスクリプトプロパティに保存し、時間主導型トリガーで続きから再開する
- シンプルトリガーが 30 秒に収まらないときは、まず呼び出しを減らす。インストール型トリガーに変えて 6 分に延ばす場合は、`TRIGGERS` に項目を足して `setupTriggers` を実行し直す（下の「トリガーを作る・変える場合」）。実行し直すまで動かず、登録を忘れても何も起きない。編集時などは、`setupTriggers` が日次のトリガーしか作らないため、項目に種類を表すキーを足し、種類ごとに作り分けるよう直す

## トリガーを作る・変える場合

- トリガーは `trigger.js` の `setupTriggers` で登録する。登録するトリガーは `trigger.js` の 1 つの一覧（`TRIGGERS`）にまとめ、`setupTriggers` は実行したアカウントのトリガーをすべて消してから一覧の分だけ作り直す。何度実行しても重複せず、一覧から外したトリガーも消えるため、廃止したトリガーを消すための仕組みを別に持たなくてよい
- トリガーを足す・やめるときは、`TRIGGERS` と入口の関数を直して push した後、`setupTriggers` を実行し直す
- `setupTriggers` は毎回同じ Google アカウントで実行する。消えるのは、実行したアカウントがこのプロジェクトで作ったインストール型トリガーだけのため。別のアカウント（ほかの人・同じ人の別のアカウント）で作ったトリガーは残り、一覧から外しても動き続けたり、同じ処理が 2 回動いたりする。シンプルトリガー（`onOpen`・`onEdit`）も消えない。Ref: [Class ScriptApp](https://developers.google.com/apps-script/reference/script/script-app#getProjectTriggers())
- `setupTriggers` を実行した後は、エディタの「トリガー」画面の件数が `TRIGGERS` の件数と合うかを確かめる。多い分は、オーナーが「他のユーザー」と表示される、別のアカウントのトリガー。要らなければ、作ったアカウントで画面を開いて消す。どのアカウントかは画面に出ない
- エディタの「トリガー」画面で手作業でトリガーを作らない。同じアカウントで作ったものは `setupTriggers` で消え、別のアカウントで作ったものは残り続けるため
- 処理の中でトリガーを毎回作らない。1 つのスクリプトで 1 ユーザーが持てるトリガーは 20 個までのため
