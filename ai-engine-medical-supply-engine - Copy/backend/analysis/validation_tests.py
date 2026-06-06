from __future__ import annotations

import itertools
import math
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any, Optional


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.procurement_decision_service import (  # noqa: E402
    CRITICAL_REASON,
    KNAPSACK_REASON,
    SKIPPED_REASON,
    build_hybrid_procurement_payload,
)
from app.services.procurement_service import get_procurement_payload  # noqa: E402


EPSILON = 1e-9
OUTPUT_DIR = Path(__file__).resolve().parent
REPORT_PATH = OUTPUT_DIR / "validation_report.md"


@dataclass
class ValidationResult:
    name: str
    dataset_type: str
    objective: str
    passed: bool
    metrics: dict[str, float]
    assertions: list[str]
    selected_medicines: list[str]
    skipped_medicines: list[str]
    total_cost: float
    total_priority: float
    notes: list[str] = field(default_factory=list)


def _round(value: float, digits: int = 4) -> float:
    return round(float(value), digits)


def _to_cents(value: float) -> int:
    return int(round(float(value) * 100))


def _split_budget_cents(total_budget_cents: int, order_cycles: int) -> list[int]:
    if order_cycles <= 0:
        return []

    base_budget = total_budget_cents // order_cycles
    remainder = total_budget_cents % order_cycles
    return [
        base_budget + (1 if cycle_index < remainder else 0)
        for cycle_index in range(order_cycles)
    ]


def _decision_sort_key(decision: dict[str, Any]) -> tuple[int, str]:
    return (
        0 if decision["selected_for_order"] else 1,
        str(decision["medicine_id"]),
    )


def _format_selected_medicine(decision: dict[str, Any]) -> str:
    cycle = decision["order_cycle"]
    cycle_text = f"cycle {cycle}" if cycle is not None else "unassigned"
    cost = "N/A" if decision["cost"] is None else f"{float(decision['cost']):.2f}"
    return (
        f"{decision['medicine_id']} - {decision['medicine_name']} "
        f"[{decision['reason']}, {cycle_text}, cost {cost}]"
    )


def _format_skipped_medicine(decision: dict[str, Any]) -> str:
    cost = "N/A" if decision["cost"] is None else f"{float(decision['cost']):.2f}"
    return (
        f"{decision['medicine_id']} - {decision['medicine_name']} "
        f"[SKIPPED, cost {cost}]"
    )


def _compute_metrics(payload: dict[str, Any]) -> dict[str, float]:
    decisions = payload["decisions"]
    selected = [decision for decision in decisions if decision["selected_for_order"]]
    skipped = [decision for decision in decisions if not decision["selected_for_order"]]
    critical_skipped = [
        decision
        for decision in decisions
        if decision["is_critical"] and not decision["selected_for_order"]
    ]

    monthly_budget = float(payload["monthly_budget"])
    total_cost = float(payload["total_cost_used"])

    return {
        "budget_utilization": (
            _round((total_cost / monthly_budget) * 100.0, 2)
            if monthly_budget > 0
            else 0.0
        ),
        "total_priority_selected": _round(float(payload["total_priority_achieved"]), 4),
        "stockout_risk_violations": float(len(critical_skipped)),
        "number_of_skipped_medicines": float(len(skipped)),
        "selected_count": float(len(selected)),
    }


def _print_test_log(name: str, payload: dict[str, Any]) -> None:
    decisions = sorted(payload["decisions"], key=_decision_sort_key)
    selected = [decision for decision in decisions if decision["selected_for_order"]]
    skipped = [decision for decision in decisions if not decision["selected_for_order"]]

    print(f"\n=== {name} ===")
    print("Selected medicines:")
    if not selected:
        print("  - None")
    else:
        for decision in selected:
            print(f"  - {_format_selected_medicine(decision)}")

    print("Skipped medicines:")
    if not skipped:
        print("  - None")
    else:
        for decision in skipped:
            print(f"  - {_format_skipped_medicine(decision)}")

    print(f"Total cost: {float(payload['total_cost_used']):.2f}")
    print(f"Total priority: {float(payload['total_priority_achieved']):.4f}")


