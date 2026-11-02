import { AS_OF, COUNTRIES, generate, daysBetween, addDays } from './data.js';
import { analyze, RULES, THRESHOLDS, OPEN_STATUSES, REVIEW_CYCLE_YEARS } from './rules.js';
import { hbar, columns, segmented, hideTip } from './charts.js';
import { renderHome, renderRoadmap } from './home.js';
import { renderFraudLab } from './fraudlab.js';
import { renderGraphLab } from './graphlab.js';

const db = analyze(generate());
const main = document.getElementById('main');

// ---------- Helpers ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eur = (n) => '€' + Math.round(n).toLocaleString('en-GB');
const eurShort = (n) => (n >= 1e6 ? `€${(n / 1e6).toFixed(n >= 1e7 ? 0 : 2)}m` : n >= 1e4 ? `€${Math.round(n / 1e3)}k` : eur(n));
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fdate = (s) => { const [y, m, d] = s.split('-'); return `${+d} ${MONTHS[m - 1]} ${y}`; };
const country = (code) => COUNTRIES[code]?.name || code;
const TX_LABEL = { SUB: 'Subscription', RED: 'Redemption', SWITCH: 'Switch', TRANSFER: 'Unit transfer' };

const riskBadge = (r) => `<span class="badge"><i class="dot ${r.toLowerCase()}"></i>${r}</span>`;
const KYC_DOT = { Complete: 'good', 'Review overdue': 'warn', 'Documents expired': 'serious', 'Documents missing': 'serious', 'EDD required': 'crit', Blocked: 'crit' };
const kycBadge = (s) => `<span class="badge"><i class="dot ${KYC_DOT[s]}"></i>${s}</span>`;
const STATUS_DOT = { New: 'info', 'In review': 'info', 'Info requested': 'warn', Escalated: 'serious', 'STR filed': 'crit', 'Closed – no further action': 'good' };
const statusBadge = (s) => `<span class="badge"><i class="dot ${STATUS_DOT[s]}"></i>${s}</span>`;
const pill = (a) => `<span class="pill ${a.band}" title="Priority score ${a.priority}/100">${a.band}</span>`;

// ---------- Analyst decisions (kept in this browser only) ----------
const STORE = 'ard-decisions-v1';
let decisions = {};
try { decisions = JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { decisions = {}; }
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(decisions)); } catch (e) { /* storage unavailable */ } };
const statusOf = (a) => decisions[a.id]?.status || a.seedStatus;
const isOpen = (a) => OPEN_STATUSES.includes(statusOf(a));

const SEED_RATIONALE = {
  R1: 'Payer confirmed as the investor\'s spouse. Joint account statement obtained and filed.',
  R2: 'Investor explained a change in liquidity needs. Proceeds returned to the originating account.',
  R3: 'Instalments match a documented savings plan with the distributor.',
  R4: 'Completion statement for a property sale received. Expected activity updated on file.',
  R5: 'Investor holds a documented business account in that jurisdiction. EDD refreshed.',
  R6: 'Payee is a custodian account in the investor\'s name. Approved under the third-party payment policy.',
  R7: 'Transferee is a KYC\'d family member. Gift letter on file.',
  R8: 'Investor returned from an overseas posting. ID and address refreshed.',
  R9: 'Date of birth and nationality do not match the list entry. Match discounted.',
};
function seededLog(a) {
  const s = a.seedStatus;
  const at = addDays(a.date, Math.min(daysBetween(a.date, AS_OF), 6));
  if (s === 'New') return [];
  if (s === 'In review') return [{ at, action: 'Review started', note: '' }];
  if (s === 'Info requested') return [{ at, action: 'Information requested via the transfer agency', note: 'Asked the distributor for an explanation and supporting documents (no mention of suspicion to the investor).' }];
  if (s === 'Escalated') return [{ at, action: 'Escalated to MLRO', note: 'Explanation received is not supported by documents. Escalated for a decision on reporting.' }];
  if (s === 'STR filed') return [{ at, action: 'Escalated to MLRO', note: 'Explanation not supported by documents.' }, { at: addDays(at, 3), action: 'STR filed with the FIU', note: 'MLRO agreed the activity is suspicious. Relationship under enhanced monitoring.' }];
  return [{ at, action: 'Closed – no further action', note: SEED_RATIONALE[a.ruleId] }];
}
const logOf = (a) => [...seededLog(a), ...(decisions[a.id]?.log || [])];

// ---------- Derived data ----------
const alertsByInv = new Map();
for (const a of db.alerts) {
  if (!alertsByInv.has(a.investorId)) alertsByInv.set(a.investorId, []);
  alertsByInv.get(a.investorId).push(a);
}
const txByInv = new Map();
for (const t of db.transactions) {
  if (!txByInv.has(t.investorId)) txByInv.set(t.investorId, []);
  txByInv.get(t.investorId).push(t);
}

function explain(a) {
  const inv = db.invById.get(a.investorId);
  const txs = a.txIds.map((id) => db.txById.get(id));
  const t = txs[txs.length - 1];
  const f = a.facts;
  switch (a.ruleId) {
    case 'R1': return `A ${eur(t.amount)} subscription on ${fdate(t.date)} was paid from an account in the name of "${esc(f.payer)}". The registered investor is ${esc(inv.name)}.`;
    case 'R2': return `${eur(f.subbed)} was subscribed on ${fdate(txs[0].date)}. ${eur(t.amount)} (${Math.round(f.ratio * 100)}% of it) was redeemed on ${fdate(t.date)}, ${f.days} days later.`;
    case 'R3': return `${f.count} subscriptions totalling ${eur(a.amount)} arrived within ${f.days} days. Each was between ${eur(THRESHOLDS.structuringBandLow)} and ${eur(THRESHOLDS.structuringBandHigh)}: ${txs.map((x) => eur(x.amount)).join(', ')}.`;
    case 'R4': return `A ${eur(t.amount)} subscription on ${fdate(t.date)} is ${f.multiple.toFixed(1)}× the investor's declared expected annual investment of ${eur(f.expected)}.`;
    case 'R5': return `${TX_LABEL[t.type]} of ${eur(t.amount)} on ${fdate(t.date)} ${t.type === 'SUB' ? 'came from' : 'was paid to'} a bank in ${esc(f.bank)} (${f.tier === 'high' ? 'call-for-action' : 'increased-monitoring'} tier). The investor is resident in ${esc(f.residence)}.`;
    case 'R6': return `A redemption of ${eur(t.amount)} on ${fdate(t.date)} was instructed to "${esc(f.payee)}", with a bank in ${esc(f.bank)}. That is not an account in the investor's name.`;
    case 'R7': return `Units worth ${eur(t.amount)} were transferred on ${fdate(t.date)} to "${esc(f.counterparty)}" (${esc(f.country)}). No relationship to the investor is declared on file.`;
    case 'R8': return `No activity for ${f.gap} days (last transaction ${fdate(f.previous)}), then a ${TX_LABEL[t.type].toLowerCase()} of ${eur(t.amount)} on ${fdate(t.date)}.`;
    case 'R9': return esc(f.note);
    default: return '';
  }
}

