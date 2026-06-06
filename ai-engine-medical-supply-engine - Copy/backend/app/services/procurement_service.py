import contextlib
import io
import json
import os
from datetime import datetime, timezone
from typing import Any, Iterator

try:
    from groq import Groq
except ImportError:  # pragma: no cover - optional for non-streaming payloads
    Groq = None

from app.core.config import load_app_environment
from app.services.inventory_service import build_inventory_snapshot
from app.services.pharmacy_config_service import load_pharmacy_config
from app.services.procurement_decision_service import (
    build_hybrid_procurement_payload,
)

from src.procurement_data import SAMPLE_DISTRIBUTORS
from src.procurement_main import process_reorder_requests


DEFAULT_REASONING_MODEL = "openai/gpt-oss-20b"
THINKING_MARKER = "[THINKING]"
FINAL_JSON_MARKER = "[FINAL_JSON]"

REASONING_SYSTEM_PROMPT = """
You are a senior hospital procurement reasoning agent operating inside a real-time enterprise dashboard.
You will receive live inventory, supplier, budget, critical-risk, multi-cycle, and knapsack-optimization data.
Think step-by-step before giving final procurement decisions.
Output visible reasoning only.
Do not output JSON.
Do not use markdown code fences.
Explain which medicines are critical, how stock pressure and demand affect priority, how supplier lead time and cost influence selection, how cycle budgets are used, and why the final set is safe and optimal under the budget constraint.
Use medicine-level supplier pricing and validated supplier inventory when explaining distributor choice or unfulfillable lines.
Base urgency on safety-stock deadlines, not fixed buffer days, and explain when an order must move to an earlier cycle.
Keep the visible reasoning concise and operational.
""".strip()


@contextlib.contextmanager
def _quiet_procurement_execution():
    previous_flag = os.environ.get("DISABLE_PROCUREMENT_AGENT")
    os.environ["DISABLE_PROCUREMENT_AGENT"] = "1"

    try:
        with contextlib.redirect_stdout(io.StringIO()):
            with contextlib.redirect_stderr(io.StringIO()):
                yield
    finally:
        if previous_flag is None:
            os.environ.pop("DISABLE_PROCUREMENT_AGENT", None)
        else:
            os.environ["DISABLE_PROCUREMENT_AGENT"] = previous_flag


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


def _build_hybrid_procurement_payload() -> dict[str, Any]:
    inventory_snapshot = build_inventory_snapshot()
    config = load_pharmacy_config()
    reorder_payload = _with_configured_pharmacy_id(
        inventory_snapshot["_raw_reorder_payload"],
        config["pharmacy_id"],
    )

    with _quiet_procurement_execution():
        procurement_payload = process_reorder_requests(
            reorder_payload,
            pharmacy_id=config["pharmacy_id"],
        )

    return build_hybrid_procurement_payload(
        inventory_snapshot=inventory_snapshot,
        reorder_payload=reorder_payload,
        procurement_payload=procurement_payload,
        config=config,
        distributors=SAMPLE_DISTRIBUTORS,
    )


def get_procurement_payload() -> dict[str, Any]:
    return _build_hybrid_procurement_payload()


def ensure_procurement_stream_ready() -> None:
    load_app_environment()
    if not os.getenv("GROQ_API_KEY"):
        raise ValueError("GROQ_API_KEY is not set.")


def _get_groq_client() -> Groq:
    ensure_procurement_stream_ready()
    if Groq is None:
        raise ValueError("groq package is not installed.")
    return Groq(api_key=os.environ["GROQ_API_KEY"])


def _get_reasoning_model() -> str:
    configured_model = os.getenv(
        "GROQ_REASONING_MODEL",
        os.getenv("GROQ_MODEL", DEFAULT_REASONING_MODEL),
    ).strip()
    return configured_model or DEFAULT_REASONING_MODEL


def _build_supplier_focus() -> list[dict[str, Any]]:
    supplier_focus = []

    for distributor in SAMPLE_DISTRIBUTORS:
        inventory = distributor.get("inventory", {})
        prices = [
            float(item["price_per_unit"])
            for item in inventory.values()
            if isinstance(item, dict) and item.get("price_per_unit") is not None
        ]
        quantities = [
            int(float(item["available_qty"]))
            for item in inventory.values()
            if isinstance(item, dict) and item.get("available_qty") is not None
        ]

        supplier_focus.append(
            {
                "id": distributor["id"],
                "name": distributor["name"],
                "lead_days": distributor["lead_days"],
                "rating": distributor["rating"],
                "inventory_medicine_count": len(inventory),
                "min_price_per_unit": round(min(prices), 2) if prices else None,
                "max_price_per_unit": round(max(prices), 2) if prices else None,
                "max_available_qty": max(quantities) if quantities else 0,
                "min_order_value": distributor["min_order_value"],
            }
        )

    return supplier_focus


