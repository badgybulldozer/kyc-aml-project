# AML Review Desk

An interactive AML and financial-crime portfolio in three parts:

1. **Review desk**: an AML workbench for a fund transfer agency, with investor KYC risk scoring, 9 transaction-monitoring rules, alert case files with a decision workflow, and auto-drafted STR narratives.
2. **Fraud rules lab** (`#/fraud-lab`): the 8 rules from `docs/specs/fraud-red-flags.md`, run live on a PaySim-style mobile-money simulation. Includes threshold sliders, a train/test split, auto-tuning on training steps only, an alert-budget curve and the DuckDB SQL for each rule.
3. **Laundering pattern lab** (`#/graph-lab`): the 8 AMLworld typologies, animated, plus graph detectors (fan-in, fan-out, cycle closure, scatter-gather) with per-typology recall, cycle recall by hop length, and a data-leakage toggle.

The home page (`#/home`) has the clickable laundering-lifecycle and alert-journey flowcharts. All data is synthetic and generated from fixed seeds. The lab numbers are **not** PaySim or AMLworld results; those are planned in `docs/specs/`.

## Run locally

No build step and no dependencies.

```bash
python -m http.server 5179
```

Then open http://localhost:5179.

## Files

| File | What it does |
|---|---|
| `js/data.js` | Generates investors, KYC documents and 24 months of transactions. Plants 8 scenarios so every typology appears. |
| `js/rules.js` | Customer risk score, KYC status, the 9 monitoring rules, alert priority. **Learn this file first.** |
| `js/app.js` | Screens: overview, alert queue, case file, investor register, investor profile, rules, about. |
| `js/charts.js` | Small hand-written charts (no chart library). |
| `js/home.js` | Home page flowcharts and the Roadmap page. |
| `js/fraudlab.js` | PaySim-style simulator, fraud rules R1–R8, metrics, budget curve. |
| `js/graphlab.js` | Typology animations, synthetic payment network, graph detectors. |
| `js/fx.js` | Animated beams, ported from 21st.dev / Magic UI "Animated Beam" (React → plain JS). The grid background in `css/v2.css` is ported from 21st.dev "Animated Grid". |
| `docs/specs/` | v2 specs for the two real-data projects, with a "Changes from v1" log. |

---

## Study guide: what to be able to explain

### 1. Where this sits in a fund administrator

Investors buy (subscribe) and sell (redeem) units of a fund. The **transfer agent** keeps the shareholder register and processes those orders, so it carries the investor-level AML duty: identify the investor, check where the money comes from, and watch what they do. The State Street AML Specialist role describes exactly this: reviewing investor AML documentation and working with the transfer agency team to get missing information.

### 2. Customer risk score (`scoreInvestor` in rules.js)

Points are added for each risk factor:

| Factor | Points |
|---|---|
| Residence in a call-for-action country | 40 (always High) |
| PEP | 25 (always High) |
| Residence in an increased-monitoring country | 20 |
| Adverse media | 15 |
| Higher-risk occupation or sector (cash-intensive, real estate, commodities, charities) | 15 |
| Trust or nominee | 15 |
| Corporate | 10 |
| Offshore incorporation | 10 |
| 3+ ownership layers | 10 |
| Introducer / non-face-to-face | 10 |

**Low** is below 20, **Medium** is 20–44 and **High** is 45 or more. High means **EDD**: source-of-wealth evidence, senior approval and a yearly review. Medium is reviewed every 2 years and Low every 3.

*Interview point:* this is the **risk-based approach** (FATF Recommendation 1): spend more effort where the risk is higher.

### 3. The nine rules

