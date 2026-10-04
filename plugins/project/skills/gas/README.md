# gas

Google Apps Script（GAS）のリポジトリへ「clasp で push する `src/` 配下の構成 ＋ ファイルの書き分けと GAS 特有の注意点をまとめた規約」を持ち込む Skill。

`files/` の中身がそのまま導入先リポジトリのルートに置かれる。

## 使い方

導入先のリポジトリのルートで Claude Code を開き、次を実行する。`.claude/settings.json`・`CLAUDE.md` などの土台も要るなら、先に `/project:init-repo` を実行しておく。

```text
/project:gas
```

衝突状況の確認 → 計画の提示 → 承認 → 既存コードの `src/` への移動（必要な場合） → コピー → 既存コードの振り分け → `.gitignore` の調整、の順に進む。

| 引数の例 | 動き |
| --- | --- |
| `規約だけ` | `.claude/rules/gas.md` だけを入れる |
| `src だけ` | `src/` 配下だけを入れる |
| `既存は置き換えない` | 既存ファイルに触らない |

既存の GAS コードがある場合は、規約に沿って関数をどのファイルへ移すかの案を出す。トリガー・カスタムメニュー・エディタの実行メニューから名前で呼ばれている関数は改名しない。コードが `src/` 以外にある場合は、先に `src/` へ移すか、今の場所のまま規約だけを入れるかを選ぶ。手順の詳細は [SKILL.md](SKILL.md) を参照。

Claude を介さず手で入れる場合は、スクリプトを直接叩いてもよい（リポジトリのルートで実行する）。

```bash
bash <plugin>/scripts/install.sh --skill gas --check  # 状態確認だけ
bash <plugin>/scripts/install.sh --skill gas --apply  # 未存在のファイルだけコピー
```

## 収録物

| パス | 内容 | 導入後の調整 |
| --- | --- | --- |
| `files/src/constants.js` | 複数の機能が使う定数とスクリプトプロパティのキー名 | `TODO:` を埋める |
| `files/src/main.js` | 中心となる業務フローの入口（`main`） | 業務フローの手順を書く。独立した機能が並ぶプロジェクトでは消し、`trigger.js` の `onDailySchedule` の呼び出し先も直す |
| `files/src/utils.js` | 複数の機能が使う関数（日時の整形・スクリプトプロパティの取得） | そのまま使える |
| `files/src/trigger.js` | 登録するトリガーの一覧（`TRIGGERS`）、今あるトリガーをすべて消して一覧の分だけ作り直す登録（`setupTriggers`）・すべての削除（`deleteTriggers`）と、毎日決まった時刻に呼ばれる入口（`onDailySchedule`） | 一覧と入口を直して、動かす時刻・間隔を変える。定期実行を使わないなら消す |
| `files/src/appsscript.json` | マニフェスト（タイムゾーン `Asia/Tokyo`・V8 ランタイム） | 使うサービス・権限に応じて追記する |
| `files/.clasp.json` | clasp の設定（`rootDir` を `src` にする） | `scriptId` を書き込む |
| `files/.claude/rules/gas.md` | ファイルの書き分け（使う範囲で置き場所を決める）・関数の命名・GAS 特有の注意点・clasp の運用 | そのまま使える |

## 前提と制約

- JavaScript（V8 ランタイム）だけを対象にする。clasp は TypeScript を変換しないため、TypeScript を使うにはバンドラー（Rollup 等）の導入が要る。Ref: [clasp](https://github.com/google/clasp)
- `.clasp.json` はコミットする前提にしている。`scriptId` は秘匿値ではなく、clone してすぐ push できるようにするため。開発用と本番用で `scriptId` を切り替える運用の場合は、`.gitignore` に入れて手元で管理する
- `.clasprc.json`（`clasp login --creds` で作業ディレクトリに保存される認証情報）は `.gitignore` に入れる。Skill が追記を提案する
- 秘匿値はスクリプトプロパティに置く前提にしている。`constants.js` にはキー名だけを書く
- トリガーは `trigger.js` の一覧（`TRIGGERS`）だけで管理する前提にしている。`setupTriggers` は今あるトリガーをすべて消してから作り直すため、エディタの「トリガー」画面で手作業で作ったトリガーは消える。既存のプロジェクトに入れる場合は、Skill が手作業のトリガーを一覧へ書き移す案を出す
- 既存の Apps Script プロジェクトに使う場合は、手元のコードをスクリプトエディタ側と揃えてから実行する。エディタで直接直した内容が手元に無いまま構成を変えて push すると、エディタ側の変更が消えるため。分からなければ先に `clasp pull` で取り込む（Skill は clasp を実行しない）

## 除外したもの

| 除外したもの | 理由 |
| --- | --- |
| `.claspignore` | `rootDir` を `src` にしているため、`src/` の外は push されない。指定しない場合の既定でも `appsscript.json` と JavaScript・HTML だけが対象になる。既存のコードを今の場所に残す場合で、`rootDir` 配下にツールの設定ファイルなど GAS ではない JavaScript があるときは、Skill が作成を提案する |
| `package.json`・ESLint の設定 | clasp をグローバルに入れる運用では不要。Lint を使うかはプロジェクトごとに決める |
| HTML（`HtmlService`）の雛形 | Web アプリ・サイドバーを作るかはプロジェクト次第のため |
| TypeScript・バンドラーの設定 | 上記「前提と制約」のとおり対象外 |
