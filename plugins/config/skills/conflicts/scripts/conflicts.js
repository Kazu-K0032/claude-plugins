#!/usr/bin/env node
// Claude Code の設定の衝突・重複を機械的に検出し、JSON で標準出力へ出す。読み取り専用。
//
// 使い方: node conflicts.js [--home <dir>] [--project <dir>] [--managed <managed-settings.json>]
//   --home     ユーザーのホームディレクトリ（既定: OS のホーム）。~/.claude/ と ~/.claude.json を読む
//   --project  プロジェクトのルート（既定: git のトップレベル、git 外ならカレントディレクトリ）
//   --managed  管理者設定ファイルのパス（既定: OS ごとの標準パス）
//
// 秘匿情報を出さないため、MCP サーバーの env / headers や ~/.claude.json の他のキーは出力しない。
// settings.json の env の値、MCP の引数・URL に含まれるトークンも伏せて出す（比較は伏せる前の値で行う）。

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

// 優先度の高い順。上にあるスコープの値が下のスコープを上書きする
const SCOPES = ['managed', 'local', 'project', 'user'];

// 配列・フックはスコープ間で結合されるので、上書きの検出からは外す
const MERGED_KEYS = new Set(['permissions', 'hooks']);
// オブジェクトのキー単位で上書きされるもの
const PER_KEY_OBJECTS = new Set(['env', 'enabledPlugins', 'extraKnownMarketplaces']);

const REDACTED = '<redacted>';
// 値そのものが秘匿情報になりうる設定キー
const SECRET_KEYS = new Set(['apiKeyHelper', 'awsAuthRefresh', 'awsCredentialExport', 'otelHeadersHelper']);
// 直後（または = の後）の値を伏せる引数名
const SECRET_ARG = /(token|key|secret|password|passwd|auth|credential)/i;

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, '');
    opts[key] = argv[i + 1];
  }
  return opts;
}

function defaultManagedPath() {
  if (process.platform === 'win32') return 'C:\\Program Files\\ClaudeCode\\managed-settings.json';
  if (process.platform === 'darwin') return '/Library/Application Support/ClaudeCode/managed-settings.json';
  return '/etc/claude-code/managed-settings.json';
}

function defaultManagedDir() {
  return path.dirname(defaultManagedPath());
}

function projectRoot() {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    }).trim();
  } catch {
    return process.cwd();
  }
}

function readJson(file, errors) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    errors.push({ file, error: `JSON として読めない: ${e.message}` });
    return null;
  }
}