function strNarrative(a) {
  const inv = db.invById.get(a.investorId);
  const all = alertsByInv.get(inv.id) || [];
  const txs = a.txIds.map((id) => db.txById.get(id));
  const factors = inv.risk.factors.map((f) => f.label.toLowerCase()).join('; ') || 'no elevated factors';
  return [
    `SUBJECT\n${inv.name} (${inv.type.toLowerCase()}, resident in ${country(inv.residence)}${inv.incorporation && inv.incorporation !== inv.residence ? `, established in ${country(inv.incorporation)}` : ''}). Register ID ${inv.id}, onboarded ${fdate(inv.onboarded)} via ${inv.channel.toLowerCase()}.`,
    `PROFILE ON FILE\nOccupation / business: ${inv.occupation}. Declared source of funds: ${inv.sourceOfFunds.toLowerCase()}. Expected annual investment: ${eur(inv.expectedAnnual)}. Customer risk rating: ${inv.risk.rating} (${inv.risk.score} points: ${factors}).${inv.pep ? ` The investor is a ${inv.pep.kind.toLowerCase()} PEP: ${inv.pep.role}.` : ''}`,
    `ACTIVITY\n${explain(a).replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'")}\nTransactions: ${txs.map((t) => `${t.id} ${TX_LABEL[t.type].toLowerCase()} ${eur(t.amount)} on ${fdate(t.date)}`).join('; ')}.`,
    `RED FLAGS IDENTIFIED\n${[...new Set(all.map((x) => RULES[x.ruleId].name))].map((n) => `- ${n}`).join('\n')}`,
    `ANALYSIS\n[Analyst to complete: what was checked, what explanation and documents were received through the transfer agency, and why the activity is still not consistent with what we know about the investor.]`,
    `ACTION TAKEN\nAlert ${a.id} escalated to the MLRO. Relationship placed under enhanced monitoring. The investor has not been told about this review or any report (tipping-off prohibition).`,
  ].join('\n\n');
}

// ---------- Views ----------
function head(title, sub, crumb = '') {
  return `<div class="page-head"><div>${crumb ? `<div class="crumb">${crumb}</div>` : ''}<h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div><span class="asof">Data as of ${fdate(AS_OF)}</span></div>`;
}

function viewOverview() {
  const inv = db.investors;
  const high = inv.filter((i) => i.risk.rating === 'High').length;
  const open = db.alerts.filter(isOpen);
  const p1 = open.filter((a) => a.band === 'P1').length;
  const kycEx = inv.filter((i) => i.kyc.status !== 'Complete');
  const overdue = inv.filter((i) => i.kyc.issues.some((x) => x.code === 'Review overdue')).length;
  const decided = db.alerts.filter((a) => ['STR filed', 'Closed – no further action'].includes(statusOf(a)));
  const strs = decided.filter((a) => statusOf(a) === 'STR filed').length;
  const entities = inv.filter((i) => i.type !== 'Individual').length;

  main.innerHTML = `
    ${head('Overview', 'Investor due diligence and transaction monitoring for a fictional Luxembourg fund range, seen from the transfer agency\'s AML desk.')}
    <div class="grid g-kpi">
      <div class="card kpi"><div class="label">Investors on register</div><div class="value">${inv.length}</div><div class="note">${inv.length - entities} individuals · ${entities} entities</div></div>
      <div class="card kpi"><div class="label">High-risk investors</div><div class="value">${high}</div><div class="note">${((high / inv.length) * 100).toFixed(1)}% of book · EDD applies</div></div>
      <div class="card kpi"><div class="label">Open alerts</div><div class="value">${open.length}</div><div class="note">${p1} at priority P1</div></div>
      <div class="card kpi"><div class="label">KYC exceptions</div><div class="value">${kycEx.length}</div><div class="note">${overdue} periodic reviews overdue</div></div>
      <div class="card kpi"><div class="label">Alerts leading to an STR</div><div class="value">${decided.length ? Math.round((strs / decided.length) * 100) : 0}%</div><div class="note">${strs} of ${decided.length} decided alerts</div></div>
    </div>
    <div class="grid g-3-2 ov mt">
      <div class="card"><h2>Alerts generated per month</h2><div class="sub">Last 12 months. Hover a month for the open/closed split.</div><div id="ch-month"></div></div>
      <div class="card"><h2>Alerts by rule</h2><div class="sub">Last 12 months. Click a rule to open its alerts.</div><div id="ch-rule"></div></div>
    </div>
    <div class="grid g-2-1 ov mt">
      <div class="card"><h2>Priority work queue</h2><div class="sub">Open alerts, highest priority first. Priority = rule severity + customer risk + amount.</div>
        <div class="table-wrap">${alertTable(open.sort((a, b) => b.priority - a.priority || (a.date < b.date ? 1 : -1)).slice(0, 8), true)}</div></div>
      <div class="stack">
        <div class="card"><h2>Customer risk rating</h2><div class="sub">Every investor is scored when onboarded and at each periodic review.</div><div id="ch-risk"></div></div>
        <div class="card"><h2>KYC file status</h2><div class="sub">Click a status to see the investors.</div><div id="ch-kyc"></div></div>
      </div>
    </div>`;

  const months = [];
  for (let k = 11; k >= 0; k--) {
    const d = new Date(Date.UTC(2026, 9 - k, 1));
    months.push({ key: d.toISOString().slice(0, 7), label: MONTHS[d.getUTCMonth()] });
  }
  columns(document.getElementById('ch-month'), months.map((m) => {
    const list = db.alerts.filter((a) => a.date.startsWith(m.key));
    const o = list.filter(isOpen).length;
    const [y, mm] = m.key.split('-');
    return { label: m.label, value: list.length, tip: `${MONTHS[mm - 1]} ${y}: <b>${list.length}</b> alerts<br>${o} open · ${list.length - o} closed or reported` };
  }));
  const ruleRows = Object.keys(RULES).map((id) => ({ key: id, label: RULES[id].short, value: db.alerts.filter((a) => a.ruleId === id).length, tip: `<b>${id} · ${esc(RULES[id].name)}</b><br>${db.alerts.filter((a) => a.ruleId === id).length} alerts` }))
    .sort((a, b) => b.value - a.value);
  hbar(document.getElementById('ch-rule'), ruleRows, { onClick: (k) => { location.hash = `#/alerts?rule=${k}&status=all`; } });
  segmented(document.getElementById('ch-risk'), ['Low', 'Medium', 'High'].map((r, i) => ({ label: r, value: inv.filter((x) => x.risk.rating === r).length, cls: ['good', 'warn', 'crit'][i] })));
  const kycOrder = ['Complete', 'Review overdue', 'Documents missing', 'Documents expired', 'EDD required', 'Blocked'];
  hbar(document.getElementById('ch-kyc'), kycOrder.map((s) => ({ key: s, label: s, value: inv.filter((i) => i.kyc.status === s).length })),
    { onClick: (k) => { location.hash = `#/investors?kyc=${encodeURIComponent(k)}`; } });
  bindRowLinks();
}

