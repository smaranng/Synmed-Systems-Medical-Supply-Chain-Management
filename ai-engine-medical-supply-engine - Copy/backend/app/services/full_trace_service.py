from __future__ import annotations

from typing import Any

from app.services.procurement_service import get_procurement_payload


def _normalize_id(value: str) -> str:
    return str(value).strip().upper()


def get_full_trace_payload(medicine_id: str) -> dict[str, Any]:
    normalized_id = _normalize_id(medicine_id)
    procurement_payload = get_procurement_payload()

    decisions = procurement_payload.get("decisions", [])
    if not isinstance(decisions, list):
        decisions = []

    decision = next(
        (
            row
            for row in decisions
            if _normalize_id(row.get("medicine_id", "")) == normalized_id
        ),
        None,
    )

    if decision is None:
        raise KeyError(f"Trace not found for medicine_id '{medicine_id}'.")

    cycle_summaries = procurement_payload.get("cycle_summaries", [])
    if not isinstance(cycle_summaries, list):
        cycle_summaries = []

    return {
        "medicine_id": normalized_id,
        "pharmacy_id": procurement_payload.get("pharmacy_id"),
        "monthly_budget": procurement_payload.get("monthly_budget"),
        "order_cycles": procurement_payload.get("order_cycles"),
        "decision": decision,
        "cycle_summaries": cycle_summaries,
        "optimization_summary": {
            "total_cost_used": procurement_payload.get("total_cost_used"),
            "total_priority_achieved": procurement_payload.get("total_priority_achieved"),
        },
    }
