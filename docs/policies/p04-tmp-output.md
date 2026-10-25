# P4 スキルの下書きやレポートは tmp に出し、コミットに混ぜないこと

| 区分 | 内容 |
| --- | --- |
| 対象 | `aidd` の `commit`・`docs-sync`・`issue-pr-sync`・`issue-start`・`pr-create`・`ai-report`・`pr-review`・`harness-audit`。スキルを使わない作業で Claude が作る作業ファイルも含む |
| 価値 | [V2](../values/v02-understand-before-accept.md)・[V3](../values/v03-human-judgment.md)・[V5](../values/v05-mechanisms-over-habits.md) |

レポートや下書きは `tmp/<ブランチ名>/` と `tmp.md` に書き、`.gitignore` でコミットから外す。

- 作業用の一時ファイル（スクリプト・中間ファイル・確認用の画像）は、`tmp/<ブランチ名>/work/<目的>/` に置く。`<目的>` には、作業の中身が分かる英語の短い名前を付ける（例：`merge-conflict`）。削除は禁止のため、消さずに済む場所に置き、スキルの出力と分ける（[P1](p01-operation-boundary.md)）
- ブランチ名の `/` は `-` に置き換える（例：`issues/1-sample` → `tmp/issues-1-sample/`）。1 つのブランチの出力を 1 か所にまとめるため
- 1 回の実行で同じ種類のファイルを何度も書き出すスキルは、`tmp/<ブランチ名>/<スキル名>/` にまとめる（例：`tmp/issues-1-sample/issue-start/`）。中のファイル名には、スキル名を付けない
- それ以外のスキルは、`tmp/<ブランチ名>/` の直下に書く
- Python のスクリプトは `python -B` で実行し、`__pycache__` を作らない。`init-repo` は、環境変数 `PYTHONDONTWRITEBYTECODE=1` を `settings.json` の `env` に入れて、仕組みでも止める

## 理由

- 【コミットへの混入】作業中のファイルを、コミットに混ぜたくないから
- 【見分けやすさ】何度も書き出す出力や作業ファイルが直下に並ぶと、ほかのスキルの出力と混ざって見分けにくいから
- 【人が消しやすい】削除は人が行う。作業ファイルが 1 か所にまとまり、目的ごとに分かれていれば、消してよい範囲を選びやすいから
- 【キャッシュ】Python は、読み込んだファイルの `.pyc` を `__pycache__` に書く。Claude は消せないため、人が消すファイルが増えるから

## 変えたいとき

- `init-repo` を使っていないリポジトリでは、`.gitignore` に `tmp/` と `tmp.md` を自分で足す。足していなくても `aidd` のスキルは書き、足すよう伝える
- Python のキャッシュを止める環境変数が要らないリポジトリでは、`.claude/settings.json` の `env` から `PYTHONDONTWRITEBYTECODE` を外す

## Q&A

### Q. スキルのレポートや下書きを、どこに出す？

`tmp/<ブランチ名>/` に出す。ブランチ名の `/` は `-` に置き換える。コミットメッセージだけは `tmp.md` に書く。

### Q. 出力を、スキル名のサブディレクトリにまとめるか迷う

1 回の実行で同じ種類のファイルを何度も書き出すなら、まとめる（`issue-start` の Issue の本文、`issue-pr-sync` の Issue・PR の本文と反映前の本文など）。1 回に 1 つずつ書くだけなら、直下に書く（`pr-create`・`pr-review` など）。

まとめるときは、`allowed-tools` に `Edit(tmp/*/<スキル名>/*.md)` と 2 階層を書く。`tmp/*/` の `*` は、1 階層だけに当たるため。

### Q. スクリプトや確認用の画像など、作業で作ったファイルをどこに置く？

`tmp/<ブランチ名>/work/<目的>/` に置く。スキルを使わない作業でも同じ。同じ作業のファイルは、同じ `<目的>` のフォルダにまとめる。人が作業の単位でまとめて消せるようにするため。`init-repo` が配る `.claude/rules/tmp-output.md` で、利用先の Claude に届ける。

### Q. Python のスクリプトを実行すると、`__pycache__` ができる

`python -B` で実行する。環境変数 `PYTHONDONTWRITEBYTECODE=1` は、既存の利用先の `settings.json` に自動では入らない。そのため、手順にも `-B` を書いている。

### Q. ほかのスキルの手順で、そのスキルの出力を書く

そのスキルの置き方に合わせる。たとえば、`issue-start` が `pr-create` の手順で書く PR 本文は、`pr-create` と同じく直下に置く。同じ種類の出力を、1 か所で探せるようにするため。

### Q. スキルの出力を、リポジトリに残したい（ADR など）

`tmp/` には置かない。リポジトリの規約の場所に書く。場所が決まっていなければ、[P3](p03-check-placement.md) のとおり利用者に聞く。
