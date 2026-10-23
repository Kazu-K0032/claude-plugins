# 導入後にやること

`gas` の手順 9 で、コピーが終わった後に、残作業として利用者に示す。既存のプロジェクトで済んでいる項目は省く。

## 残作業

1. clasp を入れてログインする（`npm install -g @google/clasp` → `clasp login`）。初回は [Apps Script のユーザー設定](https://script.google.com/home/usersettings) で Google Apps Script API を有効にする
1. Apps Script のプロジェクトを用意し、エディタの「プロジェクトの設定」にあるスクリプト ID を `.clasp.json` の `scriptId` に書き込む
1. 既にコードがあるプロジェクトにつなぐ場合は、push の前に `clasp pull` で取り込み、手順 6 の振り分けを行う。pull するとリモートと同じ名前のローカルファイルはリモートの内容で上書きされる
1. `src/constants.js` の `TODO:` を埋める。秘匿値はエディタの「プロジェクトの設定」→「スクリプト プロパティ」に登録し、キー名を `PROPERTY_KEYS` に書く
1. `clasp push` で反映し、定期実行を使う場合はエディタから `setupTriggers` を 1 回実行する（初回は権限の承認を求められる）。以後も毎回同じ Google アカウントで実行する。`setupTriggers` は実行したアカウントのトリガーをすべて消してから `TRIGGERS` の分だけ作り直すため、そのアカウントで手作業で作ったトリガーも消える（手順 6 で一覧に書き移したものは作り直される）。別のアカウントで作ったトリガーは残る。定期実行を使わない場合は `trigger.js` の雛形を消す
1. `setupTriggers` を実行したら、「トリガー」画面の件数が `TRIGGERS` の件数と合うかを確かめる。多ければ、オーナーが「他のユーザー」のトリガーを、持ち主のアカウントで消してもらう
