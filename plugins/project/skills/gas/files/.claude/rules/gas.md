---
paths:
  - "src/**/*.js"
  - "src/**/*.html"
  - "src/appsscript.json"
docs-type: people-ai-doc
---

# Google Apps Script（GAS）の実装ルール

`src/` 配下を clasp で Apps Script のプロジェクトへ push する構成を前提にする。コードは JavaScript（V8 ランタイム）で書く。

## ファイルの書き分け

| ファイル | 置くもの | 置かないもの |
| --- | --- | --- |
| `constants.js` | 定数、スクリプトプロパティのキー名 | 処理、他ファイルの関数の呼び出し、秘匿値そのもの |
| `main.js` | ワークフローの入口になる関数（処理の流れだけ） | 細かい処理（`utils.js` や役割ごとのファイルへ切り出す） |
| `utils.js` | 複数のファイルから使う共通関数 | 特定のサービス・シートに依存する処理（役割ごとのファイルへ） |
| `trigger.js` | トリガーの登録・削除、トリガーから呼ばれる入口関数 | 処理の本体（`main.js` から呼ぶ） |

### ファイルを増やすとき

4 ファイルに収まらない処理は、役割ごとにファイルを足す。

- 特定の外部サービス・シート・データを扱う処理が増えたら、対象を表す名前でファイルを足す（例：`slack.js`・`sheet.js`）
- 定数・入口・トリガーはそれぞれ 1 か所にまとめる。`constants.js`・`main.js`・`trigger.js` と同じ役割のファイルは増やさない
- `utils.js` が特定の対象の処理で膨らんだら、役割ごとのファイルへ切り出す

## 関数の命名

外から呼ぶ関数かどうかを、名前の末尾の `_` で区別する。

| 種類 | 例 | 名前の末尾 | 置き場所 |
| --- | --- | --- | --- |
| エディタの実行メニューから実行する関数 | `main`・`setupTriggers` | `_` を付けない | `main.js`・`trigger.js` |
| トリガーに登録する関数 | `onDailySchedule` | `_` を付けない | `trigger.js` |
| シンプルトリガー（予約された名前） | `onOpen`・`onEdit` | 名前を変えられない | `trigger.js` |
| カスタムメニュー（`Menu.addItem`）から呼ぶ関数 | — | `_` を付けない | 役割ごとのファイル |
| HTML（`google.script.run`）から呼ぶ関数 | — | `_` を付けない | 役割ごとのファイル |
| 上記以外（内部の処理） | `formatDate_`・`getScriptProperty_` | `_` を付ける | どこでもよい |

末尾が `_` の関数は private として扱われ、`google.script.run` から呼べず、名前もクライアントへ送られない。Ref: [HTML Service: Communicate with Server Functions](https://developers.google.com/apps-script/guides/html/communication)

## GAS 特有の注意点

### 全ファイルが同じグローバル空間を共有する

全ファイルは 1 つのグローバル空間で実行される。トップレベルのコードはファイルの読み込み順に依存するため、トップレベルでは定数と関数の定義だけを行い、処理を実行しない。Ref: [V8 runtime overview](https://developers.google.com/apps-script/guides/v8-runtime)

- 同じ名前の関数・定数を別のファイルで定義しない。関数は後から読み込まれた方で上書きされ、`const` は宣言の重複でエラーになる
- 定数の値に他ファイルの関数の戻り値を使わない。使う必要がある場合は関数の中で取得する

### 秘匿値はスクリプトプロパティに置く

API キー・Webhook URL・トークンはコードに書かず、スクリプトプロパティに置く。キー名を `constants.js` の `PROPERTY_KEYS` に定義し、値は `getScriptProperty_` で取得する。値はリポジトリにコミットしない。

### 1 回の実行は 6 分まで

1 回の実行時間の上限は 6 分。時間主導型トリガーの合計実行時間にも 1 日あたりの上限がある（個人アカウントで 90 分、Google Workspace で 6 時間）。Ref: [Quotas for Google Services](https://developers.google.com/apps-script/guides/services/quotas)

- シートの読み書きは `getValues` / `setValues` でまとめて行い、セル単位のループで API を呼ばない
- 6 分を超えうる処理は分割する。処理済みの位置をスクリプトプロパティに保存し、時間主導型トリガーで続きから再開する

### トリガーは登録用の関数から作る

- トリガーは `trigger.js` の `setupTriggers` で登録する。何度実行しても重複しないよう、登録前に同じ関数のトリガーを消す
- 処理の中でトリガーを毎回作らない。1 つのスクリプトで 1 ユーザーが持てるトリガーは 20 個まで

## clasp の運用

- push の対象は `src/` 配下（`.clasp.json` の `rootDir`）。`.claude/` やドキュメントは push されない
- スクリプトエディタで直接編集しない。`clasp push` でエディタ側の内容が上書きされる。エディタで直した場合は、push の前に `clasp pull` で取り込む
- TypeScript は使わない。clasp は TypeScript を変換しないため、使うにはバンドラーの導入が要る
