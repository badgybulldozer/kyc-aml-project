// Typology Graph Lab: the eight laundering patterns used in IBM's AMLworld paper,
// animated one at a time, plus a detector bench on a synthetic payment network.
import { esc, int, pct, money, mulberry32 } from './util.js';
import { hbar, columns } from './charts.js';

const TYPES = {
  'FAN-OUT': { focus: 0, text: 'One account spreads money to many accounts in a short time, e.g. to pay a group of money mules or to break a large sum into smaller ones.', catch: 'Fan-out count in a time window.' },
  'FAN-IN': { focus: 6, text: 'Many accounts send money to one account, e.g. mules consolidating cash they placed separately.', catch: 'Fan-in count in a time window.' },
  'CYCLE': { focus: 0, text: 'Money travels around a loop of accounts and returns to where it started, so it looks like ordinary trade.', catch: 'Cycle closure: does a path of recent transactions lead back to the sender? Only works up to the hop limit.' },
  'SCATTER-GATHER': { focus: 5, text: 'A source splits money across several intermediaries, which later forward it to one destination.', catch: 'Scatter-gather: many intermediaries between the same source and destination.' },
  'GATHER-SCATTER': { focus: 4, text: 'Money is collected from many sources into one hub, then dispersed again to many accounts.', catch: 'Fan-in and fan-out on the same hub.' },
  'STACK': { focus: 4, text: 'Layers of accounts each pass money on to the next layer, like fan-outs stacked on top of each other.', catch: 'Weakly. Each account only has a few counterparties, so count thresholds rarely trigger.' },
  'BIPARTITE': { focus: 4, text: 'One group of accounts sends to another group, with many cross links and no single hub.', catch: 'Weakly. No single account stands out.' },
  'RANDOM': { focus: 0, text: 'Money hops along a random path of accounts with no fixed shape.', catch: 'Not by any shape detector. Needs behavioural features or a model.' },
};

// ---------- hand-laid example instances for the animation ----------
function example(type) {
  const N = (id, x, y) => ({ id, x, y });
  const E = (a, b, t, amt) => ({ a, b, t, amt });
  const arc = (cx, cy, r, n, a0, a1) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos(a0 + ((a1 - a0) * i) / Math.max(1, n - 1)), cy + r * Math.sin(a0 + ((a1 - a0) * i) / Math.max(1, n - 1))]);
  switch (type) {
    case 'FAN-OUT': { const p = arc(140, 150, 300, 6, -0.55, 0.55); return { nodes: [N('A0', 110, 150), ...p.map(([x, y], i) => N(`M${i + 1}`, x + 140, y))], edges: p.map((_, i) => E(0, i + 1, i * 2, 9400 - i * 300)) }; }
    case 'FAN-IN': { const p = arc(420, 150, 300, 6, Math.PI - 0.55, Math.PI + 0.55); return { nodes: [...p.map(([x, y], i) => N(`M${i + 1}`, x - 140, y)), N('B0', 450, 150)], edges: p.map((_, i) => E(i, 6, i * 3, 8800 + i * 150)) }; }
    case 'CYCLE': { const n = 6; return { nodes: Array.from({ length: n }, (_, i) => N(`C${i}`, 280 + 115 * Math.cos(-Math.PI / 2 + (2 * Math.PI * i) / n), 150 + 115 * Math.sin(-Math.PI / 2 + (2 * Math.PI * i) / n))), edges: Array.from({ length: n }, (_, i) => E(i, (i + 1) % n, i * 5, 50000 - i * 900)) }; }
    case 'SCATTER-GATHER': return { nodes: [N('S', 80, 150), N('I1', 280, 45), N('I2', 280, 115), N('I3', 280, 185), N('I4', 280, 255), N('T', 480, 150)], edges: [E(0, 1, 0, 24000), E(0, 2, 1, 23500), E(0, 3, 2, 24500), E(0, 4, 3, 23800), E(1, 5, 9, 23400), E(2, 5, 11, 23000), E(3, 5, 12, 24100), E(4, 5, 14, 23300)] };
    case 'GATHER-SCATTER': return { nodes: [N('S1', 80, 60), N('S2', 80, 125), N('S3', 80, 190), N('S4', 80, 255), N('H', 280, 155), N('R1', 480, 60), N('R2', 480, 125), N('R3', 480, 190), N('R4', 480, 255)], edges: [E(0, 4, 0, 9000), E(1, 4, 2, 9400), E(2, 4, 3, 8700), E(3, 4, 5, 9100), E(4, 5, 10, 8800), E(4, 6, 11, 9000), E(4, 7, 12, 8900), E(4, 8, 13, 9200)] };
    case 'STACK': return { nodes: [N('L1a', 90, 70), N('L1b', 90, 150), N('L1c', 90, 230), N('L2a', 280, 70), N('L2b', 280, 150), N('L2c', 280, 230), N('L3a', 470, 70), N('L3b', 470, 150), N('L3c', 470, 230)], edges: [E(0, 3, 0, 7000), E(0, 4, 1, 7100), E(1, 4, 2, 6900), E(1, 5, 3, 7200), E(2, 5, 4, 7000), E(3, 6, 9, 6800), E(4, 7, 10, 6950), E(4, 6, 11, 7050), E(5, 8, 12, 7150), E(5, 7, 13, 6900)] };
    case 'BIPARTITE': return { nodes: [N('P1', 120, 70), N('P2', 120, 150), N('P3', 120, 230), N('Q1', 440, 50), N('Q2', 440, 120), N('Q3', 440, 190), N('Q4', 440, 260)], edges: [E(0, 3, 0, 5000), E(0, 5, 2, 5200), E(1, 4, 3, 4900), E(1, 6, 4, 5100), E(2, 3, 6, 5050), E(2, 4, 7, 4950), E(1, 5, 9, 5000)] };
    default: return { nodes: [N('R0', 70, 210), N('R1', 160, 90), N('R2', 250, 200), N('R3', 340, 80), N('R4', 420, 210), N('R5', 500, 100)], edges: [E(0, 1, 0, 30000), E(1, 2, 7, 29500), E(2, 3, 15, 29100), E(3, 4, 26, 28700), E(4, 5, 31, 28200)] };
  }
}

