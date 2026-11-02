// Visual effects ported to plain JS from two 21st.dev React components:
//  - "Animated Beam" (Magic UI, dillionverma): a light pulse travelling along a curved
//    connector between two elements. Re-measures on resize.
//  - "Animated Grid" (rmahammad): a CSS-only drifting grid backdrop (see .fx-grid in styles.css).

const SVGNS = 'http://www.w3.org/2000/svg';
let uid = 0;

// pairs: [{ from: Element, to: Element, curvature, reverse, delay, duration, tone }]
// tone: 'accent' | 'crit' | 'good' | 'muted'
export function beams(container, pairs) {
  container.querySelector(':scope > svg.fx-beams')?.remove();
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.classList.add('fx-beams');
  svg.setAttribute('aria-hidden', 'true');
  container.prepend(svg);

  const items = pairs.map((p) => {
    const id = `fxb${++uid}`;
    const g = document.createElementNS(SVGNS, 'g');
    g.dataset.tone = p.tone || 'accent';
    g.innerHTML = `
      <defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse">
        <stop offset="0" class="s0"/><stop offset="0.5" class="s1"/><stop offset="1" class="s2"/>
      </linearGradient></defs>
      <path class="track"/>
      <path class="pulse" pathLength="1000" stroke="url(#${id})"
        style="animation-duration:${p.duration || 3.2}s;animation-delay:${p.delay || 0}s;${p.reverse ? 'animation-direction:reverse;' : ''}"/>`;
    svg.appendChild(g);
    return { ...p, g, grad: g.querySelector('linearGradient') };
  });

  const layout = () => {
    const c = container.getBoundingClientRect();
    svg.setAttribute('width', c.width);
    svg.setAttribute('height', c.height);
    svg.setAttribute('viewBox', `0 0 ${c.width} ${c.height}`);
    for (const it of items) {
      if (!it.from.isConnected || !it.to.isConnected) continue;
      const a = it.from.getBoundingClientRect(), b = it.to.getBoundingClientRect();
      // anchor on the facing edges so the line doesn't run under the boxes
      const horizontal = Math.abs((b.left + b.width / 2) - (a.left + a.width / 2)) >= Math.abs((b.top + b.height / 2) - (a.top + a.height / 2));
      let sx, sy, ex, ey;
      if (horizontal) {
        const ltr = b.left > a.left;
        sx = (ltr ? a.right : a.left) - c.left; sy = a.top + a.height / 2 - c.top;
        ex = (ltr ? b.left : b.right) - c.left; ey = b.top + b.height / 2 - c.top;
      } else {
        const ttb = b.top > a.top;
        sx = a.left + a.width / 2 - c.left; sy = (ttb ? a.bottom : a.top) - c.top;
        ex = b.left + b.width / 2 - c.left; ey = (ttb ? b.top : b.bottom) - c.top;
      }
      const cv = it.curvature || 0;
      const d = horizontal
        ? `M ${sx},${sy} C ${(sx + ex) / 2},${sy - cv} ${(sx + ex) / 2},${ey - cv} ${ex},${ey}`
        : `M ${sx},${sy} C ${sx - cv},${(sy + ey) / 2} ${ex - cv},${(sy + ey) / 2} ${ex},${ey}`;
      it.g.querySelectorAll('path').forEach((p) => p.setAttribute('d', d));
      it.grad.setAttribute('x1', sx); it.grad.setAttribute('y1', sy);
      it.grad.setAttribute('x2', ex); it.grad.setAttribute('y2', ey);
    }
  };
  layout();
  const ro = new ResizeObserver(layout);
  ro.observe(container);
  return { layout, setActive: (fn) => items.forEach((it, i) => it.g.classList.toggle('dim', !fn(it, i))) };
}

// Count-up for headline numbers (respects reduced motion)
export function countUp(root = document) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.querySelectorAll('[data-count]').forEach((el) => {
    const target = Number(el.dataset.count), suffix = el.dataset.suffix || '';
    if (reduce || !Number.isFinite(target)) { el.textContent = target.toLocaleString('en-GB') + suffix; return; }
    const t0 = performance.now(), dur = 900;
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(target * e).toLocaleString('en-GB') + suffix;
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
