# `CLAUDE_CODE_PLUGIN_DIRS` の読まれ方

手順 1・4 で `CLAUDE_CODE_PLUGIN_DIRS` を読む・直すときと、入れる先をユーザーの設定にする理由を説明するときに読む。

`CLAUDE_CODE_PLUGIN_DIRS` に書いたフォルダは、起動のたびに `--plugin-dir` と同じように読み込まれる。複数のパスは区切り文字でつなぐ（Windows は `;`、macOS・Linux は `:`）。`~` も使える。ユーザーの `settings.json` の `env` とプロセスの環境変数からだけ読まれ、プロジェクトの設定に書いても読まれない。
