# `tmp.md` の書き方（commit）

`commit` の手順 9 で、提案したコミットメッセージを `tmp.md` に書くときに読む。1 つのファイルの中の変更を分けるときは、`split-within-file.md` の例の形にする。

## 1 コミットにまとめる場合

`tmp.md` に、コミットメッセージを 1 つの ` ```bash ` ブロックで書く。

````markdown
```bash
<type>: <subject>

Why:
- ...

What:
- ...
```
````

## 複数のコミットに分ける場合

コミットごとに、`git add` のコマンドのブロックと、メッセージのブロックを組にして書く。ブロックの直前に「コミット N — ステージ対象ファイル」を書く。

- 最初のコミットの `git add` のブロックは、先頭に `git reset` を入れ、今のステージを外してから add する。全ファイルがステージ済みでも、分けられるようにするため

````markdown
コミット 1 — `<fileA>` `<fileB>`

```bash
git reset
git add <fileA> <fileB>
```

```bash
<type>: <subject>

Why:
- ...

What:
- ...
```

コミット 2 — `<fileC>`

```bash
git add <fileC>
```

```bash
<type>: <subject>

Why:
- ...

What:
- ...
```
````