| ID | Rule | Red flag in plain words |
|---|---|---|
| R1 | Third-party subscription | Someone else paid for the investor's units |
| R2 | Round-trip | In and out within 30 days, 80–110% of the same money |
| R3 | Structuring | 3+ payments of €12k–15k within 10 days, staying under a €15k check threshold |
| R4 | Profile mismatch | One subscription above 2× the declared yearly amount |
| R5 | High-risk jurisdiction | Money routed through a risky country the investor doesn't live in |
| R6 | Third-party payout | Redemption proceeds sent to someone else |
| R7 | Unrelated transfer | Units handed to an unrelated (offshore) company: value moves with no cash |
| R8 | Dormant reactivation | No activity for a year or more, then €50k+ |
| R9 | Sanctions hit | Name screening found a potential match |

### 4. The eight planted cases

Know each one's story:

1. **Lukas Brandt.** Car dealer (cash business). Four payments of €14.2k–14.9k in 8 days → structuring.
2. **Corvane Trading Ltd.** Seychelles company, UAE-based, came via an introducer. Put in €1.25m and took €1.19m out 19 days later, paid to a different company in Cyprus → round-trip plus third-party payout. *The strongest STR candidate.*
3. **Elena Marchetti.** Foreign PEP in Monaco. Invested €2.4m against a declared €500k a year, with no source-of-wealth evidence → profile mismatch plus EDD gap.
4. **Priya Raman.** €85k paid by "R. Venkatesh". Probably a family member, so request information and close if documented. *Shows that most alerts are false positives.*
5. **Thomas Keller.** Dormant for almost 2 years, then €640k, and his ID has expired → dormant reactivation.
6. **Altamira Import Export.** Panama company based in Spain, paying from Lebanese banks → high-risk jurisdiction routing.
7. **Willow Creek Family Trust.** Moved €950k of units to a BVI company with no declared link → unrelated transfer.
8. **Mark Feldman.** 87% name match to a sanctions list entry, but the date of birth differs by 11 years → most likely discounted, after documenting why.

### 5. The decision workflow

Each alert can be:

- **Closed – no further action**, with a written rationale
- **Info requested**, through the TA or distributor. Never mention suspicion: that would be **tipping-off**.
- **Escalated to the MLRO**, who decides whether to file
- **STR filed** with the FIU (FIU-IND in India, the CRF in Luxembourg)

The rationale is mandatory because auditors and regulators read it later.

### 6. The labs: what to be able to say

- **Precision vs recall.** Precision is how many alerts are real. Recall is how much of the bad activity you caught. At 1–2% fraud, "flag nothing" is over 98% accurate, which is why accuracy is useless here.
- **Union vs budget.** OR-ing all rules catches nearly everything, but produces thousands of alerts. Ranking by "rules hit, then amount" and reading only the top K a day is the realistic trade-off.
- **Train/test split.** Thresholds are chosen on steps 1–500 and judged on 501–744. Choosing on the same data you report on flatters the result.
- **Leakage.** A feature at time t can only use data from before t. The pattern lab's leakage toggle shows the numbers moving on information a live system wouldn't have.
- **Blind spots.** Shape rules catch fan-in, fan-out and scatter-gather, but miss stack, bipartite and random patterns, and cycles longer than the hop limit. That's the argument for a model on top of graph features.
- **Data traps** (Roadmap page): no transaction id in PaySim, duplicate `Account` columns in AMLworld, simulator artefacts, and an unsourced statistic I removed from my own draft.

### 7. Likely interview questions

- *"Walk me through how you'd review an alert."* Read why it fired → check the KYC file and risk rating → look at the transaction history → work through the checklist → request info if needed → decide and write the rationale.
- *"What's the difference between source of funds and source of wealth?"* Source of funds is where this specific payment came from. Source of wealth is how the person built their overall wealth.
- *"Why are third-party payments a problem?"* We only did KYC on the investor. Money from someone else breaks the link between the person we know and the money.
- *"What would you improve?"* Consolidate several alerts on one investor into a single case. Tune thresholds using the false-positive rate. Pull FATF and EU lists live. Add network analysis, e.g. the same payer funding several investors.

---

*A learning project. Not affiliated with any financial institution. Jurisdiction risk tiers are illustrative.*
