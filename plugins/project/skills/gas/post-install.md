# 導入後にやること

`SKILL.md` の手順 8 で、ユーザーに提示する残作業。導入後の push には Node.js と [clasp](https://github.com/google/clasp) が要る（このスキル自体は clasp を使わない）。

1. clasp を入れてログインする（`npm install -g @google/clasp` → `clasp login`）。初回は [Apps Script のユーザー設定](https://script.google.com/home/usersettings) で Google Apps Script API を有効にする
1. Apps Script のプロジェクトを用意し、エディタの「プロジェクトの設定」にあるスクリプト ID を `.clasp.json` の `scriptId` に書き込む
1. 既にコードがあるプロジェクトにつなぐ場合は、push の前に `clasp pull` で取り込み、手順 6 の振り分けを行う。pull するとリモートと同じ名前のローカルファイルはリモートの内容で上書きされる
1. `src/constants.js` の `TODO:` を埋める。秘匿値はエディタの「プロジェクトの設定」→「スクリプト プロパティ」に登録し、キー名を `PROPERTY_KEYS` に書く
1. `clasp push` で反映し、定期実行を使う場合はエディタから `setupTriggers` を 1 回実行する（初回は権限の承認を求められる）。実行するアカウントと、手作業で作ったトリガーの扱いは、`gas-runtime.md` の「トリガーを登録・変更する場合」に従う（手順 6 で一覧に書き移したものは作り直される）。定期実行を使わない場合は `trigger.js` の雛形を消す
1. `setupTriggers` を実行したら、「トリガー」画面の件数が `TRIGGERS` の件数と合うかを確かめる。多い場合の扱いも、`gas-runtime.md` の「トリガーを登録・変更する場合」に従う