function alertTable(list, compact = false) {
  if (!list.length) return '<div class="empty">No alerts match these filters.</div>';
  return `<table><thead><tr><th>Priority</th><th>Alert</th><th>Rule</th><th>Investor</th>${compact ? '' : '<th>Risk</th>'}<th class="num">Amount</th><th>Date</th><th>Status</th></tr></thead><tbody>
    ${list.map((a) => {
      const inv = db.invById.get(a.investorId);
      return `<tr class="link" data-href="#/alerts/${a.id}">
        <td>${pill(a)}</td><td class="mono"><a href="#/alerts/${a.id}">${a.id}</a></td>
        <td>${esc(RULES[a.ruleId].short)}</td>
        <td><div class="strong">${esc(inv.name)}</div><div class="muted">${inv.type} · ${country(inv.residence)}</div></td>
        ${compact ? '' : `<td>${riskBadge(inv.risk.rating)}</td>`}
        <td class="num">${eur(a.amount)}</td><td class="ink2" style="white-space:nowrap">${fdate(a.date)}</td><td>${statusBadge(statusOf(a))}</td></tr>`;
    }).join('')}</tbody></table>`;
}

function viewAlerts(params) {
  main.innerHTML = `
    ${head('Alert queue', 'Every alert raised by the monitoring rules in the last 12 months. Open one to see why it fired, what to check and what to decide.')}
    <div class="filters">
      <input type="search" id="f-q" placeholder="Search investor, alert ID or rule" value="${esc(params.q || '')}" aria-label="Search">
      <select id="f-status" aria-label="Status">
        <option value="open">Open alerts</option><option value="all">All statuses</option>
        ${[...OPEN_STATUSES, 'STR filed', 'Closed – no further action'].map((s) => `<option>${s}</option>`).join('')}
      </select>
      <select id="f-rule" aria-label="Rule"><option value="">All rules</option>${Object.keys(RULES).map((id) => `<option value="${id}">${id} · ${RULES[id].short}</option>`).join('')}</select>
      <select id="f-band" aria-label="Priority"><option value="">Any priority</option><option>P1</option><option>P2</option><option>P3</option></select>
      <span class="result" id="f-count"></span>
    </div>
    <div class="card"><div class="table-wrap" id="tbl"></div></div>`;
  const $ = (id) => document.getElementById(id);
  $('f-status').value = params.status || 'open';
  $('f-rule').value = params.rule || '';
  $('f-band').value = params.band || '';
  const draw = () => {
    const q = $('f-q').value.trim().toLowerCase(), st = $('f-status').value, rule = $('f-rule').value, band = $('f-band').value;
    const list = db.alerts.filter((a) => {
      const s = statusOf(a), inv = db.invById.get(a.investorId);
      if (st === 'open' ? !isOpen(a) : st !== 'all' && s !== st) return false;
      if (rule && a.ruleId !== rule) return false;
      if (band && a.band !== band) return false;
      if (q && !`${a.id} ${inv.name} ${inv.id} ${RULES[a.ruleId].name}`.toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => (isOpen(b) - isOpen(a)) || b.priority - a.priority || (a.date < b.date ? 1 : -1));
    $('tbl').innerHTML = alertTable(list);
    $('f-count').textContent = `${list.length} alert${list.length === 1 ? '' : 's'}`;
    bindRowLinks();
  };
  ['f-q', 'f-status', 'f-rule', 'f-band'].forEach((id) => $(id).addEventListener('input', draw));
  draw();
}

function txTable(txs, highlight = new Set()) {
  if (!txs.length) return '<div class="empty">No transactions.</div>';
  return `<table><thead><tr><th>Date</th><th>Transaction</th><th>Fund</th><th class="num">Amount</th><th>Account / counterparty</th><th>Bank country</th></tr></thead><tbody>
    ${txs.map((t) => {
      const party = t.type === 'SUB' ? (t.payerOwn ? 'Own account' : `Paid by ${esc(t.payerName)}`)
        : t.type === 'RED' ? (t.payeeOwn ? 'Own account' : `Paid to ${esc(t.payeeName)}`)
        : t.type === 'SWITCH' ? `Into ${esc(t.toFund.replace('Aurelia ', ''))}`
        : `To ${esc(t.counterparty)} (${country(t.counterpartyCountry)})`;
      const flag = (t.type === 'SUB' && !t.payerOwn) || (t.type === 'RED' && !t.payeeOwn) || t.type === 'TRANSFER';
      return `<tr class="${highlight.has(t.id) ? 'hl' : ''}"><td style="white-space:nowrap">${fdate(t.date)}</td>
        <td><div>${TX_LABEL[t.type]}</div><div class="mono muted">${t.id}</div></td><td class="ink2">${esc(t.fund.replace('Aurelia ', ''))}</td>
        <td class="num">${eur(t.amount)}</td><td class="${flag ? 'strong' : 'ink2'}">${party}</td>
        <td>${COUNTRIES[t.bankCountry].tier !== 'standard' ? `<span class="badge"><i class="dot serious"></i>${country(t.bankCountry)}</span>` : country(t.bankCountry)}</td></tr>`;
    }).join('')}</tbody></table>`;
}

function viewAlert(id) {
  const a = db.alerts.find((x) => x.id === id);
  if (!a) return notFound();
  const inv = db.invById.get(a.investorId);
  const rule = RULES[a.ruleId];
  const status = statusOf(a);
  const dec = decisions[a.id] || {};
  const checks = dec.checks || {};
  const others = (alertsByInv.get(inv.id) || []).filter((x) => x.id !== a.id);
  const txs = (txByInv.get(inv.id) || []).slice().reverse();
  const log = logOf(a);
  const can = (s) => ({
    start: s === 'New',
    rfi: ['New', 'In review'].includes(s),
    escalate: ['New', 'In review', 'Info requested'].includes(s),
    close: OPEN_STATUSES.includes(s),
    str: s === 'Escalated',
    reopen: !OPEN_STATUSES.includes(s),
  });
  const c = can(status);

  main.innerHTML = `
    <div class="page-head"><div>
      <div class="crumb"><a href="#/alerts">Alert queue</a> / ${a.id}</div>
      <h1>${esc(rule.name)}</h1>
      <div class="case-head">${pill(a)} ${statusBadge(status)} <span class="tag">${a.ruleId}</span>
        <span class="muted">Raised ${fdate(a.date)} · ${daysBetween(a.date, AS_OF)} days old</span>
        <span class="muted">Investor: <a href="#/investors/${inv.id}">${esc(inv.name)}</a></span></div>
    </div><span class="asof">Data as of ${fdate(AS_OF)}</span></div>
    <div class="grid g-3-2">
      <div class="stack">
        <div class="card"><h2>Why this alert fired</h2><div class="sub">${esc(rule.logic)}</div>
          <div class="why"><p><strong>${explain(a)}</strong></p><p class="ink2">${esc(rule.why)}</p></div>
          ${inv.pep ? `<div class="callout warn mt"><strong>PEP:</strong> ${esc(inv.pep.role)}. Enhanced due diligence and senior management approval apply.</div>` : ''}
        </div>
        <div class="card"><h2>Investigation checklist</h2><div class="sub">Typology: ${esc(rule.typology)}. Tick items as you work. Saved in this browser.</div>
          <ul class="checklist">${rule.checks.map((t, i) => `<li><label><input type="checkbox" data-check="${i}" ${checks[i] ? 'checked' : ''}><span>${esc(t)}</span></label></li>`).join('')}</ul>
        </div>
        <div class="card"><h2>Transaction history</h2><div class="sub">Last 24 months for this investor. Transactions in this alert are highlighted.</div>
          <div class="table-wrap">${txTable(txs, new Set(a.txIds))}</div></div>
        <div class="card"><h2>Draft suspicious transaction report</h2>
          <div class="sub">Auto-drafted from the case file. It is only filed if the MLRO decides there is suspicion, and the investor must never be told (tipping-off).</div>
          <div class="narrative" id="narr">${esc(strNarrative(a))}</div>
          <div class="actions mt"><button class="btn" id="copy">Copy narrative</button></div>
        </div>
      </div>
      <div class="stack">
        <div class="card"><h2>Decision</h2><div class="sub">Closing, escalating or requesting information needs a written rationale. That is what an auditor or regulator reads later.</div>
          <textarea id="note" placeholder="Rationale: what you checked, what you found, why you decided this."></textarea>
          <div class="actions mt">
            ${c.start ? '<button class="btn" data-act="start">Start review</button>' : ''}
            ${c.rfi ? '<button class="btn" data-act="rfi">Request information</button>' : ''}
            ${c.escalate ? '<button class="btn primary" data-act="escalate">Escalate to MLRO</button>' : ''}
            ${c.str ? '<button class="btn primary" data-act="str">Record STR filed</button>' : ''}
            ${c.close ? '<button class="btn" data-act="close">Close – no further action</button>' : ''}
            ${c.reopen ? '<button class="btn" data-act="reopen">Reopen</button>' : ''}
          </div>
          <p class="muted mt" id="note-err" hidden style="color:var(--crit-ink)">Write a rationale first.</p>
          ${c.rfi ? '<div class="callout mt">Requests go to the investor through the transfer agency or distributor. Ask for documents and explanations, never mention suspicion.</div>' : ''}
          <h3 class="mt">Audit trail</h3>
          ${log.length ? `<ul class="log">${log.slice().reverse().map((l) => `<li><time>${fdate(l.at)}${l.you ? ' · you' : ''}</time><strong>${esc(l.action)}</strong>${l.note ? `<div class="ink2">${esc(l.note)}</div>` : ''}</li>`).join('')}</ul>` : '<p class="muted mt">No actions yet.</p>'}
          ${decisions[a.id] ? '<button class="ghost mt" id="undo">Reset my changes to this alert</button>' : ''}
        </div>
        <div class="card"><h2>Investor snapshot</h2>
          <dl class="facts mt">
            <div><dt>Investor</dt><dd><a href="#/investors/${inv.id}">${esc(inv.name)}</a></dd></div>
            <div><dt>Type</dt><dd>${inv.type}</dd></div>
            <div><dt>Residence</dt><dd>${country(inv.residence)}</dd></div>
            <div><dt>Occupation / business</dt><dd>${esc(inv.occupation)}</dd></div>
            <div><dt>Expected annual investment</dt><dd>${eur(inv.expectedAnnual)}</dd></div>
            <div><dt>Source of funds</dt><dd>${esc(inv.sourceOfFunds)}</dd></div>
            <div><dt>Customer risk</dt><dd>${riskBadge(inv.risk.rating)} <span class="muted">${inv.risk.score} pts</span></dd></div>
            <div><dt>KYC file</dt><dd>${kycBadge(inv.kyc.status)}</dd></div>
          </dl>
          ${inv.kyc.issues.length ? `<ul class="doclist mt">${inv.kyc.issues.map((i) => `<li><span>${esc(i.text)}</span></li>`).join('')}</ul>` : ''}
        </div>
        <div class="card"><h2>Other alerts on this investor</h2>
          ${others.length ? `<ul class="doclist">${others.map((o) => `<li><a href="#/alerts/${o.id}">${o.id} · ${esc(RULES[o.ruleId].short)}</a>${statusBadge(statusOf(o))}</li>`).join('')}</ul>
          <p class="muted mt">Several alerts on one investor are usually reviewed together as a single case.</p>` : '<p class="muted">None in the last 12 months.</p>'}
        </div>
      </div>
    </div>`;

  main.querySelectorAll('[data-check]').forEach((cb) => cb.addEventListener('change', () => {
    const d = (decisions[a.id] ||= {});
    d.checks = { ...(d.checks || {}), [cb.dataset.check]: cb.checked };
    save();
  }));
  const ACT = {
    start: ['In review', 'Review started', false],
    rfi: ['Info requested', 'Information requested via the transfer agency', true],
    escalate: ['Escalated', 'Escalated to MLRO', true],
    str: ['STR filed', 'STR filed with the FIU', true],
    close: ['Closed – no further action', 'Closed – no further action', true],
    reopen: ['In review', 'Reopened', false],
  };
  main.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
    const [next, action, needsNote] = ACT[b.dataset.act];
    const note = document.getElementById('note').value.trim();
    if (needsNote && !note) { document.getElementById('note-err').hidden = false; document.getElementById('note').focus(); return; }
    const d = (decisions[a.id] ||= {});
    d.status = next;
    d.log = [...(d.log || []), { at: AS_OF, action, note, you: true }];
    save();
    updateNavCount();
    viewAlert(id);
  }));
  document.getElementById('undo')?.addEventListener('click', () => { delete decisions[a.id]; save(); updateNavCount(); viewAlert(id); });
  document.getElementById('copy').addEventListener('click', async (e) => {
    try { await navigator.clipboard.writeText(strNarrative(a)); e.target.textContent = 'Copied'; } catch (err) { e.target.textContent = 'Copy not available'; }
  });
}

