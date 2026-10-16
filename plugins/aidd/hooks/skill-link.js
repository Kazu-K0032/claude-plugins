#!/usr/bin/env node
// UserPromptExpansion / PreToolUse（Skill）フック。実行するスキルの SKILL.md への GitHub のリンクを、1 行で利用者に表示する。
//   利用者が /プラグイン名:スキル名 と入力したとき（UserPromptExpansion）と、Claude が Skill ツールで呼んだとき（PreToolUse）の両方で動く
//   リンク先は、入れている版のタグ。plugin.json の version から v<版> を作る
//   自分のプラグインのスキルでなければ、何も出さない（aidd・config・project に同じ内容を置き、それぞれが自分のスキルだけ扱う）
//   <プラグイン名>:<スキル名> の形で呼ばれたものだけ扱う。接頭辞の無い名前は、利用者が自分で作ったスキルと見分けられないため
// 仕様: https://code.claude.com/docs/ja/hooks
// このファイルは 3 つのプラグインで同じ内容にする（.claude/rules/duplicated-files.md）。

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_URL = 'https://github.com/Kazu-K0032/claude-plugins';
const SKILL_NAME = /^[a-z0-9][a-z0-9-]*$/;
const VERSION = /^\d+\.\d+\.\d+$/;

function main() {
  const input = readInput();
  const requested = requestedSkill(input);
  if (!requested) return;

  // このファイルは <プラグインのルート>/hooks/ にある
  const pluginRoot = path.resolve(__dirname, '..');
  const manifest = readManifest(pluginRoot);
  if (!manifest) return;

  const skill = ownSkill(requested, manifest.name, pluginRoot);
  if (!skill) return;

  const url = `${REPO_URL}/blob/v${manifest.version}/plugins/${manifest.name}/skills/${skill}/SKILL.md`;
  // JSON で返す場合、標準出力は JSON だけにする必要がある
  process.stdout.write(JSON.stringify({ systemMessage: `${manifest.name}:${skill} の手順: ${url}` }));
}

function readInput() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8')) || {};
  } catch {
    return {};
  }
}

// 呼ばれたスキルの名前を返す。スキルの呼び出しでなければ null
function requestedSkill(input) {
  if (input.hook_event_name === 'UserPromptExpansion') {
    return input.expansion_type === 'slash_command' ? String(input.command_name || '') : null;
  }
  if (input.hook_event_name === 'PreToolUse') {
    return input.tool_name === 'Skill' ? String((input.tool_input && input.tool_input.skill) || '') : null;
  }
  return null;
}

function readManifest(pluginRoot) {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(pluginRoot, '.claude-plugin', 'plugin.json'), 'utf8'));
    if (typeof manifest.name === 'string' && VERSION.test(manifest.version)) return manifest;
  } catch {
    // 読めなければ、リンクを作れないので何も出さない
  }
  return null;
}

// 自分のプラグインのスキル名を返す。ほかのプラグイン・自分で作ったスキル・SKILL.md が無いもの（workflow など）は null
function ownSkill(requested, pluginName, pluginRoot) {
  const name = requested.replace(/^\//, '');
  const colon = name.indexOf(':');
  if (colon < 0 || name.slice(0, colon) !== pluginName) return null;
  const skill = name.slice(colon + 1);
  // 名前をパスに使うため、決まった形でなければ使わない
  if (!SKILL_NAME.test(skill)) return null;
  if (!fs.existsSync(path.join(pluginRoot, 'skills', skill, 'SKILL.md'))) return null;
  return skill;
}

try {
  main();
} catch {
  // フックの失敗で、スキルの実行を妨げない
}
