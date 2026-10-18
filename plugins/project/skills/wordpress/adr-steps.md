# Lint の規則を決めた理由を ADR に足す

`wordpress` の手順 9 で、この実行で `phpcs.xml.dist` を入れたときに使う。元にする ADR は `${CLAUDE_PLUGIN_ROOT}/skills/wordpress/adr/php-coding-standards.md`。あとから「なぜ整形の規則を外したか」を確かめられるようにするため、規則を決めた理由を利用先の ADR として足す。コメントを日本語で書くために外した規則（`Squiz.Commenting.InlineComment.InvalidEndChar`・`Generic.Commenting.DocComment.LongNotCapital`・`Squiz.Commenting.FunctionComment.ParamCommentFullStop`）の理由は、`phpcs.xml.dist` のコメントにある。

## 手順

1. ADR の置き場所を決める。`CLAUDE.md`・`.claude/rules/` に置き場所があればそこにする。無ければ `docs/adr/`・`doc/adr/`・`docs/decisions/`・`adr/` を Glob で探す。どれも無ければ、`AskUserQuestion` で「置き場所の候補・ADR を作らない」から選んでもらう。推測した場所には置かない
1. 置き場所に `*-php-coding-standards.md` が既にあれば、足さない
1. `date +%Y-%m-%d` で今日の日付を取る。元の ADR を Read し、`YYYY-MM-DD` を今日の日付に、仮の名前を手順 5 と同じ名前・順に置き換え、`<置き場所>/<日付>-php-coding-standards.md` に書く
1. 置き場所の一覧（`README.md`）の表に 1 行足す。題は ADR の見出しの `# ADR <日付>:` より後ろにし、状態は `承認済み` にする。表の列が違えば、今の一覧の形に合わせる。一覧が無ければ作らず、手順 10 で伝える
