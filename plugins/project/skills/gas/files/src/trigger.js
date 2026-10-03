// トリガーの登録・削除と、トリガーから呼ばれる入口関数を置く。
// トリガーに登録する関数はグローバル関数にし、名前の末尾に _ を付けない。

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
function onDailySchedule() {
  main();
}

function deleteTriggersFor_(handlerName) {
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === handlerName)
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));
}
