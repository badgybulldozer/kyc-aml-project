// Fraud Rules Lab: the eight rules from the fraud-red-flags spec, run live on a
// PaySim-style mobile-money simulation. Every number shown is computed here.
import { esc, int, pct, money, prf, mulberry32 } from './util.js';
import { beams } from './fx.js';
import { showTip, hideTip } from './charts.js';

const STEPS = 744, TRAIN_END = 500;

// ---------------- Simulation ----------------
function simulate() {
  const rnd = mulberry32(744);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const between = (a, b) => a + rnd() * (b - a);
  const logn = (median, sigma) => median * Math.exp(sigma * Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * Math.cos(2 * Math.PI * rnd()));
  const weighted = (pairs) => { let r = rnd() * pairs.reduce((s, [, w]) => s + w, 0); for (const [v, w] of pairs) if ((r -= w) < 0) return v; return pairs[0][0]; };
  const r2 = (x) => Math.round(x * 100) / 100;

  const N_CUST = 3000, N_MERCH = 60;
  const cust = Array.from({ length: N_CUST }, (_, i) => `C${String(100000 + i)}`);
  const merch = Array.from({ length: N_MERCH }, (_, i) => `M${String(500 + i)}`);
  const bal = new Map(cust.map((c) => [c, r2(logn(60000, 1.1))]));
  const activity = cust.map(() => Math.pow(rnd(), 2.2)); // a few very active customers
  const actTotal = activity.reduce((s, x) => s + x, 0);
  const pickCust = () => { let r = rnd() * actTotal; for (let i = 0; i < N_CUST; i++) if ((r -= activity[i]) < 0) return cust[i]; return cust[0]; };

  const rows = [];
  let id = 1, mule = 900000;
  const push = (o) => { rows.push({ id: id++, fraud: 0, caseId: null, ...o }); return rows[rows.length - 1]; };
  const MEDIAN = { PAYMENT: 9000, CASH_IN: 120000, CASH_OUT: 140000, TRANSFER: 380000, DEBIT: 5000 };

  // Fraud schedule: ~95 cases spread over the month, a few "campaigns" share a mule (fan-in)
  const cases = [];
  for (let k = 0; k < 95; k++) cases.push({ step: 1 + Math.floor(rnd() * (STEPS - 2)), shared: null });
  for (let c = 0; c < 4; c++) {
    const s = 20 + Math.floor(rnd() * (STEPS - 60)), m = `C${mule++}`;
    const n = 5 + Math.floor(rnd() * 3);
    for (let j = 0; j < n; j++) cases.push({ step: s + Math.floor(rnd() * 18), shared: m });
  }
  const byStep = new Map();
  cases.forEach((c, i) => { c.caseId = i + 1; if (!byStep.has(c.step)) byStep.set(c.step, []); byStep.get(c.step).push(c); });

  for (let step = 1; step <= STEPS; step++) {
    const h = (step - 1) % 24;
    const vol = Math.round((h < 7 ? 14 : 52) * between(0.8, 1.2));
    for (let n = 0; n < vol; n++) {
      const type = weighted([['CASH_OUT', 35], ['PAYMENT', 34], ['CASH_IN', 22], ['TRANSFER', 8], ['DEBIT', 1]]);
      const o = pickCust();
      const ob = bal.get(o);
      let amount = r2(Math.max(10, logn(MEDIAN[type], type === 'PAYMENT' ? 0.9 : 0.8)));
      if (type === 'CASH_IN') {
        const d = pick(cust);
        bal.set(o, r2(ob + amount));
        push({ step, type, amount, orig: o, ob, nb: bal.get(o), dest: d, odb: 0, ndb: 0 });
        continue;
      }
      if (amount > ob) amount = ob <= 0 ? amount : rnd() < 0.35 ? ob : r2(ob * between(0.2, 0.9)); // legit customers sometimes empty the account too
      const nb = ob > 0 ? Math.max(0, r2(ob - amount)) : 0;
      bal.set(o, nb);
      if (type === 'PAYMENT' || type === 'DEBIT') {
        push({ step, type, amount, orig: o, ob, nb, dest: type === 'PAYMENT' ? pick(merch) : pick(cust), odb: 0, ndb: 0 });
      } else {
        const dd = pick(cust);
        const zero = type === 'TRANSFER' && rnd() < 0.07; // simulator quirk also appears on some legit rows
        const odb = zero ? 0 : bal.get(dd);
        if (!zero) bal.set(dd, r2(odb + amount));
        push({ step, type, amount, orig: o, ob, nb, dest: dd, odb, ndb: zero ? 0 : bal.get(dd) });
      }
    }

    // Legitimate look-alikes, so the rules have something to get wrong:
    // family money sent and withdrawn straight away (looks like R2)
    if (rnd() < 0.22) {
      const a = pickCust(), b = pick(cust), amt = r2(logn(40000, 0.6));
      push({ step, type: 'TRANSFER', amount: amt, orig: a, ob: r2(amt * between(1.2, 4)), nb: 0, dest: b, odb: r2(logn(20000, 1)), ndb: 0, legit: 'family' });
      rows[rows.length - 1].nb = r2(rows[rows.length - 1].ob - amt);
      rows[rows.length - 1].ndb = r2(rows[rows.length - 1].odb + amt);
      push({ step: Math.min(STEPS, step + (rnd() < 0.5 ? 0 : 1)), type: 'CASH_OUT', amount: amt, orig: b, ob: r2(amt * between(1, 2)), nb: 0, dest: pick(cust), odb: 0, ndb: 0 });
      rows[rows.length - 1].nb = r2(rows[rows.length - 1].ob - amt);
    }
    // recurring bills of the same amount (looks like R3)
    if (rnd() < 0.15) {
      const a = pickCust(), amt = r2(logn(2500, 0.5));
      for (let i = 0; i < 3; i++) push({ step: Math.min(STEPS, step + i * Math.floor(rnd() * 6)), type: 'PAYMENT', amount: amt, orig: a, ob: 50000, nb: r2(50000 - amt), dest: pick(merch), odb: 0, ndb: 0 });
    }
    // a busy shopper making several payments in one hour (looks like R4)
    if (rnd() < 0.05) {
      const a = pickCust(), n = 5 + Math.floor(rnd() * 2);
      for (let i = 0; i < n; i++) { const amt = r2(logn(3000, 0.7)); push({ step, type: 'PAYMENT', amount: amt, orig: a, ob: 80000, nb: r2(80000 - amt), dest: pick(merch), odb: 0, ndb: 0 }); }
    }

    // fraud cases starting in this step
    for (const c of byStep.get(step) || []) {
      let victim = pickCust();
      for (let t = 0; t < 20 && bal.get(victim) < 15000; t++) victim = pickCust();
      if (bal.get(victim) < 15000) bal.set(victim, r2(logn(90000, 0.8)));
      const m = c.shared || `C${mule++}`;
      const ob0 = bal.get(victim);
      const total = rnd() < 0.75 ? ob0 : r2(ob0 * between(0.6, 0.95)); // most cases drain the account
      const style = rnd();
      const parts = style < 0.12 ? 5 : style < 0.35 ? 3 : 1; // split into equal parts sometimes
      const each = r2(total / parts);
      let ob = ob0;
      const legs = [];
      for (let p = 0; p < parts; p++) {
        const amt = p === parts - 1 ? r2(total - each * (parts - 1)) : each;
        const nb = Math.max(0, r2(ob - amt));
        const zero = rnd() < 0.7;
        const s = parts === 5 ? step : step + (p > 0 && rnd() < 0.3 ? 1 : 0);
        legs.push(push({ step: Math.min(STEPS, s), type: 'TRANSFER', amount: amt, orig: victim, ob, nb, dest: m, odb: 0, ndb: zero ? 0 : amt, fraud: 1, caseId: c.caseId }));
        ob = nb;
      }
      bal.set(victim, ob);
      // the mule cashes out: usually straight away, sometimes after a wait
      const wait = rnd() < 0.8 ? (rnd() < 0.5 ? 0 : 1) : 2 + Math.floor(rnd() * 5);
      for (const leg of legs) {
        push({ step: Math.min(STEPS, leg.step + wait), type: 'CASH_OUT', amount: leg.amount, orig: m, ob: leg.amount, nb: 0, dest: pick(cust), odb: 0, ndb: leg.amount, fraud: 1, caseId: c.caseId });
      }
    }
  }
  rows.sort((a, b) => a.step - b.step || a.id - b.id);
  rows.forEach((r) => { r.flagged = r.type === 'TRANSFER' && r.amount > 200000 ? 1 : 0; });
  return rows;
}

