# Improved Procurement Agent

## 1. Purpose of This Document

This document explains the latest improvements made to the pharmacy procurement agent and the procurement decision layer around it. It is intentionally detailed. The goal is not only to record what changed, but also to justify why those changes were necessary from business, algorithmic, and engineering perspectives.

The procurement subsystem has evolved from a basic supplier recommendation flow into a more disciplined, budget-aware, mathematically optimized procurement engine. The latest version is no longer just asking:

`"Which medicines need reordering, and which supplier should provide them?"`

It is now asking:

`"Given reorder pressure, supplier-linked costs, and a real pharmacy budget, what is the optimal set of medicines to procure right now?"`

That is a major shift in system maturity.


## 2. Executive Summary of the Improvements

The latest procurement-agent improvements can be grouped into eight major areas:

1. The procurement layer was made **configuration-driven** through `backend/data/pharmacy_config.json`.
2. The agent was constrained to operate only on **true reorder candidates**, rather than the full medicine catalog.
3. A **priority scoring framework** was introduced so medicines could be ranked using business-relevant operational pressure.
4. The system became **cost-aware** by explicitly linking procurement quantity to supplier pricing.
5. The previous **greedy budget allocation** approach was replaced with a **0/1 knapsack dynamic programming optimizer**.
6. The API, reasoning stream, and frontend dashboard were updated so the optimal procurement set is visible, explainable, and auditable.
7. The procurement analysis layer was strengthened with a **simulation and visualization harness** to demonstrate the value of knapsack over greedy selection.
8. The development environment was made more reliable through **interpreter alignment and headless plotting hardening**, so analytics and procurement validation run consistently.

Together, these changes move the procurement system from a heuristic recommender to a deterministic optimization engine.


## 3. What Was Intentionally Not Changed

An important design principle in these improvements was to avoid destabilizing the existing forecasting and inventory logic.

The following core AI logic was intentionally preserved:

- Demand forecasting models were not changed.
- Inventory formulas for safety stock, reorder point, reorder flag, and order quantity were not changed.
- Existing supplier filtering and supplier selection logic in the deterministic procurement engine was not replaced.

This matters because the procurement optimizer should sit **on top of** validated upstream outputs, not interfere with them.

Architecturally, the current pipeline remains:

`forecasting -> inventory policy -> reorder request generation -> supplier selection -> procurement optimization`

That separation keeps the system modular and makes the new optimization layer easier to trust.


## 4. Why the Procurement Agent Needed Improvement

Before these improvements, the procurement flow was useful but limited.

### 4.1 Earlier limitations

The earlier procurement logic could identify reorder medicines and connect them to supplier information, but it had important shortcomings:

- It did not explicitly model a pharmacy’s budget as a first-class constraint.
- It could recommend orders without proving that the final selection was globally optimal under the budget.
- A greedy selector can make locally attractive choices that are globally inferior.
- The response was more supplier-oriented than decision-theoretic.
- The UI showed procurement rows, but not a clear distinction between:
  - medicines selected optimally
  - medicines skipped because of budget

### 4.2 Why greedy allocation was not enough

Greedy allocation is easy to implement but not guaranteed to maximize total procurement value under a fixed budget. In this system, “value” is represented by the medicine’s computed `priority_score`.

A greedy method can fail whenever:

- one expensive medicine has a high individual score, but
- two medium-cost medicines together produce a higher total score within the same budget.

That is the classical reason for using knapsack optimization instead of greedy selection.

The system therefore needed to move from:

`"Pick the next best-looking medicine until budget runs out"`

to:

`"Search the feasible decision space and choose the set that maximizes total priority under the budget constraint"`


## 5. High-Level Architecture After the Improvement

The improved procurement-agent architecture now looks like this:

1. Inventory logic produces reorder-needed medicines.
2. Procurement logic resolves supplier-linked price and lead-time data.
3. The optimization layer constructs medicine candidates with:
   - priority score
   - order quantity
   - price per unit
   - total cost
4. A 0/1 knapsack solver selects the optimal subset under the monthly budget.
5. The API exposes:
   - selected medicines
   - non-selected medicines
   - total cost used
   - total priority achieved
6. The frontend renders the result as an optimal-vs-skipped procurement decision surface.

This turns the procurement agent into a proper decision-support engine rather than a simple list generator.


## 6. Detailed Improvement Breakdown

## 6.1 Configuration-Driven Pharmacy Constraints

