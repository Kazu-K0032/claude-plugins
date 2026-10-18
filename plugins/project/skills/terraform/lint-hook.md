# Lint のフックに足す terraform fmt

`terraform` の手順 7 で、フックの形に合わせて足す定義。`.tfvars` を対象にしない。秘匿値を含むことがあり、差分が Claude に渡るため。

## lefthook の設定に足す定義

整形はファイルを書き換える。`*.tf` は `.tfvars` に一致しない。

```yaml
terraform-fmt:
  priority: 1
  glob: "*.tf"
  run: 'command -v terraform >/dev/null 2>&1 || exit 0; terraform fmt {staged_files}'
```

## 古い形の post-edit-lint.sh に足すブロック

整形は確かめるだけにする。

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