// ---------------- Rules (mirror the SQL in the spec) ----------------
const DEFAULTS = { r3: 3, r4: 5, r5: 5, r6: 10, r7: 0.9, exclMerch: true };
const GRID = { r3: [2, 3, 4, 5], r4: [3, 4, 5, 6, 7, 8], r5: [3, 4, 5, 6, 7, 8, 10], r6: [3, 5, 8, 10, 15, 20], r7: [0.8, 0.85, 0.9, 0.95, 0.99] };

const RULES = {
  R1: { name: 'Drain', hyp: 'Fraud empties the victim\'s account in one go.', sql: `-- R1 drain: fraud empties the victim's account in one go
SELECT tx_id FROM tx
WHERE type IN ('TRANSFER', 'CASH_OUT')
  AND oldbalanceOrg > 0
  AND newbalanceOrig = 0;` },
  R2: { name: 'Transfer → cash-out', hyp: 'Money lands on a mule and leaves as cash within one step.', sql: `-- R2: a TRANSFER to D, then a CASH_OUT from D of the same amount within 1 step
WITH pairs AS (
  SELECT t.tx_id AS t_id, c.tx_id AS c_id
  FROM tx t
  JOIN tx c ON c.nameOrig = t.nameDest
           AND c.type = 'CASH_OUT'
           AND c.amount = t.amount
           AND c.step BETWEEN t.step AND t.step + 1
  WHERE t.type = 'TRANSFER')
SELECT t_id AS tx_id FROM pairs
UNION
SELECT c_id FROM pairs;` },
  R3: { name: 'Repeated amount', hyp: 'Fraudsters split a theft into equal chunks.', p: 'r3', sql: (p) => `-- R3: same origin, same amount, ${p.r3}+ times in a 24-step window
SELECT tx_id FROM (
  SELECT tx_id, count(*) OVER (
    PARTITION BY nameOrig, amount ORDER BY step
    RANGE BETWEEN 23 PRECEDING AND CURRENT ROW) AS n
  FROM tx)
WHERE n >= ${p.r3};` },
  R4: { name: 'Velocity', hyp: 'A taken-over account fires many transactions in one hour.', p: 'r4', sql: (p) => `-- R4: ${p.r4}+ transactions from one origin within one step (order inside a step is unknown)
SELECT tx_id FROM (
  SELECT tx_id, count(*) OVER (PARTITION BY nameOrig, step) AS n FROM tx)
WHERE n >= ${p.r4};` },
  R5: { name: 'Fan-in', hyp: 'One mule collects from many victims.', p: 'r5', sql: (p) => `-- R5: ${p.r5}+ distinct origins paying one destination within 24 steps
SELECT t.tx_id
FROM tx t
JOIN tx p ON p.nameDest = t.nameDest
         AND p.step BETWEEN t.step - 23 AND t.step${p.exclMerch ? `
WHERE t.nameDest NOT LIKE 'M%'           -- merchants receive from everyone` : ''}
GROUP BY t.tx_id
HAVING count(DISTINCT p.nameOrig) >= ${p.r5};` },
  R6: { name: 'Spike', hyp: 'A theft is far larger than what the account normally sends.', p: 'r6', sql: (p) => `-- R6: amount above ${p.r6}x the origin's median of strictly EARLIER steps (no future data)
SELECT tx_id FROM (
  SELECT tx_id, amount,
         median(amount) OVER (
           PARTITION BY nameOrig ORDER BY step
           RANGE BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS prior_median
  FROM tx)
WHERE prior_median IS NOT NULL
  AND amount > ${p.r6} * prior_median;` },
  R7: { name: 'New account, large', hyp: 'A brand-new account moving a large amount is a likely mule.', p: 'r7', sql: (p) => `-- R7: origin's first transaction above the type's P${Math.round(p.r7 * 100)} (training steps only)
WITH cut AS (
  SELECT type, quantile_cont(amount, ${p.r7}) AS q
  FROM tx WHERE step <= ${TRAIN_END} GROUP BY type),
firsts AS (
  SELECT *, row_number() OVER (PARTITION BY nameOrig ORDER BY step, tx_id) AS rn
  FROM tx)
SELECT f.tx_id FROM firsts f JOIN cut USING (type)
WHERE f.rn = 1 AND f.amount > cut.q;` },
  R8: { name: 'Pass-through', hyp: 'Destination balance stays 0 although money arrived (possibly a simulator artefact).', sql: `-- R8: TRANSFER where the destination balance is 0 before AND after the credit
-- Caution: may exploit how the simulator writes balances, not real fraud behaviour
SELECT tx_id FROM tx
WHERE type = 'TRANSFER'
  AND oldbalanceDest = 0
  AND newbalanceDest = 0;` },
};
const sqlOf = (id, p) => (typeof RULES[id].sql === 'function' ? RULES[id].sql(p) : RULES[id].sql);

