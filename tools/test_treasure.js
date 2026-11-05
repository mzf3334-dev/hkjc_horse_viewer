#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function section(start, end) {
  const first = html.indexOf(start);
  const last = html.indexOf(end, first + start.length);
  assert(first >= 0 && last > first, `Missing section: ${start}`);
  return html.slice(first, last);
}
const code = [
  section('function stripCode(', 'function isValidRaceEntry('),
  section('function parseCSV(', 'function detectPos('),
  section('function glmEpoch(', 'function glmMedian('),
  section('function glmParseRank(', 'function glmParseRider('),
  section('function findTreasureRides(', '/* ── Render race strip'),
].join('\n');
const elements = {
  trBody: { innerHTML: '', textContent: '' },
  trJockey: { value: '黃寶妮' },
};
const document = { getElementById: id => elements[id] };
const init = new Function('document', `${code}
  let D = [], RACECARD = null;
  return { findTreasureRides, parseCSV, searchTreasure,
    setData(history, racecard) { D = history; RACECARD = racecard; } };`);
const app = init(document);

function row(date, horse, jockey, rank) {
  return [date, '', '', '', rank, '', horse, jockey];
}
const racecard = {
  date: '2026/11/04', venue: 'HV',
  races: [{ race_no: '1', distance: '1200米', going: '好地', entries: [
    { horse_name: '前七' }, { horse_name: '第八' }, { horse_name: '未完成' },
    { horse_name: '同日' }, { horse_name: '未出賽' }, { horse_name: '其他騎師' },
  ] }],
};
const history = [
  row('2026/11/03', '前七(A001)', '黃寶妮 (-7)', '7'),
  row('2026/11/02', '第八(A002)', '黃寶妮', '8'),
  row('2026/11/01', '未完成(A003)', '黃寶妮（-7）', 'DNF'),
  row('2026/11/04', '同日(A004)', '黃寶妮', '1'),
  row('2026/11/05', '同日(A004)', '黃寶妮', '1'),
  row('2026/11/03', '未出賽(A005)', '黃寶妮', 'WV'),
  row('2026/11/03', '其他騎師(A006)', '潘頓', '1'),
];
const results = app.findTreasureRides(history, racecard, '黃寶妮');
assert.deepEqual(results.map(r => r.horse), ['前七', '第八', '未完成']);
assert.equal(results[1].dist, '1200米');
assert.equal(results[1].venue, 'HV');
assert.equal(results[1].going, '好地');
assert.throws(() => app.findTreasureRides(history, { ...racecard, date: '' }, '黃寶妮'));
app.setData(history, racecard);
app.searchTreasure();
assert.match(elements.trBody.innerHTML, /第八/);
assert.doesNotMatch(elements.trBody.innerHTML, /同日/);
elements.trJockey.value = '<不存在>';
app.searchTreasure();
assert.match(elements.trBody.innerHTML, /&lt;不存在&gt;/);

if (process.argv.length > 3) {
  const actualHistory = app.parseCSV(fs.readFileSync(process.argv[2], 'utf8'));
  const actualCard = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
  const actual = app.findTreasureRides(actualHistory, actualCard, '黃寶妮');
  assert.equal(actualCard.date, '2026/11/04');
  assert.deepEqual(actual.map(r => r.horse), [
    '馬運高', '精算奕然', '精益大師', '飛躍成就', '螢影飛馳', '金滙千帥',
    '做好自己', '傲視同群', '快活英雄', '家樂龍駒', '關鍵所在', '安康萬里',
  ]);
  console.log('11/04 黃寶妮: ' + actual.map(r => `${r.race}場 ${r.horse}`).join('、'));
}
console.log('Treasure search tests passed.');
