# architecture

## このディレクトリは何か

どう作るかを書く場所。システム全体の構成・構成要素の責務・インフラの構成図など、全体像をつかむための文書を置く。個別の判断の理由は `adr/` に分けて残す。

## いつ読むか

- 全体像をつかみたいとき
- 新しい構成要素を足す判断の前
- インフラや配信の経路を変える前

## 文書一覧

| ファイル | 内容 |
| --- | --- |
| [architecture.template.md](architecture.template.md) | アーキテクチャ概要の雛形（構成図・構成要素・環境ごとの違い・経路）。実物は `architecture.md` |
| [architecture.template.drawio](architecture.template.drawio) | インフラの構成図のソースの雛形（AWS の例）。draw.io で開いて編集する。実物は `architecture.drawio` |
| [architecture.template.png](architecture.template.png) | 上の構成図を draw.io で書き出した PNG。実物は `architecture.png` |

## 書き方

- 構成図は、draw.io のソース（`.drawio`）と、書き出した PNG（`.png`）を対にして置く。PNG は文書に貼って読むため、ソースを直したら PNG も書き出し直す
- PNG は、draw.io の「ファイル > エクスポート > PNG」で書き出す。「図のコピーを含める」をオンにすると、PNG からも編集に戻せる
- 実物を作ったら、上の表を実物の行に差し替え、雛形の削除を利用者に提案する（手順は [docs/README.md](../README.md) の「雛形から実物を作るとき」）

## ADR との違い

- *アーキテクチャ*（ここ）: 構成の現在地。変えたときは、本文を書き換える
- *ADR*（`adr/`）: 個別の判断の履歴。過去の ADR は書き換えず、新しい ADR で置き換える