### What was added

A pharmacy configuration file was added at:

`backend/data/pharmacy_config.json`

with fields like:

```json
{
  "pharmacy_id": "PH001",
  "monthly_budget": 50000,
  "order_cycles": 3
}
```

A dedicated loader was also introduced in:

`backend/app/services/pharmacy_config_service.py`

### Why this was done

Without external configuration, procurement constraints tend to become hardcoded or scattered across service logic. That is bad for maintainability and bad for realism.

Real pharmacies differ in:

- procurement budgets
- procurement cadence
- operational identity

By loading procurement constraints from configuration:

- the system becomes more realistic
- the optimizer can respond to business policy without code edits
- the procurement engine becomes reusable across pharmacies

### Design rationale

This improvement separates:

- **business configuration**
from
- **algorithmic logic**

That is a strong systems-engineering decision because budgets and pharmacy identity change more often than optimization code.

### Note about `order_cycles`

The config still retains `order_cycles` because it was part of the earlier budget-aware procurement enhancement. However, the latest knapsack optimization uses `monthly_budget` as the active optimization constraint, because that is what the current objective requires:

`maximize total priority score subject to total cost <= monthly_budget`

Keeping `order_cycles` in config is still useful for future execution scheduling or operational release planning, even though it is not part of the current knapsack objective.


## 6.2 Restricting the Procurement Agent to True Reorder Candidates

### What changed

The optimizer only considers medicines where:

`reorder == True`

This filtering is inherited from the inventory-policy output.

### Why this was done

Optimization must not be performed on the entire catalog if only a subset is operationally relevant.

Including non-reorder medicines would create three problems:

1. It would waste compute on irrelevant items.
2. It would blur the meaning of procurement priority.
3. It would allow the optimizer to “spend” budget on medicines that are not actually under reorder pressure.

### Design rationale

This improvement preserves semantic consistency:

- forecasting decides future demand
- inventory decides reorder necessity
- procurement optimization decides what subset to fund

That layering is correct. Procurement should optimize **within the reorder set**, not redefine the reorder set.


## 6.3 Introduction of Priority Scoring

### What changed

Each reorder medicine now receives a computed `priority_score` based on three operational signals:

```text
shortage_ratio = (ROP - current_stock) / ROP
demand_ratio = forecast / average_demand
lead_time_factor = lead_time / max_lead_time

priority_score =
0.5 * shortage_ratio +
0.3 * demand_ratio +
0.2 * lead_time_factor
```

The priority class is then assigned as:

- `HIGH` if score >= 0.7
- `MEDIUM` if 0.4 <= score < 0.7
- `LOW` otherwise

### Why this was done

The reorder flag alone is too coarse. Two medicines can both need reorder, but one can be much more urgent than the other.

The new score was introduced to capture urgency more intelligently.

### Why these three signals matter

#### Shortage ratio

This measures how far below the reorder point the current stock has fallen.

Why it matters:

- it quantifies stock pressure directly
- it reflects immediate replenishment urgency
- it is more informative than a simple boolean reorder flag

#### Demand ratio

This compares forecast demand to the historical average demand.

Why it matters:

- it captures whether the medicine is entering a higher-than-normal demand period
- it helps distinguish routine reorder pressure from demand acceleration
- it injects forecast intelligence into procurement decisions without changing the forecast model itself

#### Lead-time factor

This normalizes the supplier’s lead time relative to the slowest lead time in the supplier pool.

Why it matters:

- a medicine with longer fulfillment delay should be treated with more urgency
- lead time is a real operational risk multiplier
- procurement decisions should reflect not just stock need, but replenishment latency

### Why the weighting scheme makes sense

The chosen weights are:

- shortage pressure: `0.5`
- demand pressure: `0.3`
- lead-time pressure: `0.2`

This weighting prioritizes direct stock risk first, demand trend second, and logistics delay third.

That is rational because:

- current shortage is the strongest signal of immediate operational risk
- forecast uplift matters, but less than actual stock deficiency
- lead time matters, but should usually not dominate inventory pressure

### Design rationale

The score creates a bridge between:

- inventory science
- forecasting intelligence
- procurement execution risk

This makes the procurement agent much more defensible in a technical review.


## 6.4 Explicit Cost Modeling Using Supplier Data

### What changed

For each reorder medicine, the system computes:

```text
cost = order_quantity * price_per_unit
```

