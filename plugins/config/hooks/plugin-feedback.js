#!/usr/bin/env node
// SessionStart フック。kazu マーケットプレイスのプラグインの不具合・改善案を、作業の区切りで起票するよう提案させる文面を出す。
// SessionStart ではプレーンテキストの標準出力がそのまま Claude の文脈に入る。
// 仕様: https://code.claude.com/docs/ja/hooks
// 環境変数 CLAUDE_PLUGIN_FEEDBACK=off で何も出さない（提案を止める）。

'use strict';

const fs = require('fs');
const path = require('path');

function main() {
  if ((process.env.CLAUDE_PLUGIN_FEEDBACK || '').toLowerCase() === 'off') return;
  try {
    process.stdout.write(fs.readFileSync(path.join(__dirname, 'plugin-feedback.md'), 'utf8'));
  } catch {
    // 文面が読めなくても、セッションの開始は妨げない
  }
}

main();
