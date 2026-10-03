# project

リポジトリ単位の規約・足場を導入する Skill 集。どの技術スタックでも使う土台（ハーネス設定・GitHub の定型ファイル・ドキュメントの骨組み）と、技術スタックごとのファイル構成・規約を、実行中のリポジトリへコピーする。

ユーザー全体（`~/.claude/`）の設定は [config](../config/README.md) が扱う。`config` はユーザー全体、`project` はリポジトリ単位と分担する。

## 収録スキル

| スキル | 用途 |
| --- | --- |
| [`/project:init-repo`](skills/init-repo/README.md) | ハーネス設定（`.claude/`）・GitHub の定型ファイル・エディタ設定・`.gitignore`・ドキュメントの骨組みをリポジトリへ導入 |
| [`/project:gas`](skills/gas/README.md) | Google Apps Script の `src/` 構成（`constants.js`・`main.js`・`utils.js`・`trigger.js`）と clasp の設定、GAS の実装規約を導入 |

技術スタック別の Skill は、土台を入れた後に重ねて使う想定。たとえば GAS のリポジトリでは `/project:init-repo` → `/project:gas` の順に実行する。どの Skill も手動でのみ呼ぶ（`disable-model-invocation: true`）ため、使わない技術スタックの Skill が入っていてもコンテキストを消費しない。

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
│   └── markdown.md         # markdownlint 準拠の書式（aidd と同じ内容のコピー）
└── skills/                 # 1 ディレクトリ 1 Skill
    ├── init-repo/
    │   ├── SKILL.md
    │   ├── README.md       # 収録物の一覧・除外したもの
    │   └── files/          # 導入先リポジトリのルートへ置く一式
    └── gas/
        ├── SKILL.md
        ├── README.md
        └── files/
```

## 設計上の決めごと

### 規約はリポジトリへコピーして配る

Claude Code の `.claude/rules/`（対象ファイルを開いた時に自動適用される規約）は、プラグインでは配布できない。そのため、各 Skill が規約ファイルを導入先の `.claude/rules/` へコピーする。コピーされた規約はプラグインの有無に関係なく効く。

`references/` は Skill の実行時に `SKILL.md` の指示で読ませる判断基準で、導入先へはコピーしない。両者の違いは [aidd の README](../aidd/README.md) の「references/ とは何か」を参照。

### インストーラは全 Skill で共有する

テンプレートを持つ Skill は、`skills/<Skill 名>/files/` にコピー元を置き、`scripts/install.sh --skill <Skill 名>` で導入する。状態判定（NEW / SAME / DIFF）と「既存ファイルは `--only` の明示指定なしに上書きしない」動きを、全 Skill で揃えるため。

技術スタック別の Skill を足すときは、`skills/<Skill 名>/` に `SKILL.md`・`README.md`（`files/...` の収録物表）・`files/` を置く。

### プラグインをまたぐファイルはコピーで持つ

プラグインはインストール時にそれぞれ単独でキャッシュへコピーされるため、別のプラグインのファイルは参照できない。`references/markdown.md` は `aidd` と同じ内容をこのプラグインにも置いている。片方を直したときは、もう片方も直すかを検討する（このリポジトリの `.claude/rules/duplicated-files.md` が対象のファイルの組を管理する）。
