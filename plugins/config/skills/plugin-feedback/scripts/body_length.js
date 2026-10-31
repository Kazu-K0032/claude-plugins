#!/usr/bin/env node
// Issue・PR の本文とコメントの概要（最初の節）が、文字数の上限に収まっているかを数える。読み取り専用。外部パッケージは使わない。
//
// 上限と数え方の正典は、このスクリプトから見て ../references/short-body.md。
//   概要: 最初の節。先頭の見出しから、同じ大きさ以上の次の見出しの前まで（先頭が # 1 つなら ## でも区切る）。
//         先頭が地の文なら、最初の見出しの前まで。見出しが無ければ本文全体。300 文字以内
//         HTML コメント・定型の節（見出しに「チェックリスト」か「関連 Issue」を含む節）・改行・行頭と行末の空白・リンクの URL は数えない
//   概要より後の節（再現手順・要件など）は数えない。詳しく書いてよいため
//
// 使い方: node body_length.js <ファイル | ->
//   -  標準入力から読む（下書きのファイルを作らないスキル用）
// 終了コード: 上限内なら 0、超えていれば 1、引数の誤りや読めないときは 2

'use strict';

const fs = require('fs');

const SUMMARY_LIMIT = 300;

const USAGE = 'node body_length.js <ファイル | ->';

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const HEADING = /^ {0,3}(#{1,6})\s+(.*)$/;
const FIXED_SECTION = /チェックリスト|関連\s*issue/i;
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

// リンクは見える文字だけにし、行頭・行末の空白を除く
function visible(line) {
  return line.replace(LINK, '$1').trim();
}

// 概要の行を返す。最初の節（先頭の見出しから、同じ大きさ以上の次の見出しの前まで）。定型の節は、下位の見出しも含めて除く
// 区切りの大きさ: 先頭が見出しなら、その見出しの # の数（ただし # 1 つなら ## でも区切る）。先頭が地の文なら、どの見出しでも区切る
// Issue フォームは各欄を ### の見出しで書き出すため、### で始まる本文は、最初の欄が概要になる
function summaryLines(lines) {
  const result = [];
  let inFence = false;
  let marker = '';
  let skipLevel = 0;
  let seen = false;
  let boundary = 0;
  for (const line of lines) {
    const m = line.match(FENCE);
    if (inFence) {
      if (!skipLevel) result.push(line);
      if (closesFence(m, marker)) inFence = false;
      continue;
    }
    if (m) {
      inFence = true;
      marker = m[1];
      if (!skipLevel) {
        result.push(line);
        if (!seen) boundary = 6;
        seen = true;
      }
      continue;
    }
    const h = line.match(HEADING);
    if (h) {
      const level = h[1].length;
      // 中身が出た後の、区切りの大きさ以上の見出しで概要を終える。定型の節は中身に数えないため、その後の見出しから概要が始まる
      if (seen && level <= boundary) break;
      if (skipLevel && level <= skipLevel) skipLevel = 0;
      if (!skipLevel && FIXED_SECTION.test(h[2])) skipLevel = level;
      if (!skipLevel && !seen) boundary = Math.max(level, 2);
    }
    if (skipLevel) continue;
    result.push(line);
    if (visible(line)) {
      if (!seen && !h) boundary = 6;
      seen = true;
    }
  }
  return result;
}

function main(argv) {
  if (argv.length !== 1 || argv[0].startsWith('--')) {
    console.error('使い方: ' + USAGE);
    return 2;
  }
  let text;
  try {
    text = readInput(argv[0]);
  } catch (e) {
    console.error('読めない: ' + e.message);
    return 2;
  }

  const lines = stripComments(text.replace(/\r\n/g, '\n'));
  const total = summaryLines(lines).reduce((n, line) => n + charCount(visible(line)), 0);
  const ng = total > SUMMARY_LIMIT;
  console.log(`概要: ${total} / ${SUMMARY_LIMIT} 文字（${ng ? 'NG' : 'OK'}）`);
  return ng ? 1 : 0;
}

process.exitCode = main(process.argv.slice(2));