function viewInvestors(params) {
  main.innerHTML = `
    ${head('Investor register', 'Every investor on the register with their customer risk rating and the state of their KYC file.')}
    <div class="filters">
      <input type="search" id="f-q" placeholder="Search name or investor ID" aria-label="Search" value="${esc(params.q || '')}">
      <select id="f-risk" aria-label="Risk"><option value="">Any risk</option><option>High</option><option>Medium</option><option>Low</option></select>
      <select id="f-kyc" aria-label="KYC status"><option value="">Any KYC status</option>${['Complete', 'Review overdue', 'Documents missing', 'Documents expired', 'EDD required', 'Blocked'].map((s) => `<option>${s}</option>`).join('')}</select>
      <select id="f-type" aria-label="Investor type"><option value="">Any type</option><option>Individual</option><option>Corporate</option><option>Trust</option><option>Nominee</option></select>
      <span class="result" id="f-count"></span>
    </div>
    <div class="card"><div class="table-wrap" id="tbl"></div></div>`;
  const $ = (id) => document.getElementById(id);
  $('f-risk').value = params.risk || '';
  $('f-kyc').value = params.kyc || '';
  $('f-type').value = params.type || '';
  const draw = () => {
    const q = $('f-q').value.trim().toLowerCase(), risk = $('f-risk').value, kyc = $('f-kyc').value, type = $('f-type').value;
    const list = db.investors.filter((i) => (!risk || i.risk.rating === risk) && (!kyc || i.kyc.status === kyc) && (!type || i.type === type)
      && (!q || `${i.name} ${i.id}`.toLowerCase().includes(q)))
      .sort((a, b) => b.risk.score - a.risk.score || a.name.localeCompare(b.name));
    $('f-count').textContent = `${list.length} investor${list.length === 1 ? '' : 's'}`;
    $('tbl').innerHTML = list.length ? `<table><thead><tr><th>Investor</th><th>Type</th><th>Residence</th><th>Risk</th><th class="num">Score</th><th>KYC file</th><th>Next review</th><th class="num">Open alerts</th></tr></thead><tbody>
      ${list.map((i) => {
        const open = (alertsByInv.get(i.id) || []).filter(isOpen).length;
        return `<tr class="link" data-href="#/investors/${i.id}"><td><a class="strong" href="#/investors/${i.id}">${esc(i.name)}</a><div class="mono muted">${i.id}</div></td>
          <td>${i.type}${i.pep ? ' <span class="tag">PEP</span>' : ''}</td><td>${country(i.residence)}</td><td>${riskBadge(i.risk.rating)}</td>
          <td class="num">${i.risk.score}</td><td>${kycBadge(i.kyc.status)}</td>
          <td class="${i.kyc.nextReview < AS_OF ? 'strong' : 'ink2'}" style="white-space:nowrap">${fdate(i.kyc.nextReview)}</td><td class="num">${open || '<span class="muted">0</span>'}</td></tr>`;
      }).join('')}</tbody></table>` : '<div class="empty">No investors match these filters.</div>';
    bindRowLinks();
  };
  ['f-q', 'f-risk', 'f-kyc', 'f-type'].forEach((id) => $(id).addEventListener('input', draw));
  draw();
}

