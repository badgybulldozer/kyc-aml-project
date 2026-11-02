// Synthetic book of business for a fictional Luxembourg UCITS fund range.
// Everything is generated from a fixed seed, so every visitor sees the same
// investors, transactions and alerts. No real people, firms or accounts.

export const AS_OF = '2026-10-31';
const DAY = 86400000;

export const toDate = (s) => new Date(s + 'T00:00:00Z');
export const iso = (d) => d.toISOString().slice(0, 10);
export const addDays = (s, n) => iso(new Date(toDate(s).getTime() + n * DAY));
export const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / DAY);

// Small deterministic PRNG (mulberry32)
export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Jurisdiction risk tiers are illustrative, modelled on how FATF publishes its
// "call for action" and "increased monitoring" lists. A production system would
// load the current FATF / EU high-risk third country lists instead.
export const COUNTRIES = {
  IE: { name: 'Ireland', tier: 'standard', pool: 'anglo' },
  LU: { name: 'Luxembourg', tier: 'standard', pool: 'euro' },
  DE: { name: 'Germany', tier: 'standard', pool: 'euro' },
  FR: { name: 'France', tier: 'standard', pool: 'euro' },
  NL: { name: 'Netherlands', tier: 'standard', pool: 'euro' },
  BE: { name: 'Belgium', tier: 'standard', pool: 'euro' },
  IT: { name: 'Italy', tier: 'standard', pool: 'euro' },
  ES: { name: 'Spain', tier: 'standard', pool: 'euro' },
  SE: { name: 'Sweden', tier: 'standard', pool: 'euro' },
  CH: { name: 'Switzerland', tier: 'standard', pool: 'euro' },
  GB: { name: 'United Kingdom', tier: 'standard', pool: 'anglo' },
  US: { name: 'United States', tier: 'standard', pool: 'anglo' },
  IN: { name: 'India', tier: 'standard', pool: 'indian' },
  SG: { name: 'Singapore', tier: 'standard', pool: 'asian' },
  HK: { name: 'Hong Kong SAR', tier: 'standard', pool: 'asian' },
  JP: { name: 'Japan', tier: 'standard', pool: 'asian' },
  AE: { name: 'United Arab Emirates', tier: 'standard', pool: 'gulf' },
  CY: { name: 'Cyprus', tier: 'standard', pool: 'euro' },
  MC: { name: 'Monaco', tier: 'elevated', pool: 'euro' },
  LB: { name: 'Lebanon', tier: 'elevated', pool: 'gulf' },
  VE: { name: 'Venezuela', tier: 'elevated', pool: 'latam' },
  VN: { name: 'Vietnam', tier: 'elevated', pool: 'asian' },
  KE: { name: 'Kenya', tier: 'elevated', pool: 'anglo' },
  IR: { name: 'Iran', tier: 'high', pool: 'gulf' },
  KP: { name: 'North Korea', tier: 'high', pool: 'asian' },
  MM: { name: 'Myanmar', tier: 'high', pool: 'asian' },
  VG: { name: 'British Virgin Islands', tier: 'standard', offshore: true, pool: 'anglo' },
  KY: { name: 'Cayman Islands', tier: 'standard', offshore: true, pool: 'anglo' },
  SC: { name: 'Seychelles', tier: 'standard', offshore: true, pool: 'anglo' },
  JE: { name: 'Jersey', tier: 'standard', offshore: true, pool: 'anglo' },
  PA: { name: 'Panama', tier: 'standard', offshore: true, pool: 'latam' },
};

export const FUNDS = [
  'Aurelia Global Equity Fund',
  'Aurelia Euro Short-Term Bond Fund',
  'Aurelia Asia Pacific Growth Fund',
  'Aurelia Sustainable Infrastructure Fund',
  'Aurelia Multi-Asset Income Fund',
];