def _build_controlled_payload(
    *,
    pharmacy_id: str,
    monthly_budget: float,
    order_cycles: int,
    medicine_specs: list[dict[str, Any]],
) -> dict[str, Any]:
    inventory_rows: list[dict[str, Any]] = []
    reorder_requests: list[dict[str, Any]] = []
    procurement_orders: list[dict[str, Any]] = []
    distributors: list[dict[str, Any]] = []

    for spec in medicine_specs:
        medicine_id = str(spec["medicine_id"])
        medicine_name = str(spec["medicine_name"])
        distributor_id = str(spec["distributor_id"])
        current_stock = float(spec["current_stock"])
        reorder_point = float(spec["reorder_point"])
        order_quantity = int(spec["order_quantity"])
        forecast_quantity = float(spec["forecast_quantity"])

        inventory_rows.append(
            {
                "medicine_id": medicine_id,
                "medicine_name": medicine_name,
                "forecast_quantity": forecast_quantity,
                "current_stock": current_stock,
                "reorder_point": reorder_point,
                "reorder": True,
                "order_quantity": order_quantity,
            }
        )
        reorder_requests.append(
            {
                "pharmacy_id": pharmacy_id,
                "medicine_id": medicine_id,
                "medicine_name": medicine_name,
                "current_stock": current_stock,
                "required_stock": reorder_point + order_quantity,
                "order_quantity": order_quantity,
                "reorder": True,
                "trigger_reason": spec.get(
                    "trigger_reason",
                    "Controlled validation reorder candidate.",
                ),
            }
        )
        procurement_orders.append(
            {
                "pharmacy_id": pharmacy_id,
                "medicine_id": medicine_id,
                "order_quantity": order_quantity,
                "distributor_id": distributor_id,
            }
        )
        distributors.append(
            {
                "id": distributor_id,
                "name": spec["distributor_name"],
                "location": (0, 0),
                "lead_days": int(spec["lead_days"]),
                "rating": 4.5,
                "price_per_unit": float(spec["price_per_unit"]),
                "min_order_value": 0,
            }
        )

    inventory_snapshot = {
        "dataset": "controlled-validation",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_medicines": len(inventory_rows),
        "reorder_count": len(reorder_requests),
        "inventory": inventory_rows,
    }
    reorder_payload = {
        "pharmacy_id": pharmacy_id,
        "reorder_requests": reorder_requests,
    }
    procurement_payload = {
        "pharmacy_id": pharmacy_id,
        "procurement_orders": procurement_orders,
    }
    config = {
        "pharmacy_id": pharmacy_id,
        "monthly_budget": monthly_budget,
        "order_cycles": order_cycles,
    }

    return build_hybrid_procurement_payload(
        inventory_snapshot=inventory_snapshot,
        reorder_payload=reorder_payload,
        procurement_payload=procurement_payload,
        config=config,
        distributors=distributors,
    )


def _brute_force_best_subset(
    medicines: list[dict[str, Any]],
    budget_cents: int,
) -> set[str]:
    best_priority = -1.0
    best_cost = math.inf
    best_signature: tuple[str, ...] = tuple()

    for subset_size in range(len(medicines) + 1):
        for subset in itertools.combinations(medicines, subset_size):
            total_cost_cents = sum(_to_cents(float(item["cost"])) for item in subset)
            if total_cost_cents > budget_cents:
                continue

            total_priority = sum(float(item["priority_score"]) for item in subset)
            signature = tuple(sorted(str(item["medicine_id"]) for item in subset))

            if total_priority > best_priority + EPSILON:
                best_priority = total_priority
                best_cost = total_cost_cents
                best_signature = signature
                continue

            if abs(total_priority - best_priority) > EPSILON:
                continue

            if total_cost_cents < best_cost:
                best_cost = total_cost_cents
                best_signature = signature
                continue

            if total_cost_cents == best_cost and signature < best_signature:
                best_signature = signature

    return set(best_signature)


def _critical_sort_key(medicine: dict[str, Any]) -> tuple[float, float, float, float, str]:
    return (
        float(medicine["days_to_stockout"])
        if medicine["days_to_stockout"] is not None
        else float("inf"),
        -float(medicine["lead_days"] or 0),
        -float(medicine["priority_score"]),
        float(medicine["cost"]) if medicine["cost"] is not None else float("inf"),
        str(medicine["medicine_id"]),
    )


