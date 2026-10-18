# フックへの PHP の Lint と Docker の検出の追加

手順 8 で、フックに PHP の Lint と Docker の検出を足すときに読む。

## PHP の Lint

`phpcs` を動かす定義が無ければ、フックの形に合わせて足す案を差分で示し、承認を得てから足す。C の場合は、パスを今の場所に合わせる。

| フックの形 | 足すもの・場所 |
| --- | --- |
| `post-edit-lint.sh` が `lefthook run claude-edit` を呼ぶ（今の `init-repo` の形） | lefthook の設定（`lefthook.yml`・`.lefthook.yml` など）の `claude-edit` の `commands` に、下の YAML を足す。`claude-edit` が無ければ、`piped: true` と一緒に定義ごと足す |
| `post-edit-lint.sh` に `[ -d "$LINT_DIR/node_modules/.bin" ] \|\| finish` の行がある（古い `init-repo` の形） | 下の bash のブロックを、その行より前に足す。後ろに足すと、Node を使わないリポジトリでブロックまで届かないため |
| 上の行が無く、`post-edit-lint.sh` に `# --- 言語別チェック` の区切りがある | 下の bash のブロックを、区切りのすぐ後ろに足す |
| `report`・`finish` を使っていない（`init-repo` 以外の形） | 書き換えず、下の bash のブロックを示して、利用者に足し方を決めてもらう |

フックが古い形のまま `lefthook.yml` もある（`init-repo` を入れ直し、フックを据え置いた）ときは、`lefthook.yml` に足しても動かない。`AskUserQuestion` で、次のどちらにするかを聞く。

| 選択肢 | 扱い |
| --- | --- |
| `lefthook.yml` に足す（推奨） | 下の YAML を足す。フックを今の形にするため、手順 10 で `/project:init-repo` を実行し、`post-edit-lint.sh` を上書きするよう伝える |
| 古い形のフックに足す | 下の bash のブロックを、上の表の古い形の行に従って足す |

`lefthook.yml` に足す定義。検査するのは、`phpcs.xml.dist` の `<file>` と同じく、テーマと mu-plugins だけにする。`{staged_files}` は `root` からの相対パスになり、`glob` はリポジトリのルートから数える。

```yaml
phpcs:
  priority: 2
  root: "wordpress/"
  glob: "wordpress/wp-content/{themes,mu-plugins}/*.php"
  run: '[ -x vendor/bin/phpcs ] || exit 0; ./vendor/bin/phpcs -q {staged_files}'
```

古い形の `post-edit-lint.sh` に足すブロック。

```bash
# PHP: phpcs（WordPress のコーディング規約）。設定は PHP_LINT_DIR の phpcs.xml.dist
# 検査するのは、phpcs.xml.dist の <file> と同じく、テーマと mu-plugins だけ
PHP_LINT_DIR="wordpress"
case "$file_path" in
  "$PHP_LINT_DIR"/wp-content/themes/*.php | "$PHP_LINT_DIR"/wp-content/mu-plugins/*.php)
    if [ -x "$PHP_LINT_DIR/vendor/bin/phpcs" ]; then
      result=$( (cd "$PHP_LINT_DIR" && ./vendor/bin/phpcs -q "${file_path#"$PHP_LINT_DIR"/}" 2>&1) || true)
      if [ -n "$result" ]; then
        report+="⚠️  phpcs: $file_path"$'\n'"$result"$'\n'
      fi
    fi
    finish
    ;;
esac
```

## Docker の検出

Docker の雛形を入れた、またはローカル環境のファイルがあり（手順 1）、`.claude/hooks/guard-destructive.sh` の `patterns` に `docker compose down` の行が無ければ、次の行を `patterns` に足す案を差分で示し、承認を得てから足す。`docker compose down -v` は、DB のデータを入れた volume まで消すため。

```bash
# コンテナと named volume を削除する。DB のデータが消えると、サイトの全コンテンツが失われる
'docker[[:space:]]+compose[[:space:]]+down[[:space:]].*-v'
'docker-compose[[:space:]]+down[[:space:]].*-v'
```

`lefthook.yml`・`post-edit-lint.sh`・`guard-destructive.sh` が無い場合は、手順 10 で、`/project:init-repo` で入れられることを伝える。
