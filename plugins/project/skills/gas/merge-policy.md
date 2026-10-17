# 衝突したファイルのマージ方針

`gas` の手順 5 で、`DIFF` のファイルがあるとき、上書き / 手でマージ / 据え置きを選んでもらう前に読む。ファイルごとの「上書きしない」「既存を正とする」は、選択肢を示すときに伝える。

| ファイル | マージ方針 |
| --- | --- |
| `src/appsscript.json` | 既存を正とする。`oauthScopes`・`dependencies`・`webapp` などの既存のキーは消さない。`timeZone`・`runtimeVersion` が違う場合は、変えるかを確認するだけにする |
| `.clasp.json` | 既存を正とする。`scriptId` は残し、`rootDir` は手順 3 で直した値（方針 A）か既存の値（方針 B。手順 1 で絶対パスを直すことにした場合は直した値）にする |
| `src/*.js` | 既存のコードを捨てない。上書きせず、手順 6 の振り分けで扱う |
| `.claude/rules/gas.md`・`.claude/rules/gas-runtime.md` | 既存の規約に足りない項目だけを足す |