function quantile(sorted, q) {
  if (!sorted.length) return Infinity;
  const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

// Precompute everything that does not depend on thresholds
function prepare(rows) {
  const byOrig = new Map(), byDest = new Map();
  for (const r of rows) {
    if (!byOrig.has(r.orig)) byOrig.set(r.orig, []);
    byOrig.get(r.orig).push(r);
    if (!byDest.has(r.dest)) byDest.set(r.dest, []);
    byDest.get(r.dest).push(r);
  }
  const pre = { rows, byOrig };
  // R1, R8 fixed
  pre.R1 = new Set(rows.filter((r) => (r.type === 'TRANSFER' || r.type === 'CASH_OUT') && r.ob > 0 && r.nb === 0).map((r) => r.id));
  pre.R8 = new Set(rows.filter((r) => r.type === 'TRANSFER' && r.odb === 0 && r.ndb === 0).map((r) => r.id));
  // R2 fixed
  const r2 = new Set();
  for (const t of rows) {
    if (t.type !== 'TRANSFER') continue;
    for (const c of byOrig.get(t.dest) || []) {
      if (c.type === 'CASH_OUT' && c.amount === t.amount && c.step >= t.step && c.step <= t.step + 1) { r2.add(t.id); r2.add(c.id); }
    }
  }
  pre.R2 = r2;
  // R3: running count of same (orig, amount) in last 24 steps, including current
  pre.r3n = new Map();
  for (const list of byOrig.values()) {
    for (let i = 0; i < list.length; i++) {
      let n = 0;
      for (let j = i; j >= 0 && list[i].step - list[j].step <= 23; j--) if (list[j].amount === list[i].amount) n++;
      pre.r3n.set(list[i].id, n);
    }
  }
  // R4: count per (orig, step)
  pre.r4n = new Map();
  for (const list of byOrig.values()) {
    const per = new Map();
    for (const r of list) per.set(r.step, (per.get(r.step) || 0) + 1);
    for (const r of list) pre.r4n.set(r.id, per.get(r.step));
  }
  // R5: distinct origins to the same destination in [step-23, step]
  pre.r5n = new Map();
  for (const list of byDest.values()) {
    for (let i = 0, lo = 0; i < list.length; i++) {
      while (list[lo].step < list[i].step - 23) lo++;
      const s = new Set();
      for (let j = lo; j < list.length && list[j].step <= list[i].step; j++) s.add(list[j].orig);
      pre.r5n.set(list[i].id, s.size);
    }
  }
  // R6: ratio of amount to the median of strictly earlier steps
  pre.r6x = new Map();
  for (const list of byOrig.values()) {
    const prior = [];
    let k = 0;
    for (let i = 0; i < list.length; i++) {
      while (k < i && list[k].step < list[i].step) { prior.push(list[k].amount); k++; }
      if (prior.length) {
        const s = [...prior].sort((a, b) => a - b);
        pre.r6x.set(list[i].id, list[i].amount / quantile(s, 0.5));
      }
    }
  }
  // R7: first transaction per origin; training-period amounts per type
  pre.first = new Set([...byOrig.values()].map((l) => l[0].id));
  pre.trainAmounts = {};
  for (const r of rows) if (r.step <= TRAIN_END) (pre.trainAmounts[r.type] ||= []).push(r.amount);
  for (const t in pre.trainAmounts) pre.trainAmounts[t].sort((a, b) => a - b);
  pre.isMerch = (name) => name.startsWith('M');
  return pre;
}

function runRules(pre, p) {
  const out = { R1: pre.R1, R2: pre.R2, R8: pre.R8, R3: new Set(), R4: new Set(), R5: new Set(), R6: new Set(), R7: new Set() };
  const cut = {};
  for (const t in pre.trainAmounts) cut[t] = quantile(pre.trainAmounts[t], p.r7);
  for (const r of pre.rows) {
    if (pre.r3n.get(r.id) >= p.r3) out.R3.add(r.id);
    if (pre.r4n.get(r.id) >= p.r4) out.R4.add(r.id);
    if (pre.r5n.get(r.id) >= p.r5 && !(p.exclMerch && pre.isMerch(r.dest))) out.R5.add(r.id);
    if ((pre.r6x.get(r.id) || 0) > p.r6) out.R6.add(r.id);
    if (pre.first.has(r.id) && r.amount > (cut[r.type] ?? Infinity)) out.R7.add(r.id);
  }
  return out;
}

function evaluate(pre, flags, period, inUnion) {
  const [lo, hi] = period === 'train' ? [1, TRAIN_END] : period === 'test' ? [TRAIN_END + 1, STEPS] : [1, STEPS];
  const ids = new Set(), labels = new Set();
  for (const r of pre.rows) if (r.step >= lo && r.step <= hi) { ids.add(r.id); if (r.fraud) labels.add(r.id); }
  const inP = (set) => new Set([...set].filter((x) => ids.has(x)));
  const res = {};
  for (const k of Object.keys(RULES)) res[k] = prf(inP(flags[k]), labels);
  const union = new Set();
  for (const k of inUnion) for (const x of flags[k]) if (ids.has(x)) union.add(x);
  res.UNION = prf(union, labels);
  res.BASE = prf(new Set(pre.rows.filter((r) => r.flagged && ids.has(r.id)).map((r) => r.id)), labels);
  res.NONE = prf(new Set(), labels);
  return { res, n: ids.size, frauds: labels.size, union, lo, hi };
}

function budgetCurve(pre, flags, ev, ks) {
  const rowById = new Map(pre.rows.map((r) => [r.id, r]));
  const days = new Map();
  for (const id of ev.union) {
    const r = rowById.get(id);
    let n = 0;
    for (const k of Object.keys(RULES)) if (flags[k].has(id)) n++;
    const d = Math.floor((r.step - 1) / 24);
    if (!days.has(d)) days.set(d, []);
    days.get(d).push({ n, amount: r.amount, fraud: r.fraud });
  }
  for (const list of days.values()) list.sort((a, b) => b.n - a.n || b.amount - a.amount);
  return ks.map((K) => {
    let caught = 0, alerts = 0;
    for (const list of days.values()) { const top = list.slice(0, K); alerts += top.length; caught += top.filter((x) => x.fraud).length; }
    return { K, caught, alerts, recall: ev.frauds ? caught / ev.frauds : 0 };
  });
}

// ---------------- Charts ----------------
function scatter(el, points) {
  const W = Math.max(300, el.clientWidth || 520), H = 300, L = 40, B = 34, T = 12, R = 16;
  const x = (v) => L + v * (W - L - R), y = (v) => T + (1 - v) * (H - T - B);
  const maxP = Math.max(0.05, ...points.map((p) => p.precision || 0));
  const top = [0.25, 0.5, 0.75, 1].find((v) => v >= maxP + 0.04) || 1;
  const yy = (v) => y(v / top);
  const iso = [0.1, 0.2, 0.4].map((f) => {
    const pts = [];
    for (let r = f / 2 + 0.001; r <= 1; r += 0.01) { const pr = (f * r) / (2 * r - f); if (pr > 0 && pr <= top) pts.push(`${x(r)},${yy(pr)}`); }
    // label each equal-F1 curve at its upper-left end so labels never collide with the dots on the right
    const [lx, ly] = (pts[0] || '0,0').split(',').map(Number);
    return pts.length ? `<polyline class="iso" points="${pts.join(' ')}"/><text x="${lx + 4}" y="${ly + 12}">F1 ${f}</text>` : '';
  }).join('');
  const ticksY = [0, 0.25, 0.5, 0.75, 1].map((k) => k * top);
  const tickLabel = (v) => `${+(v * 100).toFixed(1)}%`;
  el.innerHTML = `<div class="scatter"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Precision versus recall for each rule">
    <g class="grid">${ticksY.map((v) => `<line x1="${L}" x2="${W - R}" y1="${yy(v)}" y2="${yy(v)}"/><text x="${L - 6}" y="${yy(v) + 4}" text-anchor="end">${tickLabel(v)}</text>`).join('')}
    ${[0, 0.25, 0.5, 0.75, 1].map((v) => `<text x="${x(v)}" y="${H - 14}" text-anchor="middle">${v * 100}%</text>`).join('')}</g>
    ${iso}
    <text x="${(L + W - R) / 2}" y="${H}" text-anchor="middle">Recall: share of fraud caught →</text>
    <text x="12" y="${T + 6}" transform="rotate(-90 12 ${T + 6})" text-anchor="end">Precision: alerts that are fraud →</text>
    ${points.map((p, i) => Number.isFinite(p.precision) ? `<g data-i="${i}"><circle class="dot ${p.cls || ''}" cx="${x(p.recall)}" cy="${yy(p.precision)}" r="${p.cls === 'union' ? 8 : 6}"/>
      <text class="lbl" x="${x(p.recall) + 10}" y="${yy(p.precision) + 4}">${p.label}</text></g>` : '').join('')}
  </svg></div>`;
  el.querySelectorAll('g[data-i]').forEach((g) => {
    const p = points[g.dataset.i];
    g.addEventListener('mousemove', (e) => showTip(e, `<b>${esc(p.label)} · ${esc(p.name)}</b><br>Precision ${pct(p.precision)} · Recall ${pct(p.recall)}<br>${int(p.flagged)} alerts, ${int(p.tp)} fraud`));
    g.addEventListener('mouseleave', hideTip);
  });
}

function line(el, pts, currentK) {
  const W = Math.max(300, el.clientWidth || 520), H = 220, L = 40, B = 30, T = 10, R = 14;
  const maxK = pts[pts.length - 1].K;
  const x = (k) => L + (Math.log(k) / Math.log(maxK)) * (W - L - R);
  const y = (v) => T + (1 - v) * (H - T - B);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.K)},${y(p.recall)}`).join(' ');
  const cur = pts.find((p) => p.K === currentK) || pts[0];
  el.innerHTML = `<div class="linechart"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Recall by daily alert budget">
    <g class="grid">${[0, 0.25, 0.5, 0.75, 1].map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v * 100}%</text>`).join('')}
    ${pts.filter((p) => [1, 5, 10, 25, 50, 100, 200, 400].includes(p.K)).map((p) => `<text x="${x(p.K)}" y="${H - 10}" text-anchor="middle">${p.K}</text>`).join('')}</g>
    <path class="area" d="${d} L${x(maxK)},${y(0)} L${x(1)},${y(0)} Z"/><path class="ln" d="${d}"/>
    <line class="marker" x1="${x(cur.K)}" x2="${x(cur.K)}" y1="${T}" y2="${y(0)}"/><circle class="mdot" cx="${x(cur.K)}" cy="${y(cur.recall)}" r="5"/>
  </svg></div>`;
}