function sameValue(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function normalizePath(p) {
  return path.resolve(p).replace(/\\/g, '/').toLowerCase();
}

// ---- 収集 ----

function collectSettings(ctx) {
  const files = {
    managed: ctx.managed,
    local: path.join(ctx.project, '.claude', 'settings.local.json'),
    project: path.join(ctx.project, '.claude', 'settings.json'),
    user: path.join(ctx.home, '.claude', 'settings.json'),
  };
  return SCOPES.map((scope) => ({ scope, file: files[scope], data: readJson(files[scope], ctx.errors) }));
}

function enabledPlugins(settings) {
  // 下位スコープから順に重ね、上位スコープの指定で上書きする
  const merged = {};
  for (const s of [...settings].reverse()) {
    Object.assign(merged, (s.data && s.data.enabledPlugins) || {});
  }
  return Object.keys(merged).filter((id) => merged[id]);
}

function installedPlugins(ctx, ids) {
  const registry = readJson(path.join(ctx.home, '.claude', 'plugins', 'installed_plugins.json'), ctx.errors);
  const entries = (registry && registry.plugins) || {};
  const result = [];
  for (const id of ids) {
    const installs = entries[id] || [];
    // project / local スコープの導入は、このプロジェクトのものを優先する
    const match =
      installs.find((i) => i.projectPath && normalizePath(i.projectPath) === normalizePath(ctx.project)) ||
      installs.find((i) => i.scope === 'user') ||
      installs[installs.length - 1];
    if (match && match.installPath && fs.existsSync(match.installPath)) {
      const manifest = readJson(path.join(match.installPath, '.claude-plugin', 'plugin.json'), ctx.errors) || {};
      // 呼び出し名の名前空間はマニフェストの name。無ければ enabledPlugins の ID から取る
      result.push({ id, name: manifest.name || id.split('@')[0], installPath: match.installPath, manifest });
    } else {
      ctx.errors.push({ file: id, error: '有効化されているが、導入先が見つからない' });
    }
  }
  return result;
}

function toArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

// マニフェストのパスはプラグインのルートからの相対パス（"./..."）
function pluginPath(plugin, rel) {
  return path.resolve(plugin.installPath, rel);
}

function collectMcpServers(ctx, plugins) {
  const servers = [];
  const add = (source, defs) => {
    for (const [name, def] of Object.entries(defs || {})) {
      if (!def || typeof def !== 'object') continue;
      // env・headers は秘匿値を含みうるので、起動方法だけを残す
      servers.push({ name, source, command: def.command || def.url || null, args: def.args || [] });
    }
  };
  // .mcp.json 形式（mcpServers で包む）と、サーバー名をキーにした素の形式の両方を受ける
  const unwrap = (data) => (data && data.mcpServers && typeof data.mcpServers === 'object' ? data.mcpServers : data);

  const claudeJson = readJson(path.join(ctx.home, '.claude.json'), ctx.errors);
  if (claudeJson) {
    add('user (~/.claude.json)', claudeJson.mcpServers);
    const projects = claudeJson.projects || {};
    const key = Object.keys(projects).find((k) => normalizePath(k) === normalizePath(ctx.project));
    if (key) add('local (~/.claude.json の projects)', projects[key].mcpServers);
  }
  const mcpJson = readJson(path.join(ctx.project, '.mcp.json'), ctx.errors);
  if (mcpJson) add('project (.mcp.json)', mcpJson.mcpServers);
  for (const p of plugins) {
    const source = `plugin (${p.id})`;
    const defaults = readJson(path.join(p.installPath, '.mcp.json'), ctx.errors);
    if (defaults) add(source, unwrap(defaults));
    // マニフェストの mcpServers は .mcp.json に加えて読み込まれる（同名は後勝ち）
    for (const entry of toArray(p.manifest.mcpServers)) {
      if (typeof entry === 'string') {
        if (/\.(mcpb|dxt)$/i.test(entry) || /^https?:/i.test(entry)) {
          // バンドルは展開しないと定義が読めないので、未確認として報告に残す
          ctx.unchecked.push({ source, what: `MCP バンドル ${entry}` });
        } else {
          add(source, unwrap(readJson(pluginPath(p, entry), ctx.errors)));
        }
      } else if (entry && typeof entry === 'object') {
        add(source, entry);
      }
    }
  }
  return servers;
}

function hasSkill(dir) {
  return fs.existsSync(path.join(dir, 'SKILL.md'));
}

// SKILL.md を直接持つディレクトリはそれ自体が 1 スキル。そうでなければ配下の <name>/SKILL.md を探す
function listSkillDirs(dir) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return [];
  if (hasSkill(dir)) return [path.basename(dir)];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && hasSkill(path.join(dir, d.name)))
    .map((d) => d.name);
}

function listCommandFiles(target) {
  if (!fs.existsSync(target)) return [];
  if (fs.statSync(target).isFile()) return target.endsWith('.md') ? [path.basename(target, '.md')] : [];
  return fs
    .readdirSync(target)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, ''));
}

function pluginSkillNames(p) {
  const names = new Set(listSkillDirs(path.join(p.installPath, 'skills')));
  // マニフェストの skills は既定の skills/ に加えて読み込まれる
  for (const rel of toArray(p.manifest.skills)) {
    if (typeof rel === 'string') listSkillDirs(pluginPath(p, rel)).forEach((n) => names.add(n));
  }
  // skills/ もマニフェスト指定も無く、ルートに SKILL.md がある場合はプラグイン自体が 1 スキル
  if (names.size === 0 && p.manifest.skills === undefined && hasSkill(p.installPath)) names.add(p.name);
  return [...names];
}

