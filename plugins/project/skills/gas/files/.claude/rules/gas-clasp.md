---
paths:
  - "src/**/*.js"
  - "src/**/*.html"
  - "src/appsscript.json"
---

# GAS を clasp で反映することに関するルール

clasp で Apps Script 側へ反映する（push する）ときの、対象・コミットするファイル・人が行う操作を決める。反映を誤ると、エディタ側の変更が消えたり、Claude が利用者の確認なしに本番のコードを書き換えたりするため。ファイルの書き分けと関数の命名は `.claude/rules/gas.md` にある。

## clasp で反映する場合

- push の対象は `.clasp.json` の `rootDir` 配下（`.claspignore` があれば、そこで除外したものを除く）。`rootDir` の外にある `.claude/` やドキュメントは push されない
- `.clasp.json` はコミットし、`.gitignore` に入れない。`scriptId` は秘匿値ではなく、clone してすぐ push できるようにするため。例外として、開発用と本番用で `scriptId` を切り替える運用の場合だけ、`.gitignore` に入れて手元で管理する
- `clasp push`・`pull`・`login` など、Apps Script 側への反映・取り込み・認証をするコマンドは、人が実行する。Claude は編集までを行い、実行を頼む。`.claude/hooks/guard-clasp.sh` が、Claude のこれらのコマンドを止める
- スクリプトエディタで直接編集しない。`clasp push` でエディタ側の内容が上書きされるため。エディタで直した場合は、push の前に `clasp pull` で取り込む
- TypeScript は使わない。clasp は TypeScript を変換しないため、使うにはバンドラーの導入が要る
