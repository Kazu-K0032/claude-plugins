declare module 'claude-code' {
  interface PluginState {
    /**
     * isChatMode: チャットモード（読み取り専用）か（サイドバーか入力欄の上のボタンで切り替える）
     * isCustomized: 応答を mod の形式で書かせるか（サイドバーか入力欄の上のボタンで切り替える）
     * hasLoadedToggles: 保存した on/off を読み込んだか（/clear などで既定値に戻ったら読み直す）
     * nextSuggestion: 最新の応答の次アクションにある、Claude ができる作業の依頼文（入力欄の候補に出す。無ければ空文字）
     */
    'mod-output-customize': {
      isChatMode: boolean
      isCustomized: boolean
      hasLoadedToggles: boolean
      nextSuggestion: string
    }
  }
}
