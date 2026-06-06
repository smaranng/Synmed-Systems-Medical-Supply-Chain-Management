# Updated Procurement Agent

## 1. Purpose

This document describes the procurement agent exactly as it is currently implemented in the project.

It keeps only the latest live features and supporting analysis modules. It does not describe older intermediate designs as if they were still active.

It also separates:

- production features that are currently active in the application
- analysis baselines that exist only for validation and comparison


## 2. Current System Identity

The procurement subsystem is now implemented as a:

`safe + optimal + multi-cycle procurement decision engine`

Its live decision policy combines:

1. Stockout risk detection
2. Priority scoring
3. Cost-aware selection
4. Multi-cycle budget allocation
5. 0/1 knapsack optimization inside each cycle

The current live pipeline is:

`Forecast -> Inventory Policy / ROP -> Reorder Candidates -> Supplier / Cost Resolution -> Hybrid Procurement Optimization -> API -> Dashboard`

Important scope clarification:

- `Greedy` is not the live production allocator
- `single-pass monthly knapsack-only` is not the live production allocator
- the live production allocator is the hybrid multi-cycle risk-aware knapsack system


## 3. What Has Not Been Changed

The procurement upgrade was implemented on top of the existing AI and inventory stack.

The following core logic remains unchanged:

- forecasting models
- safety stock logic
- reorder point logic
- reorder flag generation
- order quantity generation

This means the procurement layer consumes existing outputs rather than rewriting the upstream forecasting or inventory models.


## 4. Current Backend Features

### 4.1 Pharmacy Config Loading

The live procurement configuration is stored in:

`backend/data/pharmacy_config.json`

Current supported config fields:

```json
{
  "pharmacy_id": "PH001",
  "monthly_budget": 50000,
  "order_cycles": 3
}
```

This config is loaded and validated by:

`backend/app/services/pharmacy_config_service.py`

Implemented behavior:

- validates `pharmacy_id`
- validates `monthly_budget`
- validates `order_cycles`
- exposes config to the procurement pipeline


### 4.2 Reorder-Only Candidate Filtering

The procurement optimizer only works on medicines that already satisfy:

`reorder == True`

This is important because the optimizer should not spend budget on medicines that are not under reorder pressure.


### 4.3 Priority Score Computation

Each reorder medicine receives a computed priority score using the implemented formula:

```text
shortage_ratio = (ROP - current_stock) / ROP
demand_ratio = forecast / average_demand
lead_time_factor = lead_time / max_lead_time

priority_score =
0.5 * shortage_ratio +
0.3 * demand_ratio +
0.2 * lead_time_factor
```

Priority classes are currently assigned as:

- `HIGH` if `priority_score >= 0.7`
- `MEDIUM` if `0.4 <= priority_score < 0.7`
- `LOW` otherwise


### 4.4 Stockout Risk Detection

The current system computes stockout risk for every reorder medicine:

```text
daily_demand = forecast / 30
days_to_stockout = current_stock / daily_demand

is_critical = days_to_stockout <= lead_time
```

This produces a live boolean field:

`is_critical`

That field is used by the hybrid allocator to protect high-risk medicines before normal optimization runs.


### 4.5 Cost Awareness

The live procurement layer computes:

```text
cost = order_quantity * price_per_unit
```

`price_per_unit` comes from supplier / distributor data already resolved by the procurement engine.


### 4.6 Multi-Cycle Budget Allocation

The current live system uses:

```text
budget_per_cycle = monthly_budget / order_cycles
```

Internally, budget is split in cents across cycles so the sum of cycle budgets remains consistent with the monthly budget.

This means the procurement agent no longer behaves like a single-pass monthly selector only. It now stages procurement decisions across configured order cycles.


### 4.7 Hybrid Selection Logic

The live production allocator is implemented in:

`backend/app/services/procurement_decision_service.py`

Its current decision sequence is:

1. Build reorder candidates with priority, cost, lead time, and criticality.
2. For each cycle:
   - select critical medicines first if they fit in the cycle budget
   - apply 0/1 knapsack on the remaining medicines and remaining cycle budget
3. Mark all unselected medicines as skipped

Current decision reasons used by the live system:

- `CRITICAL`
- `KNAPSACK`
- `SKIPPED`


### 4.8 Live API Output

The current procurement API returns a payload shaped around decisions rather than old selected / non-selected lists.

Live top-level fields include:

- `pharmacy_id`
- `monthly_budget`
- `order_cycles`
- `budget_per_cycle`
- `decisions`
- `cycle_summaries`
- `total_cost_used`
- `total_priority_achieved`