where `price_per_unit` is taken from the selected supplier data resolved by the deterministic procurement engine.

### Why this was done

Budget optimization is impossible without costs.

Before this improvement, the procurement flow could talk about quantities and suppliers, but budget feasibility requires a monetary model.

By grounding cost in supplier price data:

- every candidate becomes financially meaningful
- the optimizer can enforce a real budget constraint
- the API becomes more useful for decision review and auditing

### Design rationale

This change ties the upstream supplier-selection layer to downstream optimization in a coherent way:

- supplier logic provides the commercial terms
- optimization logic decides whether the medicine can be funded

That is the right separation of concerns.


## 6.5 Transition from Greedy Allocation to 0/1 Knapsack Optimization

This is the most important improvement.

### What changed

The current selection logic in:

`backend/app/services/procurement_decision_service.py`

now uses a dynamic-programming knapsack solver instead of greedy allocation.

The active optimization problem is:

```text
maximize sum(priority_score_i * x_i)

subject to:
sum(cost_i * x_i) <= monthly_budget

x_i in {0, 1}
```

### Why this was done

This converts procurement selection into a mathematically well-defined optimization problem.

The system is no longer merely ranking medicines and taking them in order. It is solving for the best feasible subset.

### Why 0/1 knapsack is the correct formulation

Each medicine is treated as:

- either selected
- or not selected

That matches 0/1 knapsack exactly because:

- medicines are indivisible at the decision level in the current design
- the engine either funds a reorder candidate or does not
- fractional selection is not allowed

This is therefore not a heuristic analogy. It is a direct formulation fit.


## 6.6 Dynamic Programming Implementation Details

### Actual implementation approach

The code uses a memory-optimized 1D dynamic programming implementation with explicit backtracking support.

Key function:

`_solve_knapsack(...)`

in:

`backend/app/services/procurement_decision_service.py`

### Core logic

The classical recurrence is:

```text
dp[i][w] = max(
    dp[i-1][w],
    dp[i-1][w-cost_i] + priority_score_i
)
```

The implementation uses a 1D version:

```text
dp[w]
```

updated in descending budget order to preserve 0/1 semantics.

### Why 1D DP was used instead of a full 2D table

The user requirement allowed either:

- cost scaling
- or optimized 1D DP

The implementation uses both ideas together:

- 1D DP for memory efficiency
- adaptive scaling for large budgets

This is the correct engineering choice because a full 2D table can become unnecessarily expensive when budget resolution is large.

### How backtracking is preserved

Because plain 1D DP loses decision history, the implementation stores per-item take decisions in `take_rows`.

That allows the solver to reconstruct which medicines were selected after the DP pass completes.

This is important because optimization without recoverable decisions is not operationally useful. The business does not need only the objective value. It needs the medicine set.


## 6.7 Budget Scaling for Performance

### What changed

The implementation converts currency to cents and then adaptively scales if the DP budget would otherwise be too large.

Relevant ideas in the code:

- monetary values are converted to integer cents
- if the cent-level budget exceeds a threshold, costs are scaled
- scaled costs are computed using ceiling division

### Why this was done

Dynamic programming over raw budget values can become expensive if the budget is large.

For example:

- a budget of `50000.00`
- represented in cents
- becomes `5,000,000` units

That is unnecessarily large for a DP budget dimension.

### Why scaling is rational

Scaling preserves the structure of the optimization problem while reducing computational load.

The design goal is:

- keep the optimizer deterministic
- keep the solution budget-feasible
- prevent the DP state space from exploding

### Why ceiling division is used

Scaled costs are rounded upward rather than downward.

That is an important safety choice because it prevents the optimizer from accidentally selecting a set that would exceed the real budget after rescaling.

In other words:

- downward rounding risks infeasible real-world solutions
- upward rounding preserves feasibility

That is the correct bias for procurement systems.


## 6.8 Deterministic Backtracking and Stable Output Ordering

### What changed

After the DP pass:

- the best achievable priority is found
- the smallest budget achieving that best priority is chosen
- backtracking reconstructs the selected medicines
- results are then sorted deterministically for output

### Why this was done

Determinism is critical for procurement systems.

Two runs with the same inputs should produce the same result.

This matters for:

- auditability
- reproducibility
- debugging
- business trust

### Why deterministic tie-handling matters

Without stable tie behavior, the system could return different equally optimal sets across runs depending on iteration artifacts.

That would reduce stakeholder confidence.

