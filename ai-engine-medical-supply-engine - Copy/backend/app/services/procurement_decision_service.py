import math
from functools import lru_cache
from typing import Any, Optional, Union

from src.forecast import load_demand_by_medicine
from src.holtphet_main import (
    resolve_dataset_path,
    get_batch_price_from_mongo,
    get_product_id_for_medicine,
)
from src.procurement_data import SAMPLE_DISTRIBUTORS, get_distributor_inventory_entry


HIGH_PRIORITY_THRESHOLD = 0.7
MEDIUM_PRIORITY_THRESHOLD = 0.4
SHORTAGE_WEIGHT = 0.5
DEMAND_WEIGHT = 0.3
LEAD_TIME_WEIGHT = 0.2
DAYS_IN_MONTH = 30.0
MAX_DP_BUDGET_UNITS = 200000
EPSILON = 1e-12

CRITICAL_REASON = "CRITICAL"
KNAPSACK_REASON = "KNAPSACK"
SKIPPED_REASON = "SKIPPED"
CRITICAL_URGENCY = "CRITICAL"
URGENT_URGENCY = "URGENT"
SAFE_URGENCY = "SAFE"
INSUFFICIENT_INVENTORY_REASON = "INSUFFICIENT DISTRIBUTOR INVENTORY"
NOT_STOCKED_REASON = "MEDICINE NOT STOCKED BY DISTRIBUTOR"


def _round_currency(value: float) -> float:
    return round(float(value), 2)


def _round_score(value: float) -> float:
    return round(float(value), 4)


def _safe_ratio(numerator: float, denominator: float) -> float:
    if denominator <= 0:
        return 0.0
    return float(numerator) / float(denominator)


def _resolve_cycle_length(order_cycles: int) -> float:
    if order_cycles <= 0:
        return DAYS_IN_MONTH
    return DAYS_IN_MONTH / float(order_cycles)


def _compute_safe_deadline_days(
    *,
    current_stock: float,
    safety_stock: float,
    daily_demand: float,
    lead_days: float,
) -> Optional[float]:
    if daily_demand <= 0:
        return None

    return ((current_stock - safety_stock) / daily_demand) - lead_days


def _resolve_urgency_level(
    safe_deadline_days: Optional[float],
    cycle_length: float,
) -> str:
    if safe_deadline_days is None:
        return SAFE_URGENCY
    if safe_deadline_days <= 0:
        return CRITICAL_URGENCY
    if safe_deadline_days <= cycle_length:
        return URGENT_URGENCY
    return SAFE_URGENCY


def _resolve_adjusted_cycle(
    safe_deadline_days: Optional[float],
    *,
    order_cycles: int,
    cycle_length: float,
) -> Optional[int]:
    if order_cycles <= 0:
        return None
    if safe_deadline_days is None:
        return order_cycles

    normalized_deadline = max(float(safe_deadline_days), 0.0)
    latest_safe_cycle = int(math.floor(normalized_deadline / cycle_length)) + 1
    return max(1, min(order_cycles, latest_safe_cycle))


def _priority_class(priority_score: float) -> str:
    if priority_score >= HIGH_PRIORITY_THRESHOLD:
        return "HIGH"
    if priority_score >= MEDIUM_PRIORITY_THRESHOLD:
        return "MEDIUM"
    return "LOW"


def _serialize_number(value: float) -> Union[int, float]:
    rounded_value = round(float(value), 2)
    if rounded_value.is_integer():
        return int(rounded_value)
    return rounded_value


def _to_cents(value: float) -> int:
    return int(round(float(value) * 100))


def _from_cents(value: int) -> float:
    return round(float(value) / 100.0, 2)


def _ceil_divide(numerator: int, denominator: int) -> int:
    return (numerator + denominator - 1) // denominator


def _resolve_scale_cents(budget_cents: int) -> int:
    if budget_cents <= MAX_DP_BUDGET_UNITS:
        return 1

    return max(1, _ceil_divide(budget_cents, MAX_DP_BUDGET_UNITS))


