import math
from pathlib import Path

import numpy as np

try:
    from .forecast import forecast_next_month, load_demand_by_medicine
    from .inventory_math import (
        compute_statistics,
        expected_demand_during_lead_time,
        reorder_point,
        safety_stock,
        update_threshold,
    )
except ImportError:  # pragma: no cover - script execution fallback
    from forecast import forecast_next_month, load_demand_by_medicine
    from inventory_math import (
        compute_statistics,
        expected_demand_during_lead_time,
        reorder_point,
        safety_stock,
        update_threshold,
    )


DATA_FILE = Path(__file__).resolve().parents[1] / "data" / "medicine_history.xlsx"
LEAD_TIME_DAYS = 15
CURRENT_STOCK = 85
OLD_THRESHOLD = 71
LEAD_TIME_MONTHS = LEAD_TIME_DAYS / 30


def _load_medicine_demand_series(filepath, medicine_id=None):
    demand_by_medicine = load_demand_by_medicine(filepath)

    if medicine_id is not None:
        medicine_key = str(medicine_id)
        if medicine_key in demand_by_medicine:
            return demand_by_medicine[medicine_key]
        if len(demand_by_medicine) == 1:
            return next(iter(demand_by_medicine.values()))
        raise KeyError(
            f"Medicine '{medicine_key}' was not found in {filepath}. "
            f"Available medicines: {sorted(demand_by_medicine)}"
        )

    if len(demand_by_medicine) == 1:
        return next(iter(demand_by_medicine.values()))

    raise ValueError(
        "Multiple medicines detected in the demand data. "
        "Pass medicine_id to calculate the order quantity."
    )


def calculate_ai_order_plan(
    medicine_id=None,
    filepath=DATA_FILE,
    current_stock=CURRENT_STOCK,
    lead_time_days=LEAD_TIME_DAYS,
    old_threshold=OLD_THRESHOLD,
):
    lead_time_months = lead_time_days / 30
    demand_series = _load_medicine_demand_series(filepath, medicine_id=medicine_id)
    demand = demand_series.values.astype(float)

    forecast = forecast_next_month(demand_series)
    mu, sigma = compute_statistics(demand)

    expected_lt = expected_demand_during_lead_time(forecast, lead_time_months)
    ss = safety_stock(sigma, lead_time_months)
    rop = reorder_point(expected_lt, ss)
    new_threshold = update_threshold(old_threshold, rop)

    reorder = current_stock < new_threshold
    raw_order_qty = max(0.0, forecast + ss - current_stock)
    required_units = max(0, math.ceil(raw_order_qty))

    return {
        "medicine_id": str(medicine_id) if medicine_id is not None else None,
        "current_stock": current_stock,
        "lead_time_days": lead_time_days,
        "lead_time_months": lead_time_months,
        "mean_demand": float(mu),
        "demand_std": float(sigma),
        "forecast": float(forecast),
        "expected_demand_during_lead_time": float(expected_lt),
        "safety_stock": float(ss),
        "reorder_point": float(rop),
        "new_threshold": int(new_threshold),
        "reorder": bool(reorder),
        "raw_order_qty": float(raw_order_qty),
        "required_units": required_units,
    }


def run_ai_engine(medicine_id=None):
    plan = calculate_ai_order_plan(medicine_id=medicine_id)

    print("\n--- AI PHARMACY ENGINE START ---")
    print("\nDemand Mean:", round(plan["mean_demand"], 2))
    print("Demand Std:", round(plan["demand_std"], 2))
    print("Forecast:", round(plan["forecast"], 2))
    print("Safety Stock:", round(plan["safety_stock"], 2))
    print("New Threshold (ROP):", plan["new_threshold"])
    print("Suggested Order Qty:", plan["required_units"])
    print("\n--- AI ENGINE COMPLETE ---")

    return plan


if __name__ == "__main__":
    run_ai_engine()