// features of one node, using only edges[0..k]
function nodeFeatures(ex, focus, k, P) {
  const es = ex.edges.slice(0, k + 1);
  const inS = new Set(es.filter((e) => e.b === focus).map((e) => e.a));
  const outS = new Set(es.filter((e) => e.a === focus).map((e) => e.b));
  const recip = [...inS].filter((x) => outS.has(x)).length;
  // time-respecting cycle back to focus
  let cyc = 0;
  const dfs = (node, t, depth, seen) => {
    for (const e of es) if (e.a === node && e.t > t && depth < 12) {
      if (e.b === focus && depth + 1 >= 2) { cyc = cyc ? Math.min(cyc, depth + 1) : depth + 1; continue; }
      if (!seen.has(e.b)) dfs(e.b, e.t, depth + 1, new Set([...seen, e.b]));
    }
  };
  dfs(focus, -1, 0, new Set([focus]));
  // scatter-gather into focus: max intermediaries sharing one source
  let sg = 0;
  const intoF = es.filter((e) => e.b === focus);
  const sources = new Map();
  for (const e2 of intoF) for (const e1 of es) if (e1.b === e2.a && e1.t < e2.t) {
    if (!sources.has(e1.a)) sources.set(e1.a, new Set());
    sources.get(e1.a).add(e2.a);
  }
  for (const s of sources.values()) sg = Math.max(sg, s.size);
  return [
    ['Fan-in (distinct senders)', inS.size, inS.size >= P.kin],
    ['Fan-out (distinct receivers)', outS.size, outS.size >= P.kout],
    ['Reciprocity (sent and received)', recip, false],
    ['Shortest cycle back to it', cyc ? `${cyc} hops` : '–', cyc && cyc <= P.hops],
    ['Scatter-gather intermediaries', sg, sg >= P.ksg],
  ];
}

