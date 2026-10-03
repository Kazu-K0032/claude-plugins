// トリガーの登録・削除と、トリガーから呼ばれる入口関数を置く。「いつ何が動くか」の一覧として読めるよう、
// 入口は機能ごとのファイル（または main.js）の関数を呼ぶ 1〜3 行だけにする。
// トリガーに登録する関数はグローバル関数にし、名前の末尾に _ を付けない。

// 定期実行の時刻。時刻は appsscript.json の timeZone（Asia/Tokyo）で解釈される。
// このファイルだけが使う設定のため、constants.js ではなくここに置く。
const TRIGGER_HOUR = 9;

// 登録用の関数。エディタの実行メニューから手動で 1 回実行する。
// 何度実行しても同じトリガーが重複しないよう、登録前に同じ関数のトリガーを消す。
function setupTriggers() {
  deleteTriggersFor_('onDailySchedule');
  ScriptApp.newTrigger('onDailySchedule')
    .timeBased()
    .everyDays(1)
    .atHour(TRIGGER_HOUR)
    .create();
}

// 定期実行をやめるときに実行する。
// エディタから手で作ったトリガーまで消さないよう、このファイルで登録したものだけを消す。
function deleteTriggers() {
  deleteTriggersFor_('onDailySchedule');
}

// 時間主導型トリガーから呼ばれる入口。処理の本体は main.js に置く。
// main.js を消した場合は、呼び出し先を機能のファイルの関数に替える。
function onDailySchedule() {
  main();
}

function deleteTriggersFor_(handlerName) {
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === handlerName)
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));
}
