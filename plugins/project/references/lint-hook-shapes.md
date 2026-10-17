# Lint のフックの形と足し方

`wordpress`・`terraform` が、編集後の Lint のフックに検査を足すときに使う。土台のフックには今の形と古い形があり、足す場所が違うため、形を見分けてから足す。足す定義（lefthook の設定に足す YAML と、古い形のフックに足す bash のブロック）は、スキルごとに違う。

## フックの形を見分ける

検査を動かす定義が無ければ、フックの形に合わせて足す案を差分で示し、承認を得てから足す。

| フックの形 | 足すもの・場所 |
| --- | --- |
| `post-edit-lint.sh` が `lefthook run claude-edit` を呼ぶ（今の `init-repo` の形） | lefthook の設定（`lefthook.yml`・`.lefthook.yml` など）の `claude-edit` の `commands` に、スキルの YAML を足す。`claude-edit` が無ければ、`piped: true` と一緒に定義ごと足す |
| `post-edit-lint.sh` に `[ -d "$LINT_DIR/node_modules/.bin" ] \|\| finish` の行がある（古い `init-repo` の形） | スキルの bash のブロックを、その行より前に足す。後ろに足すと、Node を使わないリポジトリでブロックまで届かないため |
| 上の行が無く、`post-edit-lint.sh` に `# --- 言語別チェック` の区切りがある | スキルの bash のブロックを、区切りのすぐ後ろに足す |
| `report`・`finish` を使っていない（`init-repo` 以外の形） | 書き換えず、スキルの bash のブロックを示して、利用者に足し方を決めてもらう |

## 古い形のフックと lefthook.yml が両方ある場合

フックが古い形のまま `lefthook.yml` もある（`init-repo` を入れ直し、フックを据え置いた）ときは、`lefthook.yml` に足しても動かない。`AskUserQuestion` で、次のどちらにするかを聞く。

| 選択肢 | 扱い |
| --- | --- |
| `lefthook.yml` に足す（推奨） | スキルの YAML を足す。フックを今の形にするため、導入後にやることで、`/project:init-repo` を実行し、`post-edit-lint.sh` を上書きするよう伝える |
| 古い形のフックに足す | スキルの bash のブロックを、上の表の古い形の行に従って足す |

## フックが無い場合

`lefthook.yml`・`post-edit-lint.sh` が無い場合は、導入後にやることで、`/project:init-repo` で入れられることを伝える。
