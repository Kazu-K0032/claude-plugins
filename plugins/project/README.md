# project

リポジトリ単位の規約・足場を導入する Skill 集。どの技術スタックでも使う土台（ハーネス設定・GitHub の定型ファイル・ドキュメントの骨組み）と、技術スタックごとのファイル構成・規約を、実行中のリポジトリへコピーする。

ユーザー全体（`~/.claude/`）の設定は [config](../config/README.md) が扱う。`config` はユーザー全体、`project` はリポジトリ単位と分担する。

## 収録スキル

| スキル | 用途 |
| --- | --- |
| [`/project:init-repo`](skills/init-repo/README.md) | ハーネス設定（`.claude/`）・GitHub の定型ファイル・エディタ設定・スペルチェックの設定・`.gitignore`・ドキュメントの骨組みをリポジトリへ導入 |
| [`/project:gas`](skills/gas/README.md) | Google Apps Script の `src/` 構成（`constants.js`・`main.js`・`utils.js`・`trigger.js`）と clasp の設定、Claude に `clasp push` などをさせないフック、GAS の実装規約を導入 |
| [`/project:wordpress`](skills/wordpress/README.md) | WordPress の `wordpress/wp-content/` 構成（クラシックテーマの最小構成・mu-plugins）と Docker のローカル環境・PHP の Lint（phpcs）の設定、WordPress の実装規約を導入 |
| [`/project:terraform`](skills/terraform/README.md) | Terraform の `infra/` 構成（環境ごとの設定 `stg`・`prod` と `modules/`）、Claude に apply などをさせないフック、Terraform の実装規約を導入 |

技術スタック別の Skill は、土台を入れた後に重ねて使う想定。たとえば GAS のリポジトリでは `/project:init-repo` → `/project:gas` の順に実行する。`init-repo` は最後に、続けて使う Skill を聞く。技術スタック別の Skill は、土台（`.claude/settings.json`）が無ければ、先に `init-repo` を実行するかを聞く。どの Skill も手動でのみ呼ぶ（`disable-model-invocation: true`）ため、使わない技術スタックの Skill が入っていてもコンテキストを消費しない。

## 導入

新しいリポジトリの立ち上げで使うため、**user スコープ**でインストールする。project スコープで入れると、導入先の `.claude/settings.json` に登録が書き込まれ、`/project:init-repo` がコピーする `.claude/settings.json` と衝突する。

```bash
/plugin install project@kazu
```

## ディレクトリ構成

```text
project/
├── .claude-plugin/
│   └── plugin.json         # プラグインのマニフェスト
├── scripts/
│   └── install.sh          # 全 Skill 共通のインストーラ（--skill <Skill 名> でコピー元を切り替える）
├── references/
│   ├── markdown.md         # markdownlint 準拠の書式（aidd と同じ内容のコピー）
│   ├── install-flow.md     # 全 Skill 共通のコピーの流れ（NEW / SAME / DIFF・--only・衝突の片付け・テンプレートのリンク）
│   ├── init-repo-first.md  # 技術スタック別の Skill が、先に init-repo を入れるかを聞く手順
│   └── lint-hook-shapes.md # wordpress・terraform が、Lint のフックの形を見分けて足す手順
└── skills/                 # 1 ディレクトリ 1 Skill
    ├── init-repo/
    │   ├── SKILL.md
    │   ├── *.md            # SKILL.md が手順の中で読む参照ファイル（収録物と要否・マージ方針など）
    │   ├── README.md       # 収録物の一覧・除外したもの
    │   └── files/          # 導入先リポジトリのルートへ置く一式
    ├── gas/
    │   ├── SKILL.md
    │   ├── *.md
    │   ├── README.md
    │   └── files/
    ├── wordpress/
    │   ├── SKILL.md
    │   ├── *.md
    │   ├── README.md
    │   ├── adr/            # 利用先の ADR の置き場所へ書く ADR の元
    │   └── files/
    └── terraform/
        ├── SKILL.md
        ├── *.md
        ├── README.md
        └── files/
```

`SKILL.md` には手順の本筋だけを書き、細部（判定の表・マージ方針・フックに足す定義・導入後にやること）は同じフォルダの参照ファイルか `references/` に分ける。`SKILL.md` の「参照ファイル」の表から 1 段で指し、いつ読むかを書く（[P9](../../docs/policies/p09-readable-ai-docs.md)）。

## 設計上の決めごと

### 土台と技術スタック別の Skill の役割を分ける

`init-repo`（土台）はハーネスの設計思想だけを配り、言語・ツールに依るものは技術スタック別の Skill が土台の差し込み口に足す。何を土台に入れ、どこに足してよいかは [P6](../../docs/policies/p06-common-template.md) にある。

### 規約はリポジトリへコピーして配る

Claude Code の `.claude/rules/`（対象ファイルを開いた時に自動適用される規約）は、プラグインでは配布できない。そのため、各 Skill が規約ファイルを導入先の `.claude/rules/` へコピーする。コピーされた規約はプラグインの有無に関係なく効く。

`references/` は Skill の実行時に `SKILL.md` の指示で読ませる判断基準で、導入先へはコピーしない。両者の違いは [aidd の README](../aidd/README.md) の「references/ とは何か」を参照。

コピーした規約は、プラグインを更新しても書き換わらない。規約を直したときは、PR の「利用先への影響」に、Skill を再実行すれば差分を取り込めることを書く。

### インストーラは全 Skill で共有する

テンプレートを持つ Skill は、`skills/<Skill 名>/files/` にコピー元を置き、`scripts/install.sh --skill <Skill 名>` で導入する。状態判定（NEW / SAME / DIFF）と「既存ファイルは `--only` の明示指定なしに上書きしない」動き（[P1](../../docs/policies/p01-operation-boundary.md)）を、全 Skill で揃えるため。

技術スタック別の Skill を足すときは、`skills/<Skill 名>/` に `SKILL.md`・`README.md`（`files/...` の収録物表）・`files/` を置く。コピーや衝突の片付けなど、4 つの Skill で重なる手順は `references/`（`install-flow.md`・`init-repo-first.md`・`lint-hook-shapes.md`）を使う。

### プラグインをまたぐファイルはコピーで持つ

`references/markdown.md` は `aidd` と同じ内容をこのプラグインにも置いている（理由は [P5](../../docs/policies/p05-standalone-plugin.md)）。片方を直したときは、もう片方も直すかを検討する（このリポジトリの `.claude/rules/duplicated-files.md` が対象のファイルの組を管理する）。