def _reference_hybrid_allocation(
    decisions: list[dict[str, Any]],
    *,
    monthly_budget: float,
    order_cycles: int,
) -> dict[str, dict[str, Any]]:
    reference_state = {
        decision["medicine_id"]: {
            "selected_for_order": False,
            "order_cycle": None,
            "reason": SKIPPED_REASON,
        }
        for decision in decisions
    }
    remaining = {decision["medicine_id"]: dict(decision) for decision in decisions}
    cycle_budgets = _split_budget_cents(_to_cents(monthly_budget), order_cycles)

    for cycle_number, cycle_budget_cents in enumerate(cycle_budgets, start=1):
        remaining_budget_cents = cycle_budget_cents

        critical_candidates = sorted(
            [
                medicine
                for medicine in remaining.values()
                if medicine["is_critical"]
                and medicine["cost"] is not None
            ],
            key=_critical_sort_key,
        )

        for medicine in critical_candidates:
            medicine_cost_cents = _to_cents(float(medicine["cost"]))
            if medicine_cost_cents > remaining_budget_cents:
                continue

            reference_state[medicine["medicine_id"]] = {
                "selected_for_order": True,
                "order_cycle": cycle_number,
                "reason": CRITICAL_REASON,
            }
            remaining_budget_cents -= medicine_cost_cents
            remaining.pop(medicine["medicine_id"], None)

        knapsack_candidates = [
            medicine
            for medicine in remaining.values()
            if medicine["cost"] is not None
        ]
        selected_ids = _brute_force_best_subset(
            knapsack_candidates,
            remaining_budget_cents,
        )

        for medicine_id in sorted(selected_ids):
            if medicine_id not in remaining:
                continue

            reference_state[medicine_id] = {
                "selected_for_order": True,
                "order_cycle": cycle_number,
                "reason": KNAPSACK_REASON,
            }
            remaining.pop(medicine_id, None)

    return reference_state


def _assert_budget_constraints(payload: dict[str, Any]) -> None:
    monthly_budget = float(payload["monthly_budget"])
    total_cost_used = float(payload["total_cost_used"])
    assert total_cost_used <= monthly_budget + 0.01, (
        f"Total selected cost {total_cost_used:.2f} exceeds monthly budget "
        f"{monthly_budget:.2f}."
    )

    cycle_budget_lookup = {
        int(cycle_summary["cycle"]): float(cycle_summary["budget"])
        for cycle_summary in payload["cycle_summaries"]
    }
    for cycle_summary in payload["cycle_summaries"]:
        used_budget = float(cycle_summary["used_budget"])
        cycle_budget = float(cycle_summary["budget"])
        assert used_budget <= cycle_budget + 0.01, (
            f"Cycle {cycle_summary['cycle']} used budget {used_budget:.2f} "
            f"exceeds cycle budget {cycle_budget:.2f}."
        )

    selected_cost_by_cycle: dict[int, float] = {}
    for decision in payload["decisions"]:
        if not decision["selected_for_order"] or decision["order_cycle"] is None:
            continue
        cycle_number = int(decision["order_cycle"])
        selected_cost_by_cycle[cycle_number] = selected_cost_by_cycle.get(cycle_number, 0.0) + float(
            decision["cost"] or 0.0
        )

    for cycle_number, selected_cost in selected_cost_by_cycle.items():
        cycle_budget = cycle_budget_lookup.get(cycle_number, 0.0)
        assert selected_cost <= cycle_budget + 0.01, (
            f"Selected cost {selected_cost:.2f} in cycle {cycle_number} exceeds "
            f"cycle budget {cycle_budget:.2f}."
        )


def _result_from_payload(
    *,
    name: str,
    dataset_type: str,
    objective: str,
    payload: dict[str, Any],
    assertions: list[str],
    notes: Optional[list[str]] = None,
) -> ValidationResult:
    decisions = sorted(payload["decisions"], key=_decision_sort_key)
    selected = [decision for decision in decisions if decision["selected_for_order"]]
    skipped = [decision for decision in decisions if not decision["selected_for_order"]]
    metrics = _compute_metrics(payload)

    return ValidationResult(
        name=name,
        dataset_type=dataset_type,
        objective=objective,
        passed=True,
        metrics=metrics,
        assertions=assertions,
        selected_medicines=[_format_selected_medicine(decision) for decision in selected],
        skipped_medicines=[_format_skipped_medicine(decision) for decision in skipped],
        total_cost=float(payload["total_cost_used"]),
        total_priority=float(payload["total_priority_achieved"]),
        notes=notes or [],
    )


