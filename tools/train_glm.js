#!/usr/bin/env node
/*
 * Offline trainer for the "GLM 5.3 洞燭先機" prediction model embedded in index.html.
 *
 * The trainer extracts the model core (online rating pass + 21-feature
 * engineering) directly from index.html, so the features used in training are
 * byte-for-byte the ones used in the browser. It then fits the linear weights
 * by maximizing the conditional Plackett-Luce win log-likelihood with L2
 * regularization, on walk-forward races built from all_results.csv
 * (each race only uses information from strictly earlier races).
 *
 * Usage:
 *   node tools/train_glm.js [path/to/all_results.csv]
 *
 * Output: GLM.MEAN / GLM.STD / GLM.BETA literals to paste back into index.html.
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

// CSV parser identical to the page's parser.
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
console.error(`Loaded ${D.length} rows from ${csvPath}`);

const sandbox = new Function('D', 'RACECARD', `'use strict';\n${core}\nreturn {\n  buildGlmIndexes, buildGlmFeatures, GLM,\n  get IDX() { return GLM_IDX; },\n};`);
const model = sandbox(D, null);
model.buildGlmIndexes();
console.error(`Built online index: ${model.IDX.races.length} races`);

// Walk-forward examples: each race is scored using only data strictly before its date.
const examples = [];
for (const race of model.IDX.races) {
  const y = race.members.map((m, i) => m.win ? i : -1).filter(i => i >= 0);
  if (!y.length || race.members.length < 3) continue;
  const entries = race.members.map(m => ({
    horse_name: m.horse,
    jockey: m.jockey,     // claim already stripped; m.weight is actual carried
    trainer: m.trainer,
    weight: m.weight,
    gate: m.gate,
  }));
  const X = model.buildGlmFeatures(entries, { date: race.date, distance: race.dist, going: race.goingRaw });
  if (!X) continue;
  examples.push({ X, y, n: entries.length });
}
console.error(`Training examples: ${examples.length} races`);

const DIM = model.GLM.LABELS.length;

function standardize(exs) {
  const mean = new Array(DIM).fill(0);
  const std = new Array(DIM).fill(0);
  let rows = 0;
  for (const ex of exs) for (const row of ex.X) {
    rows += 1;
    for (let c = 0; c < DIM; c++) mean[c] += row[c];
  }
  for (let c = 0; c < DIM; c++) mean[c] /= rows || 1;
  for (const ex of exs) for (const row of ex.X)
    for (let c = 0; c < DIM; c++) { const v = row[c] - mean[c]; std[c] += v * v; }
  for (let c = 0; c < DIM; c++) std[c] = Math.sqrt(std[c] / (rows || 1));
  return { mean, std };
}

function fit(exs, mean, std, lambda, epochs = 600, lr = 0.05) {
  const Z = exs.map(ex => ex.X.map(row => row.map((v, c) => (v - mean[c]) / (std[c] > 1e-9 ? std[c] : 1))));
  let beta = new Array(DIM).fill(0);
  const m = new Array(DIM).fill(0);
  const v = new Array(DIM).fill(0);
  const b1 = 0.9, b2 = 0.999, eps = 1e-8;
  for (let epoch = 1; epoch <= epochs; epoch++) {
    const grad = new Array(DIM).fill(0);
    let ll = 0;
    for (let i = 0; i < exs.length; i++) {
      const rows = Z[i], y = exs[i].y;
      const u = rows.map(r => { let s = 0; for (let c = 0; c < DIM; c++) s += r[c] * beta[c]; return s; });
      let maxU = -Infinity;
      for (const x of u) if (x > maxU) maxU = x;
      let tot = 0;
      const e = u.map(x => { const v2 = Math.exp(x - maxU); tot += v2; return v2; });
      const winnerSet = new Set(y);
      const winnerMass = y.reduce((sum, h) => sum + e[h], 0);
      ll += Math.log(Math.max(1e-12, winnerMass / tot));
      for (let h = 0; h < rows.length; h++) {
        const p = e[h] / tot - (winnerSet.has(h) ? e[h] / winnerMass : 0);
        if (p === 0) continue;
        const r = rows[h];
        for (let c = 0; c < DIM; c++) grad[c] += p * r[c];
      }
    }
    for (let c = 0; c < DIM; c++) {
      // grad = d(loglik)/dbeta negated; loss = -loglik/N + lambda*||beta||^2,
      // so d(loss)/dbeta = +grad/N + 2*lambda*beta.
      const g = grad[c] / exs.length + 2 * lambda * beta[c];
      m[c] = b1 * m[c] + (1 - b1) * g;
      v[c] = b2 * v[c] + (1 - b2) * g * g;
      const mh = m[c] / (1 - Math.pow(b1, epoch));
      const vh = v[c] / (1 - Math.pow(b2, epoch));
      beta[c] -= lr * mh / (Math.sqrt(vh) + eps);
    }
    if (epoch % 200 === 0) console.error(`    epoch ${epoch}: avg win loglik ${(ll / exs.length).toFixed(4)}`);
  }
  return beta;
}

function evaluate(exs, mean, std, beta) {
  let ll = 0, top1 = 0, top4 = 0, probSum = 0;
  for (const ex of exs) {
    const u = ex.X.map(row => {
      let s = 0;
      for (let c = 0; c < DIM; c++) s += ((row[c] - mean[c]) / (std[c] > 1e-9 ? std[c] : 1)) * beta[c];
      return s;
    });
    let maxU = -Infinity;
    for (const x of u) if (x > maxU) maxU = x;
    let tot = 0;
    const e = u.map(x => { const v2 = Math.exp(x - maxU); tot += v2; return v2; });
    const p = e.map(v2 => v2 / tot);
    const winnerProb = ex.y.reduce((sum, h) => sum + p[h], 0);
    ll += Math.log(Math.max(1e-12, winnerProb));
    probSum += winnerProb;
    let best = 0;
    for (let h = 1; h < u.length; h++) if (u[h] > u[best]) best = h;
    if (ex.y.includes(best)) top1 += 1;
    const order = u.map((x, h) => ({ x, h })).sort((a, b) => b.x - a.x);
    if (order.slice(0, 4).some(o => ex.y.includes(o.h))) top4 += 1;
  }
  const n = exs.length || 1;
  return { ll: ll / n, top1: top1 / n, top4: top4 / n, avgWinnerProb: probSum / n };
}

// Chronological train/tune/holdout split; the final holdout never selects lambda.
const holdoutStart = Math.floor(examples.length * 0.8);
const tuneStart = Math.floor(holdoutStart * 0.8);
const train = examples.slice(0, tuneStart);
const tune = examples.slice(tuneStart, holdoutStart);
const selectionSet = examples.slice(0, holdoutStart);
const holdout = examples.slice(holdoutStart);
console.error(`Split: ${train.length} train / ${tune.length} tune / ${holdout.length} holdout races`);
const trainStats = standardize(train);

let best = null;
for (const lambda of [0.0005, 0.002, 0.008, 0.03]) {
  console.error(`Fitting lambda=${lambda} ...`);
  const beta = fit(train, trainStats.mean, trainStats.std, lambda);
  const m = evaluate(tune, trainStats.mean, trainStats.std, beta);
  console.error(`  tune: loglik/race ${m.ll.toFixed(4)} | top1 ${m.top1.toFixed(3)} | top4 ${m.top4.toFixed(3)} | avg winner prob ${m.avgWinnerProb.toFixed(3)}`);
  if (!best || m.ll > best.m.ll) best = { lambda, m };
}
console.error(`Selected lambda=${best.lambda}`);

const selectionStats = standardize(selectionSet);
console.error('Fitting through tuning period for final holdout ...');
const selectionBeta = fit(selectionSet, selectionStats.mean, selectionStats.std, best.lambda);
const holdoutEval = evaluate(holdout, selectionStats.mean, selectionStats.std, selectionBeta);
console.error(`Holdout: loglik/race ${holdoutEval.ll.toFixed(4)} | top1 ${holdoutEval.top1.toFixed(3)} | top4 ${holdoutEval.top4.toFixed(3)} | avg winner prob ${holdoutEval.avgWinnerProb.toFixed(3)}`);

const randomTop1 = holdout.reduce((sum, ex) => sum + ex.y.length / ex.n, 0) / holdout.length;
const randomTop4 = holdout.reduce((sum, ex) => {
  let miss = 1;
  for (let i = 0; i < 4; i++) {
    if (ex.n - ex.y.length - i <= 0) { miss = 0; break; }
    miss *= (ex.n - ex.y.length - i) / (ex.n - i);
  }
  return sum + 1 - miss;
}, 0) / holdout.length;
const avgField = holdout.reduce((s, e) => s + e.n, 0) / holdout.length;
console.error(`Random baselines: top1 ${randomTop1.toFixed(3)}, top4 ${randomTop4.toFixed(3)} (avg field ${avgField.toFixed(1)})`);

// Refit on all races with the selected lambda for deployment.
console.error('Refitting on all races for deployment ...');
const allStats = standardize(examples);
const betaAll = fit(examples, allStats.mean, allStats.std, best.lambda);
const finalEval = evaluate(examples, allStats.mean, allStats.std, betaAll);
console.error(`Full-data fit: loglik/race ${finalEval.ll.toFixed(4)} | top1 ${finalEval.top1.toFixed(3)} | top4 ${finalEval.top4.toFixed(3)}`);

const fmt = arr => '[' + arr.map(x => x.toFixed(4)).join(', ') + ']';
console.log('GLM.MEAN = ' + fmt(allStats.mean) + ';');
console.log('GLM.STD  = ' + fmt(allStats.std) + ';');
console.log('GLM.BETA = ' + fmt(betaAll) + ';');
