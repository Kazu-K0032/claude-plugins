#!/usr/bin/env node
// Claude Code のステータスライン。標準入力のセッション情報（JSON）を 2 行の Powerline 風表示にする。
//   1 行目: Model（推論の強さ）/ Ctx（使用率のバー）/ ディレクトリとブランチ
//   2 行目: Total（セッション累計トークン）/ Cost / Time（経過時間）/ Limit（利用上限の消費率）
// 入力の仕様: https://code.claude.com/docs/ja/statusline
// 環境変数 CLAUDE_STATUSLINE_PLAIN=1 で Powerline グリフを使わない表示に切り替える。

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const PLAIN = process.env.CLAUDE_STATUSLINE_PLAIN === '1';
const MAX_PLACE_WIDTH = 48;
const BAR_WIDTH = 10;
// 使用率がこの値以上になったら、セグメントの色を注意・警告に切り替える
const WARN_PERCENT = 50;
const DANGER_PERCENT = 80;

const COLORS = {
  red: { bg: [176, 82, 82], fg: [255, 255, 255] },
  yellow: { bg: [232, 192, 48], fg: [30, 30, 30] },
  blue: { bg: [86, 124, 204], fg: [255, 255, 255] },
  green: { bg: [120, 168, 104], fg: [30, 30, 30] },
  orange: { bg: [224, 120, 48], fg: [255, 255, 255] },
};

function main() {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    raw += chunk;
  });
  process.stdin.on('end', () => {
    let data = {};
    try {
      data = JSON.parse(raw);
    } catch {
      // 入力が壊れていても、ステータスラインを空にするよりは出せる分だけ出す
    }
    process.stdout.write(render(data));
  });
}

function render(data) {
  const lines = [
    [
      segment('red', modelLabel(data)),
      contextSegment(data.context_window),
      segment('blue', placeLabel(data)),
    ],
    [
      segment('red', totalLabel(data)),
      segment('yellow', costLabel(data.cost)),
      segment('blue', durationLabel(data.cost)),
      limitSegment(data.rate_limits),
    ],
  ];
  return lines
    .map((segments) => powerline(segments.filter(Boolean)))
    .filter(Boolean)
    .join('\n');
}

function segment(color, text) {
  return text ? { color: COLORS[color], text } : null;
}

// 使用率に応じて緑 → 黄 → 橙に色を変える
function levelColor(percent) {
  if (percent >= DANGER_PERCENT) return 'orange';
  if (percent >= WARN_PERCENT) return 'yellow';
  return 'green';
}

function modelLabel(data) {
  const name = data.model && data.model.display_name;
  if (!name) return null;
  const effort = data.effort && data.effort.level;
  return effort ? `Model: ${name} (${effort})` : `Model: ${name}`;
}

function contextSegment(ctx) {
  if (!ctx || typeof ctx.total_input_tokens !== 'number') return null;
  const tokens = formatTokens(ctx.total_input_tokens);
  // 使用率はセッション開始直後や /compact 直後に null になる。その間はトークン数だけ出す
  if (typeof ctx.used_percentage !== 'number') return segment('green', `Ctx: ${tokens}`);
  const pct = Math.min(Math.max(ctx.used_percentage, 0), 100);
  return segment(levelColor(pct), `Ctx: ${bar(pct)} ${Math.round(pct)}% ${tokens}`);
}

function bar(percent) {
  const filled = Math.round((percent / 100) * BAR_WIDTH);
  return PLAIN ? `[${'#'.repeat(filled)}${'-'.repeat(BAR_WIDTH - filled)}]` : '▓'.repeat(filled) + '░'.repeat(BAR_WIDTH - filled);
}

function placeLabel(data) {
  const dir = (data.workspace && data.workspace.current_dir) || data.cwd;
  if (!dir) return null;
  const name = path.basename(dir);
  const branch = (data.worktree && data.worktree.branch) || gitBranch(dir);
  return truncateLeft(branch ? `${name} ${PLAIN ? '@' : ''} ${branch}` : name, MAX_PLACE_WIDTH);
}

function durationLabel(cost) {
  if (!cost || typeof cost.total_duration_ms !== 'number') return null;
  const api = typeof cost.total_api_duration_ms === 'number' ? ` (API ${formatDuration(cost.total_api_duration_ms)})` : '';
  return `Time: ${formatDuration(cost.total_duration_ms)}${api}`;
}

// 5 時間枠と 7 日枠の消費率。値が無い枠（Pro / Max 以外・初回応答前・リセット後）は出さない
function limitSegment(limits) {
  if (!limits) return null;
  const parts = [];
  let max = 0;
  for (const [key, label] of [
    ['five_hour', '5h'],
    ['seven_day', '7d'],
  ]) {
    const w = limits[key];
    if (!w || typeof w.used_percentage !== 'number') continue;
    const reset = typeof w.resets_at === 'number' ? ` ${formatReset(w.resets_at, key === 'seven_day')}` : '';
    parts.push(`${label} ${Math.round(w.used_percentage)}%${reset}`);
    max = Math.max(max, w.used_percentage);
  }
  return parts.length ? segment(levelColor(max), `Limit: ${parts.join(' / ')}`) : null;
}

