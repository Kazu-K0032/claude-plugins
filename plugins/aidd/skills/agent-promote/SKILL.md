---
name: agent-promote
description: 過去セッションのタスク内容を検索し、繰り返している作業を .claude/agents/<name>.md の永続カスタムエージェントへ昇格させる提案をする。エージェント化・エージェント昇格を求められた時に使用する
disable-model-invocation: true
allowed-tools: Write(.claude/agents/*), AskUserQuestion
argument-hint: "[エージェント名（省略時は候補を一覧表示）]"
---

# エージェント昇格

セッションログからタスク概要を取り出し、承認を得た場合のみ `.claude/agents/<name>.md` を作成する。

## 前提知識

`find-agent.py` が検索するのは JSONL の `agent-name` イベント、すなわち **Claude がセッション内のタスクから自動生成したセッションタイトル**。この名前で検索し、最初と最後のユーザープロンプト・使用ツールを抽出する。

読むログの場所はカレントディレクトリから導出する（`~/.claude/projects/<パスをハイフン化した名前>/`）。**そのプロジェクトで Claude Code を起動していないと見つからない。**

## 手順

### Step 1: 候補の特定

`$ARGUMENTS` が空の場合は一覧モードで候補を表示し、どれを昇格させるかユーザーに選ばせる。

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/agent-promote/scripts/find-agent.py"
```

`$ARGUMENTS` がある場合は、その名前で詳細を取得する。

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/agent-promote/scripts/find-agent.py" <agent-name>
```

### Step 2: 内容を提示する

スクリプト出力を元に以下をユーザーへ整理して提示する。

- セッション数・ターン数
- 最初と最後のユーザープロンプト（何を依頼していたか）
- 主要ツール（どんな作業だったか）

スクリプトが「見つかりませんでした」を出力した場合は、引数なしで再実行して候補を提示する。

### Step 3: 昇格の可否を確認する

`AskUserQuestion` で確認する。

- `.claude/agents/<name>.md` に昇格させるか

No の場合はここで終了する。

### Step 4: 定義の詳細を確認する

Yes の場合、`AskUserQuestion` でさらに確認する。

- このエージェントが使用するツール（Read / Write / Bash / Agent など）
- モデル（haiku / sonnet / opus）

### Step 5: エージェントファイルを作成する

Step 2 のプロンプトを元にシステムプロンプト本文を書き起こし、`.claude/agents/<name>.md` を `Write` する。

```yaml
---
name: <エージェント名>
description: <タスクの要旨。Claude が自動発火の判断に使う>
tools: <Step 4 で確認したツール（カンマ区切り）>
model: <Step 4 で確認したモデル>
---

<セッションの プロンプト を元に書き起こしたシステムプロンプト>
```

ファイル作成後、出力パスをユーザーに報告する。

## 禁止事項

- ❌ 承認を得ずに `.claude/agents/` へ書き込む（Step 3 の確認を飛ばさない）
- ❌ セッションログを読まずに、想像でシステムプロンプトを書く
- ❌ 名前が見つからないまま Step 3 以降へ進む

## 保守

`allowed-tools` にスクリプトの `Bash` パターンを含めていない。プラグインの実体パスは `${CLAUDE_PLUGIN_ROOT}` で解決するが、この変数が `allowed-tools` の frontmatter で展開されるかは公式に記載がないため、当てにせず通常の許可プロンプトを通す。

`Write(.claude/agents/*)` は残している。このパスは Claude Code の規約で固定されており、プロジェクトごとに変わらない。