function viewInvestor(id) {
  const inv = db.invById.get(id);
  if (!inv) return notFound();
  const alerts = alertsByInv.get(id) || [];
  const txs = (txByInv.get(id) || []).slice().reverse();
  const pct = Math.min(100, (inv.risk.score / 80) * 100);
  const docStatus = (d) => {
    if (d.edd && inv.risk.rating !== 'High') return '<span class="muted">Not required (not High risk)</span>';
    if (d.status === 'ok') return `<span class="badge"><i class="dot good"></i>On file${d.expires ? ` · exp. ${fdate(d.expires)}` : ''}</span>`;
    if (d.status === 'expired') return `<span class="badge"><i class="dot serious"></i>Expired ${fdate(d.expires)}</span>`;
    return '<span class="badge"><i class="dot crit"></i>Missing</span>';
  };
  const screening = inv.sanctions === 'potential' ? `<span class="badge"><i class="dot crit"></i>Potential match, unresolved</span>`
    : inv.sanctions === 'cleared' ? `<span class="badge"><i class="dot good"></i>Match discounted</span>` : `<span class="badge"><i class="dot good"></i>No match</span>`;

  main.innerHTML = `
    <div class="page-head"><div><div class="crumb"><a href="#/investors">Investor register</a> / ${inv.id}</div>
      <h1>${esc(inv.name)}</h1>
      <div class="case-head">${riskBadge(inv.risk.rating)} ${kycBadge(inv.kyc.status)} <span class="tag">${inv.type}</span>${inv.pep ? ' <span class="tag">PEP</span>' : ''}</div>
    </div><span class="asof">Data as of ${fdate(AS_OF)}</span></div>
    <div class="grid g-3-2">
      <div class="stack">
        <div class="card"><h2>Customer risk score: ${inv.risk.score} points (${inv.risk.rating})</h2>
          <div class="sub">Low below 20 · Medium 20–44 · High 45+. A High rating means enhanced due diligence and a review every ${REVIEW_CYCLE_YEARS.High} year.</div>
          <div class="scorebar" aria-hidden="true"><i style="left:calc(${pct}% - 2px)"></i></div>
          <div class="scale"><span style="left:0">0</span><span style="left:25%">20</span><span style="left:56.25%">45</span><span style="left:100%">80+</span></div>
          <div class="mt">${inv.risk.factors.length ? inv.risk.factors.map((f) => `<div class="factor"><span>${esc(f.label)}</span><span class="pts">+${f.points}</span><small>${esc(f.detail)}</small></div>`).join('') : '<p class="muted">No risk factors present. Standard due diligence applies.</p>'}</div>
          ${inv.risk.overrides.map((o) => `<div class="callout warn mt"><strong>Override:</strong> ${esc(o)}</div>`).join('')}
        </div>
        <div class="card"><h2>Transactions</h2><div class="sub">Last 24 months.</div><div class="table-wrap">${txTable(txs)}</div></div>
      </div>
      <div class="stack">
        <div class="card"><h2>Profile</h2>
          <dl class="facts mt">
            <div><dt>Residence</dt><dd>${country(inv.residence)}${COUNTRIES[inv.residence].tier !== 'standard' ? ` <span class="tag">${COUNTRIES[inv.residence].tier}</span>` : ''}</dd></div>
            ${inv.nationality ? `<div><dt>Nationality</dt><dd>${country(inv.nationality)}</dd></div>` : ''}
            ${inv.incorporation ? `<div><dt>Established in</dt><dd>${country(inv.incorporation)}</dd></div>` : ''}
            <div><dt>${inv.type === 'Individual' ? 'Occupation' : 'Business'}</dt><dd>${esc(inv.occupation)}</dd></div>
            <div><dt>Onboarding channel</dt><dd>${esc(inv.channel)}</dd></div>
            ${inv.type !== 'Individual' ? `<div><dt>Ownership layers</dt><dd>${inv.ownershipLayers}</dd></div>` : ''}
            <div><dt>Expected annual investment</dt><dd>${eur(inv.expectedAnnual)}</dd></div>
            <div><dt>Source of funds</dt><dd>${esc(inv.sourceOfFunds)}</dd></div>
            <div><dt>Onboarded</dt><dd>${fdate(inv.onboarded)}</dd></div>
            <div><dt>Last review</dt><dd>${fdate(inv.lastReview)}</dd></div>
            <div><dt>Next review</dt><dd class="${inv.kyc.nextReview < AS_OF ? 'strong' : ''}">${fdate(inv.kyc.nextReview)}${inv.kyc.nextReview < AS_OF ? ' (overdue)' : ''}</dd></div>
          </dl>
        </div>
        <div class="card"><h2>Screening</h2>
          <ul class="doclist">
            <li><span>Sanctions lists</span>${screening}</li>
            <li><span>PEP status</span>${inv.pep ? `<span class="badge"><i class="dot serious"></i>${inv.pep.kind} PEP</span>` : '<span class="badge"><i class="dot good"></i>Not a PEP</span>'}</li>
            <li><span>Adverse media</span>${inv.adverseMedia ? '<span class="badge"><i class="dot serious"></i>Hit</span>' : '<span class="badge"><i class="dot good"></i>None found</span>'}</li>
          </ul>
          ${inv.pep ? `<p class="ink2 mt">${esc(inv.pep.role)}</p>` : ''}
          ${inv.sanctionsNote ? `<p class="ink2 mt">${esc(inv.sanctionsNote)}</p>` : ''}
          ${inv.adverseMedia ? `<p class="ink2 mt">${esc(inv.adverseMedia)}</p>` : ''}
        </div>
        <div class="card"><h2>KYC documents</h2>
          <ul class="doclist">${inv.docs.map((d) => `<li><span>${esc(d.label)}${d.edd ? ' <span class="tag">EDD</span>' : ''}</span>${docStatus(d)}</li>`).join('')}</ul>
        </div>
        <div class="card"><h2>Alerts</h2>
          ${alerts.length ? `<ul class="doclist">${alerts.map((o) => `<li><a href="#/alerts/${o.id}">${o.id} · ${esc(RULES[o.ruleId].short)}</a>${statusBadge(statusOf(o))}</li>`).join('')}</ul>` : '<p class="muted">No alerts in the last 12 months.</p>'}
        </div>
      </div>
    </div>`;
}