The current design reduces that ambiguity by:

- using stable medicine ordering
- selecting the minimum budget state that achieves the best objective
- sorting final outputs consistently


## 6.9 New Procurement API Response Shape

### What changed

The procurement response is no longer shaped around “orders” alone. It is now shaped around the optimization result:

```json
{
  "pharmacy_id": "PH001",
  "monthly_budget": 50000,
  "selected_medicines": [...],
  "non_selected_medicines": [...],
  "total_cost_used": 12345.67,
  "total_priority_achieved": 8.9123
}
```

### Why this was done

This response format is closer to how decision-makers think.

The previous approach answered:

`"What rows exist?"`

The new approach answers:

`"What did the optimizer choose, what did it reject, how much budget was used, and what value was achieved?"`

That is much stronger for both operational and presentation purposes.

### Why split selected and non-selected medicines

This separation improves:

- decision transparency
- budget explanation
- UI rendering
- post-run analysis

Non-selected medicines are not useless output. They explain the cost of the budget constraint.


## 6.10 Rich Per-Medicine Output for Auditability

Each medicine record in the output includes operational and commercial context such as:

- `medicine_id`
- `medicine_name`
- `reorder`
- `priority`
- `priority_score`
- `selected_for_order`
- `cost`
- `order_quantity`
- `distributor_id`
- `distributor_name`
- `lead_days`
- `price_per_unit`
- `forecast_quantity`
- `average_demand`
- `current_stock`
- `reorder_point`
- `trigger_reason`

### Why this was done

An optimizer should not be a black box.

Stakeholders need to understand:

- why an item was urgent
- what it would cost
- which supplier assumptions were used
- why it was selected or skipped

This richer schema enables procurement review without requiring internal debugging or code inspection.


## 6.11 Procurement Reasoning Stream Improvement

### What changed

The procurement streaming service in:

`backend/app/services/procurement_service.py`

was updated so the reasoning context now reflects knapsack optimization rather than heuristic cycle allocation.

The LLM-visible reasoning now receives:

- monthly budget
- selected medicine set
- non-selected medicine set
- optimization totals
- supplier context

### Why this was done

The LLM layer should explain the actual deterministic decision process, not describe an outdated heuristic.

That matters because explanation quality must track decision quality.

### Design rationale

The LLM is still not the decision-maker.

That is deliberate.

The decision is made by deterministic code:

- reorder logic
- supplier logic
- knapsack optimizer

The LLM explains the result after the fact.

This keeps the procurement agent:

- auditable
- predictable
- explainable

That is a strong architecture choice for high-trust domains like pharmacy supply.


## 6.12 Frontend Dashboard Improvements

### What changed

The frontend procurement dashboard was updated to reflect optimal selection rather than heuristic ordering.

Important frontend changes include:

- rendering both selected and skipped medicines in one decision table
- adding clear status labels:
  - `Selected (Optimal)`
  - `Skipped (Budget Constraint)`
- preserving priority badges:
  - `HIGH` in red
  - `MEDIUM` in yellow
  - `LOW` in green
- highlighting selected rows
- updating summary cards to show:
  - number of selected medicines
  - number of skipped medicines
  - total cost used
  - total priority achieved

### Why this was done

An optimizer is only useful if stakeholders can understand its decisions quickly.

The dashboard needed to answer:

- what the model selected
- what it skipped
- how much budget was consumed
- what optimization value was achieved

The older table was closer to a procurement listing. The new table is a procurement decision interface.

### Why the status language matters

Words like:

- `Selected (Optimal)`
- `Skipped (Budget Constraint)`

are stronger than vague “selected” flags because they explain *why* the state exists.

That improves human trust and reduces ambiguity.


## 6.13 Engineering Hardening Around the Procurement Agent

Although not the main algorithmic change, a few engineering-level improvements were also important.

### Optional dependency hardening

The procurement service was adjusted so optional packages such as `groq` and `python-dotenv` do not break deterministic procurement payload generation at import time when they are unavailable.

### Why this was done

The procurement agent should not fail to produce deterministic optimization results just because the reasoning or environment helper layer is unavailable.

This separates:

- core decision logic
from
- optional integration conveniences

### Python compatibility hardening

A Python 3.10-style union annotation was replaced with `typing.Union` for broader interpreter compatibility.

### Why this matters

Procurement logic should fail only for meaningful operational reasons, not avoidable environment mismatches.