def _small_knapsack_dataset() -> list[dict[str, Any]]:
    return [
        {
            "medicine_id": "VAL001",
            "medicine_name": "Controlled Analgesic A",
            "current_stock": 50,
            "reorder_point": 100,
            "forecast_quantity": 30,
            "order_quantity": 10,
            "price_per_unit": 3.0,
            "lead_days": 2,
            "distributor_id": "VD001",
            "distributor_name": "Validation Supplier A",
        },
        {
            "medicine_id": "VAL002",
            "medicine_name": "Controlled Antibiotic B",
            "current_stock": 10,
            "reorder_point": 100,
            "forecast_quantity": 30,
            "order_quantity": 10,
            "price_per_unit": 7.0,
            "lead_days": 5,
            "distributor_id": "VD002",
            "distributor_name": "Validation Supplier B",
        },
        {
            "medicine_id": "VAL003",
            "medicine_name": "Controlled Steroid C",
            "current_stock": 40,
            "reorder_point": 100,
            "forecast_quantity": 30,
            "order_quantity": 10,
            "price_per_unit": 6.0,
            "lead_days": 8,
            "distributor_id": "VD003",
            "distributor_name": "Validation Supplier C",
        },
        {
            "medicine_id": "VAL004",
            "medicine_name": "Controlled Antacid D",
            "current_stock": 15,
            "reorder_point": 100,
            "forecast_quantity": 30,
            "order_quantity": 10,
            "price_per_unit": 4.0,
            "lead_days": 3,
            "distributor_id": "VD004",
            "distributor_name": "Validation Supplier D",
        },
    ]


def _critical_dataset() -> list[dict[str, Any]]:
    return [
        {
            "medicine_id": "CRT001",
            "medicine_name": "Critical Insulin",
            "current_stock": 5,
            "reorder_point": 100,
            "forecast_quantity": 60,
            "order_quantity": 10,
            "price_per_unit": 3.0,
            "lead_days": 5,
            "distributor_id": "CD001",
            "distributor_name": "Critical Supplier A",
        },
        {
            "medicine_id": "CRT002",
            "medicine_name": "Critical Cardiac Drug",
            "current_stock": 2,
            "reorder_point": 100,
            "forecast_quantity": 30,
            "order_quantity": 10,
            "price_per_unit": 4.0,
            "lead_days": 4,
            "distributor_id": "CD002",
            "distributor_name": "Critical Supplier B",
        },
        {
            "medicine_id": "CRT003",
            "medicine_name": "Noncritical Supplement",
            "current_stock": 20,
            "reorder_point": 100,
            "forecast_quantity": 30,
            "order_quantity": 10,
            "price_per_unit": 6.0,
            "lead_days": 2,
            "distributor_id": "CD003",
            "distributor_name": "Critical Supplier C",
        },
    ]


def _multicycle_dataset() -> list[dict[str, Any]]:
    return [
        {
            "medicine_id": "MC001",
            "medicine_name": "Critical Vaccine",
            "current_stock": 5,
            "reorder_point": 100,
            "forecast_quantity": 60,
            "order_quantity": 10,
            "price_per_unit": 4.0,
            "lead_days": 5,
            "distributor_id": "MD001",
            "distributor_name": "Multi Supplier A",
        },
        {
            "medicine_id": "MC002",
            "medicine_name": "Priority Analgesic",
            "current_stock": 10,
            "reorder_point": 100,
            "forecast_quantity": 30,
            "order_quantity": 10,
            "price_per_unit": 6.0,
            "lead_days": 4,
            "distributor_id": "MD002",
            "distributor_name": "Multi Supplier B",
        },
        {
            "medicine_id": "MC003",
            "medicine_name": "Priority Antibiotic",
            "current_stock": 30,
            "reorder_point": 100,
            "forecast_quantity": 30,
            "order_quantity": 10,
            "price_per_unit": 7.0,
            "lead_days": 6,
            "distributor_id": "MD003",
            "distributor_name": "Multi Supplier C",
        },
        {
            "medicine_id": "MC004",
            "medicine_name": "Deferred Vitamin",
            "current_stock": 50,
            "reorder_point": 100,
            "forecast_quantity": 30,
            "order_quantity": 10,
            "price_per_unit": 5.0,
            "lead_days": 2,
            "distributor_id": "MD004",
            "distributor_name": "Multi Supplier D",
        },
    ]


