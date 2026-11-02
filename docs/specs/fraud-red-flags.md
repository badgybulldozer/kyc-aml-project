# Project: fraud-red-flags (PaySim), spec v2

> v2 keeps the original goal and guardrails. The **Changes from v1** section lists every correction and why. Items marked VERIFY are things I expect to be true from published analyses of PaySim; check them against the data before relying on them.
>
> The browser version of this idea runs live on the website (Fraud Rules Lab) using a PaySim-style simulator. Its numbers are **not** PaySim numbers.

## Goal
Show which simple, explainable fraud rules catch the most fraud per alert a reviewer has to look at, and report the trade-offs honestly. Synthetic data; this is learning-grade analytics, not a production model.

## Data
- Dataset: PaySim synthetic mobile-money transactions (Kaggle, "Synthetic Financial Datasets For Fraud Detection"). Download manually into `data/raw/` (gitignored). Never commit data.
- Expected columns (VERIFY with `head`): step, type, amount, nameOrig, oldbalanceOrg, newbalanceOrig, nameDest, oldbalanceDest, newbalanceDest, isFraud, isFlaggedFraud.
- Expected size (VERIFY): about 6.36M rows and about 8,213 fraud rows. Fraud occurs only in TRANSFER and CASH_OUT.
- `step` = 1 hour; 743 steps ≈ 30 days. A 24-step window = 1 day.
- **There is no transaction id column.** Create `tx_id` at load time from file order (`row_number() OVER ()`) and never re-sort before assigning it.
- `isFlaggedFraud` is the dataset's built-in rule (documented as TRANSFER above 200,000; VERIFY). It is the baseline to beat.

## Stack
Python 3.11, DuckDB (all heavy SQL, reads CSV directly), pandas (small outputs only), matplotlib, Streamlit (dashboard), pytest. Ask before adding any other dependency.

## Repo layout
data/ (gitignored), sql/profile.sql, sql/rules/R1..R8.sql, src/load.py, src/evaluate.py, src/budget.py, dashboard/app.py, tests/, results/, README.md, decisions.md, LIMITS.md, Makefile

## Steps
1. `load.py`: create DuckDB table `tx` with explicit column types and a `tx_id`. Assert row count and fraud count, or stop and report the difference.
2. **New: `sql/profile.sql`.** Before writing any rule, report:
   - distinct nameOrig and nameDest
   - share of origins that appear more than once
   - fraud rate by type and by step range
   - how many fraudulent TRANSFER destinations appear later as a CASH_OUT origin

   Save to `results/profile.csv`. Rules R2, R3, R4, R6 and R7 depend on these numbers (see Changes 1 and 2).
3. Write the eight rule SQL files. Each returns `tx_id`s, with a one-line hypothesis comment:
   - R1 drain: type in (TRANSFER, CASH_OUT), oldbalanceOrg > 0, newbalanceOrig = 0
   - R2 transfer-then-cashout: a TRANSFER to D followed by a CASH_OUT from D with the same amount within 1 step
   - R3 repeated amount: same origin, same amount, 3+ times within 24 steps
   - R4 velocity: 5+ transactions from one origin within one step
   - R5 fan-in: 5+ distinct origins paying one destination within 24 steps
   - R6 spike: amount > 10× the origin's median of **strictly earlier steps** (`ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING` over `ORDER BY step, tx_id`)
   - R7 new-account large: origin's first transaction above that type's 90th percentile in steps 1–500
   - R8 pass-through: TRANSFER where oldbalanceDest = 0 and newbalanceDest = 0 (VERIFY whether this is a simulator artefact; see Change 4)
4. `evaluate.py`: for each rule, the union and the baseline, compute flagged, TP, precision, recall, F1 and alerts per 1,000 transactions. **Also report "flag nothing"** so the accuracy trap is visible.
5. Temporal split: choose thresholds on steps 1–500 only and report on 501–743. Show both, plus the fraud rate in each split.
6. `budget.py`: alert budget of K per 24 steps (default 50, parameter). Rank by rules triggered, then amount. Report frauds caught in the top K and the recall-vs-K curve.
7. `dashboard/app.py`: rules table, K slider, recall bar chart. Reads `results/*.csv` only.
8. `tests/`: ~10-row fixture per rule with exact expected `tx_id`s. Add a test that R6 ignores rows in the same or a later step.
9. `make all` runs everything from raw data. Results come from code, never typed in.

## Acceptance criteria
- `make all` reproduces `results/rules_summary.csv` and `results/profile.csv` from raw data.
- All rules, the union, the budget analysis, the baseline and "flag nothing" are reported on full data and on the temporal split.
- README: one-paragraph summary, metrics table (pasted from results), how to run, and the most useful finding in plain words.
- LIMITS.md: synthetic data; mobile-money context; arbitrary thresholds; accuracy is misleading at this class balance; simulator artefacts; results do not transfer to a real bank.
- decisions.md logs every AI-suggested change: what was suggested, what changed, and how it was checked (test, manual recount of at least two rows, or a second query).

## Guardrails for Claude Code
- Do not invent or hard-code any number.
- Keep each SQL rule under 40 lines, commented.
- If a query runs longer than 60 seconds, show the plan and propose a rewrite before continuing.
- Stop and ask if a fixture test fails. Do not edit the expected value to make it pass.

---

## Changes from v1

| # | Change | Why |
|---|---|---|
| 1 | Added a profiling step before rules | Published PaySim analyses report that `nameOrig` almost never repeats (VERIFY). If so, origin-history rules (R3 repeated amount, R4 velocity, R6 spike, R7 first transaction) will flag almost nothing, and R7 would flag almost everything because nearly every transaction is an origin's "first". Measure first, then keep, redefine on `nameDest`, or report them as not applicable. |
| 2 | R2 must be checked with a join count first | Analyses report that fraudulent TRANSFER destinations rarely or never reappear as CASH_OUT origins (VERIFY). If the join count is ~0, R2 is a **negative finding** worth reporting, not something to tune. |
| 3 | Added `tx_id` | The spec asked rules to return transaction ids, but the dataset has none. |
| 4 | R8 flagged as a possible simulator artefact | Destination balances of 0 before and after a credit are not a real-world fraud signal. If R8 performs well, LIMITS.md must say it probably exploits how the simulator writes balances. |
| 5 | Defined "prior" precisely for R6 | Order within a step is unknown, so "prior" means strictly earlier steps. Otherwise the same-step test is ambiguous. |
| 6 | Added "flag nothing" row and per-split fraud rate | Makes the accuracy trap concrete, and shows whether the test split is comparable. |
| 7 | Stated step = 1 hour | So that 24-step windows read as one day in the README. |
