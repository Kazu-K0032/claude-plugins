# CLAUDE.md

このファイルは、このリポジトリ内のコードを扱う際に、Claude Code (claude.ai/code) にガイダンスを提供するものです。

## 絶対禁止

例外なく守る。違反は即アウトで、判断の余地はない。

- SSOT を破る重複記述をしない。唯一の情報源にリンクで紐づける
- 未読の既存ファイルに Write しない
- データ消失・課金影響・履歴破壊を伴う操作を無断実行しない
- トークン・パスワード・署名付き URL・Webhook URL などの秘密を、Issue・PR・コメント・コミット・ファイルに書かない。コマンドの出力に含まれていても写さない
- ドキュメントを無断で自動編集しない。提案にとどめる（条件は「ドキュメント更新を提案するとき」を参照）。承認を受けた作業の続きとして、スキルの手順が直すと決めているもの（`/aidd:issue-start` の文書の点検など）は除く
- 未検証のパッケージ版・Docker イメージタグ・クラウド設定値を「確認済み」と断定しない

## 手順ルール

行為自体は許可される。やる前に必ず次を踏む。

### 破壊的操作の前

データ消失・課金影響・履歴破壊を伴う操作（検出対象は [`guard-destructive.sh`](.claude/hooks/guard-destructive.sh) の `patterns` を正典とする）を実行する前に、次を踏む。

- 削除・変更される対象を列挙する
- 対象が実データ（本番環境・データベース・インフラの state・アップロード済みメディア等）を含まないか点検し、含む場合は明示承認を待つ
- 復元不可の削除（スナップショット無しのインスタンス削除等）は、バックアップ取得の要否を先に確認する
- IaC 統合・リソース再作成は、既存リソースに `import` を伴うか確認し、ステートフルなリソースの replace を避ける
- 例示値・プレースホルダ ID（レコード ID・リソース ID 等）をそのまま実行しない。破壊的コマンドは対象の実 ID を確認してから実行する

### ファイル編集の前

- 既存の可能性があるファイルは必ず Read してから書く
- 複数ファイルを編集する前に、どのファイルをなぜ変更するかを述べる。実装ファイルとテストファイルを取り違えない

### 権限の設定を変える前

- `.claude/settings.json` の deny・フックを足す・外す前に、[`.claude/rules/permissions.md`](.claude/rules/permissions.md) の線引き（Claude に任せる操作と人が行う操作）に当てる

### 実装がひと区切りついたとき

1 つの目的の変更を終え、確かめ（テスト・lint など）が通ったら、次を踏む。

- その区切りで直したファイルだけを `git add` でステージに置く
- `/aidd:commit` の手順（`~/.claude/plugins/cache/` の下の aidd プラグインにある `skills/commit/SKILL.md`）で、コミットメッセージを `tmp.md` に書く。スキルが見つからなければ、利用者に `/aidd:commit` の実行を頼む
- コミット・push はしない。利用者が `tmp.md` を見てコミットする

### 大規模ランの前

監査・移行・多数ファイル修正など、1 セッションで終わらない規模の作業を始める前に、次を踏む。

- 最初からスコープを分割し、1 セッションで完了できる単位に収める
- 長い操作の前にステップ化し、進捗を `tmp/<ブランチ名>/work/<目的>/` のチェックポイントに残す（置き方は [`.claude/rules/tmp-output.md`](.claude/rules/tmp-output.md)）。セッションが中断しても次セッションが再開できる状態を保つ

### ドキュメント更新を提案するとき

- 今回の変更が触ったコード/インフラと、既存ドキュメントの記述が食い違うとき
- ユーザーの指示が既存の禁止事項と矛盾するとき、または新しい恒久ルールとして残すべき指示があったとき
- README.md / CLAUDE.md / docs/ の SSOT が崩れる変更を加えたとき

### 「反映されない」と判断する前

- 「変更が効かない／反映されない」と診断する前に、編集したファイルが実際に配信・マウントされている実体と一致するか確認する
- TODO: このリポジトリ固有の配信経路（Docker のマウント元・ビルド成果物の出力先・有効なテーマ／プラグイン等）を列挙する
- ブラウザキャッシュ／CDN を疑う前に、上記のローカル配信経路の一致を先に潰す

### 事実を確認できないとき

- 公式レジストリ／ドキュメントで確認できない場合は、その旨を明示する
- URL・パッケージ版・リリース情報は記憶で書かず、一次情報／公式リリースページで裏取りしてから引用する

