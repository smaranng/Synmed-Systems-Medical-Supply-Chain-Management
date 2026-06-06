from __future__ import annotations

import contextlib
import io
import json
import math
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean
from typing import Any

try:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
except ImportError as error:  # pragma: no cover - matplotlib is required here
    raise RuntimeError("matplotlib is required to run simulation.py") from error


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.inventory_service import build_inventory_snapshot  # noqa: E402
from app.services.pharmacy_config_service import load_pharmacy_config  # noqa: E402
from app.services.procurement_decision_service import (  # noqa: E402
    EPSILON,
    MAX_DP_BUDGET_UNITS,
    build_hybrid_procurement_payload,
    _build_medicine_candidates,
)
from src.procurement_data import SAMPLE_DISTRIBUTORS  # noqa: E402
from src.procurement_main import process_reorder_requests  # noqa: E402


BUDGETS = [10000, 20000, 30000, 40000, 50000]
PLOTS_DIR = Path(__file__).resolve().parent / "plots"
REPORT_PATH = Path(__file__).resolve().parent / "simulation_report.md"
SNAPSHOT_PATH = Path(__file__).resolve().parent / "simulation_input_snapshot.json"


@dataclass(frozen=True)
class SimulationResult:
    algorithm: str
    budget: float
    total_priority_selected: float
    total_cost_used: float
    budget_utilization: float
    number_of_selected_medicines: int
    number_of_skipped_medicines: int
    stockout_risk_violations: int
    efficiency_ratio: float
    selected_medicine_ids: tuple[str, ...]
    skipped_medicine_ids: tuple[str, ...]


@contextlib.contextmanager
def _quiet_procurement_execution():
    with contextlib.redirect_stdout(io.StringIO()):
        with contextlib.redirect_stderr(io.StringIO()):
            yield


def _to_cents(value: float) -> int:
    return int(round(float(value) * 100))


def _ceil_divide(numerator: int, denominator: int) -> int:
    return (numerator + denominator - 1) // denominator


def _resolve_scale_cents(budget_cents: int) -> int:
    if budget_cents <= MAX_DP_BUDGET_UNITS:
        return 1
    return max(1, _ceil_divide(budget_cents, MAX_DP_BUDGET_UNITS))


def _with_configured_pharmacy_id(
    reorder_payload: dict[str, Any],
    pharmacy_id: str,
) -> dict[str, Any]:
    return {
        "pharmacy_id": pharmacy_id,
        "reorder_requests": [
            {
                **request,
                "pharmacy_id": pharmacy_id,
            }
            for request in reorder_payload["reorder_requests"]
        ],
    }


def _prepare_live_inputs() -> tuple[
    dict[str, Any],
    dict[str, Any],
    dict[str, Any],
    dict[str, Any],
    list[dict[str, Any]],
    float,
]:
    inventory_snapshot = build_inventory_snapshot()
    config = load_pharmacy_config()
    reorder_payload = _with_configured_pharmacy_id(
        inventory_snapshot["_raw_reorder_payload"],
        str(config["pharmacy_id"]),
    )

    with _quiet_procurement_execution():
        procurement_payload = process_reorder_requests(
            reorder_payload,
            pharmacy_id=str(config["pharmacy_id"]),
        )

    candidates = _build_medicine_candidates(
        inventory_snapshot=inventory_snapshot,
        reorder_payload=reorder_payload,
        procurement_payload=procurement_payload,
        distributors=SAMPLE_DISTRIBUTORS,
    )
    total_possible_priority = sum(
        float(candidate["priority_score"])
        for candidate in candidates
        if candidate["cost"] is not None
    )

    return (
        inventory_snapshot,
        reorder_payload,
        procurement_payload,
        config,
        candidates,
        total_possible_priority,
    )