def _normalize_order_quantity(value: Any) -> int:
    if value is None:
        return 0
    return max(0, int(math.ceil(float(value))))


def _get_cost_cents(medicine: dict[str, Any]) -> Optional[int]:
    cost = medicine.get("cost")
    if cost is None:
        return None
    return max(_to_cents(float(cost)), 0)


def _critical_sort_key(medicine: dict[str, Any]) -> tuple[float, float, float, float, str]:
    return (
        float(medicine["safe_deadline_days"])
        if medicine["safe_deadline_days"] is not None
        else float("inf"),
        float(medicine["days_to_stockout"])
        if medicine["days_to_stockout"] is not None
        else float("inf"),
        -float(medicine["lead_days"] or 0),
        -float(medicine["priority_score"]),
        float(medicine["cost"])
        if medicine["cost"] is not None
        else float("inf"),
        str(medicine["medicine_id"]),
    )


def _decision_sort_key(medicine: dict[str, Any]) -> tuple[int, float, int, int, float, float, str]:
    reason_rank = (
        0
        if medicine["reason"] == CRITICAL_REASON
        else 1
        if medicine["reason"] == KNAPSACK_REASON
        else 2
    )
    order_cycle = (
        float(medicine["order_cycle"])
        if medicine["order_cycle"] is not None
        else float("inf")
    )
    cost = float(medicine["cost"]) if medicine["cost"] is not None else float("inf")

    return (
        0 if medicine["selected_for_order"] else 1,
        order_cycle,
        reason_rank,
        0 if medicine["is_critical"] else 1,
        -float(medicine["priority_score"]),
        cost,
        str(medicine["medicine_id"]),
    )


