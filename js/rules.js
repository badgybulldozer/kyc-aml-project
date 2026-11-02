// Customer risk scoring, KYC status and transaction-monitoring rules.
// Each rule is deliberately simple and explainable: an analyst has to be able
// to say exactly why an alert fired.

import { AS_OF, COUNTRIES, addDays, daysBetween, mulberry32 } from './data.js';

export const THRESHOLDS = {
  structuringBandLow: 12000,
  structuringBandHigh: 15000, // internal enhanced-check threshold (configurable)
  structuringWindowDays: 10,
  structuringMinCount: 3,
  roundTripDays: 30,
  roundTripRatio: 0.8,
  roundTripMinAmount: 10000,
  profileMultiple: 2,
  dormantDays: 365,
  dormantMinAmount: 50000,
  monitoringWindowDays: 365,
};

export const RULES = {
  R1: {
    name: 'Third-party subscription',
    short: 'Third-party payment',
    severity: 25,
    typology: 'Use of third parties to place funds',
    logic: 'A subscription is paid from a bank account that is not in the investor\'s name.',
    why: 'The fund only knows who the investor is. Money from someone else breaks the audit trail between the person we did KYC on and the actual source of the money.',
    checks: [
      'Who is the payer and what is their relationship to the investor?',
      'Is there a documented reason (e.g. joint account, parent paying for child)?',
      'Should the payer be identified and verified as well?',
      'Has this payer funded other investors on the register?',
    ],
    anchor: 'FATF Recommendation 10 (CDD): identify the customer and understand the purpose of the relationship.',
  },
  R2: {
    name: 'Rapid subscription and redemption',
    short: 'Round-trip',
    severity: 40,
    typology: 'Layering through short holding periods',
    logic: `A redemption of at least ${THRESHOLDS.roundTripRatio * 100}% of the money subscribed in the previous ${THRESHOLDS.roundTripDays} days.`,
    why: 'Long-term investment funds are rarely used for weeks. Money in, money out turns "dirty" cash into a payment that looks like it came from a regulated fund.',
    checks: [
      'What economic reason did the investor give for exiting so quickly?',
      'Did the investor accept a loss or fees without complaint? (indicator)',
      'Are the redemption proceeds going back to the same account they came from?',
      'Is this pattern repeated across funds or other investors linked to the same introducer?',
    ],
    anchor: 'FATF Recommendation 20 (reporting of suspicious transactions).',
  },
  R3: {
    name: 'Structuring below threshold',
    short: 'Structuring',
    severity: 40,
    typology: 'Splitting amounts to avoid enhanced checks',
    logic: `${THRESHOLDS.structuringMinCount}+ subscriptions between €${THRESHOLDS.structuringBandLow.toLocaleString('en-GB')} and €${THRESHOLDS.structuringBandHigh.toLocaleString('en-GB')} within ${THRESHOLDS.structuringWindowDays} days.`,
    why: 'Several payments that each sit just under a check threshold suggest the investor knows the threshold and is avoiding it.',
    checks: [
      'Does the combined amount fit the investor\'s declared source of funds and profile?',
      'Is the investor in a cash-intensive business?',
      'Are the payments coming from one account or several?',
      'Request evidence of source of funds for the combined amount.',
    ],
    anchor: 'Structuring ("smurfing") is a classic red flag in FATF and FIU typology reports.',
  },
  R4: {
    name: 'Activity inconsistent with profile',
    short: 'Profile mismatch',
    severity: 25,
    typology: 'Unexplained wealth',
    logic: `A single subscription more than ${THRESHOLDS.profileMultiple}× the investor's declared expected annual investment.`,
    why: 'CDD records what we expect a customer to do. A large departure from that profile needs an explanation, and may mean the KYC file is out of date.',
    checks: [
      'Has the investor\'s situation changed (property sale, inheritance, bonus)?',
      'Obtain evidence for the new amount and update the expected activity on file.',
      'Does the investor\'s risk rating need to change?',
    ],
    anchor: 'FATF Recommendation 10: ongoing due diligence and scrutiny of transactions.',
  },
  R5: {
    name: 'Higher-risk jurisdiction routing',
    short: 'High-risk jurisdiction',
    severity: 40,
    typology: 'Cross-border routing through higher-risk countries',
    logic: 'Money arrives from, or is paid to, a bank in an elevated or high-risk jurisdiction that is not the investor\'s country of residence.',
    why: 'If an investor lives in one country but pays from a higher-risk jurisdiction with no obvious link, the route itself needs explaining.',
    checks: [
      'What connects the investor to the jurisdiction of the paying bank?',
      'Is the payment account in the investor\'s name?',
      'Is enhanced due diligence on file and current?',
    ],
    anchor: 'FATF Recommendation 19 (higher-risk countries).',
  },
  R6: {
    name: 'Redemption paid to a third party',
    short: 'Third-party payout',
    severity: 35,
    typology: 'Integration via third-party payments',
    logic: 'Redemption proceeds are instructed to an account not in the investor\'s name.',
    why: 'Paying proceeds to someone else is how laundered money is handed on. Most fund administrators forbid it without senior approval.',
    checks: [
      'Is the instruction signed by authorised signatories?',
      'Who is the payee and what is the commercial reason?',
      'Has the payee been screened against sanctions lists?',
      'Escalate for approval under the third-party payment policy.',
    ],
    anchor: 'FATF Recommendation 10 & 20; typical TA third-party payment policy.',
  },
  R7: {
    name: 'Transfer of units to an unrelated party',
    short: 'Unrelated transfer',
    severity: 35,
    typology: 'Value transfer outside the banking system',
    logic: 'Units are transferred to another register holder with no declared relationship to the investor.',
    why: 'A unit transfer moves value without any cash moving, so it can be used to pay someone without a bank seeing it.',
    checks: [
      'Is the transferee a KYC\'d investor on the register?',
      'What is the reason for the transfer (gift, settlement, sale)?',
      'Has consideration been paid outside the fund? Where?',
      'Is the transferee in an offshore or higher-risk jurisdiction?',
    ],
    anchor: 'FATF Recommendations 24/25 (transparency of legal persons and arrangements).',
  },
  R8: {
    name: 'Dormant account reactivated',
    short: 'Dormant reactivation',
    severity: 25,
    typology: 'Use of dormant accounts',
    logic: `A transaction of €${THRESHOLDS.dormantMinAmount.toLocaleString('en-GB')}+ after ${THRESHOLDS.dormantDays}+ days with no activity.`,
    why: 'Dormant accounts can be taken over or lent to third parties. A sudden large transaction should be checked against an up-to-date KYC file.',
    checks: [
      'Is the investor\'s ID still valid and the address current?',
      'Was the instruction received through the usual channel and signatory?',
      'Why is the investor active again? Does the amount fit their profile?',
      'Bring the periodic review forward if it is overdue.',
    ],
    anchor: 'FATF Recommendation 10: keep CDD information up to date.',
  },
  R9: {
    name: 'Sanctions screening: potential match',
    short: 'Sanctions hit',
    severity: 50,
    typology: 'Targeted financial sanctions',
    logic: 'Name screening returned a potential match to a sanctions list that has not yet been discounted.',
    why: 'Dealing with a sanctioned person is a strict-liability breach. Transactions are held until the match is confirmed or discounted.',
    checks: [
      'Compare date of birth, nationality, address and ID numbers with the list entry.',
      'Document why the match is discounted, or escalate as a true match.',
      'Keep transactions on hold until the decision is recorded.',
    ],
    anchor: 'FATF Recommendation 6 (targeted financial sanctions) and national sanctions regimes.',
  },
};