Each decision currently includes fields such as:

- `medicine_id`
- `medicine_name`
- `reorder`
- `priority`
- `priority_score`
- `is_critical`
- `selected_for_order`
- `order_cycle`
- `reason`
- `cost`
- `order_quantity`
- `lead_days`
- `price_per_unit`
- `forecast_quantity`
- `average_demand`
- `current_stock`
- `reorder_point`
- `daily_demand`
- `days_to_stockout`
- `trigger_reason`


### 4.9 Live Reasoning Stream

The procurement streaming layer now reasons over the hybrid context, not the older monthly knapsack-only view.

Current reasoning context includes:

- cycle budgets
- decision counts
- critical medicine counts
- selected / skipped decisions
- total cost used
- total priority achieved

This is implemented in:

`backend/app/services/procurement_service.py`


## 5. Current Frontend Features

The current procurement dashboard is aligned to the hybrid API shape.

Implemented frontend features:

- renders the `decisions` list directly
- shows only reorder medicines
- displays status as:
  - `Critical`
  - `Selected (Optimal)`
  - `Skipped`
- shows `Order Cycle`
- shows `Days to Stockout`
- shows priority badge and score
- highlights selected and critical rows differently
- shows cycle summaries
- shows hybrid summary cards
- parses and displays streamed reasoning steps

Key files:

- `frontend/src/api/api.ts`
- `frontend/src/pages/ProcurementPage.tsx`
- `frontend/src/components/ProcurementTable.tsx`
- `frontend/src/components/ProcurementSummaryCards.tsx`
- `frontend/src/components/AgentStep.tsx`


## 6. Current Analysis and Proof Tooling

The project now includes dedicated validation and simulation modules for the procurement agent.

### 6.1 Validation Module

Implemented at:

`backend/analysis/validation_tests.py`

Current validation coverage:

- small controlled knapsack proof against brute force
- critical medicine protection test
- live-data budget constraint test
- multi-cycle behavior test

Generated output:

`backend/analysis/validation_report.md`


### 6.2 Simulation and Visualization Module

Implemented at:

`backend/analysis/simulation.py`

Current simulation coverage:

- Greedy baseline for comparison only
- Knapsack baseline for comparison only
- Hybrid production allocator as the live system
- budget sweep across:
  - `10000`
  - `20000`
  - `30000`
  - `40000`
  - `50000`

Generated outputs:

- `backend/analysis/simulation_report.md`
- plot images in `backend/analysis/plots/`

Current plot set:

- budget vs priority
- stockout risk
- budget utilization
- efficiency ratio


### 6.3 Reproducibility Support

The simulation pipeline now persists a live computed snapshot at:

`backend/analysis/simulation_input_snapshot.json`

This keeps repeated simulation runs stable unless the snapshot is explicitly refreshed.


## 7. File Map of the Current Procurement System

### Backend

- `backend/data/pharmacy_config.json`
- `backend/app/services/pharmacy_config_service.py`
- `backend/app/services/procurement_decision_service.py`
- `backend/app/services/procurement_service.py`

### Frontend

- `frontend/src/api/api.ts`
- `frontend/src/pages/ProcurementPage.tsx`
- `frontend/src/components/ProcurementTable.tsx`
- `frontend/src/components/ProcurementSummaryCards.tsx`
- `frontend/src/components/AgentStep.tsx`

### Analysis

- `backend/analysis/validation_tests.py`
- `backend/analysis/validation_report.md`
- `backend/analysis/simulation.py`
- `backend/analysis/simulation_report.md`
- `backend/analysis/simulation_input_snapshot.json`
- `backend/analysis/plots/`


## 8. Current Behavioral Summary

As of the current implementation, the procurement agent does all of the following:

- reads pharmacy-level budget and cycle configuration
- takes only reorder-required medicines
- computes priority scores from live inventory and demand context
- computes stockout risk and marks critical medicines
- resolves procurement cost using supplier pricing
- allocates budget across multiple cycles
- protects critical medicines before standard optimization
- applies knapsack optimization on the remaining cycle budget
- returns decision reasons and cycle assignments
- exposes the result through API and dashboard
- supports validation and simulation analysis modules

What the live system does not do anymore:

- it does not use greedy budget selection as the production decision rule
- it does not optimize as one single monthly selection pass only
- it does not ignore stockout-critical medicines during budget allocation


## 9. Current System Definition

The latest implemented procurement agent in this project is not just a budget filter and not just a monthly knapsack selector.

It is currently implemented as a:

`hybrid risk-aware multi-cycle procurement optimization system`

That is the correct description of the live project state.