function pluginCommandNames(p) {
  const spec = p.manifest.commands;
  // マニフェストの commands は既定の commands/ を置き換える
  if (spec === undefined) return listCommandFiles(path.join(p.installPath, 'commands'));
  if (spec && typeof spec === 'object' && !Array.isArray(spec)) return Object.keys(spec);
  const names = new Set();
  for (const rel of toArray(spec)) {
    if (typeof rel === 'string') listCommandFiles(pluginPath(p, rel)).forEach((n) => names.add(n));
  }
  return [...names];
}

function collectSkills(ctx, plugins) {
  const skills = [];
  const add = (source, namespace, names) => names.forEach((name) => skills.push({ name, namespace, source }));
  add('user (~/.claude/skills)', null, listSkillDirs(path.join(ctx.home, '.claude', 'skills')));
  add('user (~/.claude/commands)', null, listCommandFiles(path.join(ctx.home, '.claude', 'commands')));
  add('project (.claude/skills)', null, listSkillDirs(path.join(ctx.project, '.claude', 'skills')));
  add('project (.claude/commands)', null, listCommandFiles(path.join(ctx.project, '.claude', 'commands')));
  for (const p of plugins) {
    add(`plugin (${p.id})`, p.name, pluginSkillNames(p));
    add(`plugin (${p.id})`, p.name, pluginCommandNames(p));
  }
  return skills;
}

function collectPluginHooks(ctx, plugins) {
  const sources = [];
  for (const p of plugins) {
    const scope = `plugin (${p.id})`;
    const defaults = path.join(p.installPath, 'hooks', 'hooks.json');
    const data = readJson(defaults, ctx.errors);
    if (data) sources.push({ scope, file: defaults, hooks: data.hooks || {} });
    // マニフェストの hooks は hooks/hooks.json と合わせて読み込まれる。ファイルは "hooks" で包む形、インラインは包まない形
    for (const entry of toArray(p.manifest.hooks)) {
      if (typeof entry === 'string') {
        const file = pluginPath(p, entry);
        const fileData = readJson(file, ctx.errors);
        if (fileData) sources.push({ scope, file, hooks: fileData.hooks || {} });
      } else if (entry && typeof entry === 'object') {
        sources.push({ scope, file: `${p.id} の plugin.json（インライン）`, hooks: entry });
      }
    }
  }
  return sources;
}

function countHooks(hooks) {
  let n = 0;
  for (const groups of Object.values(hooks || {})) {
    if (!Array.isArray(groups)) continue;
    for (const g of groups) n += (g.hooks || []).length;
  }
  return n;
}

// 出どころごとに照合した件数。0 件や少なすぎる件数は、読めていない可能性の手がかりになる
function buildCoverage(settings, pluginHooks, servers, skills) {
  const countBy = (items, key) =>
    items.reduce((acc, item) => {
      acc[item[key]] = (acc[item[key]] || 0) + 1;
      return acc;
    }, {});
  const permissionRules = {};
  const hooks = {};
  for (const s of settings) {
    if (!s.data) continue;
    const perms = s.data.permissions || {};
    permissionRules[s.scope] = ['allow', 'ask', 'deny'].reduce((sum, k) => sum + (perms[k] || []).length, 0);
    hooks[s.scope] = countHooks(s.data.hooks);
  }
  for (const h of pluginHooks) hooks[h.scope] = (hooks[h.scope] || 0) + countHooks(h.hooks);
  return {
    settingsFiles: settings.filter((s) => s.data).map((s) => s.scope),
    permissionRules,
    hooks,
    mcpServers: countBy(servers, 'source'),
    skills: countBy(skills, 'source'),
  };
}

