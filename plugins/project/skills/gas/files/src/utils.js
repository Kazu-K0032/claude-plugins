/**
 * @file 複数の機能が使う共通関数を置く。1 つの機能だけが使う関数は、その機能のファイルに置く。
 * 外から直接呼ばせない関数のため、名前の末尾に _ を付ける（google.script.run やライブラリの利用側から呼べなくなる）。
 */

/**
 * 日時を、スクリプトのタイムゾーンで文字列に整形する。
 * @param {Date} date 整形する日時
 * @param {string} [pattern='yyyy-MM-dd HH:mm:ss'] 出力の書式（Utilities.formatDate の書式）
 * @return {string} 整形した文字列
 */
function formatDate_(date, pattern = 'yyyy-MM-dd HH:mm:ss') {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), pattern);
}

/**
 * スクリプトプロパティの値を取得する。
 * 未設定のまま処理が進むと原因の分かりにくい失敗になるため、取得時点で止める。
 * @param {string} key スクリプトプロパティのキー名
 * @return {string} 設定されている値
 * @throws {Error} スクリプトプロパティが設定されていないとき
 */
function getScriptProperty_(key) {
  const value = PropertiesService.getScriptProperties().getProperty(key);
  if (value === null) {
    throw new Error(`スクリプトプロパティ ${key} が設定されていない`);
  }
  return value;
}
