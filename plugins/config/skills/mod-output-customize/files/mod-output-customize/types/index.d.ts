declare module 'claude-code' {
  interface PluginState {
    /**
     * isChatMode: チャットモード（読み取り専用）か（サイドバーか入力欄の上のボタンで切り替える）
     * isCustomized: 応答を mod の形式で書かせるか（サイドバーか入力欄の上のボタンで切り替える）
     * isDocConcise: Issue・PR の本文など外に書き出す文書を簡潔に書かせるか（サイドバーか入力欄の上のボタンで切り替える）
     */
    'mod-output-customize': { isChatMode: boolean; isCustomized: boolean; isDocConcise: boolean }
  }
}
