/**
 * @file トリガーの登録・削除と、トリガーから呼ばれる入口関数を置く。「いつ何が動くか」の一覧として読めるよう、
 * 入口は機能ごとのファイル（または _main.js）の関数を呼ぶ 1〜3 行だけにする。
 * トリガーに登録する関数はグローバル関数にし、名前の末尾に _ を付けない。
 */

/**
 * 登録するトリガーの一覧。トリガーを足す・やめるときは、この一覧と下の入口の関数だけを変え、setupTriggers を実行し直す。
 * atHour: 毎日その時刻（時）台に動かす。時刻は appsscript.json の timeZone（Asia/Tokyo）で解釈される。
 * description: 何をするか。メニューの「定期実行の説明」に出る（menu.js）。
 * このファイルだけが使う設定のため、constants.js ではなくここに置く。
 */
const TRIGGERS = [
  // TODO: description に、この定期実行が何をするかを書く
  { handler: 'onDailySchedule', atHour: 9, description: '中心となる業務フローを実行する' }
];

/**
 * トリガーの登録用の関数。メニューの「定期実行を設置する」（menu.js）か、エディタの実行メニューから、
 * 毎回同じ Google アカウントで手動で実行する。
 * 実行したアカウントのトリガーをすべて消してから TRIGGERS の分だけ作り直すため、何度実行しても重複せず、
 * 一覧から外したトリガーや、エディタの「トリガー」画面で手作業で作ったトリガーも消える。
 * 別のアカウントで作ったトリガーは消えずに残り、同じ処理が 2 回動くことがある。
 */
function setupTriggers() {
  deleteTriggers();
  TRIGGERS.forEach((trigger) => {
    ScriptApp.newTrigger(trigger.handler)
      .timeBased()
      .everyDays(1)
      .atHour(trigger.atHour)
      .create();
  });
}

/**
 * 定期実行をすべてやめるときに実行する。
 * 消えるのは、実行したアカウントがこのプロジェクトで作ったインストール型トリガーだけ（onOpen・onEdit は消えない）。
 */
function deleteTriggers() {
  ScriptApp.getProjectTriggers().forEach((trigger) => ScriptApp.deleteTrigger(trigger));
}

/**
 * 時間主導型トリガーから呼ばれる入口。処理の本体は _main.js に置く。
 * _main.js を消した場合は、呼び出し先を機能のファイルの関数に替える。機能のファイルの本体は、
 * 入口と同じ名前の末尾に _ を付けた名前にする（例: onDailySchedule → onDailySchedule_）。
 */
function onDailySchedule() {
  main();
}

/**
 * ファイルを開いたときに呼ばれる入口（シンプルトリガー）。メニューを足す。本体は menu.js に置く。
 * メニューを作れるのは、スプレッドシートなどに紐づいた（バインドされた）スクリプトだけ。単独のスクリプトでは呼ばれない。
 * 30 秒で打ち切られるため、メニューを作る以外の処理を入れない。Ref: https://developers.google.com/apps-script/guides/menus
 */
function onOpen() {
  onOpen_();
}
