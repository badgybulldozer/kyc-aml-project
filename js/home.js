// "Start here": hero, the laundering lifecycle and the live alert journey.
import { esc, int } from './util.js';
import { beams, countUp } from './fx.js';

const STAGES = {
  placement: {
    title: 'Placement',
    lead: 'Getting criminal money into the financial system for the first time.',
    fund: 'In a fund this looks like subscriptions split into small amounts, paid by someone other than the investor, or pushed through an old account nobody watches.',
    rules: ['R3', 'R1', 'R8', 'R9'],
    flags: ['Amounts just under a check threshold', 'Payer is not the investor', 'Dormant account suddenly active', 'Name close to a sanctions list entry'],
  },
  layering: {
    title: 'Layering',
    lead: 'Moving money around until the trail back to its source is hard to follow.',
    fund: 'Subscribe, then redeem within weeks. Route payments through banks in higher-risk countries. Transfer units to another company so value moves without cash moving.',
    rules: ['R2', 'R5', 'R7'],
    flags: ['Very short holding period', 'Money routed through an unrelated high-risk country', 'Units handed to an unrelated offshore company'],
    lab: true,
  },
  integration: {
    title: 'Integration',
    lead: 'Bringing the money back so it looks like legitimate wealth.',
    fund: 'Redemption proceeds are paid out to a third party, or an investor suddenly puts in far more than their profile explains. The money now "comes from a fund".',
    rules: ['R6', 'R4'],
    flags: ['Redemption paid to someone else', 'Investment far above the declared profile'],
  },
};

export function renderRoadmap(main) {
  const trap = (t, d) => `<div class="trap"><b>${t}</b><span class="ink2">${d}</span></div>`;
  main.innerHTML = `
    <div class="page-head"><div><div class="crumb">Roadmap</div><h1>Before touching real data</h1>
      <p>The labs on this site use small synthetic data so they can run in a browser. The next step is to run the same ideas on two public research datasets as reproducible Python projects. Before writing any code I reviewed my own first-draft specs and found these traps.</p></div></div>
    <div class="grid g-2">
      <div class="card">
        <span class="tile-k">Project A · planned</span><h2 style="margin-top:4px">fraud-red-flags (PaySim)</h2>
        <p class="ink2 mt">8 explainable fraud rules on about 6.36 million synthetic mobile-money transactions (VERIFY on download). DuckDB SQL, a temporal train/test split, an alert-budget analysis and a Streamlit dashboard. Every number comes from <span class="mono">make all</span>, never typed in.</p>
        <h3 class="mt">Data traps found in my own draft</h3>
        ${trap('No transaction id', 'The rules were meant to return transaction ids, but the dataset has none. I create one at load time from file order.')}
        ${trap('Origins may barely repeat', 'Public analyses suggest almost every sender appears only once. If so, history rules (repeated amount, velocity, spike, first transaction) will be useless. So step 1 is now profiling, before writing any rule.')}
        ${trap('Transfer → cash-out may not link', 'Analyses suggest fraudulent transfer destinations rarely reappear as cash-out origins. If the join count is ~0, that is a negative finding to report, not a rule to tune.')}
        ${trap('Simulator artefacts', 'Zero destination balances may be how the simulator writes data, not how fraud behaves. A rule that exploits them would not survive at a real bank.')}
        <p class="mt"><a href="#/fraud-lab">Try the browser version →</a></p>
      </div>
      <div class="card">
        <span class="tile-k">Project B · planned</span><h2 style="margin-top:4px">aml-pattern-detector (IBM AMLworld)</h2>
        <p class="ink2 mt">Re-implement documented graph features (fan-in/out, reciprocity, scatter-gather, 2–4 hop cycle closure) and train gradient-boosted trees on IBM's HI-Small set, then compare minority-class F1 with the published figure. Measured, never assumed.</p>
        <h3 class="mt">Data traps found in my own draft</h3>
        ${trap('Two columns called "Account"', 'pandas renames the second to Account.1, DuckDB to Account_1. Code written against one loader breaks on the other, so both get renamed at load.')}
        ${trap('Account ids may only be unique within a bank', 'Graph nodes are keyed on (bank, account) so that different customers are not merged.')}
        ${trap('Timestamps shared across a split boundary', 'Many transactions share a minute. Splits are cut between distinct timestamps, and same-time rows are excluded from "past" features.')}
        ${trap('Patterns my features can\'t see', 'Stack, bipartite and random shapes have no feature aimed at them. The pattern lab shows the same blind spot, so the plan says it up front.')}
        ${trap('An untraceable statistic', 'My draft quoted "2% of illicit flows detected". I could not find a source, so it is replaced with a properly cited figure or dropped.')}
        <p class="mt"><a href="#/graph-lab">Try the browser version →</a></p>
      </div>
    </div>
    <div class="card mt"><h2>Ground rules for both projects</h2>
      <div class="prose mt"><ul>
        <li><strong>Synthetic data only</strong>, and every write-up says so. Results do not transfer to a real bank.</li>
        <li><strong>No leakage:</strong> a feature at time t uses only data from before t, and a test proves it.</li>
        <li><strong>Precision and recall, not accuracy.</strong> At about 1 fraud in 800 rows, "flag nothing" is over 99.8% accurate.</li>
        <li><strong>AI-assisted, human-verified:</strong> every AI-suggested change is logged in <span class="mono">decisions.md</span> with how it was checked (a test, a manual recount, or a second query).</li>
      </ul></div></div>`;
}