## リポジトリガイド

### ドキュメント構成

- 文書を `docs/` のどのディレクトリに置くかは、[`docs/README.md`](docs/README.md) の振り分けに従う
- README の役割（本文を持たない案内板）・どこまで案内するか・いつリンクを足すかは、[`.claude/rules/readme.md`](.claude/rules/readme.md) に従う
- `docs/` の `*.template.*` は、実物の雛形。実物を作ったら、雛形の削除を利用者に提案する（手順は [`docs/README.md`](docs/README.md) の「雛形から実物を作るとき」）。削除は人が行う

### コメント文

全てのコメントは日本語で書くこと。実装ファイルや設定ファイルなど、全てのファイルが対象。

### SSOT 一覧

情報の唯一の所在を以下に定める。本表に該当する情報は、他ファイルに再掲せず相対パスでリンクで参照する。

TODO: このリポジトリで実際に存在する文書に合わせて行を足し引きする。`docs/specs/`・`docs/architecture/` の文書は、雛形から実物を作った後のパス。

| 情報 | 唯一の情報源 |
| --- | --- |
| ドキュメント全体の案内 | `docs/README.md` |
| ディレクトリ構造 | `CLAUDE.md` |
| 機能要件・非機能要件 | `docs/specs/specifications.md` |
| コマンド一覧 | `docs/runbook/commands.md` |
| 環境構築 | `docs/runbook/environment-setup.md` |
| デプロイ手順 | `docs/runbook/deployment.md` |
| アーキテクチャ概要 | `docs/architecture/architecture.md` |
| AI 駆動開発の戦略（AI・機械・人の分担） | `docs/strategies/ai-driven-development.md` |
| 開発の流れ | `docs/strategies/development.md` |
| テスト戦略 | `docs/strategies/test-strategy.md` |
| コミットルール | このリポジトリのコミット規約の文書。無ければ aidd プラグインの `/aidd:commit` 同梱の commit-rule |

### ディレクトリ

TODO: 実際の構成に書き換える。各行のコメントは「そのディレクトリが何を持つか」を 1 行で説明する。

```text
<repository-name>/
├── .claude/
│   ├── hooks/                            # Claude Code のフック（ガード・Lint・セッション通知）
│   ├── rules/                            # 規約（コメント・環境変数・README・GitHub Actions・ADR・ブランチ名・権限・tmp への出力・AI が読む文書）。`paths` を持つものは、対象のファイルを開いたときだけ読み込まれる
│   └── settings.json                     # 権限・フックの設定（コミット対象）
├── .vscode/                              # エディタ設定（推奨拡張機能・保存時の整形）
├── .github/
│   ├── dependabot.yml                    # 依存パッケージ更新（GitHub Actions 限定・月次）
│   ├── labels.yml                        # GitHub ラベル定義（sync-labels.yml が同期）
│   ├── ISSUE_TEMPLATE/                   # Issue フォーム（feature / bug / refactor / release / retro）
│   └── workflows/                        # CI/CD
├── docs/
│   ├── README.md                         # 全ドキュメントの案内板
│   ├── specs/                            # 要件定義書（機能・非機能要件）。雛形は specifications.template.md
│   ├── architecture/                     # アーキテクチャ図（.drawio と書き出した .png）・CI/CD・全体構成。雛形は architecture.template.*
│   ├── strategies/                       # AI 駆動開発の戦略・開発の流れ・テストの方針
│   ├── adr/                              # ADR（個別判断の履歴）。雛形は YYYY-MM-DD-判断の対象.template.md
│   └── runbook/                          # 環境構築・デプロイ・運用の手順
├── .gitattributes                        # シェルスクリプト（*.sh）の改行を LF に固定する
├── .gitignore
├── cspell.json                           # スペルチェックの設定と除外語（VS Code の拡張機能と CI が共有）
├── lefthook.yml                          # Lint・整形のツール（編集後のフックが使う）と、コミットのメッセージの検査の定義
└── README.md
```

### 参照ドキュメント

セッション開始時に常時読ませたい文書を @import する。まだ無い文書（雛形から実物を作る前のもの）は、読み込まれずに無視される。実物を作ると、次のセッションから自動で読み込まれる。

TODO: コマンド一覧など、常に読ませたい文書があれば、同じ形で足す。

@README.md
@docs/adr/README.md
@docs/specs/specifications.md
@docs/architecture/architecture.md
