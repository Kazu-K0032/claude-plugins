# コミットメッセージの出力形式

`tmp.md` に書くコミットメッセージの形を示す。`SKILL.md` の手順 5 で、`tmp.md` に書くときに読む。

## 1コミットにまとめる場合

`tmp.md` にコミットメッセージを1つの ` ```bash ` ブロックで書き込む。

````markdown
```bash
<type>: <subject>

Why:
- ...

What:
- ...
```
````

## 複数コミットに分割する場合

コミットごとに `git add` コマンドブロックとメッセージブロックをセットで記載する。ブロック直前に「コミット N — ステージ対象ファイル」を記載する。**最初のコミットの `git add` ブロックは `git reset` を先頭に入れ、既存のステージ状態を解除してから add する**（全ファイルがステージ済みでも分割を確実にするため）。

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