def _load_or_create_snapshot(
    *,
    refresh: bool = False,
) -> tuple[
    dict[str, Any],
    dict[str, Any],
    dict[str, Any],
    dict[str, Any],
    list[dict[str, Any]],
    float,
]:
    if SNAPSHOT_PATH.exists() and not refresh:
        snapshot = json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))
        return (
            snapshot["inventory_snapshot"],
            snapshot["reorder_payload"],
            snapshot["procurement_payload"],
            snapshot["config"],
            snapshot["candidates"],
            float(snapshot["total_possible_priority"]),
        )

    (
        inventory_snapshot,
        reorder_payload,
        procurement_payload,
        config,
        candidates,
        total_possible_priority,
    ) = _prepare_live_inputs()

    snapshot_payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "inventory_snapshot": inventory_snapshot,
        "reorder_payload": reorder_payload,
        "procurement_payload": procurement_payload,
        "config": config,
        "candidates": candidates,
        "total_possible_priority": total_possible_priority,
    }
    SNAPSHOT_PATH.write_text(
        json.dumps(snapshot_payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    return (
        inventory_snapshot,
        reorder_payload,
        procurement_payload,
        config,
        candidates,
        total_possible_priority,
    )


def _selectable_candidates(candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        candidate
        for candidate in candidates
        if candidate["cost"] is not None
    ]


def _greedy_selected_ids(
    candidates: list[dict[str, Any]],
    budget: float,
) -> set[str]:
    remaining_budget_cents = max(_to_cents(budget), 0)
    selected_ids: set[str] = set()

    for candidate in sorted(
        _selectable_candidates(candidates),
        key=lambda item: (
            -float(item["priority_score"]),
            float(item["cost"]),
            str(item["medicine_id"]),
        ),
    ):
        candidate_cost_cents = _to_cents(float(candidate["cost"]))
        if candidate_cost_cents <= remaining_budget_cents:
            selected_ids.add(str(candidate["medicine_id"]))
            remaining_budget_cents -= candidate_cost_cents

    return selected_ids


def _knapsack_selected_ids(
    candidates: list[dict[str, Any]],
    budget: float,
) -> set[str]:
    budget_cents = max(_to_cents(budget), 0)
    if budget_cents <= 0:
        return set()

    scale_cents = _resolve_scale_cents(budget_cents)
    scaled_budget = budget_cents // scale_cents
    if scaled_budget <= 0:
        return set()

    selectable_items: list[dict[str, Any]] = []
    for candidate in _selectable_candidates(candidates):
        cost_cents = _to_cents(float(candidate["cost"]))
        if cost_cents <= 0:
            continue

        selectable_items.append(
            {
                "medicine_id": str(candidate["medicine_id"]),
                "priority_score": float(candidate["priority_score"]),
                "scaled_cost": _ceil_divide(cost_cents, scale_cents),
            }
        )

    if not selectable_items:
        return set()

    dp = [0.0] * (scaled_budget + 1)
    take_rows: list[bytearray] = []

    for item in selectable_items:
        take_row = bytearray(scaled_budget + 1)
        item_cost = int(item["scaled_cost"])
        item_priority = float(item["priority_score"])

        if item_cost > scaled_budget:
            take_rows.append(take_row)
            continue

        for capacity in range(scaled_budget, item_cost - 1, -1):
            candidate_priority = dp[capacity - item_cost] + item_priority
            if candidate_priority > dp[capacity] + EPSILON:
                dp[capacity] = candidate_priority
                take_row[capacity] = 1

        take_rows.append(take_row)

    best_priority = max(dp)
    best_capacity = min(
        capacity
        for capacity, priority in enumerate(dp)
        if abs(priority - best_priority) <= EPSILON
    )

    selected_ids: set[str] = set()
    remaining_capacity = best_capacity

    for index in range(len(selectable_items) - 1, -1, -1):
        item = selectable_items[index]
        item_cost = int(item["scaled_cost"])

        if item_cost <= remaining_capacity and take_rows[index][remaining_capacity]:
            selected_ids.add(str(item["medicine_id"]))
            remaining_capacity -= item_cost

    return selected_ids


def _build_result(
    *,
    algorithm: str,
    budget: float,
    candidates: list[dict[str, Any]],
    selected_ids: set[str],
    total_possible_priority: float,
) -> SimulationResult:
    selected = [
        candidate
        for candidate in candidates
        if str(candidate["medicine_id"]) in selected_ids
    ]
    skipped = [
        candidate
        for candidate in candidates
        if str(candidate["medicine_id"]) not in selected_ids
    ]
    total_cost_used = sum(float(candidate["cost"] or 0.0) for candidate in selected)
    total_priority_selected = sum(
        float(candidate["priority_score"]) for candidate in selected
    )
    stockout_risk_violations = sum(
        1
        for candidate in skipped
        if bool(candidate["is_critical"])
    )

    return SimulationResult(
        algorithm=algorithm,
        budget=float(budget),
        total_priority_selected=round(total_priority_selected, 4),
        total_cost_used=round(total_cost_used, 2),
        budget_utilization=round(
            (total_cost_used / float(budget)) * 100.0 if float(budget) > 0 else 0.0,
            2,
        ),
        number_of_selected_medicines=len(selected),
        number_of_skipped_medicines=len(skipped),
        stockout_risk_violations=stockout_risk_violations,
        efficiency_ratio=round(
            total_priority_selected / total_possible_priority
            if total_possible_priority > 0
            else 0.0,
            4,
        ),
        selected_medicine_ids=tuple(sorted(str(candidate["medicine_id"]) for candidate in selected)),
        skipped_medicine_ids=tuple(sorted(str(candidate["medicine_id"]) for candidate in skipped)),
    )


def _run_greedy(
    candidates: list[dict[str, Any]],
    budget: float,
    total_possible_priority: float,
) -> SimulationResult:
    return _build_result(
        algorithm="Greedy",
        budget=budget,
        candidates=candidates,
        selected_ids=_greedy_selected_ids(candidates, budget),
        total_possible_priority=total_possible_priority,
    )


def _run_knapsack(
    candidates: list[dict[str, Any]],
    budget: float,
    total_possible_priority: float,
) -> SimulationResult:
    return _build_result(
        algorithm="Knapsack",
        budget=budget,
        candidates=candidates,
        selected_ids=_knapsack_selected_ids(candidates, budget),
        total_possible_priority=total_possible_priority,
    )


def _run_hybrid(
    *,
    inventory_snapshot: dict[str, Any],
    reorder_payload: dict[str, Any],
    procurement_payload: dict[str, Any],
    config: dict[str, Any],
    budget: float,
    total_possible_priority: float,
) -> SimulationResult:
    payload = build_hybrid_procurement_payload(
        inventory_snapshot=inventory_snapshot,
        reorder_payload=reorder_payload,
        procurement_payload=procurement_payload,
        config={
            "pharmacy_id": str(config["pharmacy_id"]),
            "monthly_budget": float(budget),
            "order_cycles": int(config["order_cycles"]),
        },
        distributors=SAMPLE_DISTRIBUTORS,
    )

    selected_ids = {
        str(decision["medicine_id"])
        for decision in payload["decisions"]
        if decision["selected_for_order"]
    }

    return _build_result(
        algorithm="Hybrid",
        budget=budget,
        candidates=payload["decisions"],
        selected_ids=selected_ids,
        total_possible_priority=total_possible_priority,
    )


def _results_for_algorithm(
    results: list[SimulationResult],
    algorithm: str,
) -> list[SimulationResult]:
    return sorted(
        [result for result in results if result.algorithm == algorithm],
        key=lambda result: result.budget,
    )


def _plot_budget_vs_priority(results: list[SimulationResult]) -> Path:
    figure_path = PLOTS_DIR / "budget_vs_priority.png"
    plt.figure(figsize=(10, 5))
    for algorithm in ("Greedy", "Knapsack", "Hybrid"):
        algorithm_results = _results_for_algorithm(results, algorithm)
        plt.plot(
            [result.budget for result in algorithm_results],
            [result.total_priority_selected for result in algorithm_results],
            marker="o",
            label=algorithm,
        )

    plt.xlabel("Budget")
    plt.ylabel("Total Priority Selected")
    plt.title("Budget vs Priority")
    plt.grid(True, alpha=0.3)
    plt.legend()
    plt.tight_layout()
    plt.savefig(figure_path, dpi=160)
    plt.close()
    return figure_path


def _plot_stockout_risk(results: list[SimulationResult]) -> Path:
    figure_path = PLOTS_DIR / "stockout_risk.png"
    algorithms = ["Greedy", "Knapsack", "Hybrid"]
    cumulative_violations = [
        sum(
            result.stockout_risk_violations
            for result in results
            if result.algorithm == algorithm
        )
        for algorithm in algorithms
    ]

    plt.figure(figsize=(8, 5))
    plt.bar(algorithms, cumulative_violations)
    plt.xlabel("Algorithm")
    plt.ylabel("Stockout Violations")
    plt.title("Cumulative Stockout Risk Across Simulated Budgets")
    plt.tight_layout()
    plt.savefig(figure_path, dpi=160)
    plt.close()
    return figure_path


def _plot_budget_utilization(results: list[SimulationResult]) -> Path:
    figure_path = PLOTS_DIR / "budget_utilization.png"
    plt.figure(figsize=(10, 5))
    for algorithm in ("Greedy", "Knapsack", "Hybrid"):
        algorithm_results = _results_for_algorithm(results, algorithm)
        plt.plot(
            [result.budget for result in algorithm_results],
            [result.budget_utilization for result in algorithm_results],
            marker="o",
            label=algorithm,
        )

    plt.xlabel("Budget")
    plt.ylabel("Budget Utilization (%)")
    plt.title("Budget Utilization by Algorithm")
    plt.grid(True, alpha=0.3)
    plt.legend()
    plt.tight_layout()
    plt.savefig(figure_path, dpi=160)
    plt.close()
    return figure_path


def _plot_efficiency_ratio(results: list[SimulationResult]) -> Path:
    figure_path = PLOTS_DIR / "efficiency_ratio.png"
    plt.figure(figsize=(10, 5))
    for algorithm in ("Greedy", "Knapsack", "Hybrid"):
        algorithm_results = _results_for_algorithm(results, algorithm)
        plt.plot(
            [result.budget for result in algorithm_results],
            [result.efficiency_ratio for result in algorithm_results],
            marker="o",
            label=algorithm,
        )

    plt.xlabel("Budget")
    plt.ylabel("Efficiency Ratio")
    plt.title("Priority Capture Efficiency")
    plt.grid(True, alpha=0.3)
    plt.legend()
    plt.tight_layout()
    plt.savefig(figure_path, dpi=160)
    plt.close()
    return figure_path


def _print_summary_table(results: list[SimulationResult]) -> None:
    print(
        "\n"
        "Algorithm | Budget | Priority | Cost | Utilization | Stockouts\n"
        "--------- | ------ | -------- | ---- | ----------- | ---------"
    )
    for result in sorted(results, key=lambda item: (item.budget, item.algorithm)):
        print(
            f"{result.algorithm:<9} | "
            f"{int(result.budget):>6} | "
            f"{result.total_priority_selected:>8.4f} | "
            f"{result.total_cost_used:>8.2f} | "
            f"{result.budget_utilization:>10.2f}% | "
            f"{result.stockout_risk_violations:>9}"
        )


def _build_results_table(results: list[SimulationResult]) -> list[str]:
    lines = [
        "| Algorithm | Budget | Total Priority | Total Cost | Utilization (%) | Selected | Skipped | Stockout Violations | Efficiency Ratio |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    for result in sorted(results, key=lambda item: (item.budget, item.algorithm)):
        lines.append(
            f"| {result.algorithm} | {int(result.budget)} | "
            f"{result.total_priority_selected:.4f} | {result.total_cost_used:.2f} | "
            f"{result.budget_utilization:.2f} | {result.number_of_selected_medicines} | "
            f"{result.number_of_skipped_medicines} | {result.stockout_risk_violations} | "
            f"{result.efficiency_ratio:.4f} |"
        )
    return lines


def _algorithm_summary(results: list[SimulationResult], algorithm: str) -> dict[str, float]:
    algorithm_results = _results_for_algorithm(results, algorithm)
    return {
        "avg_priority": mean(result.total_priority_selected for result in algorithm_results),
        "avg_utilization": mean(result.budget_utilization for result in algorithm_results),
        "avg_efficiency": mean(result.efficiency_ratio for result in algorithm_results),
        "total_stockouts": float(
            sum(result.stockout_risk_violations for result in algorithm_results)
        ),
    }


def _build_observations(
    results: list[SimulationResult],
    *,
    candidate_count: int,
    critical_count: int,
    order_cycles: int,
) -> list[str]:
    summaries = {
        algorithm: _algorithm_summary(results, algorithm)
        for algorithm in ("Greedy", "Knapsack", "Hybrid")
    }
    best_priority_algorithm = max(
        summaries,
        key=lambda algorithm: summaries[algorithm]["avg_priority"],
    )
    best_efficiency_algorithm = max(
        summaries,
        key=lambda algorithm: summaries[algorithm]["avg_efficiency"],
    )
    min_stockouts = min(
        summary["total_stockouts"] for summary in summaries.values()
    )
    safest_algorithms = [
        algorithm
        for algorithm, summary in summaries.items()
        if abs(summary["total_stockouts"] - min_stockouts) <= EPSILON
    ]

    observations = [
        f"The live reorder candidate set contains {candidate_count} medicines, with {critical_count} medicines flagged as stockout-critical, and the hybrid allocator stages budget across {order_cycles} cycles.",
        f"{best_priority_algorithm} delivers the highest average priority capture across the tested budgets, which is expected because pure objective maximization has fewer operational constraints than the hybrid cycle model.",
        f"{best_efficiency_algorithm} also achieves the highest mean efficiency ratio, indicating the strongest conversion of selectable priority into funded orders across the tested budget range.",
    ]

    if len(safest_algorithms) == 1:
        observations.append(
            f"{safest_algorithms[0]} records the lowest cumulative stockout-risk violations on this dataset."
        )
    else:
        observations.append(
            "All three algorithms tie on cumulative stockout-risk violations for this dataset."
        )

    if critical_count == 0:
        observations.append(
            "No live reorder medicine is currently classified as critical, so the safety layer does not activate on this snapshot and stockout-risk differences between algorithms collapse to zero."
        )
    else:
        hybrid_stockouts = summaries["Hybrid"]["total_stockouts"]
        observations.append(
            "Because the hybrid strategy forces critical medicines into the procurement plan before running cycle-level knapsack, it is the only algorithm designed to trade a small amount of pure objective value for safety guarantees."
            if hybrid_stockouts == min(summary["total_stockouts"] for summary in summaries.values())
            else "The hybrid strategy did not fully dominate the safety metric on this live snapshot, so the data should be reviewed for cycle-budget pressure and critical cost concentration."
        )

    return observations


def _build_report(
    *,
    results: list[SimulationResult],
    config: dict[str, Any],
    inventory_snapshot: dict[str, Any],
    candidates: list[dict[str, Any]],
    total_possible_priority: float,
    plot_paths: list[Path],
    snapshot_refreshed: bool,
) -> str:
    critical_count = sum(1 for candidate in candidates if candidate["is_critical"])
    observations = _build_observations(
        results,
        candidate_count=len(candidates),
        critical_count=critical_count,
        order_cycles=int(config["order_cycles"]),
    )

    lines = [
        "# Procurement Simulation Report",
        "",
        f"Generated: {datetime.now(timezone.utc).isoformat()}",
        "",
        "## Scope",
        "",
        "This report compares three procurement decision strategies on the live pharmacy dataset:",
        "",
        "- Greedy: sort by `priority_score` descending and pick until budget is exhausted.",
        "- Knapsack: 0/1 dynamic programming that maximizes total `priority_score` under the monthly budget.",
        "- Hybrid: production risk-aware system that detects critical medicines, forces them first, then applies cycle-level knapsack across the configured order cycles.",
        "",
        "## Live Data Setup",
        "",
        f"- Dataset: `{inventory_snapshot['dataset']}`",
        f"- Reorder medicines evaluated: {len(candidates)}",
        f"- Critical medicines detected: {critical_count}",
        f"- Configured order cycles: {config['order_cycles']}",
        f"- Budgets tested: {', '.join(str(budget) for budget in BUDGETS)}",
        f"- Total selectable priority in the live reorder set: {total_possible_priority:.4f}",
        f"- Simulation snapshot source: {'freshly generated from live pipeline' if snapshot_refreshed else 'reused cached live snapshot'}",
        "",
        "## Simulation Results",
        "",
    ]
    lines.extend(_build_results_table(results))
    lines.extend(
        [
            "",
            "## Observations",
            "",
        ]
    )
    for observation in observations:
        lines.append(f"- {observation}")

    lines.extend(
        [
            "",
            "## Plot Outputs",
            "",
        ]
    )
    for plot_path in plot_paths:
        lines.append(f"- `{plot_path.name}`")

    lines.extend(
        [
            "",
            "## Interpretation",
            "",
        ]
    )

    if critical_count == 0:
        lines.extend(
            [
                "The current live snapshot does not contain stockout-critical reorder medicines, so the Hybrid system cannot demonstrate a safety advantage on this particular run through lower violation counts.",
                "Under these conditions, Knapsack represents the strongest pure optimization baseline because it maximizes total priority without additional operational constraints.",
                "The Hybrid system remains the more operationally complete architecture because it is the only approach prepared to protect critical medicines and schedule execution across multiple cycles, but the superiority of that safety layer requires live or scenario data with actual critical cases to appear in the metrics.",
            ]
        )
    else:
        lines.extend(
            [
                "The Hybrid system is the most realistic decision layer for real pharmacy operations because it balances safety and optimization rather than optimizing priority alone.",
                "Greedy is the weakest baseline because it can miss better combinations of medicines even when budget remains available.",
                "Knapsack is strongest on pure objective value, but Hybrid is stronger operationally when critical stockout prevention and staged budget execution matter at the same time.",
            ]
        )

    lines.extend(
        [
            "",
            "## Evidence from Graphs",
            "",
            "- `budget_vs_priority.png` shows how total selected priority changes as procurement budget increases.",
            "- `stockout_risk.png` compares cumulative critical-medicine misses across the tested budget range.",
            "- `budget_utilization.png` shows how aggressively each algorithm uses available funds.",
            "- `efficiency_ratio.png` measures selected priority as a fraction of the total selectable priority in the live reorder set.",
            "",
            "## Reproducibility",
            "",
            f"The simulation uses a persisted real-data snapshot at `{SNAPSHOT_PATH.name}` to keep reruns stable.",
            "If the snapshot file is missing, or if the script is executed with `--refresh`, the live pipeline is executed again and the snapshot is regenerated from the current dataset.",
            "Within a given snapshot, the budget grid and all three algorithms are deterministic and do not use random sampling.",
            "",
        ]
    )

    return "\n".join(lines)


def main() -> None:
    PLOTS_DIR.mkdir(parents=True, exist_ok=True)
    refresh_snapshot = "--refresh" in sys.argv[1:]
    had_snapshot_before = SNAPSHOT_PATH.exists()

    (
        inventory_snapshot,
        reorder_payload,
        procurement_payload,
        config,
        candidates,
        total_possible_priority,
    ) = _load_or_create_snapshot(refresh=refresh_snapshot)

    results: list[SimulationResult] = []
    for budget in BUDGETS:
        results.append(_run_greedy(candidates, float(budget), total_possible_priority))
        results.append(_run_knapsack(candidates, float(budget), total_possible_priority))
        results.append(
            _run_hybrid(
                inventory_snapshot=inventory_snapshot,
                reorder_payload=reorder_payload,
                procurement_payload=procurement_payload,
                config=config,
                budget=float(budget),
                total_possible_priority=total_possible_priority,
            )
        )

    _print_summary_table(results)

    plot_paths = [
        _plot_budget_vs_priority(results),
        _plot_stockout_risk(results),
        _plot_budget_utilization(results),
        _plot_efficiency_ratio(results),
    ]

    report_text = _build_report(
        results=results,
        config=config,
        inventory_snapshot=inventory_snapshot,
        candidates=candidates,
        total_possible_priority=total_possible_priority,
        plot_paths=plot_paths,
        snapshot_refreshed=refresh_snapshot or not had_snapshot_before,
    )
    REPORT_PATH.write_text(report_text, encoding="utf-8")

    print(
        f"\nSimulation snapshot: {SNAPSHOT_PATH} "
        f"({'refreshed' if refresh_snapshot or not had_snapshot_before else 'reused'})"
    )
    print("\nGenerated plots:")
    for plot_path in plot_paths:
        print(f"- {plot_path}")
    print(f"\nReport written to {REPORT_PATH}")


if __name__ == "__main__":
    main()
