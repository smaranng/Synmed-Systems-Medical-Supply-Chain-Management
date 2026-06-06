import json
import math
import sys
from pathlib import Path

try:
    from .engine.audit import AuditLogger
    from .engine.filters import (
        FilterPipeline,
        lead_time_filter,
        min_order_filter,
        nearest_filter,
    )
    from .engine.procurement_engine import ProcurementEngine
    from .engine.scoring import (
        ScoringEngine,
        distance_score,
        lead_time_score,
        price_score,
        rating_score,
    )
    from .procurement_data import (
        DEFAULT_MAX_LEAD_DAYS,
        DEFAULT_PHARMACY_ID,
        DEFAULT_PHARMACY_LOCATION,
        DEFAULT_PROCUREMENT_ORDERS_FILE,
        DEFAULT_REORDER_REQUESTS_FILE,
        DEFAULT_WEIGHTS,
        SAMPLE_DISTRIBUTORS,
        SAMPLE_PROCUREMENT_REQUEST,
        materialize_distributor_for_medicine,
    )
except ImportError:  # pragma: no cover - script execution fallback
    from engine.audit import AuditLogger
    from engine.filters import (
        FilterPipeline,
        lead_time_filter,
        min_order_filter,
        nearest_filter,
    )
    from engine.procurement_engine import ProcurementEngine
    from engine.scoring import (
        ScoringEngine,
        distance_score,
        lead_time_score,
        price_score,
        rating_score,
    )
    from procurement_data import (
        DEFAULT_MAX_LEAD_DAYS,
        DEFAULT_PHARMACY_ID,
        DEFAULT_PHARMACY_LOCATION,
        DEFAULT_PROCUREMENT_ORDERS_FILE,
        DEFAULT_REORDER_REQUESTS_FILE,
        DEFAULT_WEIGHTS,
        SAMPLE_DISTRIBUTORS,
        SAMPLE_PROCUREMENT_REQUEST,
        materialize_distributor_for_medicine,
    )

SEPARATOR = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"


def _print_line(message=""):
    stdout = sys.stdout
    if hasattr(stdout, "reconfigure"):
        try:
            stdout.reconfigure(encoding="utf-8")
        except (AttributeError, ValueError):
            pass

    try:
        print(message)
    except UnicodeEncodeError:
        encoded = f"{message}\n".encode(
            sys.stdout.encoding or "utf-8",
            errors="replace",
        )
        sys.stdout.buffer.write(encoded)
        sys.stdout.buffer.flush()


def _normalize_medicine_key(medicine_id):
    return "".join(character for character in str(medicine_id).upper() if character.isalnum())


def _resolve_medicine_name(medicine_id, fallback_name=None):
    if fallback_name:
        return str(fallback_name)

    try:
        from .holtphet_main import MEDICINE_NAME_MAP
    except Exception:
        try:
            from holtphet_main import MEDICINE_NAME_MAP
        except Exception:
            return str(medicine_id)

    normalized_id = _normalize_medicine_key(medicine_id)
    return MEDICINE_NAME_MAP.get(normalized_id, {}).get("name", str(medicine_id))


def _coerce_required_units(ai_order_plan=None, fallback=None):
    plan = ai_order_plan or {}
    candidates = (
        plan.get("required_units"),
        plan.get("order_quantity"),
        plan.get("quantity"),
        fallback,
    )

    for value in candidates:
        if value is None:
            continue
        return max(0, int(math.ceil(float(value))))

    return 0


def _build_direct_ai_order_plan(medicine_id, required_units, request_record=None):
    request_record = request_record or {}
    quantity = _coerce_required_units(request_record, required_units)
    current_stock = request_record.get("current_stock")
    required_stock = request_record.get("required_stock")

    if required_stock is None and current_stock is not None:
        required_stock = round(float(current_stock) + quantity, 2)

    return {
        "medicine_id": str(medicine_id),
        "current_stock": current_stock,
        "required_stock": required_stock,
        "required_units": quantity,
        "reorder": bool(request_record.get("reorder", quantity > 0)),
        "trigger_reason": request_record.get("trigger_reason"),
    }


