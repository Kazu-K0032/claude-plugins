declare module 'claude-code' {
  interface PluginState {
    /**
     * isChatMode: チャットモード（読み取り専用）か（サイドバーか入力欄の上のボタンで切り替える）
     * isCustomized: 応答を mod の形式で書かせるか（サイドバーか入力欄の上のボタンで切り替える）
     * isDocConcise: Issue・PR の本文など外に書き出す文書を簡潔に書かせるか（サイドバーか入力欄の上のボタンで切り替える）
     * isSummaryOnly: 応答の概要を畳み、簡潔版と次アクションだけを見せるか（サイドバーか入力欄の上のボタンで切り替える）
     * nextSuggestion: 最新の応答の次アクションにある、Claude ができる作業の依頼文（入力欄の候補に出す。無ければ空文字）
     */
    'mod-output-customize': {
      isChatMode: boolean
      isCustomized: boolean
      isDocConcise: boolean
      isSummaryOnly: boolean
      nextSuggestion: string
    }
  }
}