// ---------- Customer risk ----------

export const REVIEW_CYCLE_YEARS = { High: 1, Medium: 2, Low: 3 };

export function scoreInvestor(inv) {
  const f = [];
  const res = COUNTRIES[inv.residence];
  if (res.tier === 'high') f.push({ label: 'Residence in a call-for-action jurisdiction', points: 40, detail: res.name });
  else if (res.tier === 'elevated') f.push({ label: 'Residence in an increased-monitoring jurisdiction', points: 20, detail: res.name });
  if (inv.incorporation && COUNTRIES[inv.incorporation]?.offshore) {
    f.push({ label: 'Entity set up in an offshore financial centre', points: 10, detail: COUNTRIES[inv.incorporation].name });
  }
  const typePts = { Individual: 0, Corporate: 10, Trust: 15, Nominee: 15 }[inv.type];
  if (typePts) f.push({ label: `Customer type: ${inv.type}`, points: typePts, detail: inv.type === 'Nominee' ? 'Underlying investors not directly visible' : 'Legal person / arrangement' });
  if (inv.ownershipLayers > 2) f.push({ label: 'Complex ownership structure', points: 10, detail: `${inv.ownershipLayers} layers to the beneficial owner` });
  if (inv.pep) f.push({ label: `Politically exposed person (${inv.pep.kind})`, points: 25, detail: inv.pep.role });
  if (inv.higherRiskSector) f.push({ label: 'Higher-risk occupation or sector', points: 15, detail: inv.occupation });
  if (inv.adverseMedia) f.push({ label: 'Adverse media', points: 15, detail: inv.adverseMedia });
  if (inv.channel.startsWith('Introducer')) f.push({ label: 'Non-face-to-face onboarding via introducer', points: 10, detail: inv.channel });

  const score = f.reduce((s, x) => s + x.points, 0);
  let rating = score >= 45 ? 'High' : score >= 20 ? 'Medium' : 'Low';
  const overrides = [];
  if (inv.pep && rating !== 'High') { rating = 'High'; overrides.push('PEPs are always rated High and need senior management approval.'); }
  if (res.tier === 'high' && rating !== 'High') { rating = 'High'; overrides.push('Call-for-action jurisdictions are always High risk.'); }
  return { score, rating, factors: f, overrides };
}

