# エディタ設定・Lint と整形のツール・スペルチェックの除外語

手順 5 で、導入先のプロジェクトに合わせて `.vscode/extensions.json`・`lefthook.yml`・`cspell.json` の中身を決めるときの手順をまとめる。

## 推奨拡張機能（`.vscode/extensions.json`）

ルートのファイルから技術スタックを判定し、`recommendations` に足す拡張機能を提案する。

| 判定に使うファイル | 提案する拡張機能の例 |
| --- | --- |
| `package.json`（`eslint` / `prettier` / `typescript` / `tailwindcss` 等の依存） | `dbaeumer.vscode-eslint`・`esbenp.prettier-vscode`・`bradlc.vscode-tailwindcss` |
| `pyproject.toml` / `requirements.txt` | `ms-python.python`・`charliermarsh.ruff` |
| `go.mod` | `golang.go` |
| `Cargo.toml` | `rust-lang.rust-analyzer` |
| `*.tf` | `hashicorp.terraform` |
| `Dockerfile` / `compose.yaml` | `ms-azuretools.vscode-docker` |

表にない技術は、公式に推奨されている拡張機能を調べてから提案する。拡張機能 ID の推測で書かない。

## Lint と整形のツール（`lefthook.yml` の `claude-edit`）

土台が持つのは、推論（Claude）と機械の検査を分ける仕組みだけである。どのツールを使うかはプロジェクトが決めるため、次の順で決めて `claude-edit` の `commands` に足す。別名の設定（`.lefthook.yml` など）を使っているときは、そのファイルに足す。`claude-edit` が無ければ、`piped: true` と一緒に定義ごと足す。

1. 引数でツールを指定されていれば、それを使う
1. 指定が無ければ、既存の設定を Glob で探す（例：`biome.json`・`.oxlintrc.json`・`eslint.config.*`・`.prettierrc*`・`ruff.toml`・`pyproject.toml`・`.golangci.*`、`package.json` の `scripts` の `lint`・`format`）。あれば、それを使う
1. どちらも無ければ、`AskUserQuestion` で候補を出す。「使わない」も選択肢に入れる。候補は、公式の文書で今の状態（安定版か・最新の版）を確かめてから出す。状態や版を推測で書かない。JS/TS の例：整形は oxfmt（ベータ）、Lint は oxlint、両方を 1 つで扱う Biome

`commands` は次の決まりで書く。

- 整形のツールはファイルを書き換える形にし、`priority: 1` にする。Lint のツールは、警告でも 0 以外で終える形（例：oxlint の `--deny-warnings`）にし、`priority: 2` にする。失敗した結果だけが Claude に返る
- ツールが入っていないときは黙って飛ばす。`npm` で入れたツールは PATH に無いため、`node_modules/.bin/` の下を指す
- `run` に二重引用符を書かない。Windows では、二重引用符を含むコマンドが崩れる。全体を単一引用符で囲む
- ツールの置き場所がルートでないときは、`root` にそのディレクトリを書く。`{staged_files}` は `root` からの相対パスになる。`glob` は `root` に関係なく、リポジトリのルートから数える

```yaml
claude-edit:
  piped: true
  commands:
    format:
      priority: 1
      glob: "*.{js,jsx,ts,tsx}"
      run: '[ -x node_modules/.bin/oxfmt ] || exit 0; node_modules/.bin/oxfmt {staged_files}'
    lint:
      priority: 2
      glob: "*.{js,jsx,ts,tsx}"
      run: '[ -x node_modules/.bin/oxlint ] || exit 0; node_modules/.bin/oxlint --deny-warnings {staged_files}'
```

ツールの導入（`npm install` など）は人が行う。手順 6 で伝える。

## スペルチェックの除外語（`cspell.json` の `words`）

除外語は `.vscode/settings.json` の `cSpell.words` ではなく `cspell.json` に置く。VS Code の拡張機能と cspell の CLI（`pr-checks.yml` のスペルチェック）の両方が読むのは `cspell.json` だけのため。テンプレート自身が使う語（`aidd`・`ssot` 等）は登録済み。

次から固有名詞・技術用語の候補を集め、重複を除いて小文字で並べる。

- `package.json` などの依存パッケージ名・プロジェクト名
- ルート直下のディレクトリ名・主要なファイル名
- `README.md` / `CLAUDE.md` / `docs/` に出てくるサービス名・製品名・略語
- 上の小節で `lefthook.yml` に書いたツール名・オプション（PR のスペルチェックは `lefthook.yml` も検査する）

`npx` が使える環境では、次の結果も候補に加えてよい（初回はパッケージの取得が走る）。

```bash
npx --yes cspell@9.8.0 lint --no-progress --words-only --unique --dot --gitignore --exclude ".git/**" "**/*.{md,ts,tsx,js,jsx,py,go,rs,json,yml,yaml}"
```

- 版は `pr-checks.yml` のスペルチェックとそろえる。版を固定しないと最新版が使われ、最新版が要求する Node より手元の Node が古いと失敗する
- `--dot` は `.claude/`・`.github/` などドット始まりのディレクトリも対象にする（既定では検査しない）。`--exclude ".git/**"` は、そのときに `.git/` の中まで検査しないためのもの

一般的な英単語の誤字は候補から外す。除外語に入れるのは「正しい綴りだが辞書に無い語」だけ。`pr-checks.yml` を入れた場合、ここで登録しなかった語は PR のスペルチェックで誤字として出る。
