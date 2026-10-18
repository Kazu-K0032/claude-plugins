# 設定ファイルとフックへの追加

`SKILL.md` の手順 6・7・8 の細部。導入先の `.claude/settings.json`・Lint のフック・`cspell.json` に足すときに読む。

フックは `bash` と [`jq`](https://jqlang.org/) を使う。導入後の実行には Terraform が要る（このスキル自体はどちらも使わない）。`.claude/settings.json`・`CLAUDE.md` などの土台（`/project:init-repo`）は必須ではない。無ければ手順 1 で、先に入れるかを聞く。土台の `.claude/settings.json` があれば手順 6 でフックと deny を登録し、`lefthook.yml`（古い形では `.claude/hooks/post-edit-lint.sh`）があれば手順 7 で `terraform fmt` を足す。

## フックと deny を登録する

`.claude/settings.json` に、次のうち無いものを足す案を差分で示し、承認を得てから足す。ほかのキーと書式は変えない。引数が `規約だけ` のときは飛ばす。

- フック：この実行で `.claude/hooks/guard-terraform.sh` を入れ、`guard-terraform.sh` の行が無いとき。`hooks.PreToolUse` の `"matcher": "Bash"` の `hooks` に次を足す。`"matcher": "Bash"` の定義が無ければ、`PreToolUse` に定義ごと足す

    ```json
    {
      "type": "command",
      "command": "bash .claude/hooks/guard-terraform.sh"
    }
    ```

- deny：`permissions.deny` に、次のうち無い行を足す。変数の値・state・`.terraform/` は秘匿値を平文で含むため、Claude に読ませない

    ```json
    [
      "Read(./**/*.tfvars)",
      "Read(./**/*.tfvars.json)",
      "Read(./**/*.tfstate)",
      "Read(./**/*.tfstate.*)",
      "Read(./**/.terraform/**)"
    ]
    ```

`.claude/settings.json` が無い場合は作らない。あとで `/project:init-repo` を入れると衝突するため。手順 9 で、上の定義と `/project:init-repo` を伝える。

`.claude/hooks/guard-destructive.sh` に、`terraform plan` の `-out` を確かめるブロックや、`patterns` の Terraform の行（古い `init-repo` の形）があれば、変えない。手順 9 で、`guard-terraform.sh` と重なることを伝える。

## Lint のフックに terraform fmt を足す

`terraform fmt` を動かす定義が無ければ、フックの形に合わせて足す案を差分で示し、承認を得てから足す。`.tfvars` を対象にしないのは、秘匿値を含むことがあり、差分が Claude に渡るため。

| フックの形 | 足すもの・場所 |
| --- | --- |
| `post-edit-lint.sh` が `lefthook run claude-edit` を呼ぶ（今の `init-repo` の形） | lefthook の設定（`lefthook.yml`・`.lefthook.yml` など）の `claude-edit` の `commands` に、下の YAML を足す。`claude-edit` が無ければ、`piped: true` と一緒に定義ごと足す |
| `post-edit-lint.sh` に `[ -d "$LINT_DIR/node_modules/.bin" ] \|\| finish` の行がある（古い `init-repo` の形） | 下の bash のブロックを、その行より前に足す。後ろに足すと、Node を使わないリポジトリでブロックまで届かないため |
| 上の行が無く、`post-edit-lint.sh` に `# --- 言語別チェック` の区切りがある | 下の bash のブロックを、区切りのすぐ後ろに足す |
| `report`・`finish` を使っていない（`init-repo` 以外の形） | 書き換えず、下の bash のブロックを示して、利用者に足し方を決めてもらう |

フックが古い形のまま `lefthook.yml` もある（`init-repo` を入れ直し、フックを据え置いた）ときは、`lefthook.yml` に足しても動かない。`AskUserQuestion` で、次のどちらにするかを聞く。

| 選択肢 | 扱い |
| --- | --- |
| `lefthook.yml` に足す（推奨） | 下の YAML を足す。フックを今の形にするため、手順 9 で `/project:init-repo` を実行し、`post-edit-lint.sh` を上書きするよう伝える |
| 古い形のフックに足す | 下の bash のブロックを、上の表の古い形の行に従って足す |

`lefthook.yml` に足す定義。整形はファイルを書き換える。`*.tf` は `.tfvars` に一致しない。

```yaml
terraform-fmt:
  priority: 1
  glob: "*.tf"
  run: 'command -v terraform >/dev/null 2>&1 || exit 0; terraform fmt {staged_files}'
```

古い形の `post-edit-lint.sh` に足すブロック（整形は確かめるだけ）。

```bash
# Terraform: terraform fmt（整形の確認）
# .tfvars は秘匿値を含むことがあり、差分が Claude に渡るため検査しない
case "$file_path" in
  *.tf)
    if command -v terraform >/dev/null 2>&1; then
      result=$(terraform fmt -check -diff "$file_path" 2>&1 || true)
      if [ -n "$result" ]; then
        report+="⚠️  terraform fmt: $file_path"$'\n'"$result"$'\n'
      fi
    fi
    finish
    ;;
esac
```

`lefthook.yml`・`post-edit-lint.sh` が無い場合は、手順 9 で、`/project:init-repo` で入れられることを伝える。

## スペルチェックの除外語を足す

`cspell.json` があり、テンプレートと手順 6 の deny が使う語（`chdir`・`templatefile`・`tfstate`・`tftpl`・`tfvars`・`untaint`）が `words` に無ければ、足す案を示し、承認を得てから足す。足さないと、`init-repo` の `pr-checks.yml` のスペルチェックで誤字として出るため。
