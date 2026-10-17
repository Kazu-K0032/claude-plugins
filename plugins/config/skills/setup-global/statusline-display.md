# ステータスラインの表示内容

同梱の `statusline.js` が出す内容。手順 3 で今のステータスラインと同梱版の違いを示すとき、表示について聞かれたとき（文字化けなど）に読む。

```text
 Model: Opus 5.5 (high)  Ctx: ▓▓▓░░░░░░░ 29% 57.0k  claude-plugins  issues/1-usage-feedback
 Total: 797.0k  Cost: $0.66  Time: 1h23m (API 12m)  Limit: 5h 24% ↻16:56 / 7d 84% ↻10/7 02:16
```

| 項目 | 内容 | 入力元 |
| --- | --- | --- |
| `Model` | モデルの表示名と、括弧内に推論の強さ（`low`〜`max`。対応しないモデルでは出ない） | `model.display_name`・`effort.level` |
| `Ctx` | 現在のコンテキストの使用率（10 マスのバーと %）と、載っている入力トークン数。使用率が 50% 以上で黄、80% 以上で橙になる | `context_window.used_percentage` / `total_input_tokens` |
| ディレクトリ・ブランチ | 作業ディレクトリ名と git ブランチ（長い場合は先頭を `…` で省略） | `workspace.current_dir`・`git branch --show-current` |
| `Total` | セッション内の全 API 呼び出しで処理したトークン数（入力・キャッシュ作成・出力。キャッシュ読み込みは含めない） | `transcript_path` の各応答の `usage` を合算 |
| `Cost` | セッションの推定コスト（USD） | `cost.total_cost_usd` |
| `Time` | セッションの経過時間と、括弧内に API の応答待ちの合計時間 | `cost.total_duration_ms` / `total_api_duration_ms` |
| `Limit` | 利用上限の 5 時間枠・7 日枠の消費率と、リセットされる時刻（`↻`）。高いほうの消費率で色が変わる（基準は `Ctx` と同じ） | `rate_limits.five_hour` / `seven_day` |

- `Limit` は claude.ai の Pro / Max プランでのみ、セッションの最初の応答の後から表示される
- 値が無い項目（初回応答前のコンテキストなど）は表示しない。入力の仕様は [ステータスラインの公式ドキュメント](https://code.claude.com/docs/ja/statusline) を参照
- 区切りの斜め三角は Powerline グリフ（Nerd Font 等）を使う。対応フォントが無い端末で文字化けする場合は、環境変数 `CLAUDE_STATUSLINE_PLAIN=1` を設定すると区切りなしの色帯表示になる（`settings.json` の `env` に入れればよい）