## 6.14 Operational Reproducibility and Analytics Validation Hardening

The final update to the procurement work was not a new optimization formula. It was making sure the improved system is reproducible, demonstrable, and stable in a real development environment.

### What was added

The project now includes:

- workspace-level interpreter pinning to the project virtual environment
- static-analysis environment alignment so imports resolve against the same environment used at runtime
- a reproducible greedy-vs-knapsack simulation harness
- generated CSV outputs for repeated comparison runs and budget-value curves
- generated PNG visualizations for documentation and project-defense use
- a non-interactive plotting backend so graph generation works in headless or sandboxed environments

### Files involved

- `.vscode/settings.json`
- `pyrightconfig.json`
- `backend/analysis/greedy_vs_knapsack_simulation.py`
- `backend/analysis/greedy_vs_knapsack_simulation_runs.csv`
- `backend/analysis/greedy_vs_knapsack_budget_curve.csv`
- `backend/analysis/plots/greedy_vs_knapsack_runs.png`
- `backend/analysis/plots/budget_vs_value_curve.png`

### Why this was necessary

After the optimization upgrade, one practical issue became visible: the repository could be opened with one Python interpreter while package installation and terminal execution were happening in another environment.

That creates multiple problems:

- `pip list` can say a package exists while `python` cannot import it
- simulation or report-generation scripts can fail even when dependencies are installed
- IDE diagnostics can disagree with actual runtime behavior
- project demonstrations become unreliable because success depends on which interpreter happened to be active

For an AI-driven procurement system, that is not a minor tooling issue. It directly affects trust in the reported optimization results.

### Interpreter alignment

The workspace was updated so the project consistently points to:

`myenv\Scripts\python.exe`

This matters because the procurement analysis, report generation, and future validation steps must all run in the same dependency context as the backend.

### Headless plotting hardening

The simulation script was also updated to force the `Agg` backend for `matplotlib`.

That change was necessary because interactive GUI backends such as Tk can fail in restricted or non-desktop execution environments, even when `matplotlib` itself is installed correctly.

Using `Agg` ensures:

- graphs render deterministically to PNG files
- no GUI dependency is required
- plots can be generated in sandboxed, CI, or server-side contexts

### Why this is important to the procurement story

The procurement upgrade is stronger when it is not only theoretically correct but also empirically demonstrable.

The simulation and plotting layer provides that evidence by showing:

- repeated-run comparison between greedy and knapsack
- budget-versus-value behavior across constrained spending levels
- quantitative improvement that can be cited in documentation and defense discussions

In other words, this final hardening step converts the procurement upgrade from:

- an implemented optimization feature

to:

- a reproducible, testable, and presentation-ready optimization subsystem


## 7. File-Level Implementation Map

The following files contain the main improvements.

### Backend

- `backend/data/pharmacy_config.json`
  - pharmacy-level procurement configuration

- `backend/app/services/pharmacy_config_service.py`
  - config loading and validation

- `backend/app/services/procurement_decision_service.py`
  - candidate construction
  - priority scoring
  - cost computation
  - knapsack optimization
  - output assembly

- `backend/app/services/procurement_service.py`
  - integration of the optimizer into the FastAPI procurement pipeline
  - streaming reasoning context
  - final JSON emission

- `backend/analysis/greedy_vs_knapsack_simulation.py`
  - reproducible greedy-vs-knapsack comparison harness
  - budget-value curve generation
  - plot generation for analytical evidence

- `backend/analysis/greedy_vs_knapsack_simulation_runs.csv`
  - run-by-run comparison data between greedy and knapsack

- `backend/analysis/greedy_vs_knapsack_budget_curve.csv`
  - budget scaling comparison data for both optimizers

- `backend/analysis/plots/greedy_vs_knapsack_runs.png`
  - simulation-run visualization artifact

- `backend/analysis/plots/budget_vs_value_curve.png`
  - budget-versus-value visualization artifact

### Frontend

- `frontend/src/api/api.ts`
  - updated procurement response schema

- `frontend/src/components/ProcurementTable.tsx`
  - optimal-vs-skipped rendering
  - status filtering
  - updated procurement table view

- `frontend/src/components/ProcurementSummaryCards.tsx`
  - optimization summary metrics

- `frontend/src/components/PriorityBadge.tsx`
  - visual priority representation

- `frontend/src/pages/ProcurementPage.tsx`
  - response validation
  - summary calculations
  - explanation panels for the optimal set

