#!/usr/bin/env node
// SessionStart フック。kazu マーケットプレイスのプラグインの不具合・改善案を、作業の区切りで起票するよう提案させる文面を出す。
//   additionalContext: Claude の文脈に入る文面（plugin-feedback.md）。毎セッション入れる
//   systemMessage: ユーザーに表示するお知らせ。config を入れて最初のセッションだけ出す
// 仕様: https://code.claude.com/docs/ja/hooks
// 環境変数 CLAUDE_PLUGIN_FEEDBACK=off で何も出さない（提案を止める）。

'use strict';

const fs = require('fs');
const path = require('path');

const NOTICE = [
  'kazu マーケットプレイス: プラグインの不具合や欲しい機能があれば、/config:plugin-feedback で報告してください。',
  '使い方: https://github.com/Kazu-K0032/claude-plugins',
  'このお知らせは初回だけ表示します。提案を止めるには、環境変数 CLAUDE_PLUGIN_FEEDBACK=off を設定してください。',
].join('\n');

// 表示済みの印。プラグインの更新後も残るデータ用フォルダ（CLAUDE_PLUGIN_DATA）に置く
const NOTICE_MARKER = 'plugin-feedback-notice-shown';

function main() {
  if ((process.env.CLAUDE_PLUGIN_FEEDBACK || '').toLowerCase() === 'off') return;

  const output = {};
  const context = readContext();
  if (context) output.hookSpecificOutput = { hookEventName: 'SessionStart', additionalContext: context };
  if (markNoticeShown()) output.systemMessage = NOTICE;
  if (Object.keys(output).length === 0) return;

  // JSON で返す場合、標準出力は JSON だけにする必要がある
  process.stdout.write(JSON.stringify(output));
}

function readContext() {
  try {
    return fs.readFileSync(path.join(__dirname, 'plugin-feedback.md'), 'utf8');
  } catch {
    // 文面が読めなくても、セッションの開始は妨げない
    return '';
  }
}

// 初回なら印を置いて true を返す。印を置けない環境では、毎回お知らせが出るのを避けるため false を返す
function markNoticeShown() {
  const dataDir = process.env.CLAUDE_PLUGIN_DATA;
  if (!dataDir) return false;
  const marker = path.join(dataDir, NOTICE_MARKER);
  try {
    if (fs.existsSync(marker)) return false;
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(marker, new Date().toISOString() + '\n');
    return true;
  } catch {
    return false;
  }
}

main();
