import { expect, test } from 'claude-code/testing'

import { isReadOnlyCommand, isReadOnlyMcpTool } from '../hooks/readonly'

test('読み取り用のコマンドと、その組み合わせは通す', () => {
  const commands = [
    'ls -la',
    'cat README.md | head -20',
    'grep -rn "foo -> bar" src 2>/dev/null',
    "rg 'a > b' --glob '*.ts'",
    'find . -name "*.ts" -not -path "*/node_modules/*" | wc -l',
    'find . \\( -name a -o -name b \\)',
    'cd src && ls',
    'git status && git log --oneline -5; git diff HEAD~1 2>&1',
    'sort data.txt | uniq -c',
    'cat a.txt | uniq -',
    'git log --oneline --stat -3',
    'wc -l < input.txt',
    'echo done',
    'gh pr view 12 --json title,body --jq .title',
    'gh pr diff 12 | head -50',
    'gh issue list -R owner/repo --state open',
    'gh run view 123 --log',
    'gh search issues "is:open label:bug"',
    'gh status',
    "gh api 'repos/owner/repo/pulls?state=open' --paginate -q '.[].title'",
    "gh api graphql -f query='query { viewer { login } }'",
  ]

  for (const command of commands) {
    expect([command, isReadOnlyCommand(command)]).toEqual([command, true])
  }
})

test('書き込み・ほかのコマンドの起動・確かめられない書き方は止める', () => {
  const commands = [
    '',
    'rm -rf build',
    'touch a.txt',
    'echo a > a.txt',
    'cat a >> b',
    'ls &> out.log',
    'ls | tee out.log',
    'ls $(pwd)',
    'ls `pwd`',
    'cat <(ls)',
    'cat <<EOF\nx\nEOF',
    '(cd src && ls)',
    '{ ls; }',
    'FOO=1 ls',
    'sudo ls',
    'find . -name "*.tmp" -delete',
    'find . -exec rm {} \\;',
    'sed -i s/a/b/ file',
    'awk \'{ print > "out" }\' file',
    'ls | xargs rm',
    'git push',
    'git commit -m "x"',
    'git checkout main',
    'git -c core.pager=sh log',
    'git diff --output=patch.diff',
    'git diff --out=patch.diff',
    'sort -o out.txt in.txt',
    'sort -ro out.txt in.txt',
    'sort --out=b.txt a.txt',
    'sort --compress-program=sh a.txt',
    'sort --compress=sh a.txt',
    'uniq in.txt out.txt',
    'uniq -- in.txt -out',
    'cat a.txt | uniq - out.txt',
    'rg --pre ./script foo',
    'rg --hostname-bin=./script foo',
    'tree -o out.txt',
    'npm install',
    'ls && rm a',
    'echo "unterminated',
    'gh',
    'gh pr',
    'gh pr create --title x',
    'gh pr merge 12',
    'gh pr checkout 12',
    'gh issue comment 3 --body x',
    'gh release download v1',
    'gh repo clone owner/repo',
    'gh api repos/owner/repo/issues -f title=x',
    'gh api -X DELETE repos/owner/repo',
    'gh api --method=POST repos/owner/repo/forks',
    'gh api repos/owner/repo/issues --input body.json',
    "gh api graphql -f query='mutation { addStar(input: {}) { clientMutationId } }'",
    'gh api graphql -F query=@q.graphql',
    'gh api repos/owner/repo/issues -f title=x -t graphql',
  ]

  for (const command of commands) {
    expect([command, isReadOnlyCommand(command)]).toEqual([command, false])
  }
})

test('MCP ツールは名前に読み取りの語があり、書き込みの語が無いものだけを読み取り専用とみなす', () => {
  const readOnly = [
    'mcp__doc__search_engineer',
    'mcp__doc__read_engineer',
    'mcp__claude_ai_Notion__notion-fetch',
    'mcp__claude_ai_Notion__notion-query-data-sources',
    'mcp__claude_ai_Gmail__get_thread',
    'mcp__claude_ai_Google_Drive__list_recent_files',
    'mcp__claude_ai_Figma__whoami',
    'mcp__github__listPullRequests',
  ]
  const writable = [
    'mcp__claude_ai_Gmail__send_message',
    'mcp__claude_ai_Gmail__create_draft',
    'mcp__claude_ai_Notion__notion-update-page',
    'mcp__claude_ai_Google_Drive__download_file_content',
    'mcp__claude_ai_Figma__use_figma',
    'mcp__claude_ai_Figma__weave_run_model',
    'mcp__example__get_or_create',
    'mcp__github__createIssue',
  ]

  for (const tool of readOnly) {
    expect([tool, isReadOnlyMcpTool(tool)]).toEqual([tool, true])
  }
  for (const tool of writable) {
    expect([tool, isReadOnlyMcpTool(tool)]).toEqual([tool, false])
  }
})
