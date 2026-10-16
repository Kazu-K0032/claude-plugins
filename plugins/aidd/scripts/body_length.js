#!/usr/bin/env node
// Issue・PR の本文が、文字数の上限に収まっているかを数える。読み取り専用。外部パッケージは使わない。
//
// 上限と数え方の正典は、このスクリプトから見て ../references/short-body.md。
//   全体: 500 文字以内。HTML コメントと定型の節（見出しに「チェックリスト」か「関連 Issue」を含む節）は数えない。
//         見出し・記号は数え、改行と行頭・行末の空白は数えない。リンクは見える文字だけ数える
//   項目: 箇条書きの 1 項目と、地の文の 1 文は 50 文字以内。見出し・表・引用・コードブロックは対象外
//
// 使い方: node body_length.js <ファイル | -> [--item-only]
//   -            標準入力から読む（下書きのファイルを作らないスキル用）
//   --item-only  項目だけを確かめ、全体は数えない（検証コメント用）
// 終了コード: 上限内なら 0、超えていれば 1、引数の誤りや読めないときは 2

'use strict';

const fs = require('fs');

const TOTAL_LIMIT = 500;
const ITEM_LIMIT = 50;

const USAGE = 'node body_length.js <ファイル | -> [--item-only]';

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const HEADING = /^ {0,3}(#{1,6})\s+(.*)$/;
const FIXED_SECTION = /チェックリスト|関連\s*issue/i;
const LIST_MARKER = /^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/;
const LINK = /!?\[([^\]]*)\]\([^)]*\)/g;
const COMMENT = /<!--[\s\S]*?-->/g;

// String の length は UTF-16 の単位で数え、絵文字などを 2 文字にするため、コードポイントで数える
function charCount(s) {
  return [...s].length;
}

function readInput(target) {
  const text = fs.readFileSync(target === '-' ? 0 : target, 'utf8');
  return text.replace(/^﻿/, '');
}

// コードブロックを閉じる行か。開いたときと同じ記号で、同じ数以上並んでいるもの
function closesFence(m, marker) {
  return m && m[1][0] === marker[0] && m[1].length >= marker.length;
}

// コードブロックの外の HTML コメントを消す。行番号がずれないよう、改行は残す
function stripComments(text) {
  const out = [];
  let chunk = [];
  let inFence = false;
  let marker = '';
  const flush = () => {
    if (!chunk.length) return;
    const joined = chunk.join('\n').replace(COMMENT, c => '\n'.repeat(c.split('\n').length - 1));
    out.push(...joined.split('\n'));
    chunk = [];
  };
  for (const line of text.split('\n')) {
    const m = line.match(FENCE);
    if (inFence) {
      out.push(line);
      if (closesFence(m, marker)) inFence = false;
      continue;
    }
    if (m) {
      flush();
      inFence = true;
      marker = m[1];
      out.push(line);
      continue;
    }
    chunk.push(line);
  }
  flush();
  return out;
}

// 行ごとに { counted, inFence } を返す。定型の節は、下位の見出しも含めて数えない
function classify(lines) {
  const result = [];
  let inFence = false;
  let marker = '';
  let skipLevel = 0;
  for (const line of lines) {
    const m = line.match(FENCE);
    if (inFence) {
      result.push({ counted: skipLevel === 0, inFence: true });
      if (closesFence(m, marker)) inFence = false;
      continue;
    }
    if (m) {
      inFence = true;
      marker = m[1];
      result.push({ counted: skipLevel === 0, inFence: true });
      continue;
    }
    const h = line.match(HEADING);
    if (h) {
      const level = h[1].length;
      if (skipLevel && level <= skipLevel) skipLevel = 0;
      if (!skipLevel && FIXED_SECTION.test(h[2])) skipLevel = level;
    }
    result.push({ counted: skipLevel === 0, inFence: false });
  }
  return result;
}

// リンクは見える文字だけにし、行頭・行末の空白を除く
function visible(line) {
  return line.replace(LINK, '$1').trim();
}

// 50 文字を超える項目・文を { num, length, text } で返す
function itemOverflows(num, line) {
  const text = visible(line);
  if (!text || /^[#|>]/.test(text)) return [];
  if (LIST_MARKER.test(line)) {
    const item = visible(line.replace(LIST_MARKER, ''));
    const length = charCount(item);
    return length > ITEM_LIMIT ? [{ num, length, text: item }] : [];
  }
  const sentences = (text.match(/[^。！？]*[。！？]?/g) || []).map(s => s.trim()).filter(Boolean);
  return sentences
    .map(s => ({ num, length: charCount(s), text: s }))
    .filter(s => s.length > ITEM_LIMIT);
}

function main(argv) {
  const args = argv.filter(a => a !== '--item-only');
  const itemOnly = args.length !== argv.length;
  if (args.length !== 1) {
    console.error('使い方: ' + USAGE);
    return 2;
  }
  let text;
  try {
    text = readInput(args[0]);
  } catch (e) {
    console.error('読めない: ' + e.message);
    return 2;
  }

  const lines = stripComments(text.replace(/\r\n/g, '\n'));
  const kinds = classify(lines);
  let total = 0;
  const overflows = [];
  lines.forEach((line, i) => {
    if (!kinds[i].counted) return;
    total += charCount(visible(line));
    if (!kinds[i].inFence) overflows.push(...itemOverflows(i + 1, line));
  });

  let ng = overflows.length > 0;
  if (itemOnly) {
    console.log('全体: 数えない（--item-only）');
  } else {
    ng = ng || total > TOTAL_LIMIT;
    console.log(`全体: ${total} / ${TOTAL_LIMIT} 文字（${total > TOTAL_LIMIT ? 'NG' : 'OK'}）`);
  }
  if (overflows.length) {
    console.log(`${ITEM_LIMIT} 文字を超える項目・文:`);
    for (const o of overflows) console.log(`  ${o.num} 行目: ${o.length} 文字「${o.text}」`);
  } else {
    console.log(`${ITEM_LIMIT} 文字を超える項目・文: なし`);
  }
  return ng ? 1 : 0;
}

process.exitCode = main(process.argv.slice(2));
