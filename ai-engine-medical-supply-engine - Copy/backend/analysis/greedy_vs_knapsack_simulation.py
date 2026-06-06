from __future__ import annotations

import csv
import random
from pathlib import Path
from statistics import mean
from typing import Dict, List, Tuple

try:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
except ImportError:  # pragma: no cover - plotting is optional
    plt = None


SEED = 20260405
RUN_COUNT = 25
HIGH_PRIORITY_THRESHOLD = 0.7
OUTPUT_DIR = Path(__file__).resolve().parent
PLOTS_DIR = OUTPUT_DIR / "plots"

Medicine = Dict[str, float]


def greedy_select(
    medicines: List[Medicine],
    budget: int,
) -> Tuple[int, float, List[Medicine]]:
    total_cost = 0
    total_value = 0.0
    selected: List[Medicine] = []

    for medicine in sorted(
        medicines,
        key=lambda item: (-item["priority"], item["cost"], item["id"]),
    ):
        cost = int(medicine["cost"])
        if total_cost + cost <= budget:
            total_cost += cost
            total_value += float(medicine["priority"])
            selected.append(medicine)

    return total_cost, total_value, selected


def knapsack_select(
    medicines: List[Medicine],
    budget: int,
) -> Tuple[int, float, List[Medicine]]:
    dp = [0.0] * (budget + 1)
    take_rows: List[bytearray] = []

    for medicine in medicines:
        cost = int(medicine["cost"])
        value = float(medicine["priority"])
        take_row = bytearray(budget + 1)

        for capacity in range(budget, cost - 1, -1):
            candidate = dp[capacity - cost] + value
            if candidate > dp[capacity]:
                dp[capacity] = candidate
                take_row[capacity] = 1

        take_rows.append(take_row)

    best_capacity = max(range(budget + 1), key=lambda capacity: dp[capacity])
    selected: List[Medicine] = []
    remaining_capacity = best_capacity

    for index in range(len(medicines) - 1, -1, -1):
        medicine = medicines[index]
        cost = int(medicine["cost"])
        if cost <= remaining_capacity and take_rows[index][remaining_capacity]:
            selected.append(medicine)
            remaining_capacity -= cost

    selected.reverse()
    return (
        sum(int(medicine["cost"]) for medicine in selected),
        sum(float(medicine["priority"]) for medicine in selected),
        selected,
    )


def build_random_catalog(
    rng: random.Random,
    *,
    min_items: int = 20,
    max_items: int = 50,
) -> List[Medicine]:
    if min_items == max_items:
        medicine_count = min_items
    else:
        medicine_count = rng.randint(min_items, max_items)
    medicines: List[Medicine] = []

    for medicine_id in range(1, medicine_count + 1):
        medicines.append(
            {
                "id": medicine_id,
                "cost": rng.randint(300, 3500),
                "priority": round(rng.uniform(0.25, 1.0), 4),
            }
        )

    return medicines


def run_multi_simulation() -> List[dict]:
    rng = random.Random(SEED)
    rows: List[dict] = []

    for run in range(1, RUN_COUNT + 1):
        medicines = build_random_catalog(rng)
        budget = int(
            sum(int(medicine["cost"]) for medicine in medicines)
            * rng.uniform(0.22, 0.4)
        )

        greedy_cost, greedy_value, greedy_selected = greedy_select(
            medicines,
            budget,
        )
        knapsack_cost, knapsack_value, knapsack_selected = knapsack_select(
            medicines,
            budget,
        )

        greedy_ids = {int(medicine["id"]) for medicine in greedy_selected}
        missed_high_priority = sum(
            1
            for medicine in knapsack_selected
            if float(medicine["priority"]) >= HIGH_PRIORITY_THRESHOLD
            and int(medicine["id"]) not in greedy_ids
        )

        rows.append(
            {
                "run": run,
                "medicine_count": len(medicines),
                "budget": budget,
                "greedy_cost": greedy_cost,
                "greedy_value": round(greedy_value, 4),
                "knapsack_cost": knapsack_cost,
                "knapsack_value": round(knapsack_value, 4),
                "improvement_pct": round(
                    ((knapsack_value - greedy_value) / greedy_value) * 100,
                    2,
                )
                if greedy_value
                else 0.0,
                "greedy_budget_utilization_pct": round(
                    (greedy_cost / budget) * 100,
                    2,
                ),
                "knapsack_budget_utilization_pct": round(
                    (knapsack_cost / budget) * 100,
                    2,
                ),
                "missed_high_priority_items": missed_high_priority,
            }
        )

    return rows