@lru_cache(maxsize=1)
def _load_live_payload() -> dict[str, Any]:
    return get_procurement_payload()


def run_test_small_controlled_knapsack() -> ValidationResult:
    payload = _build_controlled_payload(
        pharmacy_id="VAL-KNAPSACK",
        monthly_budget=100.0,
        order_cycles=1,
        medicine_specs=_small_knapsack_dataset(),
    )
    _print_test_log("Test 1: Small controlled dataset", payload)
    _assert_budget_constraints(payload)

    reference = _reference_hybrid_allocation(
        payload["decisions"],
        monthly_budget=float(payload["monthly_budget"]),
        order_cycles=int(payload["order_cycles"]),
    )
    expected_selected_ids = {
        medicine_id
        for medicine_id, decision in reference.items()
        if decision["selected_for_order"]
    }
    actual_selected_ids = {
        decision["medicine_id"]
        for decision in payload["decisions"]
        if decision["selected_for_order"]
    }
    expected_priority = _round(
        sum(
            float(decision["priority_score"])
            for decision in payload["decisions"]
            if decision["medicine_id"] in expected_selected_ids
        ),
        4,
    )

    assert actual_selected_ids == expected_selected_ids, (
        f"Knapsack selected {sorted(actual_selected_ids)} but brute-force optimum "
        f"is {sorted(expected_selected_ids)}."
    )
    assert abs(float(payload["total_priority_achieved"]) - expected_priority) <= 1e-4, (
        f"Selected priority {float(payload['total_priority_achieved']):.4f} does not match "
        f"brute-force optimum {expected_priority:.4f}."
    )
    assert all(
        not decision["is_critical"] for decision in payload["decisions"]
    ), "Small knapsack control case unexpectedly produced critical medicines."

    assertions = [
        "Brute-force optimum for the controlled candidate set matches the hybrid allocator output.",
        "Total selected cost stays within the configured budget.",
        "The control dataset remains non-critical so the test isolates knapsack correctness.",
    ]
    return _result_from_payload(
        name="Test 1: Small controlled dataset",
        dataset_type="Controlled",
        objective="Verify 0/1 knapsack correctness against brute-force ground truth.",
        payload=payload,
        assertions=assertions,
    )


def run_test_critical_medicines() -> ValidationResult:
    payload = _build_controlled_payload(
        pharmacy_id="VAL-CRITICAL",
        monthly_budget=140.0,
        order_cycles=2,
        medicine_specs=_critical_dataset(),
    )
    _print_test_log("Test 2: Critical medicines", payload)
    _assert_budget_constraints(payload)

    critical_ids = {
        decision["medicine_id"]
        for decision in payload["decisions"]
        if decision["is_critical"]
    }
    selected_critical_ids = {
        decision["medicine_id"]
        for decision in payload["decisions"]
        if decision["is_critical"] and decision["selected_for_order"]
    }
    critical_reasons = {
        decision["reason"]
        for decision in payload["decisions"]
        if decision["is_critical"] and decision["selected_for_order"]
    }

    assert critical_ids, "Critical validation case did not produce any critical medicines."
    assert selected_critical_ids == critical_ids, (
        f"Critical medicines {sorted(critical_ids - selected_critical_ids)} were not selected."
    )
    assert critical_reasons == {CRITICAL_REASON}, (
        "Critical medicines must be marked with the CRITICAL selection reason."
    )

    assertions = [
        "Every medicine detected as critical is selected for procurement.",
        "Selected critical medicines are labeled with the CRITICAL decision reason.",
        "Total selected cost stays within the configured multi-cycle budget.",
    ]
    return _result_from_payload(
        name="Test 2: Critical medicines",
        dataset_type="Controlled",
        objective="Ensure the safety layer protects all stockout-critical medicines.",
        payload=payload,
        assertions=assertions,
    )