function viewRules() {
  const factors = [
    ['Residence in a call-for-action jurisdiction', 40, 'Always rated High; relationship normally blocked'],
    ['Residence in an increased-monitoring jurisdiction', 20, ''],
    ['Politically exposed person', 25, 'Always rated High; senior management approval'],
    ['Adverse media', 15, ''],
    ['Higher-risk occupation or sector', 15, 'Cash-intensive, high-value goods, real estate, commodities, charities'],
    ['Customer type: trust or nominee', 15, 'Beneficial owners are harder to see'],
    ['Customer type: corporate', 10, ''],
    ['Entity set up in an offshore financial centre', 10, ''],
    ['Complex ownership (3+ layers)', 10, ''],
    ['Non-face-to-face onboarding via introducer', 10, ''],
  ];
  main.innerHTML = `
    ${head('Rules & risk model', 'How this desk decides who is high risk and which transactions deserve a second look. Every number here lives in one file (js/rules.js), so it can be explained and changed.')}
    <div class="grid g-3-2">
      <div class="card"><h2>Transaction-monitoring rules</h2><div class="sub">Each rule targets one money-laundering typology seen in fund transfer agency work.</div>
        ${Object.entries(RULES).map(([id, r]) => {
          const n = db.alerts.filter((a) => a.ruleId === id).length;
          return `<div class="rule"><span class="rid">${id}</span><div><h3>${esc(r.name)}</h3><p>${esc(r.logic)}</p>
            <dl><dt>Typology</dt><dd>${esc(r.typology)}</dd><dt>Why it matters</dt><dd>${esc(r.why)}</dd><dt>Reference</dt><dd>${esc(r.anchor)}</dd>
            <dt>Last 12 months</dt><dd><a href="#/alerts?rule=${id}&status=all">${n} alert${n === 1 ? '' : 's'}</a> · base severity ${r.severity}</dd></dl></div></div>`;
        }).join('')}
      </div>
      <div class="stack">
        <div class="card"><h2>Customer risk model</h2><div class="sub">Points are added up. The total sets the rating, the depth of due diligence and how often the file is reviewed.</div>
          ${factors.map(([l, p, d]) => `<div class="factor"><span>${l}</span><span class="pts">+${p}</span><small>${d || '&nbsp;'}</small></div>`).join('')}
          <div class="table-wrap mt"><table><thead><tr><th>Rating</th><th>Score</th><th>Due diligence</th><th>Review cycle</th></tr></thead><tbody>
            <tr><td>${riskBadge('Low')}</td><td>0–19</td><td>Standard (CDD)</td><td>${REVIEW_CYCLE_YEARS.Low} years</td></tr>
            <tr><td>${riskBadge('Medium')}</td><td>20–44</td><td>Standard + monitoring</td><td>${REVIEW_CYCLE_YEARS.Medium} years</td></tr>
            <tr><td>${riskBadge('High')}</td><td>45+</td><td>Enhanced (EDD)</td><td>${REVIEW_CYCLE_YEARS.High} year</td></tr>
          </tbody></table></div>
        </div>
        <div class="card"><h2>Alert priority</h2>
          <div class="prose"><p>Priority (0–100) = the rule's base severity + half the customer risk score (max 25) + an amount uplift (€50k+: 6, €250k+: 12, €1m+: 20).</p>
          <p><span class="pill P1">P1</span> 65+ · <span class="pill P2">P2</span> 45–64 · <span class="pill P3">P3</span> below 45</p></div>
        </div>
        <div class="card"><h2>Thresholds</h2>
          <ul class="doclist">
            <li><span>Structuring band</span><span>${eur(THRESHOLDS.structuringBandLow)}–${eur(THRESHOLDS.structuringBandHigh)}, ${THRESHOLDS.structuringMinCount}+ in ${THRESHOLDS.structuringWindowDays} days</span></li>
            <li><span>Round-trip</span><span>${THRESHOLDS.roundTripRatio * 100}–110% redeemed within ${THRESHOLDS.roundTripDays} days</span></li>
            <li><span>Profile mismatch</span><span>&gt; ${THRESHOLDS.profileMultiple}× expected annual</span></li>
            <li><span>Dormancy</span><span>${THRESHOLDS.dormantDays}+ days, then ${eur(THRESHOLDS.dormantMinAmount)}+</span></li>
          </ul>
          <p class="muted mt">Jurisdiction tiers here are illustrative. A live system loads the current FATF and EU high-risk country lists.</p>
        </div>
      </div>
    </div>`;
}

