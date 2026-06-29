# MoneyApp — System Review & Forecasting Strategy

*Prepared 2026-06-28. Based on a full read of the codebase, the 2026-06-28 account backup, and the bank statement set (AIB Kene, AIB Joint, Revolut).*

---

## 1. What you've actually built (honest read)

You have a **monthly ledger app** for a two-person household (Kene + Havilah), spanning AIB Kene, AIB Joint, and Revolut. The real shape of your money, from the data:

| Month | Income | Budgeted | Spent | Notes |
|---|---|---|---|---|
| Feb 2026 | 8,021 | 4,364 | **9,364** | Overspent vs income |
| Mar 2026 | 8,217 | 4,952 | 4,596 | Healthy |
| Apr 2026 | 9,213 | 5,907 | 5,874 | Healthy |
| May 2026 | 11,350 | 6,338 | 7,298 | Healthy |
| Jun 2026 | 12,532 | 3,694 | 0 | Active — spending not yet logged |
| Jul 2026 | **0** | 3,783 | 2,247 | Future — no income → forecast shows −3,783 |

Income is irregular and multi-source (two salaries, family transfers, "Other"), €8k–12.5k/month. Fixed master budgets total ~€3.9k (Rent 2,067, Food 400, Transport 350, Therapy 316, etc.). You log expenses by hand — **182 of them**, zero marked recurring, even though you maintain **65 subscriptions**.

### What works
- Clean service-layer architecture, RLS, triggers maintaining computed balances. Solid foundation.
- Master budgets → per-month budgets is a good "template → instance" pattern.
- Transfers table as single source of truth for goal movements is the right call.
- Subscriptions + month_subscriptions snapshotting is sensible.

### The core problem
**You have a rear-view mirror, not a windshield.** Every primitive in the app describes the past or the present month. There is no engine that projects *forward*. Proof:

- The **"Forecast" page is not a forecast.** It's a list of life-event cards (baby 👶, house 🏠, car 🚗) with one-time/recurring cost fields. Nothing computes a month-by-month balance. [forecast/page.tsx](src/app/(dashboard)/forecast/page.tsx)
- July 2026 shows `income = 0, unallocated = −3,783`. The app can't project income into a month that hasn't happened, so any future month looks insolvent. That's the symptom of a missing projection layer.

Everything else below flows from fixing that one thing.

---

## 2. The three problems to attack

1. **No forward projection.** No "what will my balances be on 15 Aug / 30 Sep / 31 Dec?"
2. **Manual entry is the bottleneck.** 182 hand-typed rows; 0 recurring flags; bank names inconsistent (`Revolut`, `Revolut Kene`, `AIB`, `AIB Kene` all coexist). Daily/weekly entry is friction → entry lapses → data rots → forecast can't be trusted.
3. **No reconciliation.** You have real bank statements (PDF/CSV/photos) sitting in `bank_statements/`, never reconciled against what's in the app. So you never know if the app matches reality.

---

## 3. The mental model fix (most important section)

Reframe the whole system around **three layers**:

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 3 — PROJECTION  (the windshield, NEW)                 │
│  Recurring rules + planned events → balance curve, 12mo out  │
│  "Will we be OK in October? What if the baby comes in Sept?" │
└─────────────────────────────────────────────────────────────┘
              ▲ feeds on rules + actuals
┌─────────────────────────────────────────────────────────────┐
│  LAYER 2 — PLAN  (templates, mostly exists)                  │
│  Master budgets, subscriptions, recurring income rules       │
│  "What SHOULD happen every month"                            │
└─────────────────────────────────────────────────────────────┘
              ▲ instantiated into months