const NAMES = {
  euro: {
    first: ['Lena', 'Matteo', 'Sophie', 'Jonas', 'Clara', 'Luca', 'Hugo', 'Elise', 'Marta', 'Felix', 'Anouk', 'Pieter', 'Giulia', 'Nils', 'Camille', 'Andreas', 'Ines', 'Theo'],
    last: ['Schneider', 'Rossi', 'Dubois', 'Jansen', 'Lindqvist', 'Moreau', 'Weber', 'Bianchi', 'Martin', 'Peeters', 'Fischer', 'Romano', 'Lefebvre', 'Vogel', 'Garcia', 'Hoffmann'],
  },
  anglo: {
    first: ['James', 'Olivia', 'Henry', 'Grace', 'Oliver', 'Charlotte', 'Daniel', 'Hannah', 'Samuel', 'Emily', 'Michael', 'Ruth', 'Patrick', 'Aoife', 'Joseph', 'Wanjiru'],
    last: ['Walsh', 'Bennett', 'Clarke', 'Murphy', 'Harrison', 'Doyle', 'Turner', 'Hughes', 'Kamau', 'Fletcher', 'Byrne', 'Morgan', 'Reid', 'Kelly', 'Odhiambo'],
  },
  indian: {
    first: ['Arjun', 'Divya', 'Karthik', 'Ananya', 'Rohan', 'Meera', 'Vikram', 'Lakshmi', 'Siddharth', 'Nandini', 'Aditya', 'Kavya', 'Rahul', 'Deepa'],
    last: ['Iyer', 'Menon', 'Sharma', 'Reddy', 'Nair', 'Kapoor', 'Krishnan', 'Rao', 'Mehta', 'Pillai', 'Banerjee', 'Subramanian'],
  },
  asian: {
    first: ['Wei', 'Mei', 'Hiroshi', 'Yuki', 'Jun', 'Lin', 'Kenji', 'Hana', 'Minh', 'Linh', 'Jia', 'Haruto'],
    last: ['Tan', 'Lim', 'Wong', 'Sato', 'Nakamura', 'Chen', 'Ng', 'Nguyen', 'Tanaka', 'Lee', 'Ho', 'Tran'],
  },
  gulf: {
    first: ['Omar', 'Layla', 'Karim', 'Yasmin', 'Rami', 'Nadia', 'Samir', 'Huda', 'Tariq', 'Rania'],
    last: ['Haddad', 'Khoury', 'Mansour', 'Nasser', 'Saleh', 'Aziz', 'Farouk', 'Habib'],
  },
  latam: {
    first: ['Mateo', 'Valentina', 'Diego', 'Camila', 'Andres', 'Lucia', 'Javier', 'Sofia'],
    last: ['Herrera', 'Castillo', 'Mendoza', 'Rojas', 'Vargas', 'Morales', 'Paredes', 'Salazar'],
  },
};

const CORP_STEM = ['Northgate', 'Aldermoor', 'Bluewater', 'Kestrel', 'Lumen', 'Orchard', 'Silverline', 'Granite', 'Halcyon', 'Brightwell', 'Tidewater', 'Ridgeback', 'Ashford', 'Copperleaf', 'Larkspur', 'Fenwick', 'Stonebridge', 'Westmoor', 'Saltmarsh', 'Ironvale'];
const CORP_SUFFIX = { LU: 'S.à r.l.', DE: 'GmbH', FR: 'SAS', NL: 'B.V.', CH: 'AG', SG: 'Pte. Ltd.', HK: 'Limited', IN: 'Pvt. Ltd.', US: 'LLC', AE: 'FZE', default: 'Ltd' };

const OCCUPATIONS = [
  ['Software engineer', false], ['Physician', false], ['Retired', false], ['Lawyer', false],
  ['Management consultant', false], ['Architect', false], ['University professor', false],
  ['Pharmacist', false], ['Civil servant', false], ['Pilot', false], ['Company director', false],
  ['Real estate agent', true], ['Restaurant owner', true], ['Jewellery dealer', true],
  ['Car dealership owner', true], ['Art dealer', true],
];
const SECTORS = [
  ['Technology', false], ['Manufacturing', false], ['Family investment office', false],
  ['Pension scheme', false], ['Insurance', false], ['Shipping & logistics', false],
  ['Healthcare', false], ['Commodities trading', true], ['Real estate holding', true],
  ['Charity / foundation', true], ['Precious metals', true],
];

const SOURCE_OF_FUNDS = {
  Individual: ['Salary savings', 'Sale of property', 'Inheritance', 'Business income', 'Pension lump sum', 'Investment proceeds'],
  Corporate: ['Retained earnings', 'Treasury surplus', 'Sale of subsidiary', 'Shareholder capital'],
  Trust: ['Settlor contribution', 'Sale of family business', 'Inheritance'],
  Nominee: ['Underlying client monies (omnibus)'],
};

