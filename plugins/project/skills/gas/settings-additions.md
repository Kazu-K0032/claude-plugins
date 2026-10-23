# .claude/settings.json に足すフックと deny

`gas` の手順 8 で使う。`.claude/settings.json` に、次のうち無いものを足す案を差分で示し、承認を得てから足す。ほかのキーと書式は変えない。

## フック

この実行で `.claude/hooks/guard-clasp.sh` を入れ、`guard-clasp.sh` の行が無いときに足す。`hooks.PreToolUse` の `"matcher": "Bash|PowerShell|Monitor"` の `hooks` に次を足す。`"matcher": "Bash"`・`"Bash|PowerShell"`（古い `init-repo` の形）しか無ければ、その `matcher` を `"Bash|PowerShell|Monitor"` に直す案も差分に入れる。足りないと、PowerShell のツールや、コマンドを裏で動かす `Monitor` のツールで打った `clasp` を止められないため。どれも無ければ、`"matcher": "Bash|PowerShell|Monitor"` で `PreToolUse` に定義ごと足す。

```json
{
  "type": "command",
  "command": "bash .claude/hooks/guard-clasp.sh"
}
```

## deny

`permissions.deny` に、次のうち無い行を足す。`.clasprc.json` は clasp のログインで作られる認証情報で、Google アカウントへの権限を含むため、Claude に読ませない。`~/.clasprc.json` は、`clasp login` が保存する既定の場所。

```json
[
  "Read(./**/.clasprc.json)",
  "Read(~/.clasprc.json)"
]
```

## settings.json が無い場合

`.claude/settings.json` が無い場合は作らない。あとで `/project:init-repo` を入れると衝突するため。手順 10 で、上の定義と `/project:init-repo` を伝える。