def _build_procurement_context(
    procurement_payload: dict[str, Any],
) -> dict[str, Any]:
    inventory_snapshot = build_inventory_snapshot()
    decisions = procurement_payload["decisions"]
    selected_decisions = [
        decision for decision in decisions if decision["selected_for_order"]
    ]
    skipped_decisions = [
        decision for decision in decisions if not decision["selected_for_order"]
    ]
    critical_decisions = [
        decision for decision in decisions if decision["is_critical"]
    ]
    critical_selected = [
        decision
        for decision in critical_decisions
        if decision["selected_for_order"]
    ]
    fulfillable_decisions = [
        decision for decision in decisions if decision["is_fulfillable"]
    ]
    unfulfillable_decisions = [
        decision for decision in decisions if not decision["is_fulfillable"]
    ]

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "pharmacy_id": procurement_payload["pharmacy_id"],
        "dataset": inventory_snapshot["dataset"],
        "monthly_budget": procurement_payload["monthly_budget"],
        "order_cycles": procurement_payload["order_cycles"],
        "budget_per_cycle": procurement_payload["budget_per_cycle"],
        "catalog_summary": {
            "total_inventory_medicines": inventory_snapshot["total_medicines"],
            "reorder_count": inventory_snapshot["reorder_count"],
            "decision_count": len(decisions),
            "selected_count": len(selected_decisions),
            "skipped_count": len(skipped_decisions),
            "critical_count": len(critical_decisions),
            "critical_selected_count": len(critical_selected),
            "fulfillable_count": len(fulfillable_decisions),
            "unfulfillable_count": len(unfulfillable_decisions),
        },
        "decisions": decisions,
        "cycle_summaries": procurement_payload["cycle_summaries"],
        "optimization_summary": {
            "total_cost_used": procurement_payload["total_cost_used"],
            "total_priority_achieved": procurement_payload["total_priority_achieved"],
        },
        "supplier_data": _build_supplier_focus(),
    }


def _stringify_context(context: dict[str, Any]) -> str:
    return json.dumps(
        context,
        ensure_ascii=False,
        separators=(",", ":"),
    )


def _build_reasoning_messages(context: dict[str, Any]) -> list[dict[str, str]]:
    return [
        {"role": "system", "content": REASONING_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                "Think step-by-step before giving final procurement decisions.\n"
                "Use the hybrid procurement data below.\n"
                "Explain your reasoning as a visible running analysis for an enterprise operations dashboard.\n"
                "Keep it concise: use short operational steps rather than long paragraphs.\n"
                "Focus on safety-stock deadlines, shortage pressure, demand ratio, lead time impact, per-medicine distributor pricing, distributor inventory validation, unfulfillable medicines, cycle budgets, critical medicines handled first, adjusted cycles, and why the remaining set is selected by knapsack.\n\n"
                f"{_stringify_context(context)}"
            ),
        },
    ]


def _iter_groq_stream(
    client: Groq,
    model: str,
    messages: list[dict[str, str]],
    *,
    temperature: float,
    max_completion_tokens: int,
    include_reasoning: bool = False,
) -> Iterator[str]:
    stream = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=temperature,
        max_completion_tokens=max_completion_tokens,
        top_p=0.95,
        stream=True,
    )

    for chunk in stream:
        if not chunk.choices:
            continue

        delta = chunk.choices[0].delta
        reasoning = getattr(delta, "reasoning", None) or ""
        content = delta.content or ""
        if include_reasoning and reasoning:
            yield reasoning
        elif content:
            yield content


def stream_procurement_response() -> Iterator[str]:
    procurement_payload = get_procurement_payload()
    context = _build_procurement_context(procurement_payload)

    yield f"{THINKING_MARKER}\n"

    try:
        client = _get_groq_client()
    except ValueError as exc:
        yield (
            "Reasoning stream unavailable because the AI provider is not configured "
            f"correctly: {exc}. Returning deterministic procurement output only."
        )
        yield f"\n{FINAL_JSON_MARKER}\n"
        yield json.dumps(
            procurement_payload,
            ensure_ascii=False,
            separators=(",", ":"),
        )
        return

    for token in _iter_groq_stream(
        client,
        _get_reasoning_model(),
        _build_reasoning_messages(context),
        temperature=0.45,
        max_completion_tokens=1400,
        include_reasoning=True,
    ):
        yield token

    yield f"\n{FINAL_JSON_MARKER}\n"
    yield json.dumps(
        procurement_payload,
        ensure_ascii=False,
        separators=(",", ":"),
    )