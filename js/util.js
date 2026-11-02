// Shared formatting helpers for the lab and home views.
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const int = (n) => Math.round(n).toLocaleString('en-GB');
export const pct = (x, d = 1) => (Number.isFinite(x) ? `${(x * 100).toFixed(d)}%` : '–');
export const money = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}m` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : Math.round(n).toString());

export function prf(flagged, labels) {
  // flagged: Set of ids; labels: Set of positive ids
  let tp = 0;
  for (const id of flagged) if (labels.has(id)) tp++;
  const p = flagged.size ? tp / flagged.size : NaN;
  const r = labels.size ? tp / labels.size : NaN;
  const f1 = p + r ? (2 * p * r) / (p + r) : 0;
  return { flagged: flagged.size, tp, precision: p, recall: r, f1: Number.isFinite(f1) ? f1 : 0 };
}

export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