function docTemplate(type) {
  const common = [
    { key: 'tax', label: 'FATCA / CRS self-certification' },
    { key: 'sof', label: 'Source of funds declaration' },
  ];
  const byType = {
    Individual: [
      { key: 'id', label: 'Passport / national ID', expiring: true },
      { key: 'poa', label: 'Proof of address (< 3 months at onboarding)' },
    ],
    Corporate: [
      { key: 'coi', label: 'Certificate of incorporation' },
      { key: 'dir', label: 'Register of directors' },
      { key: 'ubo', label: 'UBO declaration (all owners above threshold)' },
      { key: 'uboid', label: 'ID of each UBO', expiring: true },
      { key: 'sig', label: 'Authorised signatory list' },
    ],
    Trust: [
      { key: 'deed', label: 'Trust deed' },
      { key: 'trustee', label: 'Trustee ID / regulated status', expiring: true },
      { key: 'parties', label: 'Settlor, protector & beneficiary list' },
    ],
    Nominee: [
      { key: 'ddq', label: 'Intermediary due diligence questionnaire (Wolfsberg-style)' },
      { key: 'reliance', label: 'Reliance / introducer agreement' },
      { key: 'reg', label: 'Evidence of regulated status' },
    ],
  };
  return [...byType[type], ...common, { key: 'sow', label: 'Source of wealth evidence', edd: true }];
}