def _build_trigger_reason(ai_order_plan):
    if ai_order_plan.get("trigger_reason"):
        return str(ai_order_plan["trigger_reason"])

    current_stock = ai_order_plan.get("current_stock")
    if current_stock is None:
        return "Inventory has crossed the reorder threshold."

    if ai_order_plan.get("new_threshold") is not None:
        reorder_threshold = int(ai_order_plan["new_threshold"])
        return (
            f"Current stock {int(float(current_stock))} is below the reorder "
            f"threshold of {reorder_threshold}."
        )

    if ai_order_plan.get("reorder_point") is not None:
        reorder_point = round(float(ai_order_plan["reorder_point"]), 2)
        return (
            f"Current stock {round(float(current_stock), 2)} is below the reorder "
            f"point of {reorder_point}."
        )

    return "Inventory has crossed the reorder threshold."


def _print_inventory_alert(ai_order_plan, medicine_id, medicine_name=None):
    if not ai_order_plan.get("reorder"):
        return

    current_stock = ai_order_plan.get("current_stock")
    required_units = _coerce_required_units(ai_order_plan)
    required_stock = ai_order_plan.get("required_stock")

    if required_stock is None and current_stock is not None:
        required_stock = round(float(current_stock) + required_units, 2)

    resolved_name = _resolve_medicine_name(medicine_id, fallback_name=medicine_name)

    _print_line(SEPARATOR)
    _print_line("📊 INVENTORY ALERT")
    _print_line(f"   Medicine: {resolved_name}")
    if current_stock is not None:
        _print_line(f"   Current Stock: {round(float(current_stock), 2)}")
    if required_stock is not None:
        _print_line(f"   Required Stock: {round(float(required_stock), 2)}")
    _print_line(f"   Order Quantity: {required_units}")
    _print_line(f"   Trigger Reason: {_build_trigger_reason(ai_order_plan)}")


def _print_no_order_required(ai_order_plan, medicine_id, medicine_name=None):
    resolved_name = _resolve_medicine_name(medicine_id, fallback_name=medicine_name)
    trigger_reason = _build_trigger_reason(ai_order_plan)

    _print_line(SEPARATOR)
    _print_line("✅ PROCUREMENT NOT REQUIRED")
    _print_line(f"   Medicine: {resolved_name}")
    _print_line(f"   Trigger Reason: {trigger_reason}")
    _print_line(SEPARATOR)


def _save_json(payload, output_path):
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with output_path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)

    return output_path


def _normalize_reorder_payload(payload, pharmacy_id=None):
    if isinstance(payload, list):
        reorder_requests = payload
        resolved_pharmacy_id = pharmacy_id or DEFAULT_PHARMACY_ID
    elif isinstance(payload, dict):
        reorder_requests = payload.get("reorder_requests", [])
        resolved_pharmacy_id = (
            pharmacy_id
            or payload.get("pharmacy_id")
            or DEFAULT_PHARMACY_ID
        )
    else:
        raise ValueError("Reorder payload must be a list or dictionary.")

    normalized_requests = []
    for request in reorder_requests:
        medicine_id = request.get("medicine_id")
        if medicine_id is None:
            continue

        quantity = _coerce_required_units(request)
        if quantity <= 0:
            continue

        normalized_requests.append(
            {
                "pharmacy_id": request.get("pharmacy_id", resolved_pharmacy_id),
                "medicine_id": str(medicine_id),
                "medicine_name": request.get("medicine_name"),
                "current_stock": request.get("current_stock"),
                "required_stock": request.get("required_stock"),
                "order_quantity": quantity,
                "reorder": bool(request.get("reorder", True)),
                "trigger_reason": request.get("trigger_reason"),
            }
        )

    return {
        "pharmacy_id": resolved_pharmacy_id,
        "reorder_requests": normalized_requests,
    }