function viewAbout() {
  main.innerHTML = `
    ${head('About this project', '')}
    <div class="grid g-3-2">
      <div class="stack">
        <div class="card"><h2>What this is</h2><div class="prose mt">
          <p>This site has three parts: the <strong>review desk</strong> (below), a <a href="#/fraud-lab">fraud rules lab</a> and a <a href="#/graph-lab">laundering pattern lab</a>. The review desk is a working prototype of the tools an <strong>anti-money laundering analyst at a fund transfer agency</strong> uses every day. Investors subscribe to and redeem from investment funds. The transfer agent keeps the register, so it is responsible for knowing who those investors are and for spotting money that should not be there.</p>
          <p>The prototype covers the three parts of that job:</p>
          <ul>
            <li><strong>Know your customer.</strong> Every investor gets a risk score that you can explain line by line, plus a KYC document checklist and a periodic review date.</li>
            <li><strong>Transaction monitoring.</strong> Nine rules, each targeting one known typology (structuring, round-tripping, third-party payments, dormant accounts, sanctions hits…), run over 12 months of activity.</li>
            <li><strong>Case work.</strong> Each alert opens as a case file: why it fired, what to check, the transaction history, a decision with a written rationale, an audit trail and an auto-drafted STR narrative.</li>
          </ul>
        </div></div>
        <div class="card"><h2>Try it in two minutes</h2><div class="prose mt"><ul>
          <li>Open the <a href="#/alerts">alert queue</a> and start with a P1 alert, for example <a href="#/alerts/${db.alerts.find((a) => a.ruleId === 'R6')?.id}">the third-party redemption</a>.</li>
          <li>Read <em>why it fired</em>, then follow the links to the investor and their risk score breakdown.</li>
          <li>Tick the checklist, write a rationale and escalate or close the alert. Your decisions are saved in your browser only.</li>
          <li>Compare it with <a href="#/alerts/${db.alerts.find((a) => a.ruleId === 'R1')?.id}">the third-party subscription</a>, which is probably a family member paying. Most alerts end as "no further action". Writing down <em>why</em> is the job.</li>
        </ul></div></div>
        <div class="card"><h2>Glossary</h2>
          <dl class="glossary mt">
            <dt>CDD / EDD</dt><dd>Customer due diligence: identifying and verifying the investor and understanding the relationship. Enhanced due diligence adds source-of-wealth evidence and senior approval for higher-risk investors.</dd>
            <dt>UBO</dt><dd>Ultimate beneficial owner: the natural person who ultimately owns or controls an entity investor (commonly above 25% under EU rules; 10% for companies under India's PML Rules).</dd>
            <dt>PEP</dt><dd>Politically exposed person: someone with a prominent public function, or their family and close associates.</dd>
            <dt>Source of funds vs. wealth</dt><dd>Funds: where this particular money came from. Wealth: how the investor built their overall wealth.</dd>
            <dt>STR / SAR</dt><dd>Suspicious transaction (or activity) report filed with the national financial intelligence unit, e.g. FIU-IND in India or the CRF in Luxembourg.</dd>
            <dt>MLRO</dt><dd>Money laundering reporting officer: decides whether an escalated case is reported.</dd>
            <dt>Tipping-off</dt><dd>Telling a customer they are under suspicion or have been reported. It is an offence, which is why information requests never mention suspicion.</dd>
            <dt>Typology</dt><dd>A known pattern of how money is laundered, e.g. structuring or round-tripping.</dd>
            <dt>Transfer agency</dt><dd>The fund's record-keeper: processes subscriptions and redemptions, keeps the investor register and performs investor AML checks.</dd>
          </dl>
        </div>
      </div>
      <div class="stack">
        <div class="card"><h2>Data</h2><div class="prose mt">
          <p>All ${db.investors.length} investors, ${db.transactions.length.toLocaleString('en-GB')} transactions and the "Aurelia" fund range are <strong>synthetic</strong>, generated from a fixed seed. Any resemblance to real people or companies is coincidental.</p>
          <p>Eight scenarios are planted on purpose so each typology appears at least once. Everything else is ordinary activity, so alerts on it are mostly false positives, as in real monitoring.</p>
        </div></div>
        <div class="card"><h2>How it is built</h2><div class="prose mt">
          <p>Plain HTML, CSS and JavaScript with no backend and no libraries. Everything runs in your browser:</p>
          <ul><li><span class="mono">js/data.js</span>, <span class="mono">js/rules.js</span>: synthetic investors and the review desk's risk model and 9 rules</li>
          <li><span class="mono">js/fraudlab.js</span>: a PaySim-style simulator and the 8 fraud rules, with the same logic as the DuckDB SQL shown in the lab</li>
          <li><span class="mono">js/graphlab.js</span>: the AMLworld-style typologies and the graph detectors</li>
          <li><span class="mono">js/home.js</span>, <span class="mono">js/app.js</span>: the screens and flowcharts</li></ul>
          <p>The animated beams and grid background are adapted from two 21st.dev components: Magic UI's <em>Animated Beam</em> and rmahammad's <em>Animated Grid</em>. I ported them from React to plain JavaScript.</p>
          <p>Built with AI coding assistance, which I directed and reviewed. The rule logic sits in plain files, so every number on the site can be traced and re-checked.</p>
        </div></div>
        <div class="card"><h2>Author</h2><div class="prose mt">
          <p>Built by <strong>Vishnu Suresh</strong>, a final-year B.Com (Honours) student in Chennai, as a hands-on way to learn AML and KYC practice in fund administration.</p>
          <p class="muted">A learning project. Not affiliated with, or endorsed by, any financial institution.</p>
        </div></div>
        <div class="card"><h2>Reset</h2><p class="ink2">Clear every decision you have recorded in this browser.</p><div class="actions mt"><button class="btn danger" id="reset">Reset all my changes</button></div></div>
      </div>
    </div>`;
  document.getElementById('reset').addEventListener('click', () => { decisions = {}; save(); updateNavCount(); viewAbout(); });
}

