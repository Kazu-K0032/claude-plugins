# 動作の確かめ方

手順 5 で、配置・編集した `statusline.js` にサンプル入力を流すときに読む。エラーなく 2 行が出れば動いている。

```bash
echo '{"model":{"display_name":"Opus"},"effort":{"level":"high"},"workspace":{"current_dir":"'"$(pwd -W 2>/dev/null || pwd)"'"},"cost":{"total_cost_usd":0.12,"total_duration_ms":754000,"total_api_duration_ms":120000},"context_window":{"total_input_tokens":12000,"used_percentage":6},"rate_limits":{"five_hour":{"used_percentage":23,"resets_at":'"$(( $(date +%s) + 3600 ))"'}}}' | node ~/.claude/statusline/statusline.js
```

`pwd -W` は Git Bash で Windows 形式のパス（`C:/...`）を返す。Windows の Node.js は `/c/...` 形式を扱えず、ブランチが表示されなくなるため。