// ---------- bench network ----------
function buildNetwork() {
  const rnd = mulberry32(2023);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const between = (a, b) => a + rnd() * (b - a);
  const HOURS = 30 * 24;
  const acc = Array.from({ length: 520 }, (_, i) => `A${String(i).padStart(3, '0')}`);
  const tx = [];
  let id = 1;
  const add = (a, b, t, amt, lab = null) => tx.push({ id: id++, a, b, t: Math.round(t * 10) / 10, amt: Math.round(amt), lab });
  const weight = acc.map(() => Math.pow(rnd(), 3));
  const W = weight.reduce((s, x) => s + x, 0);
  const pickW = () => { let r = rnd() * W; for (let i = 0; i < acc.length; i++) if ((r -= weight[i]) < 0) return acc[i]; return acc[0]; };

  // ordinary payments
  for (let i = 0; i < 6200; i++) { const a = pickW(); let b = pick(acc); if (b === a) b = pick(acc); add(a, b, between(0, HOURS), Math.exp(between(Math.log(50), Math.log(20000)))); }
  // payroll: legit fan-out twice a month
  for (let c = 0; c < 5; c++) { const co = acc[c], staff = Array.from({ length: 10 + Math.floor(rnd() * 14) }, () => pick(acc)); for (const day of [0, 15]) staff.forEach((s, j) => add(co, s, day * 24 + 9 + j * 0.05, between(1500, 4000))); }
  // utilities / merchants: legit fan-in
  for (let u = 0; u < 4; u++) { const ut = acc[10 + u]; for (let i = 0; i < 170; i++) add(pick(acc), ut, between(0, HOURS), between(20, 300)); }
  // friends paying each other back (legit 2-cycles)
  for (let i = 0; i < 60; i++) { const a = pick(acc), b = pick(acc), t = between(0, HOURS - 48); add(a, b, t, between(20, 200)); add(b, a, t + between(1, 40), between(20, 200)); }

  // planted laundering instances
  let L = 0;
  const fresh = () => (rnd() < 0.7 ? `L${String(L++).padStart(3, '0')}` : pick(acc));
  const inst = [];
  const plant = (type, edges, meta = {}) => { const iid = inst.length; inst.push({ type, ...meta }); for (const [a, b, t, amt] of edges) add(a, b, t, amt, { type, iid, ...meta }); };
  const start = () => between(24, HOURS - 96);
  for (let r = 0; r < 6; r++) {
    { const s = fresh(), t0 = start(), n = 5 + Math.floor(rnd() * 5); plant('FAN-OUT', Array.from({ length: n }, (_, i) => [s, fresh(), t0 + i * between(0.5, 3), between(4000, 9900)])); }
    { const d = fresh(), t0 = start(), n = 5 + Math.floor(rnd() * 5); plant('FAN-IN', Array.from({ length: n }, (_, i) => [fresh(), d, t0 + i * between(0.5, 3), between(4000, 9900)])); }
    { const s = fresh(), d = fresh(), t0 = start(), m = Array.from({ length: 3 + Math.floor(rnd() * 3) }, fresh); plant('SCATTER-GATHER', [...m.map((x, i) => [s, x, t0 + i, between(8000, 12000)]), ...m.map((x, i) => [x, d, t0 + 8 + i * 1.5, between(7500, 11500)])]); }
    { const h = fresh(), t0 = start(), ins = Array.from({ length: 4 + Math.floor(rnd() * 3) }, fresh), outs = Array.from({ length: 4 + Math.floor(rnd() * 3) }, fresh); plant('GATHER-SCATTER', [...ins.map((x, i) => [x, h, t0 + i, between(5000, 9000)]), ...outs.map((x, i) => [h, x, t0 + 10 + i, between(5000, 9000)])]); }
    { const l1 = [fresh(), fresh(), fresh()], l2 = [fresh(), fresh(), fresh()], l3 = [fresh(), fresh(), fresh()], t0 = start(), e = []; l1.forEach((a, i) => { e.push([a, l2[i], t0 + i, 7000]); e.push([a, l2[(i + 1) % 3], t0 + i + 0.5, 7000]); }); l2.forEach((a, i) => { e.push([a, l3[i], t0 + 9 + i, 6800]); e.push([a, l3[(i + 2) % 3], t0 + 9.5 + i, 6800]); }); plant('STACK', e); }
    { const A = [fresh(), fresh(), fresh()], B = [fresh(), fresh(), fresh(), fresh()], t0 = start(), e = []; for (let i = 0; i < 7; i++) e.push([pick(A), pick(B), t0 + i * between(1, 4), between(3000, 6000)]); plant('BIPARTITE', e); }
    { const n = 4 + Math.floor(rnd() * 4), p = Array.from({ length: n + 1 }, fresh); let t = start(); plant('RANDOM', p.slice(0, -1).map((a, i) => [a, p[i + 1], (t += between(2, 8)), 30000 - i * 400])); }
  }
  for (let len = 2; len <= 10; len++) for (let r = 0; r < 2; r++) {
    // each hop happens after the previous one, so the loop is time-respecting
    const c = Array.from({ length: len }, fresh);
    let t = start();
    plant('CYCLE', c.map((a, i) => [a, c[(i + 1) % len], (t += between(1, 5)), 40000 - i * 500]), { hops: len });
  }
  tx.sort((x, y) => x.t - y.t || x.id - y.id);
  const out = new Map(), inn = new Map();
  for (const e of tx) { (out.get(e.a) || out.set(e.a, []).get(e.a)).push(e); (inn.get(e.b) || inn.set(e.b, []).get(e.b)).push(e); }
  return { tx, out, inn, inst };
}

