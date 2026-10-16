# 設計思想の要約（ハーネス監査の物差し）

`/aidd:harness-audit` が、リポジトリ全体を本マーケットプレイスの設計思想（aidd × DocDD）に当てるときの物差し。利用先には価値と方針の文書が配られないため、要点をここに置く。

正典は、マーケットプレイスのリポジトリの `docs/values/`（価値）・`docs/policies/`（方針）と、`project` の `init-repo` の README（土台の収録物）。これは要約で、食い違えば正典を正とする。

## 価値

| 番号 | 価値 | ファイルで確かめられる表れ |
| --- | --- | --- |
| V1 | 作業時間の短縮ではなく、成果物の質と量を高めること | 確かめる手順（検査・検証コメント・レビュー）を省く作りになっていない |
| V2 | AI の出力は、説明できるまで理解してから受け入れること | AI の出力を、人が読まずにそのまま反映・投稿する手順が無い |
| V3 | 何を作るかと、これで良いかの判断は、人が持つこと | コミット・push・マージ・リリースを AI に任せる設定・手順が無い |
| V4 | 判断の理由を残し、人と AI があとでたどれるようにすること | 判断が ADR・規約・`CLAUDE.md` に理由とともに残っている。規約に「なぜ」がある |
| V5 | よいやり方を、個人の心がけでなく仕組みでそろえること | 守らせたいことが、文章の頼みだけでなく deny・フック・CI・スキルの手順になっている |

影響が自分に閉じる個人開発・技術検証・試作は、AI に任せきってよい。価値に反するとは扱わない。

## 利用先に効く方針

| 番号 | 方針 | 要点 |
| --- | --- | --- |
| P1 | Claude に任せる操作と、人が行う操作を分けること | 削除・権限の変更・コミット・push と、間違えると深刻な外部操作（マージ・承認・リリース・ワークフローの実行など）は、deny などで止めて人が行う。それ以外は止めない |
| P3 | ADR などの文書は、プロジェクトの規約どおりの場所に置くこと | 置き場所を規約（`CLAUDE.md` など）に書き、そこに置く。推測した場所に置かない |
| P4 | スキルの下書きやレポートは tmp に出し、コミットに混ぜないこと | レポート・下書きは `tmp/<ブランチ名>/`、コミットメッセージは `tmp.md` に書き、どちらも `.gitignore` に入れる。作業ファイルは `tmp/<ブランチ名>/work/<目的>/` に置く |
| P7 | README には本文を書かず、どこに何があるかの案内にとどめること | 手順・設計・仕様は `docs/` などに 1 か所だけ書き、README からはリンクで案内する。ルートの README から `docs/` へは `docs/README.md` だけを案内する |
| P8 | Issue・PR の本文は、人が読み切れる長さにすること | 本文は 500 文字以内、1 文・1 項目は 50 文字以内。テンプレートに上限を示す |

DocDD の土台として、同じ情報は唯一の情報源に 1 か所だけ書き、ほかからはリンクで指す（SSOT）。

## 土台の仕組み

`init-repo` が入れる土台を、役割で並べる。パスや書き方が違っても、役割を果たしていれば欠けとしない。技術別のスキル（`gas`・`terraform`・`wordpress`）が足すものは含めない。

| 仕組み | 確かめる手がかり | 欠けたときの重大度 |
| --- | --- | --- |
| コミット・push・削除・権限の変更・深刻な外部操作を止める | `.claude/settings.json` の `permissions.deny`（`git commit`・`git push`・`rm`・`gh pr merge`・`gh release` など） | high |
| 秘匿ファイルの読み取りを止める | `permissions.deny` の `Read(./.env)` など | high |
| 破壊的な操作を承認へ回す | PreToolUse のフック（`guard-destructive.sh` など） | high |
| コミット・PR に Claude の署名を付けない | `settings.json` の `attribution` が空 | low |
| 操作の線引きと理由を、利用先の Claude に伝える | `.claude/rules/permissions.md` など | medium |
| 作業ファイルをコミットから外す | `.gitignore` の `tmp/`・`tmp.md` | medium |
| `tmp/` の置き方を伝える | `.claude/rules/tmp-output.md` など | low |
| 判断を残し、毎回読む | ADR の一覧（`docs/adr/README.md` など）と、`CLAUDE.md` での読み込み、ADR の規約 | medium |
| Claude への指示の入口 | `CLAUDE.md`（禁止事項・手順・唯一の情報源の一覧） | medium |
| README を案内板にする | `.claude/rules/readme.md` などと `docs/README.md` | low |
| 秘密の混入を CI で止める | シークレットスキャン（gitleaks など）の CI | medium |
| Issue・PR の定型 | Issue・PR のテンプレート（本文の長さの上限を示す） | low |
| 編集後に Lint・整形を動かす | PostToolUse のフックと、その定義（`lefthook.yml` など） | low |
| コミット規約を検証する（Node のプロジェクトだけ） | `commitlint.config.*` など | low |

重大度が low・medium の欠けは、意図して入れていないなら無視してよい。`init-repo` は、一部だけ入れることもできるため。

## init-repo の印

次のうち 2 つ以上があれば、土台が入っているとみなし、仕組みの欠けを見る。1 つ以下なら、欠けは見ない。

- `.claude/rules/permissions.md`
- `.claude/rules/tmp-output.md`
- `.claude/hooks/guard-destructive.sh`
- `.claude/hooks/session-start.sh`
- `docs/adr/README.md`