def run_budget_curve() -> List[dict]:
    rng = random.Random(SEED)
    medicines = build_random_catalog(rng, min_items=30, max_items=30)
    catalog_cost = sum(int(medicine["cost"]) for medicine in medicines)
    rows: List[dict] = []

    for budget_pct in [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60]:
        budget = round(catalog_cost * budget_pct / 100)
        greedy_cost, greedy_value, greedy_selected = greedy_select(
            medicines,
            budget,
        )
        knapsack_cost, knapsack_value, knapsack_selected = knapsack_select(
            medicines,
            budget,
        )
        greedy_ids = {int(medicine["id"]) for medicine in greedy_selected}
        missed_high_priority = sum(
            1
            for medicine in knapsack_selected
            if float(medicine["priority"]) >= HIGH_PRIORITY_THRESHOLD
            and int(medicine["id"]) not in greedy_ids
        )

        rows.append(
            {
                "budget_pct": budget_pct,
                "budget": budget,
                "greedy_value": round(greedy_value, 4),
                "knapsack_value": round(knapsack_value, 4),
                "value_gap": round(knapsack_value - greedy_value, 4),
                "value_gap_pct": round(
                    ((knapsack_value - greedy_value) / greedy_value) * 100,
                    2,
                )
                if greedy_value
                else 0.0,
                "greedy_budget_utilization_pct": round(
                    (greedy_cost / budget) * 100,
                    2,
                ),
                "knapsack_budget_utilization_pct": round(
                    (knapsack_cost / budget) * 100,
                    2,
                ),
                "missed_high_priority_items": missed_high_priority,
            }
        )

    return rows


def write_csv(filename: str, rows: List[dict]) -> None:
    if not rows:
        return

    path = OUTPUT_DIR / filename
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def plot_if_available(simulation_rows: List[dict], curve_rows: List[dict]) -> None:
    if plt is None:
        return

    PLOTS_DIR.mkdir(parents=True, exist_ok=True)

    plt.figure(figsize=(11, 5))
    plt.plot(
        [row["run"] for row in simulation_rows],
        [row["greedy_value"] for row in simulation_rows],
        marker="o",
        label="Greedy",
    )
    plt.plot(
        [row["run"] for row in simulation_rows],
        [row["knapsack_value"] for row in simulation_rows],
        marker="o",
        label="Knapsack",
    )
    plt.xlabel("Simulation Run")
    plt.ylabel("Total Value Achieved")
    plt.title("Greedy vs Knapsack Across Simulation Runs")
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(PLOTS_DIR / "greedy_vs_knapsack_runs.png", dpi=160)
    plt.close()

    plt.figure(figsize=(11, 5))
    plt.plot(
        [row["budget_pct"] for row in curve_rows],
        [row["greedy_value"] for row in curve_rows],
        marker="o",
        label="Greedy",
    )
    plt.plot(
        [row["budget_pct"] for row in curve_rows],
        [row["knapsack_value"] for row in curve_rows],
        marker="o",
        label="Knapsack",
    )
    plt.xlabel("Budget (% of Total Candidate Cost)")
    plt.ylabel("Total Value Achieved")
    plt.title("Budget vs Procurement Value")
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(PLOTS_DIR / "budget_vs_value_curve.png", dpi=160)
    plt.close()


def print_summary(simulation_rows: List[dict]) -> None:
    print("Greedy vs Knapsack summary")
    print(f"Runs: {len(simulation_rows)}")
    print(
        "Mean improvement (%):",
        round(mean(row["improvement_pct"] for row in simulation_rows), 2),
    )
    print(
        "Mean greedy utilization (%):",
        round(
            mean(
                row["greedy_budget_utilization_pct"]
                for row in simulation_rows
            ),
            2,
        ),
    )
    print(
        "Mean knapsack utilization (%):",
        round(
            mean(
                row["knapsack_budget_utilization_pct"]
                for row in simulation_rows
            ),
            2,
        ),
    )
    print(
        "Mean missed high-priority items:",
        round(
            mean(row["missed_high_priority_items"] for row in simulation_rows),
            2,
        ),
    )


def main() -> None:
    simulation_rows = run_multi_simulation()
    curve_rows = run_budget_curve()

    write_csv("greedy_vs_knapsack_simulation_runs.csv", simulation_rows)
    write_csv("greedy_vs_knapsack_budget_curve.csv", curve_rows)
    plot_if_available(simulation_rows, curve_rows)
    print_summary(simulation_rows)


if __name__ == "__main__":
    main()