- `frontend/src/components/AgentStep.tsx`
  - reasoning-term highlighting updated for “optimal” and “knapsack”


### Workspace and Tooling

- `.vscode/settings.json`
  - pins the workspace to the project virtual environment
  - keeps IDE and terminal execution aligned

- `pyrightconfig.json`
  - points static analysis to the same virtual environment used by runtime execution


## 8. Why These Improvements Matter

## 8.1 Business value

These improvements make the procurement agent more aligned with real pharmacy operations.

A real pharmacy cannot procure:

- every urgent medicine
- at any quantity
- without financial limits

The optimizer therefore adds realism by recognizing that procurement is always a constrained decision.

## 8.2 Algorithmic value

The move to dynamic programming is a serious upgrade in decision quality.

It changes the system from:

- heuristic

to:

- optimization-based

That is a material improvement, not just a refactor.

## 8.3 Explainability value

The system now provides a stronger narrative:

- why a medicine is urgent
- what it costs
- whether it was selected
- whether it was skipped because of budget
- what total optimization value was achieved

This is much easier to defend in a report, demo, viva, or stakeholder review.

## 8.4 Engineering value

The procurement subsystem is now more modular:

- config loading is separate
- candidate building is separate
- optimization is separate
- streaming explanation is separate
- frontend presentation is separate

That is good architecture.


## 8.5 Validation and defense value

These improvements also make the system easier to defend academically and operationally.

The combination of:

- formal optimization logic
- simulation evidence
- CSV outputs
- generated graphs
- consistent interpreter behavior

means the procurement engine can now be shown, measured, and reproduced with much less ambiguity.

That is especially important for:

- final year project defense
- stakeholder demonstrations
- technical documentation
- future regression testing of the optimizer


## 9. Why Knapsack Makes the Procurement Agent “Mathematically Optimal”

The phrase “mathematically optimal” is justified because the system is now explicitly solving:

```text
maximize total priority score
subject to total cost not exceeding monthly budget
```

For the discretized budget representation used by the solver:

- every feasible combination is implicitly evaluated through DP state transitions
- the best achievable objective value is computed
- the selected set is reconstructed by backtracking

This is fundamentally stronger than a sorted greedy pick loop.

The system can now say:

`"This is the best feasible subset under the modeled budget and scoring assumptions."`

That is the correct language for optimization-backed procurement.


## 10. Remaining Limitations

Even after these improvements, the system still has some limits.

### 10.1 Objective quality depends on priority design

Knapsack is only as good as the value function it maximizes. The current objective is based on `priority_score`, which is rational, but still hand-designed.

### 10.2 Supplier data is still static

The cost model is only as realistic as the supplier data source.

### 10.3 Partial procurement is not modeled

The current design is 0/1 at the medicine level:

- fully selected
- or not selected

It does not yet support partial funding of a medicine order.

### 10.4 Monthly budget only

The current live objective optimizes against total monthly budget, not operationally staged ordering windows.

That is correct for the current requirement, but future versions may want:

- multi-period optimization
- cycle-aware procurement release planning
- rolling replenishment horizons


## 11. Recommended Future Extensions

The next logical improvements would be:

1. Multi-period procurement optimization
   - use `order_cycles` in a formal multi-stage model rather than only config storage

2. Supplier alternatives per medicine
   - optimize both medicine selection and supplier selection jointly

3. Inventory-position-aware optimization
   - include on-order or reserved stock

4. Partial-order optimization
   - allow bounded fractional or pack-based decisions where business rules permit

5. Stronger value modeling
   - incorporate medicine criticality, clinical importance, or margin/risk weighting

6. Live integration
   - replace static supplier and demand assumptions with production data sources


## 12. Final Conclusion

The latest procurement-agent improvements were done for a clear reason: the previous system could identify procurement need, but it could not yet prove that its final budget-constrained selection was the best possible one.

That gap has now been addressed.

The procurement agent is improved because it is now:

- configuration-driven
- reorder-focused
- priority-aware
- cost-aware
- deterministically optimized
- explainable through both API output and dashboard visualization
- reproducible through aligned tooling and repeatable analytics artifacts

Most importantly, the decision layer now has a mathematically grounded objective:

`maximize total procurement priority under a real budget constraint`

That is the defining improvement.

The system has moved from:

`heuristic procurement support`

to:

`optimal procurement decision intelligence`
