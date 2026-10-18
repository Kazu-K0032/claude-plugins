# 方針との照らし方

手順 5 で、件がマーケットプレイスの価値（`docs/values/`）・設計の方針（`docs/policies/`）とずれないかを確かめるときに読む。不具合でも、方針どおりの挙動（削除が deny で止まるなど）なら、ずれとして扱う。

## 確かめ方

1. 価値と方針の一覧を読む。`gh repo view --json nameWithOwner` が `Kazu-K0032/claude-plugins` を返すなら、手元の `docs/values/README.md`・`docs/policies/README.md` を `Read` で読む。リリース前の方針も含めるため。それ以外は、`gh api` で GitHub から読む

    ```bash
    gh api repos/Kazu-K0032/claude-plugins/contents/docs/values/README.md -H "Accept: application/vnd.github.raw"
    gh api repos/Kazu-K0032/claude-plugins/contents/docs/policies/README.md -H "Accept: application/vnd.github.raw"
    ```

1. 一覧の「読む場面」から関係する価値・方針を選び、そのファイル（一覧のリンク先）も同じ方法で読む
1. 件が、読んだ文書の決めごと（禁止・しないと決めたこと・Q&A の答え）と食い違うかを見る
1. ずれる、またはずれるか迷うときは、該当する価値・方針の番号・題・該当の文を示し、`AskUserQuestion` で「承知の上で起票する / ずれていない / やめる」を聞く。「承知の上で起票する」なら、ずれを承知で求める理由をユーザーに書いてもらう。「やめる」なら起票しない

## 読めない場合

`gh api` が失敗した・ログインしていないなどで読めないときは、照らさずに進み、照らしていないことを手順 11 で報告する。