// ---------------- View ----------------
let STATE = null;
export function renderFraudLab(main) {
  if (!STATE) {
    const rows = simulate();
    STATE = { rows, pre: prepare(rows), p: { ...DEFAULTS }, period: 'all', K: 50, inUnion: new Set(Object.keys(RULES)), open: null, caseIdx: 0, tuned: false };
  }
  const S = STATE;
  const fraudRows = S.rows.filter((r) => r.fraud).length;

  main.innerHTML = `
    <div class="page-head"><div><div class="crumb">Lab 02</div><h1>Fraud rules lab</h1>
      <p>Which simple, explainable red flags catch the most fraud per alert an analyst has to read? Eight rules from my <a href="#/roadmap">fraud-red-flags spec</a>, run live on a PaySim-style simulation of ${int(S.rows.length)} mobile-money transactions over ${STEPS} hourly steps, ${int(fraudRows)} of them fraud (${pct(fraudRows / S.rows.length, 2)}).</p></div>
      <span class="asof">Simulated in your browser · not PaySim figures</span></div>

    <div class="card"><div class="section-head"><div><h2>How a takeover fraud moves</h2><div class="sub">A real case from the simulation. Step through cases to see which rules fire and which ones miss.</div></div>
      <div class="actions"><button class="btn" id="case-prev">← Prev</button><button class="btn" id="case-next">Next case →</button></div></div>
      <div class="anatomy" id="anat"></div><div id="anat-rules"></div></div>

    <div class="card mt"><div class="section-head"><div><h2>Thresholds</h2><div class="sub">Drag a slider and every table and chart below recomputes. Or let the lab pick thresholds on the training steps only, then judge them on unseen steps.</div></div>
      <div class="actions"><button class="btn primary" id="tune">Auto-tune on steps 1–${TRAIN_END}</button><button class="btn" id="reset">Reset</button></div></div>
      <div class="lab-controls mt" id="ctls"></div>
      <div class="mt" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><span class="ink2">Evaluate on</span>
        <div class="seg-ctl" id="period"><button data-p="all">All steps</button><button data-p="train">Train 1–${TRAIN_END}</button><button data-p="test">Test ${TRAIN_END + 1}–${STEPS}</button></div>
        <span class="muted" id="tuned-note"></span></div>
    </div>

    <div class="card mt"><h2>Rule scoreboard</h2><div class="sub">Click a rule to see its DuckDB SQL. Untick a rule to drop it from the union.</div>
      <div class="table-wrap" id="board"></div></div>

    <div class="grid g-2 mt">
      <div class="card"><h2>Precision vs recall</h2><div class="sub">Top-right is ideal. Dashed lines are equal F1. Hover a dot.</div><div id="pr"></div></div>
      <div class="card"><h2>Alert budget</h2><div class="sub">An analyst can only read K alerts a day. Rank flagged transactions by number of rules hit, then amount, and take the top K.</div>
        <div class="ctl mt"><label for="k">Alerts per day (K) <b id="kval"></b></label><input type="range" id="k" min="0" max="12" step="1"></div>
        <div class="grid g-2 mt" style="gap:8px"><div><div class="big-stat" id="b-rec"></div><small class="muted">of fraud caught</small></div><div><div class="big-stat" id="b-al"></div><small class="muted">alerts read</small></div></div>
        <div class="mt" id="curve"></div></div>
    </div>
    <div class="card mt"><h2>What the numbers say</h2><div class="sub">Generated from the current results, not written by hand.</div><div id="findings" class="findings-2"></div></div>`;

  const KS = [1, 2, 3, 5, 8, 10, 15, 25, 50, 75, 100, 200, 400];

  // controls
  const CTL = [
    ['r3', 'R3 repeats needed', GRID.r3, (v) => `${v}×`],
    ['r4', 'R4 transactions per step', GRID.r4, (v) => `${v}`],
    ['r5', 'R5 distinct senders / 24 steps', GRID.r5, (v) => `${v}`],
    ['r6', 'R6 spike vs prior median', GRID.r6, (v) => `${v}×`],
    ['r7', 'R7 percentile cut-off', GRID.r7, (v) => `P${Math.round(v * 100)}`],
  ];
  main.querySelector('#ctls').innerHTML = CTL.map(([k, l, g]) => `<div class="ctl"><label for="c-${k}">${l} <b id="v-${k}"></b></label><input type="range" id="c-${k}" min="0" max="${g.length - 1}" step="1"></div>`).join('')
    + `<div class="ctl"><label><span>R5 ignore merchants</span></label><label style="justify-content:flex-start;gap:8px"><input type="checkbox" id="c-ex"> <small>merchants receive from everyone</small></label></div>`;
  const syncCtl = () => {
    for (const [k, , g, f] of CTL) { main.querySelector(`#c-${k}`).value = g.indexOf(S.p[k]); main.querySelector(`#v-${k}`).textContent = f(S.p[k]); }
    main.querySelector('#c-ex').checked = S.p.exclMerch;
    main.querySelectorAll('#period button').forEach((b) => b.classList.toggle('on', b.dataset.p === S.period));
    main.querySelector('#k').value = KS.indexOf(S.K);
    main.querySelector('#kval').textContent = S.K;
    main.querySelector('#tuned-note').textContent = S.tuned ? 'Thresholds were picked on training steps only.' : '';
  };
  for (const [k, , g] of CTL) main.querySelector(`#c-${k}`).addEventListener('input', (e) => { S.p[k] = g[+e.target.value]; S.tuned = false; update(); });
  main.querySelector('#c-ex').addEventListener('change', (e) => { S.p.exclMerch = e.target.checked; update(); });
  main.querySelectorAll('#period button').forEach((b) => b.addEventListener('click', () => { S.period = b.dataset.p; update(); }));
  main.querySelector('#k').addEventListener('input', (e) => { S.K = KS[+e.target.value]; update(); });
  main.querySelector('#reset').addEventListener('click', () => { S.p = { ...DEFAULTS }; S.period = 'all'; S.tuned = false; S.inUnion = new Set(Object.keys(RULES)); update(); });
  main.querySelector('#tune').addEventListener('click', () => {
    // pick each threshold to maximise that rule's F1 on the training steps only
    for (const [k] of CTL) {
      let best = S.p[k], bestF = -1;
      for (const v of GRID[k]) {
        const f = evaluate(S.pre, runRules(S.pre, { ...S.p, [k]: v }), 'train', S.inUnion).res[`R${k.slice(1)}`].f1;
        if (f > bestF) { bestF = f; best = v; }
      }
      S.p[k] = best;
    }
    S.tuned = true; S.period = 'test'; update();
  });

  // fraud anatomy
  const caseIds = [...new Set(S.rows.filter((r) => r.fraud).map((r) => r.caseId))];
  const showCase = () => {
    const flags = runRules(S.pre, S.p);
    const cid = caseIds[((S.caseIdx % caseIds.length) + caseIds.length) % caseIds.length];
    const legs = S.rows.filter((r) => r.caseId === cid);
    const tr = legs.filter((r) => r.type === 'TRANSFER'), co = legs.filter((r) => r.type === 'CASH_OUT');
    const v = tr[0], m = co[0];
    const total = tr.reduce((s, r) => s + r.amount, 0);
    main.querySelector('#anat').innerHTML = `
      <div class="fnode" id="an-v"><small>Victim</small><b>${v.orig}</b><small>balance ${money(v.ob)} → ${money(tr[tr.length - 1].nb)}</small></div>
      <div class="fnode bad" id="an-t"><small>${tr.length} × TRANSFER · step ${v.step}</small><b>${money(total)}</b><small>dest balance ${v.odb === 0 && v.ndb === 0 ? 'stays 0 (!)' : `${money(v.odb)} → ${money(v.ndb)}`}</small></div>
      <div class="fnode bad" id="an-m"><small>Mule account</small><b>${v.dest}</b><small>${S.rows.filter((r) => r.dest === v.dest && r.fraud && r.type === 'TRANSFER').length > tr.length ? 'collects from several victims' : 'used once'}</small></div>
      <div class="fnode" id="an-c"><small>${co.length} × CASH_OUT · step ${m.step}</small><b>${money(co.reduce((s, r) => s + r.amount, 0))}</b><small>${m.step - v.step <= 1 ? 'within 1 step' : `${m.step - v.step} steps later`}</small></div>`;
    beams(main.querySelector('#anat'), [['an-v', 'an-t'], ['an-t', 'an-m'], ['an-m', 'an-c']].map(([a, b], i) => ({ from: main.querySelector('#' + a), to: main.querySelector('#' + b), tone: 'crit', delay: i * 0.5 })));
    const chip = (k) => { const hit = legs.some((r) => flags[k].has(r.id)); return `<span class="chip ${hit ? 'hit' : 'miss'}" title="${esc(RULES[k].hyp)}">${k} ${RULES[k].name}${hit ? ' ✓' : ''}</span>`; };
    const any = Object.keys(RULES).some((k) => legs.some((r) => flags[k].has(r.id)));
    main.querySelector('#anat-rules').innerHTML = `<div class="detail-row"><div class="chips">${Object.keys(RULES).map(chip).join('')}</div>
      <span class="muted">Case ${(S.caseIdx % caseIds.length + caseIds.length) % caseIds.length + 1} of ${caseIds.length}${any ? '' : ' · <b style="color:var(--crit-ink)">missed by every rule</b>'}</span></div>`;
  };
  main.querySelector('#case-prev').addEventListener('click', () => { S.caseIdx--; showCase(); });
  main.querySelector('#case-next').addEventListener('click', () => { S.caseIdx++; showCase(); });

  function update() {
    syncCtl();
    const flags = runRules(S.pre, S.p);
    const ev = evaluate(S.pre, flags, S.period, S.inUnion);
    const R = ev.res;
    const per1k = (n) => ((n / ev.n) * 1000).toFixed(1);
    const bar = (v) => `<span class="mbar"><i style="width:${(Number.isFinite(v) ? v : 0) * 100}%"></i></span>`;
    const row = (key, label, name, cls = '') => {
      const m = R[key];
      const ruleRow = !!RULES[key];
      return `<tr class="${cls} ${ruleRow ? 'link' : ''}" data-rule="${ruleRow ? key : ''}">
        <td>${ruleRow ? `<input type="checkbox" data-u="${key}" ${S.inUnion.has(key) ? 'checked' : ''} aria-label="Include ${key} in union" onclick="event.stopPropagation()">` : ''}</td>
        <td><span class="rid">${label}</span> ${esc(name)}</td>
        <td class="num">${int(m.flagged)}</td><td class="num">${int(m.tp)}</td>
        <td class="num">${pct(m.precision)}${bar(m.precision)}</td><td class="num">${pct(m.recall)}${bar(m.recall)}</td>
        <td class="num">${m.f1.toFixed(2)}</td><td class="num">${per1k(m.flagged)}</td></tr>
        ${S.open === key ? `<tr class="expand"><td></td><td colspan="7"><p class="ink2" style="margin-bottom:8px">${esc(RULES[key].hyp)}</p><pre class="sql">${hl(sqlOf(key, S.p))}</pre></td></tr>` : ''}`;
    };
    main.querySelector('#board').innerHTML = `<table><thead><tr><th></th><th>Rule</th><th class="num">Alerts</th><th class="num">Fraud hit</th><th class="num">Precision</th><th class="num">Recall</th><th class="num">F1</th><th class="num">Per 1k tx</th></tr></thead><tbody>
      ${Object.keys(RULES).map((k) => row(k, k, RULES[k].name)).join('')}
      ${row('UNION', 'ANY', `Union of ${S.inUnion.size} ticked rules`, 'union')}
      ${row('BASE', 'BASE', 'Built-in flag (TRANSFER > 200,000)', 'base')}
      ${row('NONE', 'NONE', 'Flag nothing', 'base')}
      </tbody></table><p class="muted" style="padding:10px 18px">${int(ev.n)} transactions and ${int(ev.frauds)} fraud rows in steps ${ev.lo}–${ev.hi}.</p>`;
    main.querySelectorAll('#board tr[data-rule]').forEach((tr) => tr.dataset.rule && tr.addEventListener('click', () => { S.open = S.open === tr.dataset.rule ? null : tr.dataset.rule; update(); }));
    main.querySelectorAll('#board [data-u]').forEach((cb) => cb.addEventListener('change', () => { cb.checked ? S.inUnion.add(cb.dataset.u) : S.inUnion.delete(cb.dataset.u); update(); }));

    scatter(main.querySelector('#pr'), [
      ...Object.keys(RULES).map((k) => ({ ...R[k], label: k, name: RULES[k].name })),
      { ...R.UNION, label: 'ANY', name: 'Union', cls: 'union' },
      { ...R.BASE, label: 'BASE', name: 'Built-in flag', cls: 'base' },
    ]);

    const curve = budgetCurve(S.pre, flags, ev, KS);
    const cur = curve.find((c) => c.K === S.K);
    main.querySelector('#b-rec').textContent = pct(cur.recall, 0);
    main.querySelector('#b-al').textContent = int(cur.alerts);
    line(main.querySelector('#curve'), curve, S.K);

    // findings
    const rules = Object.keys(RULES).map((k) => ({ k, ...R[k] })).filter((r) => r.flagged > 0);
    const bestP = [...rules].sort((a, b) => b.precision - a.precision)[0];
    const bestR = [...rules].sort((a, b) => b.recall - a.recall)[0];
    const noisiest = [...rules].sort((a, b) => a.precision - b.precision)[0];
    const accNone = 1 - ev.frauds / ev.n;
    const trainU = evaluate(S.pre, flags, 'train', S.inUnion).res.UNION, testU = evaluate(S.pre, flags, 'test', S.inUnion).res.UNION;
    const f = [
      ['%', `<b>The accuracy trap.</b> Flagging nothing at all is ${pct(accNone, 2)} "accurate" here and catches zero fraud. That's why the scoreboard uses precision and recall.`],
      ['P', `<b>${bestP.k} ${esc(RULES[bestP.k].name)}</b> is the most precise rule: ${pct(bestP.precision)} of its alerts are fraud, but it catches only ${pct(bestP.recall)} of it.`],
      ['R', `<b>${bestR.k} ${esc(RULES[bestR.k].name)}</b> catches the most fraud (${pct(bestR.recall)}) at ${pct(bestR.precision)} precision.`],
      ['!', `<b>${noisiest.k} ${esc(RULES[noisiest.k].name)}</b> is the noisiest: ${int(noisiest.flagged - noisiest.tp)} false alerts. Untick it and watch the union's precision change.`],
      ['K', `With a budget of <b>${S.K} alerts a day</b>, the desk reads ${int(cur.alerts)} alerts and catches ${pct(cur.recall, 0)} of fraud. Reading everything the union flags would mean ${int(R.UNION.flagged)} alerts.`],
      ['T', `Union F1 is ${trainU.f1.toFixed(2)} on training steps and ${testU.f1.toFixed(2)} on unseen test steps. ${testU.f1 < trainU.f1 - 0.03 ? 'The drop is the price of tuning on the past.' : testU.f1 > trainU.f1 + 0.03 ? 'Test is higher here, which is a reminder that one month of data is noisy. A single split is not proof.' : 'Stable across the split.'}`],
      ['B', `The built-in flag raises ${int(R.BASE.flagged)} alerts at ${pct(R.BASE.precision)} precision. Large ≠ fraudulent.`],
    ];
    main.querySelector('#findings').innerHTML = f.map(([i, t]) => `<div class="finding"><span class="ico">${i}</span><div>${t}</div></div>`).join('');
    showCase();
  }

  update();
}

function hl(sql) {
  return esc(sql)
    .replace(/(--[^\n]*)/g, '<span class="cm">$1</span>')
    .replace(/\b(SELECT|FROM|WHERE|AND|JOIN|ON|WITH|AS|UNION|GROUP BY|HAVING|OVER|PARTITION BY|ORDER BY|RANGE BETWEEN|PRECEDING|CURRENT ROW|UNBOUNDED|IN|NOT LIKE|BETWEEN|IS NOT NULL|USING|count|median|quantile_cont|row_number|DISTINCT)\b/g, '<span class="kw">$1</span>');
}

// exported for tests
export { simulate, prepare, runRules, evaluate, budgetCurve, DEFAULTS };
