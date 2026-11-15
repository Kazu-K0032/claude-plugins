/**
 * @file スプレッドシートのメニューを作り、メニューから呼ぶ関数（今すぐ実行・定期実行の設置と解除・定期実行の説明）を置く。
 * エディタを開かずに、スプレッドシートの画面から操作できるようにするため。
 * メニューを作れるのは、スプレッドシートなどに紐づいた（バインドされた）スクリプトだけ。単独のスクリプトでは、
 * このファイルと trigger.js の onOpen を消してよい。ドキュメント・フォームに紐づく場合は、SpreadsheetApp を
 * DocumentApp・FormApp に替える。
 * メニューから呼ぶ関数は、名前で呼ばれるため、名前の末尾に _ を付けない。
 */

/** メニューの名前。 */
// TODO: メニューの名前を、プロジェクトに合わせて決める
const MENU_TITLE = 'スクリプト';

/** 登録済みのトリガーの種類を、説明に出す言葉に直す表。 */
const MENU_TRIGGER_EVENT_LABELS = Object.freeze({
  CLOCK: '時刻',
  ON_OPEN: '開いたとき',
  ON_EDIT: '編集したとき',
  ON_CHANGE: '変更したとき',
  ON_FORM_SUBMIT: 'フォームを送信したとき'
});

/**
 * メニューを足す。trigger.js の onOpen から呼ぶ。
 * onOpen は 30 秒で打ち切られるため、メニューを作るだけにする。
 */
function onOpen_() {
  SpreadsheetApp.getUi()
    .createMenu(MENU_TITLE)
    .addItem('今すぐ実行する', 'runMainFromMenu')
    .addSeparator()
    .addItem('定期実行を設置する', 'setupTriggersFromMenu')
    .addItem('定期実行を解除する', 'deleteTriggersFromMenu')
    .addSeparator()
    .addItem('定期実行の説明', 'showTriggerGuide')
    .addToUi();
}

/**
 * メニューの「今すぐ実行する」から呼ぶ。定期実行を待たずに、_main.js の main を今すぐ実行する。
 * 失敗したら、画面に知らせる。
 */
function runMainFromMenu() {
  const ui = SpreadsheetApp.getUi();
  try {
    main();
    ui.alert('実行した。');
  } catch (error) {
    ui.alert(`実行できなかった。\n\n${error}`);
  }
}

/**
 * メニューの「定期実行を設置する」から呼ぶ。trigger.js の setupTriggers で作り直し、登録の結果を見せる。
 */
function setupTriggersFromMenu() {
  setupTriggers();
  SpreadsheetApp.getUi().alert(`定期実行を設置した。\n\n${buildTriggerGuideText_(TRIGGERS, readRegisteredTriggers_())}`);
}

/**
 * メニューの「定期実行を解除する」から呼ぶ。確かめてから、trigger.js の deleteTriggers で消す。
 * 押し間違いで、定期実行が止まらないようにするため、先に確かめる。
 */
function deleteTriggersFromMenu() {
  const ui = SpreadsheetApp.getUi();
  const answer = ui.alert('定期実行を解除する', '定期実行が止まる。解除してよいか。', ui.ButtonSet.YES_NO);
  if (answer !== ui.Button.YES) {
    return;
  }
  deleteTriggers();
  ui.alert('定期実行を解除した。再開するときは、メニューの「定期実行を設置する」を押す。');
}

/**
 * メニューの「定期実行の説明」から呼ぶ。登録する定期実行の一覧と、今のアカウントで登録済みのものを見せる。
 */
function showTriggerGuide() {
  SpreadsheetApp.getUi().alert(buildTriggerGuideText_(TRIGGERS, readRegisteredTriggers_()));
}

/**
 * 今のアカウントがこのプロジェクトで登録したトリガーを読む。
 * @return {{handler: string, type: string}[]} 呼ぶ関数と、トリガーの種類（CLOCK など）
 */
function readRegisteredTriggers_() {
  return ScriptApp.getProjectTriggers().map((trigger) => ({
    handler: trigger.getHandlerFunction(),
    type: String(trigger.getEventType())
  }));
}

/**
 * 定期実行の説明の文を作る。GAS のサービスを使わないため、手元の Node.js で確かめられる（tests/menu.test.js）。
 * @param {{handler: string, atHour: number, description: string}[]} definitions 登録する定期実行（trigger.js の TRIGGERS）
 * @param {{handler: string, type: string}[]} registered 今のアカウントで登録済みのトリガー
 * @return {string} 説明の文
 */
function buildTriggerGuideText_(definitions, registered) {
  const planned = definitions.map((definition) => `・毎日 ${definition.atHour} 時台：${definition.description}（${definition.handler}）`);
  const current = registered.length === 0
    ? ['・まだ登録されていない。メニューの「定期実行を設置する」を押す。']
    : registered.map((trigger) => `・${trigger.handler}（${MENU_TRIGGER_EVENT_LABELS[trigger.type] || trigger.type}）`);
  const plannedHandlers = definitions.map((definition) => definition.handler).sort().join(',');
  const registeredHandlers = registered.map((trigger) => trigger.handler).sort().join(',');
  const mismatch = registered.length > 0 && plannedHandlers !== registeredHandlers
    ? ['', '登録済みのものが、登録する一覧と合わない。「定期実行を設置する」を押すと、一覧のとおりに作り直す。']
    : [];
  return [
    '【登録する定期実行】',
    ...planned,
    '',
    '【今のアカウントで登録済み】',
    ...current,
    ...mismatch,
    '',
    '【注意】',
    '・設置と解除の対象は、押したアカウントが登録したトリガーだけ。別のアカウントで登録したものは残り、同じ処理が 2 回動くことがある。',
    '・「今すぐ実行する」は、定期実行を待たずに今すぐ実行する。'
  ].join('\n');
}
