# .claude/settings.json に足すフックと deny

`terraform` の手順 6 で使う。`.claude/settings.json` に、次のうち無いものを足す案を差分で示し、承認を得てから足す。ほかのキーと書式は変えない。

## フック

この実行で `.claude/hooks/guard-terraform.sh` を入れ、`guard-terraform.sh` の行が無いときに足す。`hooks.PreToolUse` の `"matcher": "Bash|PowerShell|Monitor"` の `hooks` に次を足す。`"matcher": "Bash"`・`"Bash|PowerShell"`（古い `init-repo` の形）しか無ければ、その `matcher` を `"Bash|PowerShell|Monitor"` に直す案も差分に入れる。足りないと、PowerShell のツールや、コマンドを裏で動かす `Monitor` のツールで打った `terraform` を止められないため。どれも無ければ、`"matcher": "Bash|PowerShell|Monitor"` で `PreToolUse` に定義ごと足す。

```json
{
  "type": "command",
  "command": "bash .claude/hooks/guard-terraform.sh"
}
```

## deny

`permissions.deny` に、次のうち無い行を足す。変数の値・state・`.terraform/` は秘匿値を平文で含むため、Claude に読ませない。

```json
[
  "Read(./**/*.tfvars)",
  "Read(./**/*.tfvars.json)",
  "Read(./**/*.tfstate)",
  "Read(./**/*.tfstate.*)",
  "Read(./**/.terraform/**)"
]
```

## settings.json が無い場合

`.claude/settings.json` が無い場合は作らない。あとで `/project:init-repo` を入れると衝突するため。手順 9 で、上の定義と `/project:init-repo` を伝える。

## guard-destructive.sh に古い Terraform の検出がある場合

`.claude/hooks/guard-destructive.sh` に、`terraform plan` の `-out` を確かめるブロックや、`patterns` の Terraform の行（古い `init-repo` の形）があれば、変えない。手順 9 で、`guard-terraform.sh` と重なることを伝える。