def load_reorder_requests(input_path=DEFAULT_REORDER_REQUESTS_FILE, pharmacy_id=None):
    input_path = Path(input_path)
    if not input_path.exists():
        raise FileNotFoundError(
            f"Reorder request file not found: {input_path}. "
            "Run the monthly inventory cycle first to generate it."
        )

    with input_path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    return _normalize_reorder_payload(payload, pharmacy_id=pharmacy_id)


def procure(
    distributors,
    pharmacy_location,
    max_lead_days,
    medicine_id,
    required_units=None,
    ai_order_plan=None,
    pharmacy_id=DEFAULT_PHARMACY_ID,
):
    if ai_order_plan is None:
        if required_units is not None:
            ai_order_plan = _build_direct_ai_order_plan(
                medicine_id,
                required_units,
            )
        else:
            try:
                from .main import calculate_ai_order_plan
            except ImportError:  # pragma: no cover - script execution fallback
                from main import calculate_ai_order_plan

            ai_order_plan = calculate_ai_order_plan(medicine_id=medicine_id)

    derived_required_units = _coerce_required_units(ai_order_plan, required_units)
    should_reorder = bool(
        ai_order_plan.get("reorder", derived_required_units > 0)
    )

    if not should_reorder or derived_required_units <= 0:
        return {
            "pharmacy_id": pharmacy_id,
            "medicine_id": medicine_id,
            "distributor_id": None,
            "distributor_name": None,
            "quantity": 0,
            "order_quantity": 0,
            "status": "NO_ORDER_REQUIRED",
            "audit_log": [],
            "agent_reasoning": (
                "Inventory remains above the reorder threshold, so no procurement "
                "order is required."
            ),
            "ai_order_plan": ai_order_plan,
            "reflection": "",
        }

    context = {
        "pharmacy_id": pharmacy_id,
        "location": tuple(pharmacy_location),
        "max_lead_days": max_lead_days,
        "ai_order_plan": ai_order_plan,
    }

    order = {
        "pharmacy_id": pharmacy_id,
        "medicine_id": medicine_id,
        "required_units": derived_required_units,
        "requested_units": required_units,
    }

    # Convert each distributor to a medicine-specific view so pricing/inventory
    # fields are available to filters and scoring.
    prepared_distributors = []
    for distributor in distributors:
        materialized = materialize_distributor_for_medicine(distributor, medicine_id)
        if materialized is not None:
            prepared_distributors.append(materialized)
            continue

        # Backward compatibility for distributor records that already carry
        # top-level price fields and no nested inventory map.
        if distributor.get("price_per_unit") is not None:
            prepared_distributors.append(distributor)

    audit = AuditLogger()

    pipeline = FilterPipeline(audit)
    pipeline.add_filter(nearest_filter)
    pipeline.add_filter(lead_time_filter)
    pipeline.add_filter(min_order_filter)

    scoring = ScoringEngine(DEFAULT_WEIGHTS, audit)
    scoring.add_criteria(distance_score)
    scoring.add_criteria(lead_time_score)
    scoring.add_criteria(rating_score)
    scoring.add_criteria(price_score)

    engine = ProcurementEngine(prepared_distributors, pipeline, scoring, audit)
    result = engine.process_order(context, order)
    result["pharmacy_id"] = pharmacy_id
    result["medicine_id"] = medicine_id
    result["order_quantity"] = derived_required_units
    result["ai_order_plan"] = ai_order_plan
    return result


def _build_procurement_record(result, pharmacy_id, medicine_id, order_quantity):
    return {
        "pharmacy_id": pharmacy_id,
        "medicine_id": medicine_id,
        "order_quantity": order_quantity,
        "distributor_id": result.get("distributor_id"),
    }


