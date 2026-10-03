#!/usr/bin/env bash
# SessionStart hook: セッション開始時に運用ルールをユーザーへ通知する。
cat <<'JSON'
{"systemMessage": "\n\n🚨 セッション運用ルール 🚨\n\n  → チャットのテーマが変わったら精度低下を防ぐために /clear を実行すること"}
JSON