export function kycStatus(inv, risk) {
  const issues = [];
  if (inv.sanctions === 'potential') issues.push({ code: 'Blocked', text: 'Unresolved sanctions potential match. Transactions on hold.' });
  if (COUNTRIES[inv.residence].tier === 'high') issues.push({ code: 'Blocked', text: 'Residence in a call-for-action jurisdiction.' });
  for (const d of inv.docs) {
    if (d.edd && risk.rating !== 'High') continue;
    if (d.status === 'missing') issues.push({ code: d.edd ? 'EDD required' : 'Documents missing', text: `${d.label} not on file.` });
    if (d.status === 'expired') issues.push({ code: 'Documents expired', text: `${d.label} expired on ${d.expires}.` });
  }
  const nextReview = addDays(inv.lastReview, REVIEW_CYCLE_YEARS[risk.rating] * 365);
  if (nextReview < AS_OF) issues.push({ code: 'Review overdue', text: `Periodic review was due ${nextReview}.` });
  const order = ['Blocked', 'EDD required', 'Documents missing', 'Documents expired', 'Review overdue'];
  const status = issues.length ? order.find((o) => issues.some((i) => i.code === o)) : 'Complete';
  return { status, issues, nextReview };
}

// ---------- Transaction monitoring ----------

export function runMonitoring(investors, transactions) {
  const byInv = new Map(investors.map((i) => [i.id, []]));
  for (const t of transactions) byInv.get(t.investorId).push(t);
  const invById = new Map(investors.map((i) => [i.id, i]));
  const windowStart = addDays(AS_OF, -THRESHOLDS.monitoringWindowDays);
  const raw = [];
  const add = (ruleId, inv, txs, facts) => {
    const date = txs.length ? txs[txs.length - 1].date : inv.onboarded;
    if (date < windowStart) return;
    // R3 is about the combined amount; every other rule is about the triggering transaction
    const amount = ruleId === 'R3' ? txs.reduce((s, t) => s + t.amount, 0) : txs[txs.length - 1].amount;
    raw.push({ ruleId, investorId: inv.id, date, txIds: txs.map((t) => t.id), amount, facts });
  };

  for (const [invId, txs] of byInv) {
    const inv = invById.get(invId);
    const subs = txs.filter((t) => t.type === 'SUB');

    for (const t of txs) {
      if (t.type === 'SUB' && !t.payerOwn) add('R1', inv, [t], { payer: t.payerName });
      if (t.type === 'RED' && !t.payeeOwn) add('R6', inv, [t], { payee: t.payeeName, bank: COUNTRIES[t.bankCountry].name });
      if (t.type === 'SUB' && t.amount > THRESHOLDS.profileMultiple * inv.expectedAnnual) {
        add('R4', inv, [t], { multiple: t.amount / inv.expectedAnnual, expected: inv.expectedAnnual });
      }
      const bc = COUNTRIES[t.bankCountry];
      if ((t.type === 'SUB' || t.type === 'RED') && bc.tier !== 'standard' && t.bankCountry !== inv.residence) {
        add('R5', inv, [t], { bank: bc.name, tier: bc.tier, residence: COUNTRIES[inv.residence].name });
      }
      if (t.type === 'TRANSFER' && !t.related) {
        add('R7', inv, [t], { counterparty: t.counterparty, country: COUNTRIES[t.counterpartyCountry].name });
      }
    }

    // R2 round-trip
    for (const red of txs.filter((t) => t.type === 'RED')) {
      const recent = subs.filter((s) => s.date <= red.date && daysBetween(s.date, red.date) <= THRESHOLDS.roundTripDays);
      const subbed = recent.reduce((s, x) => s + x.amount, 0);
      const ratio = subbed ? red.amount / subbed : 0;
      // money in, roughly the same money out: 80%-110% of what was just subscribed
      if (subbed >= THRESHOLDS.roundTripMinAmount && ratio >= THRESHOLDS.roundTripRatio && ratio <= 1.1) {
        add('R2', inv, [...recent, red], { days: daysBetween(recent[0].date, red.date), ratio, subbed });
      }
    }

    // R3 structuring: clusters of just-below-threshold subscriptions
    const band = subs.filter((s) => s.amount >= THRESHOLDS.structuringBandLow && s.amount < THRESHOLDS.structuringBandHigh);
    let i = 0;
    while (i < band.length) {
      let j = i;
      while (j + 1 < band.length && daysBetween(band[i].date, band[j + 1].date) <= THRESHOLDS.structuringWindowDays) j++;
      const cluster = band.slice(i, j + 1);
      if (cluster.length >= THRESHOLDS.structuringMinCount) {
        add('R3', inv, cluster, { count: cluster.length, days: daysBetween(cluster[0].date, cluster.at(-1).date) });
        i = j + 1;
      } else i++;
    }

    // R8 dormant reactivation
    for (let k = 1; k < txs.length; k++) {
      const gap = daysBetween(txs[k - 1].date, txs[k].date);
      if (gap >= THRESHOLDS.dormantDays && txs[k].amount >= THRESHOLDS.dormantMinAmount) {
        add('R8', inv, [txs[k]], { gap, previous: txs[k - 1].date });
      }
    }

    // R9 sanctions screening
    if (inv.sanctions === 'potential') {
      raw.push({ ruleId: 'R9', investorId: inv.id, date: addDays(AS_OF, -2), txIds: subs.slice(-1).map((t) => t.id), amount: subs.at(-1)?.amount || 0, facts: { note: inv.sanctionsNote } });
    }
  }

  raw.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.ruleId.localeCompare(b.ruleId)));
  return raw.map((a, idx) => ({ ...a, id: `AL-${String(idx + 1).padStart(4, '0')}` }));
}

