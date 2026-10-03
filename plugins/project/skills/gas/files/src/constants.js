// プロジェクト全体で使う定数を置く。
// GAS では全ファイルが同じグローバル空間を共有するため、定数をこのファイルに集めて名前の重複を防ぐ。
// トップレベルでは値の定義だけを行う。他ファイルの関数を呼ぶと、ファイルの読み込み順によって失敗する。

// 秘匿値（API キー等）はコードに書かず、スクリプトプロパティに置く。ここにはプロパティのキー名だけを置く。
const PROPERTY_KEYS = Object.freeze({
  // TODO: 使うスクリプトプロパティのキーを追加する（例: SLACK_WEBHOOK_URL: 'SLACK_WEBHOOK_URL'）
});

// 定期実行の時刻。時刻は appsscript.json の timeZone（Asia/Tokyo）で解釈される。
const TRIGGER_HOUR = 9;