def process_reorder_requests(
    reorder_payload,
    distributors=SAMPLE_DISTRIBUTORS,
    pharmacy_location=DEFAULT_PHARMACY_LOCATION,
    max_lead_days=DEFAULT_MAX_LEAD_DAYS,
    pharmacy_id=None,
):
    normalized_payload = _normalize_reorder_payload(
        reorder_payload,
        pharmacy_id=pharmacy_id,
    )
    resolved_pharmacy_id = normalized_payload["pharmacy_id"]
    procurement_orders = []

    for request in normalized_payload["reorder_requests"]:
        direct_plan = _build_direct_ai_order_plan(
            request["medicine_id"],
            request["order_quantity"],
            request_record=request,
        )
        _print_inventory_alert(
            direct_plan,
            request["medicine_id"],
            medicine_name=request.get("medicine_name"),
        )

        result = procure(
            distributors=distributors,
            pharmacy_id=request.get("pharmacy_id", resolved_pharmacy_id),
            pharmacy_location=pharmacy_location,
            max_lead_days=max_lead_days,
            medicine_id=request["medicine_id"],
            required_units=request["order_quantity"],
            ai_order_plan=direct_plan,
        )

        procurement_orders.append(
            _build_procurement_record(
                result,
                pharmacy_id=request.get("pharmacy_id", resolved_pharmacy_id),
                medicine_id=request["medicine_id"],
                order_quantity=request["order_quantity"],
            )
        )

    return {
        "pharmacy_id": resolved_pharmacy_id,
        "procurement_orders": procurement_orders,
    }


def run_procurement_batch(
    input_path=DEFAULT_REORDER_REQUESTS_FILE,
    output_path=DEFAULT_PROCUREMENT_ORDERS_FILE,
    distributors=SAMPLE_DISTRIBUTORS,
    pharmacy_location=DEFAULT_PHARMACY_LOCATION,
    max_lead_days=DEFAULT_MAX_LEAD_DAYS,
    pharmacy_id=None,
):
    reorder_payload = load_reorder_requests(input_path, pharmacy_id=pharmacy_id)
    procurement_payload = process_reorder_requests(
        reorder_payload,
        distributors=distributors,
        pharmacy_location=pharmacy_location,
        max_lead_days=max_lead_days,
        pharmacy_id=pharmacy_id,
    )
    saved_path = _save_json(procurement_payload, output_path)

    _print_line(SEPARATOR)
    _print_line("📦 PROCUREMENT ORDERS SAVED")
    _print_line(
        f"   Orders: {len(procurement_payload['procurement_orders'])}"
    )
    _print_line(f"   File: {saved_path}")
    _print_line(SEPARATOR)

    return procurement_payload


def run_monthly_pipeline(
    pharmacy_id=DEFAULT_PHARMACY_ID,
    reorder_output_path=DEFAULT_REORDER_REQUESTS_FILE,
    procurement_output_path=DEFAULT_PROCUREMENT_ORDERS_FILE,
    distributors=SAMPLE_DISTRIBUTORS,
    pharmacy_location=DEFAULT_PHARMACY_LOCATION,
    max_lead_days=DEFAULT_MAX_LEAD_DAYS,
):
    try:
        from .holtphet_main import run as run_inventory_cycle
    except ImportError:  # pragma: no cover - script execution fallback
        from holtphet_main import run as run_inventory_cycle

    run_inventory_cycle(
        pharmacy_id=pharmacy_id,
        reorder_output_path=reorder_output_path,
    )
    return run_procurement_batch(
        input_path=reorder_output_path,
        output_path=procurement_output_path,
        distributors=distributors,
        pharmacy_location=pharmacy_location,
        max_lead_days=max_lead_days,
        pharmacy_id=pharmacy_id,
    )


def run_procurement_demo():
    request = dict(SAMPLE_PROCUREMENT_REQUEST)
    result = procure(
        distributors=SAMPLE_DISTRIBUTORS,
        **request,
    )

    if result.get("status") == "NO_ORDER_REQUIRED":
        _print_no_order_required(
            result["ai_order_plan"],
            request["medicine_id"],
        )

    return result


if __name__ == "__main__":
    run_procurement_batch()
