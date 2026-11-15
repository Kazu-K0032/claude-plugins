/**
 * @file メニューの「定期実行の説明」の文と、登録する定期実行の一覧（trigger.js の TRIGGERS）を確かめる。
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGas } = require('./load-gas');

const gas = loadGas(['trigger.js', 'menu.js'], ['TRIGGERS', 'buildTriggerGuideText_']);

test('登録する定期実行は、すべて時刻と説明を持つ', () => {
  gas.TRIGGERS.forEach((trigger) => {
    assert.ok(Number.isInteger(trigger.atHour) && trigger.atHour >= 0 && trigger.atHour <= 23);
    assert.ok(typeof trigger.description === 'string' && trigger.description.length > 0);
  });
});

test('まだ登録されていないときは、設置を促す', () => {
  const text = gas.buildTriggerGuideText_([{ handler: 'run', atHour: 9, description: '集計' }], []);
  assert.ok(text.includes('・毎日 9 時台：集計（run）'));
  assert.ok(text.includes('まだ登録されていない'));
  assert.ok(!text.includes('合わない'));
});

test('登録済みのものが一覧と合わないときだけ、作り直しを促す', () => {
  const definitions = [{ handler: 'run', atHour: 9, description: '集計' }];
  const same = gas.buildTriggerGuideText_(definitions, [{ handler: 'run', type: 'CLOCK' }]);
  assert.ok(same.includes('・run（時刻）'));
  assert.ok(!same.includes('合わない'));
  const different = gas.buildTriggerGuideText_(definitions, [
    { handler: 'run', type: 'CLOCK' },
    { handler: 'old', type: 'CLOCK' }
  ]);
  assert.ok(different.includes('合わない'));
});