function notFound() {
  main.innerHTML = `${head('Not found', 'That record does not exist.')}<p><a href="#/overview">Back to the overview</a></p>`;
}

// ---------- Router ----------
function bindRowLinks() {
  main.querySelectorAll('tr.link').forEach((tr) => tr.addEventListener('click', (e) => {
    if (e.target.closest('a')) return;
    location.hash = tr.dataset.href;
  }));
}
function updateNavCount() {
  document.getElementById('nav-open').textContent = db.alerts.filter(isOpen).length;
}
function route() {
  hideTip();
  const raw = location.hash.replace(/^#\/?/, '') || 'home';
  const [path, query = ''] = raw.split('?');
  const params = Object.fromEntries(new URLSearchParams(query));
  const [view, id] = path.split('/');
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === view));
  const titles = { home: 'Follow the money', 'fraud-lab': 'Fraud rules lab', 'graph-lab': 'Laundering pattern lab', roadmap: 'Roadmap', overview: 'Overview', alerts: id || 'Alert queue', investors: id ? db.invById.get(id)?.name : 'Investor register', rules: 'Rules & risk model', about: 'About' };
  document.title = `${titles[view] || 'Not found'} · AML Review Desk`;
  if (view === 'home') renderHome(main, { db, statusOf, isOpen, RULES });
  else if (view === 'fraud-lab') renderFraudLab(main);
  else if (view === 'graph-lab') renderGraphLab(main);
  else if (view === 'roadmap') renderRoadmap(main);
  else if (view === 'overview') viewOverview();
  else if (view === 'alerts') id ? viewAlert(id) : viewAlerts(params);
  else if (view === 'investors') id ? viewInvestor(id) : viewInvestors(params);
  else if (view === 'rules') viewRules();
  else if (view === 'about') viewAbout();
  else notFound();
  window.scrollTo(0, 0);
}

document.getElementById('theme-toggle').addEventListener('click', () => {
  const root = document.documentElement;
  const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = dark ? 'light' : 'dark';
  try { localStorage.setItem('ard-theme', root.dataset.theme); } catch (e) { /* ignore */ }
});
window.addEventListener('hashchange', route);
updateNavCount();
route();
