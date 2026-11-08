# 導入時に聞くこと

`init-repo` の手順 2 で、導入計画と一緒に聞くことと、選ばれた内容を手順 3・5 で当てる方法。聞くのは、導入先によって答えが変わり、Claude が決められないことだけにする。引数の補足（`環境は Windows と macOS`・`pnpm を使う` など）で答えが分かっていれば、その問いは聞かず、どう読んだかを計画に書く。

- [想定する環境](#想定する環境)
- [docs のフォルダ](#docs-のフォルダ)
- [テスト戦略](#テスト戦略)
  - [戦略ごとの「テストの層」の表](#戦略ごとのテストの層の表)
- [パッケージマネージャー](#パッケージマネージャー)

## 想定する環境

フックは `bash` と `jq` で動く。Claude Code は、Windows で Git Bash が無いと、フックのコマンドを PowerShell で動かす（[フック](https://code.claude.com/docs/en/hooks) の `shell`）。そのため、`bash .claude/hooks/...` が起動できず、ガードも編集後の Lint も動かない。チームが使う環境を聞き、環境ごとに要る道具を計画に示す。

1. `AskUserQuestion`（`multiSelect: true`）で、想定する環境を聞く。選択肢は「Windows」「WSL」「macOS」「Linux」にし、今の環境を先頭に置いて「（推奨）」を付ける
1. 今の環境で、`bash --version` と `jq --version` を動かし、道具があるかを確かめる。無ければ、下の表の入れ方を計画に示す。道具は人が入れる
1. 選ばれた環境ごとに、要る道具と入れ方を、下の表から計画に示す

| 環境 | 要る道具 | 入れ方 |
| --- | --- | --- |
| Windows | Git for Windows（Git Bash）・jq | Git for Windows は [Claude Code の導入](https://code.claude.com/docs/en/setup) の案内に従う。jq は `winget install jqlang.jq` |
| WSL・Linux | jq | Debian・Ubuntu は `sudo apt-get install jq`。ほかは [jq の入手](https://jqlang.org/download/) |
| macOS | jq | `brew install jq` |

- フックは、環境に関係なく bash の形で配り、PowerShell 版は配らない（#273）。2 つの版を保守すると、片方だけが直されて守りがずれるため
- `settings.json` の deny は、環境に関係なく `Bash(...)` と `PowerShell(...)` を組で残す。Windows の Claude Code は、Bash と PowerShell のどちらのツールでもコマンドを動かすため
- Windows で Git Bash を入れないと決めたときは、フックが動かないことを計画に書き、それでも入れるかを確かめる

## docs のフォルダ

`docs/` の `specs/`・`architecture/`・`strategies/`・`adr/`・`runbook/` のうち、導入先に無く、範囲の引数で外されていないものを、入れるかを聞く。導入先にあるフォルダは聞かず、`SAME`・`DIFF` の扱いに従う。`runbook/` は雛形を配らないが、`CLAUDE.md` と `docs/README.md` が指すため聞く。

1. `AskUserQuestion`（`multiSelect: true`）で、入れるフォルダを聞く。1 問の選択肢は 4 つまでのため、「`specs/`・`architecture/`・`strategies/`」と「`adr/`・`runbook/`」の 2 問に分ける。聞くフォルダが 1 つだけの問いは、「入れる / 入れない」の単一選択にする
1. どのフォルダにも「（推奨）」を付ける。どれも土台の設計思想（[P6](https://github.com/Kazu-K0032/claude-plugins/blob/main/docs/policies/p06-common-template.md)）に入るため
1. 各選択肢の説明に、フォルダの役割（`template-inventory.md` の「要否の判定」）と、入れないときに外す参照（`template-inventory.md` の「依存関係」）を短く添える
1. 入れないと選ばれたフォルダは、手順 3 の `--only` から外す。外す参照を計画に並べて承認を得て、手順 3 のコピーの後に外す
1. 外す参照が `DIFF` のファイル（既存の `CLAUDE.md` など）にあるときは、手順 4 のマージで、その行を足さない

## テスト戦略

`docs/strategies/test-strategy.md` が `NEW` のときだけ、「テストの層」に使う戦略を聞く。

1. `AskUserQuestion` で聞く。選択肢は、下の 3 つの戦略と「使わない（`TODO:` のまま）」にする。説明には、各戦略の「向いている場面」を書く
1. 推奨は付けない。どの戦略が合うかは、作るものの形（画面が中心か・サービスが多いか）で変わり、Claude が決めることではないため
1. 戦略が選ばれたら、手順 3 のコピーの後に、`test-strategy.md` の「テストの層」の節にある `TODO:` 行の次の表を、下のその戦略の表に差し替える。表の上に、戦略の名前と出典を 1 行で書く。「使わない」なら、何も変えない
1. ファイルの名前は変えない（[P10](https://github.com/Kazu-K0032/claude-plugins/blob/main/docs/policies/p10-template-lifecycle.md) の Q&A）。差し替えた表の「対象」の `TODO` は、利用者が埋める

| 戦略 | 考え方 | 向いている場面 | 出典 |
| --- | --- | --- | --- |
| テストピラミッド | 速い単体テストを最も多くし、画面を通す広いテストを最も少なくする | 単体で確かめやすいロジックが多いもの | [TestPyramid](https://martinfowler.com/bliki/TestPyramid.html)（Martin Fowler。Mike Cohn が 2009 年の書籍で広めた） |
| テスティングトロフィー | 静的な検査を土台にし、結合テストを最も厚くする。テストが実際の使われ方に近いほど、確信が得られるとする | JavaScript・TypeScript の画面のアプリ | [The Testing Trophy and Testing Classifications](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications)（Kent C. Dodds） |
| テストハニカム | サービス単位の結合テストを中心にし、ほかのシステムの正しさで結果が変わるテストを最も少なくする | マイクロサービス（難しさが、サービス同士のやり取りにあるもの） | [Testing of Microservices](https://engineering.atspotify.com/2018/01/testing-of-microservices)（Spotify） |

量の目安に数値（割合）は書かない。出典の図は形を示すだけで、決まった割合を定めていないため。

### 戦略ごとの「テストの層」の表

差し替える表は、上の層から下の層の順に並べる。

テストピラミッド：

| 層 | 確かめること | 量 | 対象 |
| --- | --- | --- | --- |
| UI・E2E | 画面を通した利用者の操作の流れが、最後まで通るか | 最も少なく | TODO |
| サービス | 画面を通さず、サービスの層（API など）を通して、機能が動くか | 中くらい | TODO |
| 単体 | 関数・モジュールが、入力に対して決めた結果を返すか | 最も多く | TODO |

テスティングトロフィー：

| 層 | 確かめること | 量 | 対象 |
| --- | --- | --- | --- |
| E2E | 利用者と同じように画面を操作し、アプリが動くか | 少なく | TODO |
| 結合 | 複数の部品を組み合わせて、正しく動くか | 最も厚く | TODO |
| 単体 | 1 つの関数・部品が、単独で正しく動くか | 結合より少なく | TODO |
| 静的 | 型の検査・Lint で、書き間違いを動かす前に見つけられるか（`lefthook.yml` の `claude-edit`） | 土台 | TODO |

テストハニカム：

| 層 | 確かめること | 量 | 対象 |
| --- | --- | --- | --- |
| 統合されたテスト | ほかのシステムとつないだ状態で動くか（結果が、ほかのシステムの正しさで変わる） | 最も少なく | TODO |
| 結合 | サービスを 1 つ立ち上げ、外との境目（API・データベースなど）を通して、正しく動くか | 最も多く | TODO |
| 実装の詳細のテスト | 独立していて、中に固有の複雑さを持つ部分が、正しく動くか | 少なく | TODO |

## パッケージマネージャー

`package.json` がある導入先で、lefthook や Lint・整形のツールを Node のパッケージで入れるとき（`tooling.md` の「入れ方を決める」）に聞く。

1. 使っているものを、導入先の手がかりから探す。`package.json` の `packageManager`（例：`pnpm@9.0.0`）を先に見て、無ければ lock ファイル（`package-lock.json` は npm、`yarn.lock` は yarn、`pnpm-lock.yaml` は pnpm）を見る
1. `AskUserQuestion` で、「npm」「yarn」「pnpm」から聞く。見つかったものを先頭に置き、「（推奨）」を付ける。lock ファイルと違うものを使うと、lock ファイルが 2 つになり、チームで入る版がずれるため。手がかりが無ければ、Node に同梱される npm を先頭にする
1. yarn が選ばれたら、`yarn --version` で版を確かめる。2 以降なら、`.yarnrc.yml` の `nodeLinker` も見る。書いていなければ、既定の `pnp` として扱う。入れ方と `lefthook.yml` の `run` の書き方が、Yarn 1・Yarn 2 以降・PnP で違うため（`tooling.md`）
1. 選ばれたものを、手順 2 の計画（ツールの入れ方）と、手順 5（`lefthook.yml` の `run` と「動くかを確かめる」）に使う

## 保守

- `SKILL.md` の `allowed-tools` の `Bash(bash --version)`・`Bash(jq --version)`・`Bash(yarn --version)` は、この文書の問いで、道具があるかと版を確かめるためのもの。読み取りだけに絞るため、完全一致で入れる（[P1](https://github.com/Kazu-K0032/claude-plugins/blob/main/docs/policies/p01-operation-boundary.md) の「確認なしで任せる操作」）
- 戦略の説明と「テストの層」の表は、出典の記事に書かれたことだけで書く。戦略を足すときも、出典を確かめてから足す