┌─────────────────────────────────────────────────────────────┐
│  LAYER 1 — ACTUALS  (ledger, exists & solid)                 │
│  Expenses, income_sources, transfers, per-month budgets      │
│  "What DID happen"  ← reconciled against bank statements     │
└─────────────────────────────────────────────────────────────┘
```

The insight: **today you only have Layers 1 and 2, and Layer 2 leaks.** A recurring subscription lives in Layer 2 but you re-type it as an expense in Layer 1 every month (hence 65 subs but 0 recurring expenses). Fix the layering and the forecast becomes almost free — it's just "replay the rules forward."

---

## 4. Daily/weekly workflow — make entry frictionless

You said you put info in daily and weekly. That cadence only survives if entry takes seconds. Target workflows:

### Daily (30 seconds) — "Quick Add"
One global `+` button → amount, category (smart-default to last used), bank (default to your most-used per category), date (default today). Nothing else. Save. Mass of your 182 expenses fit this.

### Weekly (5 minutes) — "Reconcile"
Import the week's Revolut CSV / AIB statement → app auto-matches rows to expenses you already logged, flags unmatched bank rows ("you spent €34 at Tesco, not logged — add?"), flags app rows with no bank match ("did this actually happen?"). One screen, swipe to confirm. This is where the bank_statements folder finally earns its keep.

### Monthly (10 minutes) — "Roll forward"
"Start next month" button clones recurring income rules + subscriptions + master budgets into a fresh month, pre-filled. You only adjust deltas.

**Principle:** never type what the app can derive. A €2,067 rent payment on the 1st should *appear*, not be typed.

---

## 5. Schema additions (the forecast engine)

Three new tables turn the rear-view app into a forward one. SQL sketches — adapt names to your conventions.

### 5a. `recurring_rules` — the heartbeat of money
Replace "re-type the subscription as an expense each month" with a rule the engine replays.

```sql
create table recurring_rules (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id),
  kind            text not null check (kind in ('income','expense','transfer')),
  label           text not null,                 -- 'Rent', 'Salary Kene', 'Spotify'
  amount          numeric(12,2) not null,
  -- scheduling
  rrule           text not null,                 -- iCal RRULE: 'FREQ=MONTHLY;BYMONTHDAY=1'
  next_date       date not null,                 -- denormalised for fast projection
  start_date      date not null,
  end_date        date,                          -- null = open-ended
  -- routing
  bank            text,                           -- normalised (see §7)
  master_budget_id uuid references master_budgets(id),
  person          text,
  -- modelling
  variability     numeric(4,3) default 0,        -- 0=fixed (rent), 0.3=groceries swing
  is_essential    boolean default false,
  confidence      text default 'high',           -- high/med/low for forecast bands
  created_at      timestamptz default now()
);
```

Your 65 subscriptions and your two salaries become rows here. Master budgets like Food/Transport become rules with `variability > 0`. This single table is what the projection loops over.

### 5b. `account_balances` — anchor the projection to reality
A forecast is worthless without a starting balance. Snapshot each account when you reconcile.

```sql
create table account_balances (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id),
  bank        text not null,                     -- 'AIB Kene','AIB Joint','Revolut Kene'
  balance     numeric(12,2) not null,
  as_of       date not null,
  source      text default 'manual',             -- 'manual' | 'statement_import'
  created_at  timestamptz default now(),
  unique (user_id, bank, as_of)
);
```

### 5c. `forecast_snapshots` — cache the projected curve (optional)
The engine can run on the fly, but caching lets you compare "what I predicted in June" vs "what actually happened in August."

```sql
create table forecast_snapshots (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  generated_at  timestamptz default now(),
  horizon_end   date not null,
  scenario      text default 'base',             -- 'base','baby-sept','car-replace'
  curve         jsonb not null,                  -- [{date, projected_balance, lo, hi, events[]}]
  assumptions   jsonb                            -- income growth %, inflation, etc.
);
```

### 5d. Reuse what you have for scenarios
Your existing `life_events` table is already a scenario input — one-time cost/income + recurring monthly change. The forecast engine just needs to *consume* it. No new table needed; wire it into the projection (§6).

---

## 6. The forecast engine (the windshield)

Pure function, no DB writes. Lives in `src/lib/forecast/`. Algorithm:

```
project(fromDate, horizonMonths, scenario):
  balances = latest account_balances           # anchor to reality
  curve = []
  for each day from fromDate to fromDate+horizon:
    for rule in recurring_rules where next occurrence == day:
      balances[rule.bank] += signed(rule.amount)
    for event in life_events where impact lands on day:
      apply one-time cost/income + start/stop recurring change
    if day is a snapshot point (week/month end):
      lo, hi = apply variability bands (±variability × amount, compounded)
      curve.push({ day, total: sum(balances), lo, hi, perBank: balances })
  return curve
```

Visualised:

```
Balance
 €25k ┤                                   ╭──── optimistic (low-spend)
 €20k ┤                          ╭────────┤
 €15k ┤             ╭────────────┤        ╰──── base
 €10k ┤  ╭──────────┤            ╰──── pessimistic
  €5k ┤──┤          ▼ baby (one-time −4k, +250/mo)
  €0  ┼──┴──────────────────────────────────────►
     Jun  Jul  Aug  Sep  Oct  Nov  Dec  Jan  Feb