def _sort_decisions(decisions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(decisions, key=_decision_sort_key)


def _split_budget_cents(total_budget_cents: int, order_cycles: int) -> list[int]:
    if order_cycles <= 0:
        return []

    base_budget = total_budget_cents // order_cycles
    remainder = total_budget_cents % order_cycles

    return [
        base_budget + (1 if cycle_index < remainder else 0)
        for cycle_index in range(order_cycles)
    ]


@lru_cache(maxsize=1)
def load_average_demand_map() -> dict[str, float]:
    demand_by_medicine = load_demand_by_medicine(resolve_dataset_path())

    return {
        str(medicine_id): float(series.mean()) if not series.empty else 0.0
        for medicine_id, series in demand_by_medicine.items()
    }


def _candidate_sort_key(candidate: dict[str, Any]) -> tuple[float, float, float, str]:
    return (
        float(candidate["price_per_unit"]),
        float(candidate["lead_days"]),
        -float(candidate["rating"]),
        str(candidate["id"]),
    )


def _evaluate_distributor_candidates(
    medicine_id: str,
    required_quantity: int,
    distributors: list[dict[str, Any]],
) -> dict[str, Any]:
    best_candidate: Optional[dict[str, Any]] = None
    fastest_stocking_lead_days: Optional[float] = None
    highest_available_qty = 0
    evaluations: list[dict[str, Any]] = []

    for distributor in distributors:
        lead_days = float(distributor.get("lead_days", 0.0) or 0.0)
        rating = float(distributor.get("rating", 0.0) or 0.0)
        inventory_entry = get_distributor_inventory_entry(distributor, medicine_id)
        evaluation = {
            "id": str(distributor["id"]),
            "name": str(distributor["name"]),
            "lead_days": lead_days,
            "rating": rating,
            "price_per_unit": None,
            "available_qty": 0,
            "valid": False,
            "rejection_reason": NOT_STOCKED_REASON,
        }

        if inventory_entry is None:
            evaluations.append(evaluation)
            continue

        available_qty = int(inventory_entry["available_qty"])
        price_per_unit = float(inventory_entry["price_per_unit"])
        
        # Try to fetch the actual batch price from MongoDB
        # This overrides the distributor's price with the real pharmacy pricing
        mongo_batch_price = None
        try:
            product_id = get_product_id_for_medicine(str(medicine_id))
            if product_id:
                mongo_batch_price = get_batch_price_from_mongo(product_id)
        except Exception:
            # If MongoDB lookup fails, fall back to distributor price
            pass
        
        # Use batch price from MongoDB if available, otherwise use distributor price
        if mongo_batch_price is not None:
            price_per_unit = mongo_batch_price
            
        evaluation["price_per_unit"] = _round_currency(price_per_unit)
        evaluation["available_qty"] = available_qty

        if (
            fastest_stocking_lead_days is None
            or lead_days < fastest_stocking_lead_days
        ):
            fastest_stocking_lead_days = lead_days
        highest_available_qty = max(highest_available_qty, available_qty)

        if available_qty < required_quantity:
            evaluation["rejection_reason"] = INSUFFICIENT_INVENTORY_REASON
            evaluations.append(evaluation)
            continue

        candidate = {
            "id": distributor["id"],
            "name": distributor["name"],
            "lead_days": lead_days,
            "rating": rating,
            "price_per_unit": price_per_unit,
            "available_qty": available_qty,
        }
        evaluation["valid"] = True
        evaluation["rejection_reason"] = None

        if (
            best_candidate is None
            or _candidate_sort_key(candidate) < _candidate_sort_key(best_candidate)
        ):
            best_candidate = candidate

        evaluations.append(evaluation)

    selected_distributor_id = (
        str(best_candidate["id"]) if best_candidate is not None else None
    )
    for evaluation in evaluations:
        evaluation["selected"] = evaluation["id"] == selected_distributor_id

    return {
        "selected_distributor": best_candidate,
        "is_fulfillable": best_candidate is not None,
        "available_qty": (
            int(best_candidate["available_qty"])
            if best_candidate is not None
            else highest_available_qty
        ),
        "availability_reason": (
            None if best_candidate is not None else INSUFFICIENT_INVENTORY_REASON
        ),
        "fallback_lead_days": fastest_stocking_lead_days,
        "evaluations": evaluations,
    }


def _select_best_distributor(
    medicine_id: str,
    required_quantity: int,
    distributors: list[dict[str, Any]],
) -> dict[str, Any]:
    selection = _evaluate_distributor_candidates(
        medicine_id,
        required_quantity,
        distributors,
    )
    return {
        "selected_distributor": selection["selected_distributor"],
        "is_fulfillable": selection["is_fulfillable"],
        "available_qty": selection["available_qty"],
        "availability_reason": selection["availability_reason"],
        "fallback_lead_days": selection["fallback_lead_days"],
    }


def _build_medicine_candidates(
    *,
    inventory_snapshot: dict[str, Any],
    reorder_payload: dict[str, Any],
    procurement_payload: dict[str, Any],
    distributors: list[dict[str, Any]],
    order_cycles: int,
) -> list[dict[str, Any]]:
    average_demand_map = load_average_demand_map()
    inventory_lookup = {
        item["medicine_id"]: item for item in inventory_snapshot["inventory"]
    }
    reorder_lookup = {
        request["medicine_id"]: request
        for request in reorder_payload["reorder_requests"]
    }
    procurement_lookup = {
        order["medicine_id"]: order
        for order in procurement_payload["procurement_orders"]
    }

    max_lead_time = max(
        (float(distributor["lead_days"]) for distributor in distributors),
        default=0.0,
    )
    cycle_length = _resolve_cycle_length(order_cycles)
    candidates: list[dict[str, Any]] = []

    for medicine_id, reorder_row in reorder_lookup.items():
        inventory_row = inventory_lookup.get(medicine_id, {})
        if not bool(inventory_row.get("reorder", reorder_row.get("reorder", True))):
            continue

        procurement_row = procurement_lookup.get(medicine_id, {})

        forecast_quantity = float(inventory_row.get("forecast_quantity", 0.0))
        average_demand = float(average_demand_map.get(medicine_id, 0.0))
        current_stock = float(
            inventory_row.get("current_stock", reorder_row.get("current_stock", 0.0))
        )
        safety_stock = float(inventory_row.get("safety_stock", 0.0))
        reorder_point = float(inventory_row.get("reorder_point", 0.0))
        order_quantity = _normalize_order_quantity(
            procurement_row.get("order_quantity", reorder_row.get("order_quantity"))
        )
        distributor_selection = _select_best_distributor(
            str(medicine_id),
            order_quantity,
            distributors,
        )
        selected_distributor = distributor_selection["selected_distributor"]
        lead_days = (
            float(selected_distributor["lead_days"])
            if selected_distributor is not None
            else (
                float(distributor_selection["fallback_lead_days"])
                if distributor_selection["fallback_lead_days"] is not None
                else max_lead_time
            )
        )
        price_per_unit = (
            float(selected_distributor["price_per_unit"])
            if selected_distributor is not None
            else None
        )

        shortage_ratio = max(
            _safe_ratio(reorder_point - current_stock, reorder_point),
            0.0,
        )
        demand_ratio = _safe_ratio(forecast_quantity, average_demand)
        lead_time_factor = _safe_ratio(lead_days, max_lead_time)

        priority_score = (
            SHORTAGE_WEIGHT * shortage_ratio
            + DEMAND_WEIGHT * demand_ratio
            + LEAD_TIME_WEIGHT * lead_time_factor
        )
        cost = (
            _round_currency(order_quantity * price_per_unit)
            if price_per_unit is not None
            else None
        )

        daily_demand = forecast_quantity / DAYS_IN_MONTH if forecast_quantity > 0 else 0.0
        days_to_stockout = (
            current_stock / daily_demand
            if daily_demand > 0
            else None
        )
        safe_deadline_days = _compute_safe_deadline_days(
            current_stock=current_stock,
            safety_stock=safety_stock,
            daily_demand=daily_demand,
            lead_days=lead_days,
        )
        urgency_level = _resolve_urgency_level(safe_deadline_days, cycle_length)
        adjusted_cycle = _resolve_adjusted_cycle(
            safe_deadline_days,
            order_cycles=order_cycles,
            cycle_length=cycle_length,
        )
        is_critical = urgency_level == CRITICAL_URGENCY

        candidates.append(
            {
                "medicine_id": str(medicine_id),
                "medicine_name": reorder_row.get(
                    "medicine_name",
                    inventory_row.get("medicine_name", str(medicine_id)),
                ),
                "reorder": True,
                "priority": _priority_class(priority_score),
                "priority_score": _round_score(priority_score),
                "is_critical": bool(is_critical),
                "selected_for_order": False,
                "order_cycle": None,
                "reason": SKIPPED_REASON,
                "cost": cost,
                "order_quantity": order_quantity,
                "selected_distributor_id": (
                    selected_distributor["id"] if selected_distributor else None
                ),
                "selected_distributor_name": (
                    selected_distributor["name"] if selected_distributor else None
                ),
                "distributor_id": (
                    selected_distributor["id"] if selected_distributor else None
                ),
                "distributor_name": (
                    selected_distributor["name"] if selected_distributor else None
                ),
                "lead_days": int(lead_days) if lead_days else None,
                "price_per_unit": (
                    _round_currency(price_per_unit)
                    if price_per_unit is not None
                    else None
                ),
                "selected_price_per_unit": (
                    _round_currency(price_per_unit)
                    if price_per_unit is not None
                    else None
                ),
                "available_qty": int(distributor_selection["available_qty"]),
                "is_fulfillable": bool(distributor_selection["is_fulfillable"]),
                "availability_reason": distributor_selection["availability_reason"],
                "safety_stock": round(safety_stock, 2),
                "forecast_quantity": round(forecast_quantity, 2),
                "average_demand": round(average_demand, 2),
                "current_stock": round(current_stock, 2),
                "reorder_point": round(reorder_point, 2),
                "daily_demand": round(daily_demand, 4) if daily_demand else 0.0,
                "days_to_stockout": (
                    round(days_to_stockout, 2)
                    if days_to_stockout is not None
                    else None
                ),
                "safe_deadline_days": (
                    round(safe_deadline_days, 2)
                    if safe_deadline_days is not None
                    else None
                ),
                "urgency_level": urgency_level,
                "adjusted_cycle": adjusted_cycle,
                "trigger_reason": reorder_row.get("trigger_reason"),
                "mongo_mapped": bool(inventory_row.get("mongo_mapped", False)),
            }
        )

    return sorted(candidates, key=lambda candidate: candidate["medicine_id"])


def _solve_knapsack_for_budget_cents(
    medicines: list[dict[str, Any]],
    budget_cents: int,
) -> set[str]:
    budget_cents = max(int(budget_cents), 0)
    if budget_cents <= 0 or not medicines:
        return set()

    scale_cents = _resolve_scale_cents(budget_cents)
    scaled_budget = budget_cents // scale_cents
    if scaled_budget <= 0:
        return set()

    selectable_items: list[dict[str, Any]] = []
    zero_cost_selected_ids: set[str] = set()

    for medicine in medicines:
        cost_cents = _get_cost_cents(medicine)
        if cost_cents is None:
            continue

        if cost_cents == 0:
            zero_cost_selected_ids.add(medicine["medicine_id"])
            continue

        selectable_items.append(
            {
                "medicine_id": medicine["medicine_id"],
                "priority_score": float(medicine["priority_score"]),
                "scaled_cost": _ceil_divide(cost_cents, scale_cents),
            }
        )

    if not selectable_items:
        return zero_cost_selected_ids

    dp = [0.0] * (scaled_budget + 1)
    take_rows: list[bytearray] = []

    for item in selectable_items:
        take_row = bytearray(scaled_budget + 1)
        item_cost = item["scaled_cost"]
        item_priority = item["priority_score"]

        if item_cost > scaled_budget:
            take_rows.append(take_row)
            continue

        for budget in range(scaled_budget, item_cost - 1, -1):
            candidate_priority = dp[budget - item_cost] + item_priority
            if candidate_priority > dp[budget] + EPSILON:
                dp[budget] = candidate_priority
                take_row[budget] = 1

        take_rows.append(take_row)

    best_priority = max(dp)
    best_budget = min(
        budget
        for budget, priority in enumerate(dp)
        if abs(priority - best_priority) <= EPSILON
    )

    selected_medicine_ids: set[str] = set(zero_cost_selected_ids)
    remaining_budget = best_budget

    for item_index in range(len(selectable_items) - 1, -1, -1):
        item = selectable_items[item_index]
        item_cost = item["scaled_cost"]

        if item_cost <= remaining_budget and take_rows[item_index][remaining_budget]:
            selected_medicine_ids.add(item["medicine_id"])
            remaining_budget -= item_cost

    return selected_medicine_ids


def _allocation_candidate_snapshot(medicine: dict[str, Any]) -> dict[str, Any]:
    return {
        "medicine_id": str(medicine["medicine_id"]),
        "medicine_name": str(medicine.get("medicine_name", medicine["medicine_id"])),
        "priority": str(medicine["priority"]),
        "priority_score": _round_score(medicine["priority_score"]),
        "cost": medicine["cost"],
        "order_quantity": int(medicine["order_quantity"]),
        "adjusted_cycle": medicine["adjusted_cycle"],
        "safe_deadline_days": medicine["safe_deadline_days"],
        "is_critical": bool(medicine["is_critical"]),
        "selected_for_order": bool(medicine["selected_for_order"]),
        "reason": str(medicine["reason"]),
    }


def _apply_multi_cycle_hybrid_allocation_with_trace(
    medicines: list[dict[str, Any]],
    *,
    monthly_budget: float,
    order_cycles: int,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    remaining_lookup = {
        medicine["medicine_id"]: medicine for medicine in medicines
    }
    cycle_budgets = _split_budget_cents(max(_to_cents(monthly_budget), 0), order_cycles)
    cycle_summaries: list[dict[str, Any]] = []
    allocation_trace = {
        "cycle_budgets": [
            {
                "cycle": cycle_number,
                "budget": _from_cents(cycle_budget_cents),
            }
            for cycle_number, cycle_budget_cents in enumerate(cycle_budgets, start=1)
        ],
        "cycles": [],
    }

    for cycle_number, cycle_budget_cents in enumerate(cycle_budgets, start=1):
        overdue_removed = [
            remaining_lookup[medicine_id]
            for medicine_id in [
                medicine["medicine_id"]
                for medicine in remaining_lookup.values()
                if medicine.get("adjusted_cycle") is not None
                and int(medicine["adjusted_cycle"]) < cycle_number
            ]
            if medicine_id in remaining_lookup
        ]
        for medicine in overdue_removed:
            remaining_lookup.pop(medicine["medicine_id"], None)

        remaining_budget_cents = cycle_budget_cents
        cycle_selected_count = 0
        critical_selected_count = 0

        cycle_trace: dict[str, Any] = {
            "cycle": cycle_number,
            "budget": _from_cents(cycle_budget_cents),
            "remaining_budget_at_start": _from_cents(remaining_budget_cents),
            "overdue_removed": [
                _allocation_candidate_snapshot(medicine)
                for medicine in overdue_removed
            ],
        }

        critical_candidates = sorted(
            [
                medicine
                for medicine in remaining_lookup.values()
                if medicine["is_critical"]
            ],
            key=_critical_sort_key,
        )
        cycle_trace["critical_candidates"] = [
            _allocation_candidate_snapshot(medicine)
            for medicine in critical_candidates
        ]

        critical_selected_ids: list[str] = []
        for medicine in critical_candidates:
            cost_cents = _get_cost_cents(medicine)
            if cost_cents is None or cost_cents > remaining_budget_cents:
                continue

            medicine["selected_for_order"] = True
            medicine["order_cycle"] = cycle_number
            medicine["reason"] = CRITICAL_REASON
            remaining_budget_cents -= cost_cents
            cycle_selected_count += 1
            critical_selected_count += 1
            critical_selected_ids.append(str(medicine["medicine_id"]))
            remaining_lookup.pop(medicine["medicine_id"], None)

        cycle_trace["critical_selected_ids"] = critical_selected_ids
        cycle_trace["remaining_budget_after_critical"] = _from_cents(
            remaining_budget_cents
        )

        due_candidates = [
            medicine
            for medicine in remaining_lookup.values()
            if medicine.get("adjusted_cycle") == cycle_number
            and not medicine["is_critical"]
        ]
        cycle_trace["due_candidates"] = [
            _allocation_candidate_snapshot(medicine)
            for medicine in due_candidates
        ]
        due_selected_ids = _solve_knapsack_for_budget_cents(
            due_candidates,
            remaining_budget_cents,
        )
        cycle_trace["due_selected_ids"] = sorted(due_selected_ids)

        if due_selected_ids:
            selected_cost_cents = 0

            for medicine in medicines:
                medicine_id = medicine["medicine_id"]
                if medicine_id not in due_selected_ids:
                    continue
                if medicine_id not in remaining_lookup:
                    continue

                medicine["selected_for_order"] = True
                medicine["order_cycle"] = cycle_number
                medicine["reason"] = KNAPSACK_REASON
                selected_cost_cents += _get_cost_cents(medicine) or 0
                cycle_selected_count += 1
                remaining_lookup.pop(medicine_id, None)

            remaining_budget_cents = max(0, remaining_budget_cents - selected_cost_cents)

        cycle_trace["remaining_budget_after_due"] = _from_cents(
            remaining_budget_cents
        )

        future_candidates = [
            medicine
            for medicine in remaining_lookup.values()
            if medicine.get("adjusted_cycle") is None
            or int(medicine["adjusted_cycle"]) > cycle_number
        ]
        cycle_trace["future_candidates"] = [
            _allocation_candidate_snapshot(medicine)
            for medicine in future_candidates
        ]
        knapsack_selected_ids = _solve_knapsack_for_budget_cents(
            future_candidates,
            remaining_budget_cents,
        )
        cycle_trace["future_selected_ids"] = sorted(knapsack_selected_ids)

        if knapsack_selected_ids:
            selected_cost_cents = 0

            for medicine in medicines:
                medicine_id = medicine["medicine_id"]
                if medicine_id not in knapsack_selected_ids:
                    continue
                if medicine_id not in remaining_lookup:
                    continue

                medicine["selected_for_order"] = True
                medicine["order_cycle"] = cycle_number
                medicine["reason"] = KNAPSACK_REASON
                selected_cost_cents += _get_cost_cents(medicine) or 0
                cycle_selected_count += 1
                remaining_lookup.pop(medicine_id, None)

            remaining_budget_cents = max(0, remaining_budget_cents - selected_cost_cents)

        cycle_trace["remaining_budget_after_future"] = _from_cents(
            remaining_budget_cents
        )
        cycle_trace["remaining_medicines_after_cycle"] = [
            _allocation_candidate_snapshot(medicine)
            for medicine in remaining_lookup.values()
        ]

        cycle_summaries.append(
            {
                "cycle": cycle_number,
                "budget": _from_cents(cycle_budget_cents),
                "used_budget": _from_cents(cycle_budget_cents - remaining_budget_cents),
                "remaining_budget": _from_cents(remaining_budget_cents),
                "selected_count": cycle_selected_count,
                "critical_selected_count": critical_selected_count,
            }
        )
        allocation_trace["cycles"].append(cycle_trace)

    return cycle_summaries, allocation_trace


def _apply_multi_cycle_hybrid_allocation(
    medicines: list[dict[str, Any]],
    *,
    monthly_budget: float,
    order_cycles: int,
) -> list[dict[str, Any]]:
    cycle_summaries, _ = _apply_multi_cycle_hybrid_allocation_with_trace(
        medicines,
        monthly_budget=monthly_budget,
        order_cycles=order_cycles,
    )
    return cycle_summaries


def build_hybrid_procurement_payload(
    *,
    inventory_snapshot: dict[str, Any],
    reorder_payload: dict[str, Any],
    procurement_payload: dict[str, Any],
    config: dict[str, Any],
    distributors: list[dict[str, Any]] = SAMPLE_DISTRIBUTORS,
) -> dict[str, Any]:
    order_cycles = int(config["order_cycles"])
    medicines = _build_medicine_candidates(
        inventory_snapshot=inventory_snapshot,
        reorder_payload=reorder_payload,
        procurement_payload=procurement_payload,
        distributors=distributors,
        order_cycles=order_cycles,
    )

    monthly_budget = float(config["monthly_budget"])
    cycle_summaries = _apply_multi_cycle_hybrid_allocation(
        medicines,
        monthly_budget=monthly_budget,
        order_cycles=order_cycles,
    )

    selected_medicines = [
        medicine for medicine in medicines if medicine["selected_for_order"]
    ]
    total_cost_used = sum(
        float(medicine["cost"] or 0.0) for medicine in selected_medicines
    )
    total_priority_achieved = sum(
        float(medicine["priority_score"]) for medicine in selected_medicines
    )
    fulfillable_count = sum(
        1 for medicine in medicines if bool(medicine["is_fulfillable"])
    )

    return {
        "pharmacy_id": str(config["pharmacy_id"]),
        "monthly_budget": _serialize_number(monthly_budget),
        "order_cycles": order_cycles,
        "budget_per_cycle": _serialize_number(monthly_budget / order_cycles),
        "decisions": _sort_decisions(medicines),
        "cycle_summaries": cycle_summaries,
        "fulfillable_count": fulfillable_count,
        "unfulfillable_count": len(medicines) - fulfillable_count,
        "total_cost_used": _round_currency(total_cost_used),
        "total_priority_achieved": _round_score(total_priority_achieved),
    }