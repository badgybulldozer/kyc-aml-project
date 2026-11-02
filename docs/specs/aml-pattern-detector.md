# Project: aml-pattern-detector (IBM AMLworld), spec v2

> v2 keeps the original goal and hard rules. The **Changes from v1** section lists every correction and why. Items marked VERIFY must be checked against the data, the Kaggle page or the paper before they are relied on.
>
> The browser version of the typology detectors runs live on the website (Typology Graph Lab) on a small synthetic network. Its numbers are **not** AMLworld numbers.

## Goal
Reproduce a documented graph-feature gradient-boosting baseline on IBM's synthetic AML dataset. Report minority-class F1, precision, recall and per-pattern recall, and explain where and why it fails.

## Data
- Dataset: IBM "Transactions for Anti-Money Laundering" (Kaggle, ealtman2019). Use HI-Small. Download manually to `data/raw/` (gitignored).
- Licence: check the Kaggle page (CDLA-Sharing-1.0 at the time of research; VERIFY) and record it in LIMITS.md.
- Files (VERIFY): `HI-Small_Trans.csv`, `HI-Small_Patterns.txt`.
- Expected columns (VERIFY): Timestamp, From Bank, Account, To Bank, Account, Amount Received, Receiving Currency, Amount Paid, Payment Currency, Payment Format, Is Laundering.
  - The header has **two columns called `Account`**. pandas renames the second to `Account.1`, DuckDB to `Account_1`. Rename both at load: `from_account`, `to_account`.
  - Account ids may only be unique within a bank (VERIFY). Use node key = `(bank, account)` everywhere.
- Expected size (VERIFY): about 5M transactions, about 1 laundering transaction per 981.
- The data is synthetic. Say so in the README.

## Hard rules
- Do NOT use account ids as model features. Use them only to build graph features.
- Do NOT copy or import IBM's Graph Feature Preprocessor (proprietary licence). Re-implement the documented typologies yourself.
- Temporal split 60/20/20 on Timestamp. Never shuffle. **No timestamp may appear on both sides of a boundary**: move the cut to the next distinct timestamp.
- No leakage: every feature for a transaction at time t uses only transactions with timestamp < t. Same-timestamp transactions are excluded, and this is stated in the README. Test it.

## Stack
Python 3.11, DuckDB for loading and windowed counts, NetworkX optional for cycle checks, LightGBM, scikit-learn metrics, SHAP or built-in importance, Streamlit optional, pytest. Ask before adding dependencies.

## Repo layout
data/ (gitignored), src/load.py, src/features_tx.py, src/features_graph.py, src/split.py, src/patterns.py, src/train.py, src/evaluate.py, src/narrative.py, tests/, results/, README.md, decisions.md, LIMITS.md, Makefile

## Features
Per transaction: amount (both sides), currency mismatch, payment format, hour of day, bank pair, self-transfer flag (from = to).

Per account (node key = bank + account), computed on prior data only:
- in-degree, out-degree, distinct counterparties (in and out)
- total in and out amount; in/out amount ratio
- reciprocity: counterparties that both sent to and received from this account
- burst: transaction count in rolling 1-hour and 1-day windows
- fan-in and fan-out: distinct counterparties in a rolling window
- scatter-gather: sends to many accounts, which then send to one account within a window
- cycle closure: a time-respecting path of 2–4 hops returns to the origin within the window. The data contains cycles of up to 10 hops (VERIFY), so report recall by hop length.

Amounts: when paid and received currencies differ, keep both and add a `fx_mismatch` flag. Do not convert with outside FX rates.

## Pattern labels
- Parse `HI-Small_Patterns.txt` into (attempt_id, typology, transactions) and join on all transaction columns.
- **Report coverage**: what share of `Is Laundering = 1` rows match a pattern attempt (VERIFY: the file may not cover every laundering row). Per-pattern recall uses matched rows only. Report unmatched laundering rows as their own group.
- Expected typologies (VERIFY): FAN-OUT, FAN-IN, CYCLE, GATHER-SCATTER, SCATTER-GATHER, STACK, BIPARTITE, RANDOM. The features above do not target STACK, BIPARTITE or RANDOM, so expect low recall there and say so.

## Models (train on 60%, tune on 20%, report the last 20% once)
1. Rule baseline: one threshold on fan-in or burst, whichever is better on validation
2. GBDT on transaction features only
3. GBDT on transaction + graph features (main model)

Use `scale_pos_weight` (or class weights) for every model and record all hyperparameters. Choose the decision threshold on validation, not test.

## Metrics
- Minority-class precision, recall, F1 (primary); PR-AUC
- Alerts per 1,000 transactions at the reported operating point
- Per-pattern recall by typology, plus recall by cycle hop length
- Confusion matrix

## Reproduction check
Compare the main model's minority-class F1 with the figure in Altman et al., *Realistic Synthetic Financial Transactions for Anti-Money Laundering Models* (NeurIPS 2023 Datasets & Benchmarks) or its supplement. VERIFY the exact figure and the split the paper used before quoting either. Report measured value and gap. Never claim a match unless it is measured.

## Explainability and narrative
- Feature importance for the main model in `results/`.
- `narrative.py`: for three flagged accounts chosen by the script (e.g. top score per typology), write a one-page SAR-style narrative: who, what, when, pattern, red flags, what would verify it.

## Acceptance criteria
- `make all` reproduces every table and figure from raw data.
- Tests: feature functions on hand-built graphs (fan-in, reciprocity, a 3-hop cycle, a 5-hop cycle that must *not* be found with max 4 hops); a no-leakage test (adding a future transaction must not change any past feature); a split test asserting no timestamp overlap.
- README: summary, results table pasted from `results/`, measured-vs-published comparison, the most useful finding in plain words.
- LIMITS.md: synthetic data and simulator assumptions; licence; cycle hop limit; pattern-file coverage; false-positive cost; real-world detection rates (see Change 8).
- decisions.md: every AI-suggested change, with how it was verified.

## Guardrails for Claude Code
- Never type a metric into the README. Generate it.
- If a feature changes a result by more than 5 points, add a test or a note explaining why before moving on.
- If training takes longer than 20 minutes, subsample negatives for development only and say so. Final numbers use the full data.
- Stop and ask if the licence text or column names differ from this spec.

---

## Changes from v1

| # | Change | Why |
|---|---|---|
| 1 | Rename the duplicate `Account` columns at load | `Account.1` only exists in pandas. DuckDB calls it `Account_1`, so code written against the v1 spec breaks depending on the loader. |
| 2 | Node key = (bank, account) | If account ids repeat across banks, graph features would merge different customers. |
| 3 | Split boundaries on distinct timestamps | Many transactions share a timestamp. A cut through a timestamp leaks the same moment into two splits. |
| 4 | "Prior" excludes same-timestamp rows, and this is tested | Makes the no-leakage rule precise and testable. |
| 5 | Pattern-file coverage reported | Per-pattern recall is meaningless if part of the laundering rows has no pattern label. |
| 6 | Expect low recall on STACK / BIPARTITE / RANDOM | None of the planned features targets them. Saying so up front is part of "explain where it fails". |
| 7 | Added self-transfer flag and FX-mismatch handling | Self-transfers would inflate degree counts, and outside FX rates would be an unrecorded assumption. |
| 8 | Replaced the "2% of illicit flows detected" line | I could not trace that figure. The widely cited UNODC (2011) estimate is that well under 1% of criminal proceeds are seized or frozen (VERIFY before quoting). LIMITS.md should cite a source or drop the number. |
| 9 | Threshold chosen on validation | v1 did not say where the decision threshold comes from. Choosing it on test would leak. |