export function renderHome(main, ctx) {
  const { db, statusOf, isOpen, RULES } = ctx;
  const inv = db.investors;
  const high = inv.filter((i) => i.risk.rating === 'High').length;
  const medium = inv.filter((i) => i.risk.rating === 'Medium').length;
  const open = db.alerts.filter(isOpen).length;
  const by = (s) => db.alerts.filter((a) => statusOf(a) === s).length;
  const closed = by('Closed – no further action');
  const strs = by('STR filed');
  const escalated = by('Escalated') + strs;
  const peps = inv.filter((i) => i.pep).length;
  const hits = inv.filter((i) => i.sanctions !== 'clear').length;
  const ruleCount = (id) => db.alerts.filter((a) => a.ruleId === id).length;
  const example = (id) => db.alerts.filter((a) => a.ruleId === id).sort((a, b) => b.priority - a.priority)[0];

  const JOURNEY = {
    screen: { n: inv.length, label: 'Onboard & screen', unit: 'investors', text: `Every investor is identified, verified and screened against sanctions and PEP lists before money is accepted. ${peps} PEPs and ${hits} sanctions name matches were found on this register.`, href: '#/investors' },
    score: { n: high, label: 'Risk score', unit: 'rated High', text: `Each investor gets a points-based risk score. ${high} are High (enhanced due diligence, yearly review) and ${medium} are Medium. The rest are Low.`, href: '#/rules' },
    monitor: { n: db.transactions.length, label: 'Monitor', unit: 'transactions', text: 'Nine rules scan 24 months of subscriptions, redemptions, switches and transfers. Each rule targets one known typology.', href: '#/rules' },
    alert: { n: db.alerts.length, label: 'Alert', unit: 'alerts raised', text: 'An alert means "a human should look", not "this is laundering". Most turn out to have a legitimate explanation.', href: '#/alerts?status=all' },
    review: { n: open, label: 'Investigate', unit: 'still open', text: 'The analyst reads why it fired, checks the KYC file, asks the investor for information through the transfer agency (never mentioning suspicion), and writes a rationale.', href: '#/alerts' },
    close: { n: closed, label: 'Close', unit: 'no further action', text: 'Explained and documented. The rationale is what an auditor or regulator reads later, so "looks fine" is not enough.', href: '#/alerts?status=Closed%20%E2%80%93%20no%20further%20action' },
    escalate: { n: escalated, label: 'Escalate', unit: 'to the MLRO', text: 'Not explained. The money laundering reporting officer reviews the case and decides whether there is suspicion.', href: '#/alerts?status=Escalated' },
    str: { n: strs, label: 'STR filed', unit: 'to the FIU', text: 'A suspicious transaction report goes to the financial intelligence unit. The investor must never be told (tipping-off).', href: '#/alerts?status=STR%20filed' },
  };

  main.innerHTML = `
    <section class="hero">
      <div class="fx-grid" aria-hidden="true"><span class="fx-grid-glow"></span></div>
      <div class="hero-inner">
        <span class="eyebrow"><i class="dot info"></i> AML &amp; financial crime portfolio · synthetic data</span>
        <h1 class="hero-title">Follow the money.<br><span>Then explain why it matters.</span></h1>
        <p class="hero-sub">Three interactive tools I built to learn how anti-money laundering works in fund administration. Every number on this site is computed live in your browser from labelled synthetic data. Click anything.</p>
        <div class="actions">
          <a class="btn primary" href="#/overview">Open the review desk</a>
          <a class="btn" href="#/fraud-lab">Fraud rules lab</a>
          <a class="btn" href="#/graph-lab">Laundering pattern lab</a>
        </div>
        <div class="hero-stats">
          <div><b data-count="${inv.length}">0</b><span>investors</span></div>
          <div><b data-count="${db.transactions.length}">0</b><span>transactions</span></div>
          <div><b data-count="${db.alerts.length}">0</b><span>alerts</span></div>
          <div><b data-count="${Object.keys(RULES).length}">0</b><span>explainable rules</span></div>
        </div>
      </div>
      <div class="hero-viz" id="hv" aria-label="Diagram: transactions flow into monitoring, which produces risk scores, alerts and STR drafts">
        <div class="hv-col">
          <div class="hv-node" id="hv-a"><i class="dot info"></i>Subscriptions</div>
          <div class="hv-node" id="hv-b"><i class="dot info"></i>Redemptions</div>
          <div class="hv-node" id="hv-c"><i class="dot info"></i>Unit transfers</div>
        </div>
        <div class="hv-hub" id="hv-hub"><svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true"><rect width="32" height="32" rx="8" fill="var(--accent)"/><path d="M9 16.5l4.5 4.5L23 11.5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg><b>Monitoring</b><small>${Object.keys(RULES).length} rules</small></div>
        <div class="hv-col">
          <div class="hv-node" id="hv-d"><i class="dot medium"></i>Risk score</div>
          <div class="hv-node" id="hv-e"><i class="dot serious"></i>Alerts</div>
          <div class="hv-node" id="hv-f"><i class="dot high"></i>STR draft</div>
        </div>
      </div>
    </section>

    <section class="card mt">
      <div class="section-head"><div><h2>The three stages of money laundering</h2>
        <div class="sub">Click a stage to see what it looks like inside an investment fund, and which rules on this site are designed to catch it.</div></div>
        <span class="hint">Click a stage</span></div>
      <div class="flow lifecycle" id="lc">
        <div class="fnode ghost" id="lc-src"><b>Criminal proceeds</b><small>fraud, corruption, drugs, tax evasion</small></div>
        ${Object.entries(STAGES).map(([k, s], i) => `<button class="fnode stage" data-stage="${k}" id="lc-${k}"><span class="step">${i + 1}</span><b>${s.title}</b><small>${s.rules.length} rules · ${s.rules.reduce((n, r) => n + ruleCount(r), 0)} alerts</small></button>`).join('')}
        <div class="fnode ghost" id="lc-out"><b>"Clean" money</b><small>appears to come from a fund</small></div>
      </div>
      <div class="detail" id="lc-detail"></div>
    </section>

    <section class="card mt">
      <div class="section-head"><div><h2>An alert's journey through the desk</h2>
        <div class="sub">Live counts from the review desk. Decisions you record there change these numbers. Click a step.</div></div>
        <span class="hint">Click a step</span></div>
      <div class="flow journey" id="jr">
        ${Object.entries(JOURNEY).map(([k, j]) => `<button class="fnode jn" data-j="${k}" id="jr-${k}" style="grid-area:${k}"><b class="n" data-count="${j.n}">0</b><span>${j.label}</span><small>${j.unit}</small></button>`).join('')}
      </div>
      <div class="detail" id="jr-detail"></div>
    </section>

    <section class="bento mt">
      <a class="card tile" href="#/overview">
        <span class="tile-k">01 · Review desk</span><h3>Transfer-agency AML workbench</h3>
        <p>KYC risk scoring you can explain line by line, nine monitoring rules, case files with checklists, a decision audit trail and auto-drafted STR narratives.</p>
        <span class="tile-cta">${open} open alerts waiting →</span></a>
      <a class="card tile" href="#/fraud-lab">
        <span class="tile-k">02 · Fraud rules lab</span><h3>Which red flags are worth an analyst's time?</h3>
        <p>Eight fraud rules on a PaySim-style mobile-money simulation. Move the thresholds and an alert budget, and watch precision, recall and missed fraud change.</p>
        <span class="tile-cta">Tune the rules →</span></a>
      <a class="card tile" href="#/graph-lab">
        <span class="tile-k">03 · Pattern lab</span><h3>Laundering shapes in a payment network</h3>
        <p>The eight typologies from IBM's AMLworld paper, animated. Graph detectors show where they work, and where they go blind (long cycles, stacks).</p>
        <span class="tile-cta">Watch the money move →</span></a>
      <a class="card tile alt" href="#/roadmap">
        <span class="tile-k">04 · Roadmap</span><h3>Before touching real data</h3>
        <p>Plans for running these ideas on the full PaySim and IBM datasets, plus the data traps I found in my own first drafts.</p>
        <span class="tile-cta">Read the plan →</span></a>
    </section>`;

  countUp(main);

  // hero diagram: the 21st.dev beam pattern (many sources into one hub, hub out to results)
  const hv = main.querySelector('#hv'), $h = (id) => main.querySelector('#hv-' + id);
  beams(hv, [
    { from: $h('a'), to: $h('hub'), curvature: 40, delay: 0 },
    { from: $h('b'), to: $h('hub'), delay: 0.8 },
    { from: $h('c'), to: $h('hub'), curvature: -40, delay: 1.6, tone: 'crit' },
    { from: $h('hub'), to: $h('d'), curvature: 40, delay: 1.2 },
    { from: $h('hub'), to: $h('e'), delay: 2, tone: 'crit' },
    { from: $h('hub'), to: $h('f'), curvature: -40, delay: 2.8, tone: 'crit' },
  ]);

  // ---- lifecycle ----
  const lc = main.querySelector('#lc');
  const ids = ['lc-src', 'lc-placement', 'lc-layering', 'lc-integration', 'lc-out'].map((id) => main.querySelector('#' + id));
  const lcBeams = beams(lc, ids.slice(0, -1).map((el, i) => ({ from: el, to: ids[i + 1], curvature: i % 2 ? 18 : -18, delay: i * 0.6, tone: i === 0 ? 'crit' : 'accent' })));
  const showStage = (k) => {
    const s = STAGES[k];
    main.querySelectorAll('[data-stage]').forEach((b) => b.classList.toggle('on', b.dataset.stage === k));
    const idx = Object.keys(STAGES).indexOf(k);
    lcBeams.setActive((_, i) => i === idx || i === idx + 1);
    main.querySelector('#lc-detail').innerHTML = `
      <div class="detail-grid">
        <div><h3>${s.title}</h3><p class="lead">${esc(s.lead)}</p><p class="ink2">${esc(s.fund)}</p>
          <ul class="flags">${s.flags.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
          ${s.lab ? '<p class="mt"><a href="#/graph-lab">See layering shapes (cycles, scatter-gather) in the pattern lab →</a></p>' : ''}</div>
        <div><h3>Rules that target it</h3><ul class="rulelinks">${s.rules.map((r) => {
          const ex = example(r);
          return `<li><a href="#/alerts?rule=${r}&status=all"><span class="rid">${r}</span> ${esc(RULES[r].name)}</a>
            <span class="muted">${ruleCount(r)} alerts${ex ? ` · <a href="#/alerts/${ex.id}">open example</a>` : ''}</span></li>`;
        }).join('')}</ul></div>
      </div>`;
  };
  main.querySelectorAll('[data-stage]').forEach((b) => b.addEventListener('click', () => showStage(b.dataset.stage)));
  showStage('layering');

  // ---- journey ----
  const jr = main.querySelector('#jr');
  const J = (k) => main.querySelector('#jr-' + k);
  const links = [['screen', 'score'], ['score', 'monitor'], ['monitor', 'alert'], ['alert', 'review'], ['review', 'close'], ['review', 'escalate'], ['escalate', 'str']];
  const jrBeams = beams(jr, links.map(([a, b], i) => ({ from: J(a), to: J(b), delay: i * 0.45, tone: b === 'close' ? 'good' : b === 'str' || b === 'escalate' ? 'crit' : 'accent', curvature: b === 'close' ? 14 : b === 'escalate' ? -14 : 0 })));
  const showJ = (k) => {
    const j = JOURNEY[k];
    main.querySelectorAll('[data-j]').forEach((b) => b.classList.toggle('on', b.dataset.j === k));
    jrBeams.setActive((_, i) => links[i].includes(k));
    main.querySelector('#jr-detail').innerHTML = `<div class="detail-row"><div><h3>${j.label} <span class="muted">· ${int(j.n)} ${j.unit}</span></h3><p class="ink2">${esc(j.text)}</p></div><a class="btn" href="${j.href}">Go there →</a></div>`;
  };
  main.querySelectorAll('[data-j]').forEach((b) => b.addEventListener('click', () => showJ(b.dataset.j)));
  showJ('alert');
}