```

Outputs you've been missing:
- **Runway / lowest point**: "your tightest day is 28 Sep at €3,140 — don't commit the car deposit before then."
- **Scenario toggles**: flip the baby life-event on/off, see the curve move.
- **Confidence bands**: fixed costs (rent) are certain; groceries swing — show a cone, not a false-precision line.
- **Per-account view**: Revolut might dip negative even while the total looks fine.

---

## 7. Data hygiene — non-negotiable before forecasting

Garbage rules → garbage forecast. Fix these first:

1. **Normalise bank names.** Today: `Revolut`, `Revolut Kene`, `AIB`, `AIB Kene`, `AIB Joint`, `Revolut Havilah`, `Other` all coexist. Pick a canonical set (`AIB Kene`, `AIB Joint`, `Revolut Kene`, `Revolut Havilah`) and migrate. Drive every dropdown from one `app_settings` source so new typos can't appear.
2. **Backfill recurring.** 0 of 182 expenses are flagged recurring. Convert the genuinely-recurring ones into `recurring_rules` and stop re-typing them.
3. **Reconcile once, fully.** Import all statements through June, snapshot each account's true balance into `account_balances`. That's your forecast's anchor point. Without it the projection floats.

---

## 8. Three strategies to attack this (pick one)

### Strategy A — "Forecast-first" (highest value, most work)
Build §5 + §6 now. Ship the projection engine, recurring rules, account balances. Biggest payoff (you finally see the windshield) but ~2–3 focused sessions. **Recommended if forecasting is the whole reason you're asking.**

### Strategy B — "Hygiene-first" (de-risk, then forecast)
Do §7 only this week: normalise banks, migrate subscriptions → recurring rules, reconcile balances. *Then* the forecast engine is a small follow-on because the data is clean. Lower risk, slightly slower to the payoff. **Recommended if the data mess worries you.**

### Strategy C — "Entry-first" (fix the cadence so data stops rotting)
Build the Quick-Add + weekly statement reconcile (§4) before anything else. Solves the root cause — entry friction — so the dataset stays trustworthy enough to forecast on later. **Recommended if you keep falling behind on daily entry.**

> My pick: **B → A**. One week of hygiene, then the engine. C's Quick-Add is a quick win to slot in alongside.

---

## 9. Concrete roadmap

**Week 1 — Hygiene (Strategy B)**
- [ ] Migration: canonical bank names + backfill existing rows.
- [ ] Migration: `account_balances`, `recurring_rules` tables.
- [ ] Convert 65 subscriptions + 2 salaries + master budgets → `recurring_rules`.
- [ ] Reconcile Jan–Jun statements; snapshot true balances per account.

**Week 2 — Engine (Strategy A)**
- [ ] `src/lib/forecast/project.ts` — pure projection function + unit tests.
- [ ] Rebuild `/forecast` into a real balance chart with scenario toggles (keep life-events as scenario inputs).
- [ ] "Lowest point / runway" callout.

**Week 3 — Cadence (Strategy C)**
- [ ] Global Quick-Add (30-second daily entry).
- [ ] Weekly statement import + auto-match reconcile screen.
- [ ] "Roll forward to next month" one-click.

**Ongoing**
- [ ] Forecast-vs-actual: each month, compare last month's snapshot to reality; tune `variability`.

---

## 10. Schema at a glance (target state)

```
                 ┌──────────────────┐
                 │  recurring_rules │  (NEW — Layer 2 heartbeat)
                 │  income/expense/ │
                 │  transfer + RRULE│
                 └────────┬─────────┘
        replay forward    │   instantiate monthly
        ┌─────────────────┼──────────────────┐
        ▼                 ▼                  ▼
┌───────────────┐  ┌─────────────┐   ┌──────────────────┐
│ forecast      │  │ monthly_    │   │ expenses /       │
│ engine (§6)   │  │ overviews + │   │ income_sources / │
│ → curve       │  │ budgets     │   │ transfers (L1)   │
└──────┬────────┘  └─────────────┘   └────────┬─────────┘
       │ anchored by                          │ reconciled vs
       ▼                                       ▼
┌──────────────────┐                  ┌────────────────────┐
│ account_balances │◄─────────────────│ bank_statements    │
│  (NEW — anchor)  │   import+match    │  (PDF/CSV/photos)  │
└──────────────────┘                  └────────────────────┘
                ▲
        ┌───────┴────────┐
        │  life_events   │  (EXISTS — scenario inputs to engine)
        └────────────────┘
```

---

## TL;DR

You built a solid **ledger**. You're missing the **projection layer**. Three new tables (`recurring_rules`, `account_balances`, `forecast_snapshots`) plus one pure `project()` function turn "what happened" into "what will happen." But clean the data first — normalise banks, convert subscriptions to recurring rules, reconcile real balances — or the forecast will lie to you. Do hygiene (Week 1), engine (Week 2), faster entry (Week 3).