// Seeded starting status, so older alerts look like they have been worked.
export function seedStatus(alert) {
  const age = daysBetween(alert.date, AS_OF);
  let h = 0;
  for (const ch of alert.id + alert.ruleId) h = (h * 31 + ch.charCodeAt(0)) | 0;
  const r = mulberry32(h)();
  if (age <= 20) return r < 0.75 ? 'New' : 'In review';
  if (age <= 60) return r < 0.35 ? 'In review' : r < 0.55 ? 'Info requested' : r < 0.75 ? 'Escalated' : 'Closed – no further action';
  return r < 0.78 ? 'Closed – no further action' : r < 0.9 ? 'STR filed' : 'Escalated';
}

export const OPEN_STATUSES = ['New', 'In review', 'Info requested', 'Escalated'];

export function priority(alert, risk) {
  const amt = alert.amount >= 1e6 ? 20 : alert.amount >= 250000 ? 12 : alert.amount >= 50000 ? 6 : 0;
  return Math.min(100, Math.round(RULES[alert.ruleId].severity + Math.min(25, risk.score / 2) + amt));
}
export const priorityBand = (p) => (p >= 65 ? 'P1' : p >= 45 ? 'P2' : 'P3');

export function analyze({ investors, transactions }) {
  for (const inv of investors) {
    inv.risk = scoreInvestor(inv);
    inv.kyc = kycStatus(inv, inv.risk);
  }
  const invById = new Map(investors.map((i) => [i.id, i]));
  const txById = new Map(transactions.map((t) => [t.id, t]));
  const alerts = runMonitoring(investors, transactions).map((a) => {
    const p = priority(a, invById.get(a.investorId).risk);
    return { ...a, priority: p, band: priorityBand(p), seedStatus: seedStatus(a) };
  });
  return { investors, transactions, alerts, invById, txById };
}