function listMarkdown(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listMarkdown(full));
    else if (entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

function collectMemoryFiles(ctx) {
  const candidates = [
    { scope: 'managed', file: path.join(ctx.managedDir, 'CLAUDE.md') },
    { scope: 'user', file: path.join(ctx.home, '.claude', 'CLAUDE.md') },
    ...listMarkdown(path.join(ctx.home, '.claude', 'rules')).map((file) => ({ scope: 'user-rule', file })),
  ];
  // プロジェクトのルートから上位ディレクトリへ遡って読み込まれる
  let dir = path.resolve(ctx.project);
  const ancestors = [];
  for (;;) {
    ancestors.unshift(dir);
    const parent = path.dirname(dir);
    if (parent === dir || normalizePath(dir) === normalizePath(ctx.home)) break;
    dir = parent;
  }
  for (const d of ancestors) {
    candidates.push({ scope: 'project', file: path.join(d, 'CLAUDE.md') });
    candidates.push({ scope: 'project', file: path.join(d, '.claude', 'CLAUDE.md') });
    candidates.push({ scope: 'local', file: path.join(d, 'CLAUDE.local.md') });
  }
  candidates.push(
    ...listMarkdown(path.join(ctx.project, '.claude', 'rules')).map((file) => ({ scope: 'project-rule', file })),
  );
  // プロジェクトがホーム配下だと、遡った先のホームで ~/.claude/CLAUDE.md を再び拾う。先に登録したスコープを残す
  const seen = new Set();
  return candidates
    .filter((c) => {
      const key = normalizePath(c.file);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .filter((c) => fs.existsSync(c.file))
    .map((c) => ({ ...c, bytes: fs.statSync(c.file).size }));
}

// ---- 検出 ----

function redactSetting(key, entry) {
  const secret = key.startsWith('env.') || SECRET_KEYS.has(key);
  return secret ? { scope: entry.scope, value: REDACTED } : entry;
}

function checkScalarOverrides(settings, findings) {
  const values = {}; // key -> [{scope, value}]
  for (const s of settings) {
    if (!s.data) continue;
    for (const [key, value] of Object.entries(s.data)) {
      if (key === '$schema' || MERGED_KEYS.has(key)) continue;
      if (PER_KEY_OBJECTS.has(key) && value && typeof value === 'object') {
        for (const [sub, subValue] of Object.entries(value)) {
          (values[`${key}.${sub}`] = values[`${key}.${sub}`] || []).push({ scope: s.scope, value: subValue });
        }
      } else {
        (values[key] = values[key] || []).push({ scope: s.scope, value });
      }
    }
    // permissions のうち、配列以外（defaultMode 等）は上書きされる
    const perms = s.data.permissions || {};
    for (const [key, value] of Object.entries(perms)) {
      if (Array.isArray(value)) continue;
      (values[`permissions.${key}`] = values[`permissions.${key}`] || []).push({ scope: s.scope, value });
    }
  }
  for (const [key, list] of Object.entries(values)) {
    if (list.length < 2) continue;
    const [winner, ...shadowed] = list; // settings は優先度順に並んでいる
    const differing = shadowed.filter((l) => !sameValue(l.value, winner.value));
    if (differing.length) {
      findings.push({
        category: 'scalar-override',
        severity: 'warn',
        key,
        message: `${key} は ${winner.scope} の値が使われ、${differing.map((d) => d.scope).join('・')} の値は効いていない`,
        effective: redactSetting(key, winner),
        shadowed: differing.map((d) => redactSetting(key, d)),
      });
    } else {
      findings.push({
        category: 'scalar-override',
        severity: 'info',
        key,
        message: `${key} は ${list.map((l) => l.scope).join('・')} に同じ値で重複している`,
        effective: redactSetting(key, winner),
      });
    }
  }
}

function parseRule(rule) {
  const m = /^([^(]+)(?:\((.*)\))?$/.exec(rule.trim());
  return m ? { tool: m[1].trim(), spec: m[2] } : { tool: rule, spec: undefined };
}

// deny / ask のルールが allow のルールを丸ごと覆うか。Bash の「:*」「 *」はどちらも前方一致として扱う
function covers(broad, narrow) {
  const b = parseRule(broad);
  const n = parseRule(narrow);
  if (b.tool !== n.tool) return false;
  if (b.spec === undefined || b.spec === '*' || b.spec === '**') return true;
  if (n.spec === undefined) return false;
  const pattern = b.spec
    .replace(/:\*$/, ' *')
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\u0000')
    .replace(/\*/g, '.*')
    .replace(/\u0000/g, '.*');
  // 「git push *」は「git push」単体にも一致する
  const loose = pattern.endsWith(' .*') ? `${pattern.slice(0, -3)}( .*)?` : pattern;
  return new RegExp(`^${loose}$`).test(n.spec.replace(/:\*$/, ' *'));
}

function checkPermissions(settings, findings) {
  const rules = { allow: [], ask: [], deny: [] };
  for (const s of settings) {
    const perms = (s.data && s.data.permissions) || {};
    for (const kind of Object.keys(rules)) {
      for (const rule of perms[kind] || []) rules[kind].push({ rule, scope: s.scope });
    }
  }

  // 同じ一覧の中での重複
  for (const kind of Object.keys(rules)) {
    const seen = {};
    for (const r of rules[kind]) (seen[r.rule] = seen[r.rule] || []).push(r.scope);
    for (const [rule, scopes] of Object.entries(seen)) {
      if (scopes.length > 1) {
        findings.push({
          category: 'permission-duplicate',
          severity: 'info',
          message: `${kind} の ${rule} が ${scopes.join('・')} に重複している`,
          rule,
          scopes,
        });
      }
    }
  }

  // deny > ask > allow の順に評価されるため、上位の一覧に覆われた allow / ask は効かない
  const shadow = (weakKind, strongKind, severity) => {
    for (const weak of rules[weakKind]) {
      const strong = rules[strongKind].find((s) => covers(s.rule, weak.rule));
      if (!strong) continue;
      const exact = strong.rule === weak.rule;
      findings.push({
        category: 'permission-conflict',
        severity,
        message: exact
          ? `${weak.rule} が ${weakKind}（${weak.scope}）と ${strongKind}（${strong.scope}）の両方にあり、${strongKind} が優先される`
          : `${weakKind} の ${weak.rule}（${weak.scope}）は ${strongKind} の ${strong.rule}（${strong.scope}）に覆われていて効かない可能性がある`,
        weak: { kind: weakKind, ...weak },
        strong: { kind: strongKind, ...strong },
        exact,
      });
    }
  };
  shadow('allow', 'deny', 'warn');
  shadow('ask', 'deny', 'warn');
  shadow('allow', 'ask', 'info');
}

function checkHooks(settings, pluginHooks, findings) {
  const seen = {};
  const sources = [
    ...settings.filter((s) => s.data && s.data.hooks).map((s) => ({ scope: s.scope, hooks: s.data.hooks })),
    ...pluginHooks,
  ];
  for (const src of sources) {
    for (const [event, groups] of Object.entries(src.hooks || {})) {
      if (!Array.isArray(groups)) continue;
      for (const group of groups) {
        for (const hook of group.hooks || []) {
          const command = hook.command || hook.prompt || hook.url || JSON.stringify(hook);
          const key = `${event}\u0000${group.matcher || ''}\u0000${command}`;
          (seen[key] = seen[key] || { event, matcher: group.matcher || '', command, scopes: [] }).scopes.push(src.scope);
        }
      }
    }
  }
  for (const h of Object.values(seen)) {
    if (h.scopes.length < 2) continue;
    // 設定ファイル間の同一フックは 1 回にまとめられるが、プラグイン側の同一フックは別に実行される
    const pluginCopies = h.scopes.filter((s) => s.startsWith('plugin')).length;
    const runs = pluginCopies + (h.scopes.length > pluginCopies ? 1 : 0);
    const label = `${h.event}${h.matcher ? `（matcher: ${h.matcher}）` : ''} のフック「${h.command}」`;
    findings.push({
      category: 'hook-duplicate',
      severity: runs > 1 ? 'warn' : 'info',
      message:
        runs > 1
          ? `${label}が ${h.scopes.join('・')} に登録されており、${runs} 回実行される`
          : `${label}が ${h.scopes.join('・')} に重複して定義されている（実行は 1 回にまとめられる）`,
      runs,
      ...h,
    });
  }
}

// URL は認証情報・クエリ文字列を落とす。解釈できない文字列はそのまま返す
function redactUrl(value) {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return value;
  try {
    const url = new URL(value);
    // URL オブジェクトに戻すと < > が符号化されるので、文字列で組み立てる
    const auth = url.username || url.password ? `${REDACTED}@` : '';
    const query = url.search ? `?${REDACTED}` : '';
    return `${url.protocol}//${auth}${url.host}${url.pathname}${query}`;
  } catch {
    return value;
  }
}

function redactArgs(args) {
  if (!Array.isArray(args)) return args;
  return args.map((arg, i) => {
    if (typeof arg !== 'string') return arg;
    const eq = /^(--?[^=]+)=(.*)$/.exec(arg);
    if (eq && SECRET_ARG.test(eq[1])) return `${eq[1]}=${REDACTED}`;
    const prev = args[i - 1];
    if (typeof prev === 'string' && /^--?[^=]+$/.test(prev) && SECRET_ARG.test(prev) && !arg.startsWith('-')) return REDACTED;
    return redactUrl(arg);
  });
}

function redactServer(s) {
  return { ...s, command: redactUrl(s.command), args: redactArgs(s.args) };
}

function checkMcp(servers, findings) {
  const byName = {};
  for (const s of servers) (byName[s.name] = byName[s.name] || []).push(s);
  for (const [name, list] of Object.entries(byName)) {
    if (list.length < 2) continue;
    const sameLaunch = list.every((s) => sameValue([s.command, s.args], [list[0].command, list[0].args]));
    findings.push({
      category: 'mcp-duplicate',
      severity: sameLaunch ? 'info' : 'warn',
      message: sameLaunch
        ? `MCP サーバー ${name} が ${list.map((s) => s.source).join('・')} に同じ起動方法で重複定義されている`
        : `MCP サーバー ${name} が ${list.map((s) => s.source).join('・')} に異なる起動方法で定義されている`,
      name,
      definitions: list.map(redactServer),
    });
  }
}

function checkSkills(skills, findings) {
  const byName = {};
  for (const s of skills) (byName[s.name] = byName[s.name] || []).push(s);
  for (const [name, list] of Object.entries(byName)) {
    if (list.length < 2) continue;
    const bare = list.filter((s) => !s.namespace);
    const namespaced = list.filter((s) => s.namespace);
    if (bare.length > 1) {
      findings.push({
        category: 'skill-collision',
        severity: 'warn',
        message: `/${name} が ${bare.map((s) => s.source).join('・')} に重複しており、どちらか一方しか使われない`,
        name,
        definitions: bare,
      });
    } else if (bare.length === 1) {
      findings.push({
        category: 'skill-collision',
        severity: 'info',
        message: `/${name}（${bare[0].source}）と同名のスキルがプラグインにある（${namespaced
          .map((s) => `/${s.namespace}:${name}`)
          .join('・')}）。呼び出し名は区別されるが、モデルの自動選択では取り違えうる`,
        name,
        definitions: list,
      });
    } else if (new Set(namespaced.map((s) => s.namespace)).size > 1) {
      findings.push({
        category: 'skill-collision',
        severity: 'info',
        message: `同名のスキルが複数のプラグインにある（${namespaced
          .map((s) => `/${s.namespace}:${name}`)
          .join('・')}）。呼び出し名は区別されるが、モデルの自動選択では取り違えうる`,
        name,
        definitions: list,
      });
    }
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const ctx = {
    home: path.resolve(opts.home || os.homedir()),
    project: path.resolve(opts.project || projectRoot()),
    managed: opts.managed ? path.resolve(opts.managed) : defaultManagedPath(),
    errors: [],
    unchecked: [],
  };
  ctx.managedDir = opts.managed ? path.dirname(ctx.managed) : defaultManagedDir();

  const settings = collectSettings(ctx);
  const plugins = installedPlugins(ctx, enabledPlugins(settings));
  const pluginHooks = collectPluginHooks(ctx, plugins);
  const servers = collectMcpServers(ctx, plugins);
  const skills = collectSkills(ctx, plugins);
  const findings = [];
  checkScalarOverrides(settings, findings);
  checkPermissions(settings, findings);
  checkHooks(settings, pluginHooks, findings);
  checkMcp(servers, findings);
  checkSkills(skills, findings);

  const order = { warn: 0, info: 1 };
  findings.sort((a, b) => order[a.severity] - order[b.severity] || a.category.localeCompare(b.category));

  const report = {
    home: ctx.home,
    project: ctx.project,
    settingsFiles: settings.map((s) => ({ scope: s.scope, file: s.file, exists: Boolean(s.data) })),
    enabledPlugins: plugins.map((p) => p.id),
    coverage: buildCoverage(settings, pluginHooks, servers, skills),
    findings,
    memoryFiles: collectMemoryFiles(ctx),
    unchecked: ctx.unchecked,
    errors: ctx.errors,
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main();
