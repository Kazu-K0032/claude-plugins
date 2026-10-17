# フックに足す PHP の Lint と Docker の検出

`wordpress` の手順 8 で使う。どちらも、足す案を差分で示し、承認を得てから足す。C の場合は、パスを今の場所に合わせる。

## PHP の Lint：lefthook の設定に足す定義

`phpcs` を動かす定義が無いときに足す。検査するのは、`phpcs.xml.dist` の `<file>` と同じく、テーマと mu-plugins だけにする。`{staged_files}` は `root` からの相対パスになり、`glob` はリポジトリのルートから数える。

```yaml
phpcs:
  priority: 2
  root: "wordpress/"
  glob: "wordpress/wp-content/{themes,mu-plugins}/*.php"
  run: '[ -x vendor/bin/phpcs ] || exit 0; ./vendor/bin/phpcs -q {staged_files}'
```

## PHP の Lint：古い形の post-edit-lint.sh に足すブロック

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

Docker の雛形を入れた、またはローカル環境のファイルがあり（手順 1）、`.claude/hooks/guard-destructive.sh` の `patterns` に `docker compose down` の行が無ければ、次の行を `patterns` に足す。`docker compose down -v` は、DB のデータを入れた volume まで消すため。

```bash
# コンテナと named volume を削除する。DB のデータが消えると、サイトの全コンテンツが失われる
'docker[[:space:]]+compose[[:space:]]+down[[:space:]].*-v'
'docker-compose[[:space:]]+down[[:space:]].*-v'
```

`guard-destructive.sh` が無い場合は、手順 10 で、`/project:init-repo` で入れられることを伝える。