function costLabel(cost) {
  if (!cost || typeof cost.total_cost_usd !== 'number') return null;
  return `Cost: $${cost.total_cost_usd.toFixed(2)}`;
}

function totalLabel(data) {
  const total = sessionTotalTokens(data.session_id, data.transcript_path);
  return total === null ? null : `Total: ${formatTokens(total)}`;
}

function gitBranch(dir) {
  const run = (args) =>
    execFileSync('git', ['-C', dir, ...args], {
      encoding: 'utf8',
      timeout: 1000,
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    }).trim();
  try {
    // detached HEAD では branch 名が空になるので、短いコミット ID で代用する
    return run(['branch', '--show-current']) || run(['rev-parse', '--short', 'HEAD']);
  } catch {
    return '';
  }
}

// セッション内の全 API 呼び出しで処理したトークン数（入力・キャッシュ作成・出力）。
// キャッシュ読み込みは毎ターン同じ文脈を数え直すだけなので含めない。
// 描画のたびに transcript 全体を読み直さないよう、読んだ位置と集計を一時ファイルに残して差分だけ読む。
function sessionTotalTokens(sessionId, transcriptPath) {
  if (!sessionId || !transcriptPath) return null;
  let size;
  try {
    size = fs.statSync(transcriptPath).size;
  } catch {
    return null;
  }

  const cacheFile = path.join(os.tmpdir(), 'claude-statusline', `${sessionId.replace(/[^\w-]/g, '_')}.json`);
  let state = { offset: 0, total: 0, seen: {} };
  try {
    const saved = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    // transcript が作り直された（縮んだ）場合は最初から数え直す
    if (saved.path === transcriptPath && saved.offset <= size) state = saved;
  } catch {
    // キャッシュが無い・壊れている場合は最初から数える
  }
  if (state.offset === size) return state.total;

  const fd = fs.openSync(transcriptPath, 'r');
  let chunk;
  try {
    chunk = Buffer.alloc(size - state.offset);
    fs.readSync(fd, chunk, 0, chunk.length, state.offset);
  } finally {
    fs.closeSync(fd);
  }
  // 書き込み途中の最終行は次回に回す
  const lastNewline = chunk.lastIndexOf(0x0a);
  if (lastNewline < 0) return state.total;

  for (const line of chunk.subarray(0, lastNewline).toString('utf8').split('\n')) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const message = entry && entry.type === 'assistant' && entry.message;
    if (!message || !message.id || !message.usage) continue;
    // 1 つの応答が複数行に分けて記録されるため、同じ id は最新の usage で置き換える
    const tokens = usageTokens(message.usage);
    state.total += tokens - (state.seen[message.id] || 0);
    state.seen[message.id] = tokens;
  }
  state.offset += lastNewline + 1;
  state.path = transcriptPath;

  try {
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify(state));
  } catch {
    // 保存できなくても次回は数え直すだけなので表示は続ける
  }
  return state.total;
}

function usageTokens(usage) {
  return (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0) + (usage.output_tokens || 0);
}

function formatDuration(ms) {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours) return `${hours}h${String(minutes).padStart(2, '0')}m`;
  if (totalMinutes) return `${minutes}m`;
  return `${Math.floor(ms / 1000)}s`;
}

// リセット時刻をローカル時刻で示す。7 日枠は日付も付ける
function formatReset(epochSeconds, withDate) {
  const d = new Date(epochSeconds * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return withDate ? `↻${d.getMonth() + 1}/${d.getDate()} ${time}` : `↻${time}`;
}

function formatTokens(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(n);
}

function truncateLeft(text, width) {
  const chars = Array.from(text);
  return chars.length <= width ? text : `…${chars.slice(chars.length - width + 1).join('')}`;
}

const ESC = '\x1b[';
const RESET = `${ESC}0m`;
const fg = ([r, g, b]) => `${ESC}38;2;${r};${g};${b}m`;
const bg = ([r, g, b]) => `${ESC}48;2;${r};${g};${b}m`;

// 各セグメントを背景色付きで並べ、間を斜めの区切りでつなぐ（ /  は Powerline の斜め三角）
function powerline(segments) {
  if (segments.length === 0) return '';
  if (PLAIN) {
    return segments.map((s) => `${bg(s.color.bg)}${fg(s.color.fg)} ${s.text} ${RESET}`).join(' ');
  }
  let out = `${fg(segments[0].color.bg)}`;
  segments.forEach((s, i) => {
    out += `${bg(s.color.bg)}${fg(s.color.fg)} ${s.text} `;
    const next = segments[i + 1];
    out += next ? `${fg(s.color.bg)}${bg(next.color.bg)}` : `${RESET}${fg(s.color.bg)}`;
  });
  return out + RESET;
}

main();
