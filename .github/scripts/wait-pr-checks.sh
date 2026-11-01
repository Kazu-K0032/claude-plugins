#!/usr/bin/env bash
# bot が push した後に、PR のチェック（CI）が終わるまで待ち、結果を返す。claude-issue-to-pr.yml が呼ぶ。
# bot が書き換えられないよう、ワークフローは bot が動く前にこのファイルを $RUNNER_TEMP に写し、写しを流す。
#
# 使い方: wait-pr-checks.sh <PR 番号> <作業ブランチ> <失敗のログを書くファイル>
#   作業ブランチを取り直して手元をその先頭に合わせ、その先頭のコミットのチェックを待つ
# 結果:   result=pass / fail / unknown を、標準出力と $GITHUB_OUTPUT（あれば）に書く
#   pass    = すべてのチェックが通った（skipping を含む）
#   fail    = 落ちた・取り消されたチェックがある。落ちた実行のログの末尾を、3 つ目の引数のファイルに書く
#   unknown = ブランチを取れない、PR の先頭が合わない、チェックが出てこない、時間内に終わらない
# 環境変数: GH_TOKEN・GH_REPO（gh が使う）。APPEAR_LIMIT・FINISH_LIMIT（秒。待つ上限）。
#   EXPECT_SHA を渡すと、ブランチを取り直さずに、そのコミットを待つ（試すとき用）

set -uo pipefail

pr=$1
branch=$2
log=$3
appear_limit=${APPEAR_LIMIT:-300}
finish_limit=${FINISH_LIMIT:-1200}
interval=${INTERVAL:-20}

finish() {
  echo "result=$1"
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    echo "result=$1" >> "$GITHUB_OUTPUT"
  fi
  exit 0
}

# 待つコミットを決める。bot が push した先頭に手元も合わせ、次の直しが同じ内容から始まるようにする
sha=${EXPECT_SHA:-}
if [ -z "$sha" ]; then
  if ! git fetch --quiet origin "$branch"; then
    echo "作業ブランチ $branch を取れなかった"
    finish unknown
  fi
  git checkout --quiet -B "$branch" FETCH_HEAD
  sha=$(git rev-parse HEAD)
fi

start=$(date +%s)
elapsed() { echo $(( $(date +%s) - start )); }

# push の直後は、PR の先頭がまだ古いコミットのことがある。待つコミットになるまで待つ
while [ "$(gh pr view "$pr" --json headRefOid -q .headRefOid 2>/dev/null)" != "$sha" ]; do
  if [ "$(elapsed)" -ge "$appear_limit" ]; then
    echo "PR #$pr の先頭が $sha にならなかった"
    finish unknown
  fi
  sleep "$interval"
done

# 新しいコミットのチェックは、少し遅れて登録される。出てきて、すべて終わるまで待つ
while :; do
  checks=$(gh pr checks "$pr" --json name,bucket,link 2>/dev/null || echo '[]')
  [ -n "$checks" ] || checks='[]'
  total=$(jq 'length' <<< "$checks")
  pending=$(jq '[.[] | select(.bucket == "pending")] | length' <<< "$checks")
  if [ "$total" -eq 0 ] && [ "$(elapsed)" -ge "$appear_limit" ]; then
    echo "チェックが出てこなかった"
    finish unknown
  fi
  if [ "$total" -gt 0 ] && [ "$pending" -eq 0 ]; then
    break
  fi
  if [ "$(elapsed)" -ge "$finish_limit" ]; then
    echo "チェックが時間内に終わらなかった（残り $pending 件）"
    finish unknown
  fi
  sleep "$interval"
done

jq -r '.[] | "\(.bucket)\t\(.name)"' <<< "$checks"
failed=$(jq -r '.[] | select(.bucket == "fail" or .bucket == "cancel") | .link' <<< "$checks")
if [ -z "$failed" ]; then
  finish pass
fi

# 落ちたチェックのリンク（.../actions/runs/<実行の ID>/job/<ジョブの ID>）から実行を取り、失敗したジョブのログの末尾を集める
: > "$log"
for run in $(sed -nE 's#.*/actions/runs/([0-9]+).*#\1#p' <<< "$failed" | sort -u); do
  {
    echo "## 落ちた実行 $run"
    echo
    echo '```text'
    gh run view "$run" --log-failed 2>/dev/null | tail -n 150
    echo '```'
    echo
  } >> "$log"
done
[ -s "$log" ] || jq -r '.[] | select(.bucket == "fail" or .bucket == "cancel") | "- \(.name)（\(.link)）"' <<< "$checks" > "$log"
finish fail