def run_test_budget_constraint_real_data() -> ValidationResult:
    payload = _load_live_payload()
    _print_test_log("Test 3: Budget constraint on real data", payload)
    _assert_budget_constraints(payload)

    selected_with_invalid_cycle = [
        decision["medicine_id"]
        for decision in payload["decisions"]
        if decision["selected_for_order"]
        and (
            decision["order_cycle"] is None
            or int(decision["order_cycle"]) < 1
            or int(decision["order_cycle"]) > int(payload["order_cycles"])
        )
    ]

    assert not selected_with_invalid_cycle, (
        f"Selected medicines have invalid cycle assignments: {selected_with_invalid_cycle}."
    )

    cycle_used_budget = sum(
        float(cycle_summary["used_budget"])
        for cycle_summary in payload["cycle_summaries"]
    )
    assert abs(cycle_used_budget - float(payload["total_cost_used"])) <= 0.01, (
        f"Cycle used budget {cycle_used_budget:.2f} does not reconcile with total cost "
        f"{float(payload['total_cost_used']):.2f}."
    )

    assertions = [
        "Total selected spend remains within the live monthly budget.",
        "Every cycle summary remains within its own allocated budget.",
        "Every selected live-data medicine has a valid cycle assignment.",
    ]
    notes = [
        f"Live reorder medicines: {len(payload['decisions'])}",
        f"Live critical medicines: {sum(1 for decision in payload['decisions'] if decision['is_critical'])}",
        f"Configured order cycles: {payload['order_cycles']}",
    ]
    return _result_from_payload(
        name="Test 3: Budget constraint",
        dataset_type="Real backend data",
        objective="Validate budget safety and cycle accounting on the live dataset.",
        payload=payload,
        assertions=assertions,
        notes=notes,
    )


def run_test_multicycle_behavior() -> ValidationResult:
    payload = _build_controlled_payload(
        pharmacy_id="VAL-MULTI",
        monthly_budget=200.0,
        order_cycles=2,
        medicine_specs=_multicycle_dataset(),
    )
    _print_test_log("Test 4: Multi-cycle behavior", payload)
    _assert_budget_constraints(payload)

    reference = _reference_hybrid_allocation(
        payload["decisions"],
        monthly_budget=float(payload["monthly_budget"]),
        order_cycles=int(payload["order_cycles"]),
    )

    for decision in payload["decisions"]:
        expected = reference[decision["medicine_id"]]
        assert decision["selected_for_order"] == expected["selected_for_order"], (
            f"{decision['medicine_id']} selection mismatch. "
            f"Expected {expected['selected_for_order']}, got {decision['selected_for_order']}."
        )
        assert decision["order_cycle"] == expected["order_cycle"], (
            f"{decision['medicine_id']} cycle mismatch. "
            f"Expected {expected['order_cycle']}, got {decision['order_cycle']}."
        )
        assert decision["reason"] == expected["reason"], (
            f"{decision['medicine_id']} reason mismatch. "
            f"Expected {expected['reason']}, got {decision['reason']}."
        )

    used_cycles = {
        int(decision["order_cycle"])
        for decision in payload["decisions"]
        if decision["selected_for_order"] and decision["order_cycle"] is not None
    }
    assert used_cycles == {1, 2}, (
        f"Expected both cycles to be used in the controlled multi-cycle test, got {sorted(used_cycles)}."
    )

    assertions = [
        "Decision reason, cycle assignment, and selection state match the independent reference allocator.",
        "The controlled case uses more than one cycle, verifying staged allocation behavior.",
        "Total selected spend remains within both monthly and per-cycle budgets.",
    ]
    return _result_from_payload(
        name="Test 4: Multi-cycle behavior",
        dataset_type="Controlled",
        objective="Verify correct cycle assignment under critical-first plus knapsack allocation.",
        payload=payload,
        assertions=assertions,
    )


def _run_with_capture(
    name: str,
    runner,
) -> ValidationResult:
    try:
        return runner()
    except Exception as error:
        return ValidationResult(
            name=name,
            dataset_type="Unknown",
            objective="Validation execution failed.",
            passed=False,
            metrics={},
            assertions=[f"Failure: {error}"],
            selected_medicines=[],
            skipped_medicines=[],
            total_cost=0.0,
            total_priority=0.0,
            notes=[],
        )