export function generate() {
  const rnd = mulberry32(20261031);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const chance = (p) => rnd() < p;
  const between = (a, b) => a + rnd() * (b - a);
  const int = (a, b) => Math.floor(between(a, b + 1));
  const weighted = (pairs) => {
    let r = rnd() * pairs.reduce((s, [, w]) => s + w, 0);
    for (const [v, w] of pairs) if ((r -= w) < 0) return v;
    return pairs[pairs.length - 1][0];
  };
  const round = (x, step) => Math.max(step, Math.round(x / step) * step);

  const investors = [];
  const transactions = [];
  let invSeq = 10001;
  let txSeq = 500001;
  const usedNames = new Set();

  const personName = (pool) => {
    for (let i = 0; i < 50; i++) {
      const p = NAMES[chance(0.85) ? pool : pick(Object.keys(NAMES))];
      const n = `${pick(p.first)} ${pick(p.last)}`;
      if (!usedNames.has(n)) { usedNames.add(n); return n; }
    }
    return `Investor ${invSeq}`;
  };
  const corpName = (country, sector) => {
    for (let i = 0; i < 50; i++) {
      const word = sector.split(/[ &/]/)[0];
      const n = `${pick(CORP_STEM)} ${word} ${CORP_SUFFIX[country] || CORP_SUFFIX.default}`;
      if (!usedNames.has(n)) { usedNames.add(n); return n; }
    }
    return `Entity ${invSeq}`;
  };

  const makeDocs = (type, overrides = {}) =>
    docTemplate(type).map((d) => {
      let status = weighted([['ok', 96], ['missing', 2], ['expired', d.expiring ? 4 : 0]]);
      if (d.edd) status = chance(0.8) ? 'ok' : 'missing';
      if (overrides[d.key]) status = overrides[d.key];
      const expires = d.expiring
        ? status === 'expired' ? addDays(AS_OF, -int(5, 200)) : addDays(AS_OF, int(60, 2400))
        : null;
      return { ...d, status, expires };
    });

  const residenceMix = [
    ['LU', 10], ['DE', 10], ['FR', 7], ['NL', 5], ['BE', 4], ['IT', 6], ['ES', 4], ['SE', 3], ['CH', 7],
    ['GB', 9], ['IE', 6], ['US', 5], ['IN', 7], ['SG', 6], ['HK', 4], ['JP', 3], ['AE', 5],
    ['MC', 1.5], ['LB', 0.8], ['VN', 1], ['KE', 1], ['VE', 0.6],
  ];

  // ---- Regular book of business ----
  for (let i = 0; i < 176; i++) {
    const type = weighted([['Individual', 70], ['Corporate', 18], ['Trust', 7], ['Nominee', 5]]);
    const residence = weighted(residenceMix);
    const c = COUNTRIES[residence];
    let name, occupation, higherRiskSector, incorporation = null, layers = 1;
    if (type === 'Individual') {
      name = personName(c.pool);
      [occupation, higherRiskSector] = pick(OCCUPATIONS);
    } else {
      [occupation, higherRiskSector] = type === 'Nominee' ? ['Regulated platform / nominee', false]
        : type === 'Trust' ? ['Family trust', false] : pick(SECTORS);
      incorporation = type === 'Corporate' && chance(0.15) ? pick(['VG', 'KY', 'SC', 'JE']) : residence;
      if (type === 'Trust') incorporation = chance(0.35) ? pick(['JE', 'KY']) : residence;
      name = type === 'Nominee'
        ? `${pick(CORP_STEM)} Nominees ${CORP_SUFFIX[residence] || 'Ltd'}`
        : type === 'Trust' ? `${personName(c.pool).split(' ')[1]} Family Trust` : corpName(incorporation, occupation);
      layers = type === 'Nominee' ? 1 : weighted([[1, 45], [2, 35], [3, 15], [4, 5]]);
    }
    const expectedAnnual = type === 'Individual'
      ? round(Math.exp(between(Math.log(15000), Math.log(250000))), 5000)
      : round(Math.exp(between(Math.log(300000), Math.log(8000000))), 50000);
    const onboarded = addDays(AS_OF, -int(200, 3200));
    const pep = type === 'Individual' && chance(0.025)
      ? { kind: chance(0.5) ? 'Foreign' : 'Domestic', role: pick(['Member of parliament', 'Senior judge', 'Ambassador', 'Board member of a state-owned enterprise', 'Close associate of a minister']) }
      : null;
    const inv = {
      id: `INV-${invSeq++}`,
      name, type, residence, incorporation, occupation, higherRiskSector, pep,
      nationality: type === 'Individual' ? residence : null,
      sanctions: chance(0.025) ? 'cleared' : 'clear',
      sanctionsNote: null,
      adverseMedia: type !== 'Nominee' && chance(0.03) ? pick(['Named in a 2024 local press report on a tax dispute (no charges)', 'Former director of a company fined for customs violations', 'Litigation with a former business partner over unpaid invoices']) : null,
      channel: weighted([['Direct', 45], ['Distributor (regulated)', 40], ['Introducer (non-face-to-face)', 15]]),
      ownershipLayers: layers,
      expectedAnnual,
      sourceOfFunds: pick(SOURCE_OF_FUNDS[type]),
      onboarded,
      lastReview: addDays(AS_OF, -int(30, Math.min(1300, daysBetween(onboarded, AS_OF)))),
      docs: makeDocs(type),
      relatedParties: [],
    };
    if (inv.sanctions === 'cleared') inv.sanctionsNote = 'Partial name match reviewed and discounted (different date of birth and nationality).';
    investors.push(inv);

    // Transactions over a 24-month window, so dormancy can be measured
    const n = type === 'Individual' ? int(3, 12) : int(6, 20);
    const start = onboarded > addDays(AS_OF, -720) ? onboarded : addDays(AS_OF, -720);
    const span = daysBetween(start, AS_OF);
    const dates = Array.from({ length: n }, () => addDays(start, int(0, span))).sort();
    let holding = type === 'Individual' ? expectedAnnual * between(0.3, 1.5) : expectedAnnual * between(0.5, 2);
    const fundOf = pick(FUNDS);
    const bank = type !== 'Individual' && COUNTRIES[incorporation]?.offshore ? pick(['LU', 'CH', 'SG']) : residence;
    for (const date of dates) {
      const step = type === 'Individual' ? 100 : 1000;
      const r = rnd();
      if (r < 0.62 || holding < 5000) {
        // Mostly ordinary amounts; occasionally a one-off far above the declared profile
        const amount = round(expectedAnnual * (chance(0.012) ? between(2.1, 4) : between(0.05, 0.45)), step);
        const own = !chance(0.035);
        const odd = chance(0.008) ? pick(['LB', 'VN', 'KE', 'MC'].filter((x) => x !== residence)) : bank;
        const fund = chance(0.8) ? fundOf : pick(FUNDS);
        transactions.push({
          id: `TX-${txSeq++}`, investorId: inv.id, date, type: 'SUB', fund, amount,
          payerOwn: own, payerName: own ? inv.name : `${personName(c.pool)}`, bankCountry: odd,
        });
        holding += amount;
        // Some investors change their mind and sell again within weeks
        if (chance(0.035) && daysBetween(date, AS_OF) > 28) {
          const back = round(amount * between(0.85, 1), step);
          transactions.push({
            id: `TX-${txSeq++}`, investorId: inv.id, date: addDays(date, int(4, 28)), type: 'RED', fund, amount: back,
            payeeOwn: true, payeeName: inv.name, bankCountry: bank,
          });
          holding -= back;
        }
      } else if (r < 0.92) {
        const amount = round(holding * between(0.1, 0.55), step);
        const own = !chance(0.02);
        transactions.push({
          id: `TX-${txSeq++}`, investorId: inv.id, date, type: 'RED', fund: fundOf, amount,
          payeeOwn: own, payeeName: own ? inv.name : personName(c.pool), bankCountry: bank,
        });
        holding -= amount;
      } else {
        const to = pick(FUNDS.filter((f) => f !== fundOf));
        transactions.push({
          id: `TX-${txSeq++}`, investorId: inv.id, date, type: 'SWITCH', fund: fundOf, toFund: to,
          amount: round(holding * between(0.2, 0.5), step), bankCountry: bank,
        });
      }
    }
  }

  // ---- Planted scenarios: each one is a typology an AML analyst should recognise ----
  const plant = (inv, txs) => {
    const full = {
      id: `INV-${invSeq++}`, incorporation: null, nationality: inv.type === 'Individual' ? inv.residence : null,
      sanctions: 'clear', sanctionsNote: null, adverseMedia: null, pep: null, higherRiskSector: false,
      channel: 'Direct', ownershipLayers: 1, relatedParties: [], ...inv,
      docs: makeDocs(inv.type, inv.docOverrides || {}),
    };
    delete full.docOverrides;
    usedNames.add(full.name);
    investors.push(full);
    for (const t of txs) {
      transactions.push({ id: `TX-${txSeq++}`, investorId: full.id, fund: FUNDS[0], bankCountry: full.residence, payerOwn: true, payerName: full.name, payeeOwn: true, payeeName: full.name, ...t });
    }
    return full;
  };

  // 1. Structuring just below the €15,000 enhanced-check threshold
  plant({
    name: 'Lukas Brandt', type: 'Individual', residence: 'DE', occupation: 'Car dealership owner', higherRiskSector: true,
    expectedAnnual: 30000, sourceOfFunds: 'Business income', onboarded: '2023-02-14', lastReview: '2025-02-20',
    docOverrides: { sow: 'ok' },
  }, [
    { date: '2025-03-12', type: 'SUB', amount: 8000, fund: FUNDS[4] },
    { date: addDays(AS_OF, -16), type: 'SUB', amount: 14500, fund: FUNDS[4] },
    { date: addDays(AS_OF, -14), type: 'SUB', amount: 14800, fund: FUNDS[4] },
    { date: addDays(AS_OF, -11), type: 'SUB', amount: 14200, fund: FUNDS[4] },
    { date: addDays(AS_OF, -8), type: 'SUB', amount: 14900, fund: FUNDS[4] },
  ]);

  // 2. Offshore trading company: subscribe, redeem within weeks, pay out to someone else
  plant({
    name: 'Corvane Trading Ltd', type: 'Corporate', residence: 'AE', incorporation: 'SC', occupation: 'Commodities trading',
    higherRiskSector: true, channel: 'Introducer (non-face-to-face)', ownershipLayers: 3, expectedAnnual: 1500000,
    sourceOfFunds: 'Retained earnings', onboarded: '2026-05-04', lastReview: '2026-05-04',
  }, [
    { date: addDays(AS_OF, -34), type: 'SUB', amount: 1250000, fund: FUNDS[1] },
    { date: addDays(AS_OF, -15), type: 'RED', amount: 1190000, fund: FUNDS[1], payeeOwn: false, payeeName: 'Kestrel Mercantile Ltd', bankCountry: 'CY' },
  ]);

  // 3. Foreign PEP: subscription far above the declared profile, source of wealth not evidenced
  plant({
    name: 'Elena Marchetti', type: 'Individual', residence: 'MC', nationality: 'IT', occupation: 'Retired',
    pep: { kind: 'Foreign', role: 'Former regional minister for infrastructure (left office 2023)' },
    expectedAnnual: 500000, sourceOfFunds: 'Sale of property', onboarded: '2024-09-02', lastReview: '2025-09-15',
    docOverrides: { sow: 'missing' },
  }, [
    { date: '2024-11-05', type: 'SUB', amount: 300000, fund: FUNDS[0] },
    { date: addDays(AS_OF, -12), type: 'SUB', amount: 2400000, fund: FUNDS[0] },
  ]);

  // 4. Third-party payment: probably a family member, but it still has to be explained
  plant({
    name: 'Priya Raman', type: 'Individual', residence: 'GB', occupation: 'Physician', expectedAnnual: 60000,
    sourceOfFunds: 'Salary savings', onboarded: '2022-06-21', lastReview: '2025-06-30', docOverrides: { sow: 'ok' },
  }, [
    { date: '2025-07-02', type: 'SUB', amount: 12000, fund: FUNDS[3] },
    { date: '2026-01-15', type: 'SUB', amount: 9000, fund: FUNDS[3] },
    { date: addDays(AS_OF, -9), type: 'SUB', amount: 85000, fund: FUNDS[3], payerOwn: false, payerName: 'R. Venkatesh' },
  ]);

  // 5. Dormant account suddenly reactivated with a large amount
  plant({
    name: 'Thomas Keller', type: 'Individual', residence: 'CH', occupation: 'Retired', expectedAnnual: 80000,
    sourceOfFunds: 'Pension lump sum', onboarded: '2019-03-11', lastReview: '2023-04-02', docOverrides: { sow: 'ok', id: 'expired' },
  }, [
    { date: '2024-11-20', type: 'SUB', amount: 40000, fund: FUNDS[2] },
    { date: addDays(AS_OF, -6), type: 'SUB', amount: 640000, fund: FUNDS[2] },
  ]);

  // 6. Funds routed through a higher-risk jurisdiction unconnected to the investor
  plant({
    name: 'Altamira Import Export S.A.', type: 'Corporate', residence: 'ES', incorporation: 'PA', occupation: 'Commodities trading',
    higherRiskSector: true, ownershipLayers: 2, expectedAnnual: 800000, sourceOfFunds: 'Retained earnings',
    channel: 'Distributor (regulated)', onboarded: '2025-01-20', lastReview: '2026-01-22',
  }, [
    { date: '2025-02-03', type: 'SUB', amount: 250000, fund: FUNDS[1], bankCountry: 'ES' },
    { date: addDays(AS_OF, -19), type: 'SUB', amount: 420000, fund: FUNDS[1], bankCountry: 'LB' },
    { date: addDays(AS_OF, -4), type: 'SUB', amount: 380000, fund: FUNDS[1], bankCountry: 'LB' },
  ]);

  // 7. Transfer of units to an unrelated offshore company
  plant({
    name: 'Willow Creek Family Trust', type: 'Trust', residence: 'JE', incorporation: 'JE', occupation: 'Family trust',
    ownershipLayers: 3, expectedAnnual: 2000000, sourceOfFunds: 'Sale of family business', onboarded: '2021-08-09',
    lastReview: '2025-08-12', channel: 'Distributor (regulated)', relatedParties: ['Willow Creek Holdings Ltd'],
  }, [
    { date: '2025-06-10', type: 'SUB', amount: 1800000, fund: FUNDS[3] },
    { date: addDays(AS_OF, -7), type: 'TRANSFER', amount: 950000, fund: FUNDS[3], counterparty: 'Harbourline Ventures Ltd', counterpartyCountry: 'VG', related: false },
  ]);

  // 8. Sanctions screening: potential name match waiting for a decision
  plant({
    name: 'Mark Feldman', type: 'Individual', residence: 'US', occupation: 'Management consultant', expectedAnnual: 50000,
    sourceOfFunds: 'Salary savings', onboarded: '2026-10-20', lastReview: '2026-10-20', sanctions: 'potential',
    sanctionsNote: '87% name match to a listed individual "FELDMANN, Marc". Listed date of birth differs by 11 years; nationality not stated on the list entry.',
    docOverrides: { sow: 'ok' },
  }, [
    { date: addDays(AS_OF, -3), type: 'SUB', amount: 25000, fund: FUNDS[0] },
  ]);

  transactions.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { investors, transactions };
}