function detect(net, P) {
  const flagged = new Set();
  const why = { fanin: new Set(), fanout: new Set(), cycle: new Set(), sg: new Set() };
  const leak = P.leak;
  const inWin = (e, t, W) => (leak ? Math.abs(e.t - t) < W : e.t > t - W && e.t <= t);
  for (const e of net.tx) {
    const t = e.t;
    // fan-in on the receiver
    const ins = (net.inn.get(e.b) || []).filter((x) => inWin(x, t, P.win));
    if (new Set(ins.map((x) => x.a)).size >= P.kin) ins.forEach((x) => { flagged.add(x.id); why.fanin.add(x.id); });
    // fan-out on the sender
    const outs = (net.out.get(e.a) || []).filter((x) => inWin(x, t, P.win));
    if (new Set(outs.map((x) => x.b)).size >= P.kout) outs.forEach((x) => { flagged.add(x.id); why.fanout.add(x.id); });
    // cycle closure: a time-respecting path b -> ... -> a made of earlier edges (max P.hops total)
    const CW = 96;
    // path edges + the closing edge e must total <= P.hops
    const path = [];
    // earliest arrival time at each node per depth: a later or deeper arrival can't do better
    const best = new Map();
    const dominated = (node, tt, depth) => { const b = best.get(node); if (!b) return false; for (let d = 0; d <= depth; d++) if (b[d] !== undefined && b[d] <= tt) return true; return false; };
    let budget = 20000;
    const dfs = (node, tPrev, depth) => {
      for (const x of net.out.get(node) || []) {
        if (--budget < 0) return false;
        if (leak ? Math.abs(x.t - t) >= CW : !(x.t > tPrev && x.t < t && x.t > t - CW)) continue;
        if (x.id === e.id) continue;
        if (x.b === e.a) { if (depth + 2 <= P.hops) { path.push(x); return true; } continue; }
        if (x.b === e.b || depth + 3 > P.hops || (!leak && dominated(x.b, x.t, depth))) continue;
        if (!best.has(x.b)) best.set(x.b, []);
        best.get(x.b)[depth] = Math.min(best.get(x.b)[depth] ?? Infinity, x.t);
        path.push(x);
        if (dfs(x.b, leak ? -Infinity : x.t, depth + 1)) return true;
        path.pop();
      }
      return false;
    };
    if (e.a !== e.b && dfs(e.b, leak ? -Infinity : t - CW, 0)) { [e, ...path].forEach((x) => { flagged.add(x.id); why.cycle.add(x.id); }); }
    // scatter-gather into the receiver
    const into = (net.inn.get(e.b) || []).filter((x) => inWin(x, t, CW));
    const bySrc = new Map();
    for (const m of into) for (const s of net.inn.get(m.a) || []) {
      if (!(s.t < m.t && s.t > m.t - CW) && !leak) continue;
      if (!bySrc.has(s.a)) bySrc.set(s.a, new Map());
      bySrc.get(s.a).set(m.a, [s, m]);
    }
    for (const [, mids] of bySrc) if (mids.size >= P.ksg) for (const [s, m] of mids.values()) { flagged.add(s.id); flagged.add(m.id); why.sg.add(s.id); why.sg.add(m.id); }
  }
  return { flagged, why };
}

