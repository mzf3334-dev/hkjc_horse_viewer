#!/usr/bin/env node
/*
 * End-to-end smoke test for the "GLM 5.3 洞燭先機" model embedded in index.html.
 *
 * Extracts the model core (with the trained weights) from index.html, rebuilds
 * the online index from all_results.csv, and scores the most recent race as if
 * it were tomorrow's race card — the same code path the browser runs.
 *
 * Usage:
 *   node tools/smoke_glm.js [path/to/all_results.csv]
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const htmlPath = path.resolve(__dirname, '..', 'index.html');
const csvPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(__dirname, '..', '..', 'hkjc_scraper', 'data', 'all_results.csv');

const START = '/* ═══ GLM 5.3 洞燭先機 — model core start ═══ */';
const END = '/* ═══ GLM 5.3 洞燭先機 — model core end ═══ */';
const html = fs.readFileSync(htmlPath, 'utf8');
const startIdx = html.indexOf(START);
const endIdx = html.indexOf(END, startIdx);
if (startIdx < 0 || endIdx < 0) throw new Error('GLM model core markers not found in index.html');
const core = html.slice(startIdx + START.length, endIdx);

function parseCSV(text) {
  const lines = text.trim().split('\n');
  return lines.slice(1).map(l => {
    const cols = [];
    let cur = '', inQ = false;
    for (const ch of l) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { cols.push(cur); cur = ''; }
      else { cur += ch; }
    }
    cols.push(cur);
    return cols;
  }).filter(r => r.length >= 14);
}

const D = parseCSV(fs.readFileSync(csvPath, 'utf8'));
const sandbox = new Function('D', 'RACECARD', `'use strict';\n${core}\nreturn {\n  buildGlmIndexes, buildGlmFeatures, buildGlmPrediction,\n  get IDX() { return GLM_IDX; },\n};`);
const model = sandbox(D, null);
model.buildGlmIndexes();

const races = model.IDX.races;
const target = races[Math.floor(races.length * 0.8)];
if (target) {
  const targetEntries = target.members.map((m, i) => ({
    horse_no: String(i + 1),
    horse_name: m.horse,
    jockey: m.jockey,
    trainer: m.trainer,
    weight: m.weight,
    gate: m.gate,
  }));
  const targetContext = { date: target.date, distance: target.dist, going: target.goingRaw };
  const fullFeatures = model.buildGlmFeatures(targetEntries, targetContext);
  const priorRows = D.filter(row => String(row[0] || '').trim() < target.date);
  const priorModel = sandbox(priorRows, null);
  priorModel.buildGlmIndexes();
  const priorFeatures = priorModel.buildGlmFeatures(targetEntries, targetContext);
  let maxDelta = 0;
  for (let i = 0; i < fullFeatures.length; i++) {
    for (let j = 0; j < fullFeatures[i].length; j++) {
      maxDelta = Math.max(maxDelta, Math.abs(fullFeatures[i][j] - priorFeatures[i][j]));
    }
  }
  if (maxDelta > 1e-9) throw new Error(`historical feature leakage detected (max delta ${maxDelta})`);
  console.log(`Walk-forward feature leakage check passed (${target.date}; max delta ${maxDelta}).`);
}

const last = races[races.length - 1];
const next = new Date(last.epoch + 86400000);
const pad = n => String(n).padStart(2, '0');
const nextDate = `${next.getUTCFullYear()}/${pad(next.getUTCMonth() + 1)}/${pad(next.getUTCDate())}`;

const entries = last.members.map((m, i) => ({
  horse_no: String(i + 1),
  horse_name: m.horse,
  jockey: m.jockey,
  trainer: m.trainer,
  weight: m.weight,
  gate: m.gate,
}));

const preds = model.buildGlmPrediction(entries, { date: nextDate, distance: last.dist, going: last.goingRaw });
if (!preds.length) throw new Error('model returned no predictions');

const winSum = preds.reduce((s, p) => s + p.prob, 0);
console.log(`Race ${last.raceKey} scored as ${nextDate} (${last.dist}, ${last.goingRaw}, ${entries.length} runners)`);
console.log(`Win probabilities sum to ${winSum.toFixed(6)}`);
preds.slice(0, 4).forEach((p, i) => {
  console.log(`${i + 1}. #${p.entry.horse_no} ${p.horse} — win ${(p.prob * 100).toFixed(1)}% | place ${(p.placeProb * 100).toFixed(0)}% | ${p.reasons.join(' · ')}`);
});
console.log(`Insight: ${preds.insight}`);
