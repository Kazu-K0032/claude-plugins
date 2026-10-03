// 複数の機能が使う共通関数を置く。1 つの機能だけが使う関数は、その機能のファイルに置く。
// 外から直接呼ばせない関数のため、名前の末尾に _ を付ける（google.script.run やライブラリの利用側から呼べなくなる）。

function formatDate_(date, pattern = 'yyyy-MM-dd HH:mm:ss') {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), pattern);
}

// 未設定のまま処理が進むと原因の分かりにくい失敗になるため、取得時点で止める
function getScriptProperty_(key) {
  const value = PropertiesService.getScriptProperties().getProperty(key);
  if (value === null) {
    throw new Error(`スクリプトプロパティ ${key} が設定されていない`);
  }
  return value;
}
