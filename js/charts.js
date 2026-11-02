// Tiny dependency-free charts: horizontal bars, monthly columns and a segmented bar.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const tip = () => document.getElementById('tooltip');
export function showTip(evt, html) {
  const t = tip();
  t.innerHTML = html;
  t.hidden = false;
  const pad = 14;
  const { innerWidth: w } = window;
  const r = t.getBoundingClientRect();
  let x = evt.clientX + pad;
  if (x + r.width > w - 8) x = evt.clientX - r.width - pad;
  t.style.left = `${Math.max(8, x)}px`;
  t.style.top = `${Math.max(8, evt.clientY - r.height - 10)}px`;
}
export const hideTip = () => { tip().hidden = true; };

function bindTips(root, lookup) {
  root.querySelectorAll('[data-tip]').forEach((el) => {
    el.addEventListener('mousemove', (e) => showTip(e, lookup(el.dataset.tip)));
    el.addEventListener('mouseleave', hideTip);
  });
}

// rows: [{ key, label, value, tip }]
export function hbar(el, rows, { onClick } = {}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  el.innerHTML = `<div class="hbar" role="list">${rows.map((r, i) => `
    <div class="hbar-row${onClick ? ' clickable' : ''}" role="listitem" data-tip="${i}" data-key="${esc(r.key)}"
      ${onClick ? 'tabindex="0"' : ''} aria-label="${esc(r.label)}: ${r.value}">
      <span class="hbar-label">${esc(r.label)}</span>
      <span class="hbar-track"><span class="hbar-fill" style="width:${(r.value / max) * 100}%"></span></span>
      <span class="hbar-val">${r.value}</span>
    </div>`).join('')}</div>`;
  bindTips(el, (i) => rows[i].tip || `${esc(rows[i].label)}: <b>${rows[i].value}</b>`);
  if (onClick) {
    el.querySelectorAll('.hbar-row').forEach((row) => {
      const go = () => { hideTip(); onClick(row.dataset.key); };
      row.addEventListener('click', go);
      row.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    });
  }
}

// cols: [{ label, value, tip, dim }]
export function columns(el, cols) {
  // Draw at the container's real pixel width so text stays 11-12px
  const W = Math.max(280, el.clientWidth || 640), H = 240, L = 30, B = 24, T = 10;
  const max = Math.max(1, ...cols.map((c) => c.value));
  const step = [1, 2, 5, 10, 20, 50, 100].find((s) => Math.ceil(max / s) <= 5);
  const top = Math.ceil(max / step) * step;
  const plotW = W - L, plotH = H - B - T;
  const bw = plotW / cols.length;
  const y = (v) => T + plotH - (v / top) * plotH;
  const ticks = Array.from({ length: top / step + 1 }, (_, k) => k * step);
  el.innerHTML = `<div class="colchart"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Column chart">
    <g class="grid">${ticks.map((v) => `<line x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${Math.round(v)}</text>`).join('')}</g>
    ${cols.map((c, i) => {
      const x = L + i * bw + bw * 0.18, w = bw * 0.64, h = Math.max(0, y(0) - y(c.value));
      const r = Math.min(4, h, w / 2);
      // column with rounded data-end only
      const d = h > 0 ? `M${x},${y(0)} V${y(c.value) + r} Q${x},${y(c.value)} ${x + r},${y(c.value)} H${x + w - r} Q${x + w},${y(c.value)} ${x + w},${y(c.value) + r} V${y(0)} Z` : '';
      return `<g data-tip="${i}"><rect class="hit" x="${L + i * bw}" y="${T}" width="${bw}" height="${plotH}"/>
        <path class="col${c.dim ? ' dim' : ''}" d="${d}"/>
        <text x="${L + i * bw + bw / 2}" y="${H - 6}" text-anchor="middle">${esc(c.label)}</text></g>`;
    }).join('')}
    <line class="baseline" x1="${L}" x2="${W}" y1="${y(0)}" y2="${y(0)}"/>
  </svg></div>`;
  bindTips(el, (i) => cols[i].tip);
  if (!el._ro) {
    let w = el.clientWidth;
    el._ro = new ResizeObserver(() => { if (Math.abs(el.clientWidth - w) > 8) { w = el.clientWidth; columns(el, cols); } });
    el._ro.observe(el);
  }
}

// parts: [{ label, value, cls }]
export function segmented(el, parts) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  el.innerHTML = `
    <div class="seg" role="img" aria-label="${parts.map((p) => `${p.label} ${p.value}`).join(', ')}">
      ${parts.filter((p) => p.value).map((p, i) => `<span data-tip="${i}" class="segpart" style="flex:${p.value};background:var(--${p.cls})"></span>`).join('')}
    </div>
    <div class="legend">${parts.map((p) => `<span><i class="dot ${p.cls === 'good' ? 'low' : p.cls === 'warn' ? 'medium' : 'high'}"></i>${esc(p.label)} <b>${p.value}</b> <span class="muted">(${Math.round((p.value / total) * 100)}%)</span></span>`).join('')}</div>`;
  const shown = parts.filter((p) => p.value);
  bindTips(el, (i) => `${esc(shown[i].label)}: <b>${shown[i].value}</b> investors (${Math.round((shown[i].value / total) * 100)}%)`);
}
