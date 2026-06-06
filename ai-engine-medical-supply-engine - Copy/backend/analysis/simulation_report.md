# Procurement Simulation Report

Generated: 2026-04-06T18:21:23.848709+00:00

## Scope

This report compares three procurement decision strategies on the live pharmacy dataset:

- Greedy: sort by `priority_score` descending and pick until budget is exhausted.
- Knapsack: 0/1 dynamic programming that maximizes total `priority_score` under the monthly budget.
- Hybrid: production risk-aware system that detects critical medicines, forces them first, then applies cycle-level knapsack across the configured order cycles.

## Live Data Setup

- Dataset: `pharmacy_demand.xlsx`
- Reorder medicines evaluated: 15
- Critical medicines detected: 0
- Configured order cycles: 3
- Budgets tested: 10000, 20000, 30000, 40000, 50000
- Total selectable priority in the live reorder set: 8.1337
- Simulation snapshot source: reused cached live snapshot

## Simulation Results

| Algorithm | Budget | Total Priority | Total Cost | Utilization (%) | Selected | Skipped | Stockout Violations | Efficiency Ratio |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Greedy | 10000 | 2.2352 | 9824.00 | 98.24 | 4 | 11 | 0 | 0.2748 |
| Hybrid | 10000 | 1.6978 | 7344.00 | 73.44 | 3 | 12 | 0 | 0.2087 |
| Knapsack | 10000 | 2.2352 | 9824.00 | 98.24 | 4 | 11 | 0 | 0.2748 |
| Greedy | 20000 | 3.3490 | 19592.00 | 97.96 | 6 | 9 | 0 | 0.4117 |
| Hybrid | 20000 | 3.8835 | 18208.00 | 91.04 | 7 | 8 | 0 | 0.4775 |
| Knapsack | 20000 | 3.9149 | 19752.00 | 98.76 | 7 | 8 | 0 | 0.4813 |
| Greedy | 30000 | 3.9572 | 28280.00 | 94.27 | 7 | 8 | 0 | 0.4865 |
| Hybrid | 30000 | 4.9779 | 27888.00 | 92.96 | 9 | 6 | 0 | 0.6120 |
| Knapsack | 30000 | 5.3967 | 29752.00 | 99.17 | 10 | 5 | 0 | 0.6635 |
| Greedy | 40000 | 5.5944 | 38744.00 | 96.86 | 10 | 5 | 0 | 0.6878 |
| Hybrid | 40000 | 6.0243 | 38720.00 | 96.80 | 11 | 4 | 0 | 0.7407 |
| Knapsack | 40000 | 6.4911 | 39432.00 | 98.58 | 12 | 3 | 0 | 0.7981 |
| Greedy | 50000 | 7.1509 | 49864.00 | 99.73 | 13 | 2 | 0 | 0.8792 |
| Hybrid | 50000 | 7.1187 | 48400.00 | 96.80 | 13 | 2 | 0 | 0.8752 |
| Knapsack | 50000 | 7.1509 | 49864.00 | 99.73 | 13 | 2 | 0 | 0.8792 |

## Observations

- The live reorder candidate set contains 15 medicines, with 0 medicines flagged as stockout-critical, and the hybrid allocator stages budget across 3 cycles.
- Knapsack delivers the highest average priority capture across the tested budgets, which is expected because pure objective maximization has fewer operational constraints than the hybrid cycle model.
- Knapsack also achieves the highest mean efficiency ratio, indicating the strongest conversion of selectable priority into funded orders across the tested budget range.
- All three algorithms tie on cumulative stockout-risk violations for this dataset.
- No live reorder medicine is currently classified as critical, so the safety layer does not activate on this snapshot and stockout-risk differences between algorithms collapse to zero.

## Plot Outputs

- `budget_vs_priority.png`
- `stockout_risk.png`
- `budget_utilization.png`
- `efficiency_ratio.png`

## Interpretation

The current live snapshot does not contain stockout-critical reorder medicines, so the Hybrid system cannot demonstrate a safety advantage on this particular run through lower violation counts.
Under these conditions, Knapsack represents the strongest pure optimization baseline because it maximizes total priority without additional operational constraints.
The Hybrid system remains the more operationally complete architecture because it is the only approach prepared to protect critical medicines and schedule execution across multiple cycles, but the superiority of that safety layer requires live or scenario data with actual critical cases to appear in the metrics.

## Evidence from Graphs

- `budget_vs_priority.png` shows how total selected priority changes as procurement budget increases.
- `stockout_risk.png` compares cumulative critical-medicine misses across the tested budget range.
- `budget_utilization.png` shows how aggressively each algorithm uses available funds.
- `efficiency_ratio.png` measures selected priority as a fraction of the total selectable priority in the live reorder set.

## Reproducibility

The simulation uses a persisted real-data snapshot at `simulation_input_snapshot.json` to keep reruns stable.
If the snapshot file is missing, or if the script is executed with `--refresh`, the live pipeline is executed again and the snapshot is regenerated from the current dataset.
Within a given snapshot, the budget grid and all three algorithms are deterministic and do not use random sampling.