function score(net, det) {
  const lab = net.tx.filter((e) => e.lab);
  const tp = lab.filter((e) => det.flagged.has(e.id)).length;
  const byType = {};
  for (const t of Object.keys(TYPES)) { const l = lab.filter((e) => e.lab.type === t); byType[t] = { n: l.length, hit: l.filter((e) => det.flagged.has(e.id)).length }; }
  const byHop = [];
  for (let h = 2; h <= 10; h++) { const l = lab.filter((e) => e.lab.hops === h); byHop.push({ h, n: l.length, hit: l.filter((e) => det.flagged.has(e.id)).length }); }
  return { flagged: det.flagged.size, tp, fp: det.flagged.size - tp, pos: lab.length, n: net.tx.length, precision: det.flagged.size ? tp / det.flagged.size : NaN, recall: tp / lab.length, byType, byHop };
}

// ---------- view ----------
let NET = null;
const G = { type: 'SCATTER-GATHER', k: 0, playing: null, P: { win: 24, kin: 5, kout: 5, hops: 4, ksg: 3, leak: false } };

export function renderGraphLab(main) {
  if (!NET) NET = buildNetwork();
  clearInterval(G.playing); G.playing = null;
  const laund = NET.tx.filter((e) => e.lab).length;
  main.innerHTML = `
    <div class="page-head"><div><div class="crumb">Lab 03</div><h1>Laundering pattern lab</h1>
      <p>Layering happens in a network, not in one transaction. These are the eight laundering shapes used in IBM's synthetic AMLworld dataset (Altman et al., NeurIPS 2023). Pick one and press play to watch the money move, while the graph features an analyst or model would see build up step by step.</p></div>
      <span class="asof">Synthetic network · not AMLworld figures</span></div>

    <div class="card">
      <div class="typo-tabs" id="tabs">${Object.keys(TYPES).map((t) => `<button data-t="${t}">${t.toLowerCase().replace(/(^|-)\w/g, (m) => m.toUpperCase())}</button>`).join('')}</div>
      <div class="grid g-3-2">
        <div><div class="netview" id="net"></div>
          <div class="player"><button class="btn" id="play">▶ Play</button><input type="range" id="scrub" min="0" value="0" aria-label="Transaction step"><span class="t" id="tlabel"></span></div></div>
        <div class="stack" style="gap:12px">
          <div><h3 id="t-name"></h3><p class="ink2" id="t-text" style="margin-top:4px"></p></div>
          <div class="callout"><b>How a detector sees it:</b> <span id="t-catch"></span></div>
          <div><h3 style="margin-bottom:8px">Features of <span class="mono" id="t-focus"></span> so far <span class="muted">(past transactions only)</span></h3><div class="feat" id="feats"></div></div>
        </div>
      </div>
    </div>

    <div class="card mt"><div class="section-head"><div><h2>Detector bench</h2>
      <div class="sub">${int(NET.tx.length)} payments between ${int(new Set(NET.tx.flatMap((e) => [e.a, e.b])).size)} accounts over 30 days, including ${int(laund)} laundering transactions in ${NET.inst.length} planted patterns, payroll runs, utility bills and friends paying each other back. Four rule-based graph detectors run live.</div></div></div>
      <div class="lab-controls mt" id="gctl"></div>
      <label class="mt" style="display:flex;gap:8px;align-items:center;cursor:pointer"><input type="checkbox" id="leak"> <span><b>Let detectors peek at future transactions</b> <span class="muted">(data leakage, which the spec forbids). Watch how the numbers move on information a live system would never have.</span></span></label>
      <div class="grid g-kpi mt" id="gstats"></div>
      <div class="det-grid mt">
        <div><h3>Recall by typology</h3><p class="muted" style="font-size:12px;margin:2px 0 10px">Share of each pattern's transactions that end up in an alert.</p><div id="g-type"></div></div>
        <div><h3>Cycle recall by hop length</h3><p class="muted" style="font-size:12px;margin:2px 0 10px">The cycle detector only searches up to the hop limit. Longer loops vanish.</p><div id="g-hop"></div></div>
      </div>
      <div id="g-note" class="mt"></div>
    </div>`;

  // ---- animation ----
  const tabs = main.querySelectorAll('#tabs button');
  const scrub = main.querySelector('#scrub');
  const draw = () => {
    const ex = example(G.type), T = TYPES[G.type];
    tabs.forEach((b) => b.classList.toggle('on', b.dataset.t === G.type));
    scrub.max = ex.edges.length - 1;
    scrub.value = G.k;
    const r = 18;
    const touched = new Set(ex.edges.slice(0, G.k + 1).flatMap((e) => [e.a, e.b]));
    const edgeSvg = ex.edges.map((e, i) => {
      const A = ex.nodes[e.a], B = ex.nodes[e.b];
      const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1;
      const x1 = A.x + (dx / L) * r, y1 = A.y + (dy / L) * r, x2 = B.x - (dx / L) * (r + 6), y2 = B.y - (dy / L) * (r + 6);
      const cls = i < G.k ? 'done' : i === G.k ? 'live' : '';
      const mx = (x1 + x2) / 2 - (dy / L) * 10, my = (y1 + y2) / 2 + (dx / L) * 10;
      return `<path class="edge ${cls}" d="M${x1},${y1} Q${mx},${my} ${x2},${y2}" marker-end="url(#ah-${cls || 'idle'})"/>
        ${i <= G.k ? `<text class="amt" x="${mx}" y="${my - 4}" text-anchor="middle">${money(e.amt)}</text>` : ''}`;
    }).join('');
    main.querySelector('#net').innerHTML = `<svg viewBox="0 0 560 300" role="img" aria-label="${esc(G.type)} pattern animation">
      <defs>${[['idle', 'var(--axis)'], ['done', 'var(--accent)'], ['live', 'var(--crit)']].map(([k, c]) => `<marker id="ah-${k}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${c}"/></marker>`).join('')}</defs>
      ${edgeSvg}
      ${ex.nodes.map((n, i) => `<g class="node ${i === T.focus ? 'focus' : ''} ${touched.has(i) ? 'touched' : ''}"><circle cx="${n.x}" cy="${n.y}" r="${r}"/><text x="${n.x}" y="${n.y}">${n.id}</text></g>`).join('')}
    </svg>`;
    const e = ex.edges[G.k];
    main.querySelector('#tlabel').textContent = `hour ${e.t} · tx ${G.k + 1}/${ex.edges.length}`;
    main.querySelector('#t-name').textContent = G.type;
    main.querySelector('#t-text').textContent = T.text;
    main.querySelector('#t-catch').textContent = T.catch;
    main.querySelector('#t-focus').textContent = ex.nodes[T.focus].id;
    main.querySelector('#feats').innerHTML = nodeFeatures(ex, T.focus, G.k, G.P).map(([l, v, over]) => `<span>${l}</span><span class="v ${over ? 'over' : ''}">${v}${over ? ' ⚑' : ''}</span>`).join('')
      + '<span class="muted" style="grid-column:1/-1;font-size:12px">⚑ = over the bench threshold below</span>';
  };
  const stop = () => { clearInterval(G.playing); G.playing = null; main.querySelector('#play').textContent = '▶ Play'; };
  main.querySelector('#play').addEventListener('click', () => {
    if (G.playing) return stop();
    const n = example(G.type).edges.length;
    if (G.k >= n - 1) G.k = -1;
    main.querySelector('#play').textContent = '❚❚ Pause';
    G.playing = setInterval(() => { if (!main.isConnected) return stop(); G.k++; draw(); if (G.k >= n - 1) stop(); }, 850);
    G.k++; draw();
  });
  scrub.addEventListener('input', () => { stop(); G.k = +scrub.value; draw(); });
  tabs.forEach((b) => b.addEventListener('click', () => { stop(); G.type = b.dataset.t; G.k = 0; draw(); main.querySelector('#play').click(); }));

  // ---- bench ----
  const CTL = [
    ['win', 'Fan window', [6, 12, 24, 48, 72], (v) => `${v}h`],
    ['kin', 'Fan-in threshold', [3, 4, 5, 6, 8, 10], (v) => `${v}+`],
    ['kout', 'Fan-out threshold', [3, 4, 5, 6, 8, 10], (v) => `${v}+`],
    ['hops', 'Cycle hop limit', [2, 3, 4, 5, 6, 8, 10], (v) => `≤ ${v}`],
    ['ksg', 'Scatter-gather middles', [2, 3, 4, 5], (v) => `${v}+`],
  ];
  main.querySelector('#gctl').innerHTML = CTL.map(([k, l, g]) => `<div class="ctl"><label for="g-${k}">${l} <b id="gv-${k}"></b></label><input type="range" id="g-${k}" min="0" max="${g.length - 1}" step="1" value="${g.indexOf(G.P[k])}"></div>`).join('');
  const bench = () => {
    for (const [k, , , f] of CTL) main.querySelector(`#gv-${k}`).textContent = f(G.P[k]);
    const s = score(NET, detect(NET, G.P));
    const base = G.P.leak ? score(NET, detect(NET, { ...G.P, leak: false })) : null;
    main.querySelector('#gstats').innerHTML = [
      ['Laundering caught', pct(s.recall, 0), `${int(s.tp)} of ${int(s.pos)} transactions`],
      ['Precision', pct(s.precision, 0), 'of flagged transactions are laundering'],
      ['False alerts', int(s.fp), 'legit payments flagged'],
      ['Flagged per 1k', ((s.flagged / s.n) * 1000).toFixed(0), `of ${int(s.n)} payments`],
    ].map(([l, v, n]) => `<div class="card kpi"><div class="label">${l}</div><div class="value">${v}</div><div class="note">${n}</div></div>`).join('');
    hbar(main.querySelector('#g-type'), Object.entries(s.byType).map(([t, v]) => ({ key: t, label: t.toLowerCase(), value: Math.round((v.hit / v.n) * 100), tip: `<b>${t}</b><br>${v.hit} of ${v.n} transactions caught (${pct(v.hit / v.n, 0)})` })).sort((a, b) => b.value - a.value), {});
    main.querySelector('#g-type').querySelectorAll('.hbar-val').forEach((el) => (el.textContent += '%'));
    columns(main.querySelector('#g-hop'), s.byHop.map((h) => ({ label: `${h.h}`, value: Math.round((h.hit / h.n) * 100), tip: `<b>${h.h}-hop cycles</b><br>${h.hit} of ${h.n} transactions caught${h.h > G.P.hops ? '<br>beyond the hop limit' : ''}` })));
    const weak = Object.entries(s.byType).filter(([, v]) => v.hit / v.n < 0.3).map(([t]) => t.toLowerCase());
    main.querySelector('#g-note').innerHTML = `<div class="finding"><span class="ico">!</span><div>${G.P.leak
      ? `<b>Leakage on:</b> recall ${pct(base.recall, 0)} → ${pct(s.recall, 0)}, precision ${pct(base.precision, 0)} → ${pct(s.precision, 0)}, false alerts ${int(base.fp)} → ${int(s.fp)}. Better or worse, these numbers use tomorrow's payments, which a live system can't see, so none of them can be trusted. That is why the spec has a no-leakage test.`
      : `<b>Blind spots at these settings:</b> ${weak.length ? weak.join(', ') : 'none below 30%'}. Count and shape rules miss what they were not written for. That is the case for adding a model on top of graph features (see the <a href="#/roadmap">AMLworld plan</a>).`}</div></div>
      <div class="finding"><span class="ico">↺</span><div>Raising the cycle hop limit catches longer loops, but it also flags more friends who simply paid each other back. Watch false alerts as you drag it.</div></div>`;
  };
  for (const [k, , g] of CTL) main.querySelector(`#g-${k}`).addEventListener('input', (e) => { G.P[k] = g[+e.target.value]; bench(); draw(); });
  main.querySelector('#leak').checked = G.P.leak;
  main.querySelector('#leak').addEventListener('change', (e) => { G.P.leak = e.target.checked; bench(); });

  draw();
  bench();
}

export { buildNetwork, detect, score };