def _build_report(results: list[ValidationResult]) -> str:
    passed_count = sum(1 for result in results if result.passed)
    failed_count = len(results) - passed_count

    lines = [
        "# Hybrid Procurement Validation Report",
        "",
        f"Generated: {datetime.now(timezone.utc).isoformat()}",
        "",
        "## Pass/Fail Summary",
        "",
        f"- Total tests: {len(results)}",
        f"- Passed: {passed_count}",
        f"- Failed: {failed_count}",
        "",
        "## Test Matrix",
        "",
        "| Test | Dataset | Status | Budget Utilization (%) | Total Priority | Risk Violations | Skipped |",
        "| --- | --- | --- | ---: | ---: | ---: | ---: |",
    ]

    for result in results:
        budget_utilization = result.metrics.get("budget_utilization", 0.0)
        total_priority = result.metrics.get("total_priority_selected", 0.0)
        risk_violations = result.metrics.get("stockout_risk_violations", 0.0)
        skipped = result.metrics.get("number_of_skipped_medicines", 0.0)
        lines.append(
            f"| {result.name} | {result.dataset_type} | "
            f"{'PASS' if result.passed else 'FAIL'} | "
            f"{budget_utilization:.2f} | {total_priority:.4f} | "
            f"{risk_violations:.0f} | {skipped:.0f} |"
        )

    lines.extend(
        [
            "",
            "## Detailed Results",
            "",
        ]
    )

    for result in results:
        lines.extend(
            [
                f"### {result.name}",
                "",
                f"- Dataset: {result.dataset_type}",
                f"- Objective: {result.objective}",
                f"- Status: {'PASS' if result.passed else 'FAIL'}",
                f"- Total cost: {result.total_cost:.2f}",
                f"- Total priority: {result.total_priority:.4f}",
                "",
                "| Metric | Value |",
                "| --- | ---: |",
            ]
        )

        for key, value in result.metrics.items():
            if key in {"stockout_risk_violations", "number_of_skipped_medicines", "selected_count"}:
                lines.append(f"| {key} | {value:.0f} |")
            else:
                digits = 4 if key == "total_priority_selected" else 2
                lines.append(f"| {key} | {value:.{digits}f} |")

        lines.extend(
            [
                "",
                "**Assertions**",
                "",
            ]
        )
        for assertion in result.assertions:
            lines.append(f"- {assertion}")

        lines.extend(
            [
                "",
                "**Selected Medicines**",
                "",
            ]
        )
        if result.selected_medicines:
            for medicine in result.selected_medicines:
                lines.append(f"- {medicine}")
        else:
            lines.append("- None")

        lines.extend(
            [
                "",
                "**Skipped Medicines**",
                "",
            ]
        )
        if result.skipped_medicines:
            for medicine in result.skipped_medicines:
                lines.append(f"- {medicine}")
        else:
            lines.append("- None")

        if result.notes:
            lines.extend(
                [
                    "",
                    "**Notes**",
                    "",
                ]
            )
            for note in result.notes:
                lines.append(f"- {note}")

        lines.append("")

    lines.extend(
        [
            "## Conclusion",
            "",
            "The validation suite combines brute-force proof on controlled instances with live-data budget and cycle checks.",
            "A passing report means the hybrid procurement system satisfies the tested properties of safety, budget feasibility, and optimal cycle-level selection under the modeled rules.",
            "",
        ]
    )

    return "\n".join(lines)


def main() -> None:
    tests = [
        ("Test 1: Small controlled dataset", run_test_small_controlled_knapsack),
        ("Test 2: Critical medicines", run_test_critical_medicines),
        ("Test 3: Budget constraint", run_test_budget_constraint_real_data),
        ("Test 4: Multi-cycle behavior", run_test_multicycle_behavior),
    ]
    results = [_run_with_capture(name, runner) for name, runner in tests]
    report_text = _build_report(results)
    REPORT_PATH.write_text(report_text, encoding="utf-8")

    print("\nValidation summary:")
    for result in results:
        print(f"- {result.name}: {'PASS' if result.passed else 'FAIL'}")
    print(f"\nReport written to {REPORT_PATH}")


if __name__ == "__main__":
    main()
