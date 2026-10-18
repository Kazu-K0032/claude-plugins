# 入れるファイルの範囲

`SKILL.md` の「想定している引数」の対応表と、手順 4 で `--only` に並べるファイルを決める。引数が渡されたとき、または手順 4 でコピーするファイルを絞るときに読む。

## 引数の対応

| 引数の例 | 対象・扱い |
| --- | --- |
| `規約だけ` | `.claude/rules/wordpress.md`・`.claude/rules/wordpress-security.md`・`.claude/rules/wordpress-templates.md` だけ |
| `Lint だけ` | `wordpress/composer.json`・`wordpress/phpcs.xml.dist` だけ（手順 8 のフックも対象）。`vendor/`・`auth.json` が Git の対象外になっていなければ、`.gitignore` に足す案を出す |
| `Docker なし` | `wordpress/compose.yaml`・`wordpress/.env.example` を入れない。手順 2 で聞かない |
| `既存は置き換えない` | `DIFF` はすべて据え置き、手順 6 を飛ばす。手順 8 のフックと手順 9 の ADR の一覧は、既存のファイルでも追記する |

範囲を絞った場合は、`--check` の結果から対象ファイルの相対パスを確定し、手順 4 で `--only` に列挙する。`--only` に `DIFF` のファイルを含めると上書きになるため、**列挙するのは `NEW` のファイルだけ**にする。

## 手順 4 で `--only` に並べるファイル

次の場合は、入れるファイルを `--only` に列挙する。`--only` は「差分を承知で上書きする」という明示指定として扱われる。

| 場合 | `--only` に並べるもの |
| --- | --- |
| B | テーマの雛形を除いた `NEW` |
| C | `.claude/rules/wordpress.md`・`.claude/rules/wordpress-security.md`・`.claude/rules/wordpress-templates.md` だけ |
| Docker の雛形を入れない | `wordpress/compose.yaml`・`wordpress/.env.example` を除いた `NEW` |
| 範囲を絞った | 引数で指定した範囲の `NEW` |

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/install.sh" --skill wordpress --apply --only .claude/rules/wordpress.md .claude/rules/wordpress-security.md .claude/rules/wordpress-templates.md wordpress/composer.json wordpress/phpcs.xml.dist
```

2 回目以降の実行では、手順 5 で名前を変えたテーマは `wordpress/wp-content/themes/my-theme/` 配下が `NEW` に、置き換えたファイルは `DIFF` に出る。テーマの雛形は B と同じく入れず、仮の名前だけの差分は据え置く。
