import math
from collections.abc import Mapping
from typing import Union

import pandas as pd


SERVICE_Z = 1.65
LEAD_TIME = 0.5
CurrentStockInput = Union[Mapping[str, Union[float, int]], float, int]
POLICY_OUTPUT_KEYS = (
    "weight_hw",
    "weight_prophet",
    "ensemble_forecast",
    "safety_stock",
    "rop",
    "target_stock",
    "reorder",
    "order_qty",
)


def hybrid_inventory_policy_with_details(hw_forecast, prophet_result, current_stock):
    forecast_hw = max(float(hw_forecast), 0.0)
    prophet_prediction_raw = float(prophet_result["prediction"])
    forecast_prophet = max(prophet_prediction_raw, 0.0)
    prophet_lower = prophet_result.get("lower")
    prophet_upper = prophet_result.get("upper")

    if "sigma" in prophet_result:
        sigma = max(float(prophet_result["sigma"]), 0.0)
    elif "lower" in prophet_result and "upper" in prophet_result:
        sigma = max(
            0.0,
            float(prophet_result["upper"]) - float(prophet_result["lower"]),
        ) / 4.0
    else:
        sigma = 0.0

    if forecast_prophet <= 0:
        weight_hw = 0.5
    else:
        weight_hw = max(0.0, min(1.0, 1 - (sigma / abs(forecast_prophet))))

    ensemble_forecast = (
        weight_hw * forecast_hw + (1 - weight_hw) * forecast_prophet
    )
    demand_during_lead_time = ensemble_forecast * LEAD_TIME
    safety_stock = SERVICE_Z * sigma * math.sqrt(LEAD_TIME)
    rop = demand_during_lead_time + safety_stock
    target_stock = ensemble_forecast + demand_during_lead_time + safety_stock

    current_stock = float(current_stock)
    reorder = current_stock < rop
    order_qty = max(0.0, target_stock - current_stock) if reorder else 0.0

    return {
        "forecast_hw": forecast_hw,
        "prophet_prediction_raw": prophet_prediction_raw,
        "forecast_prophet": forecast_prophet,
        "prophet_lower": (
            float(prophet_lower) if prophet_lower is not None else None
        ),
        "prophet_upper": (
            float(prophet_upper) if prophet_upper is not None else None
        ),
        "sigma": sigma,
        "service_z": SERVICE_Z,
        "lead_time_months": LEAD_TIME,
        "lead_time_days": LEAD_TIME * 30.0,
        "demand_during_lead_time": demand_during_lead_time,
        "daily_demand": ensemble_forecast / 30.0 if ensemble_forecast > 0 else 0.0,
        "current_stock": current_stock,
        "weight_hw": weight_hw,
        "weight_prophet": 1 - weight_hw,
        "ensemble_forecast": ensemble_forecast,
        "safety_stock": safety_stock,
        "rop": rop,
        "target_stock": target_stock,
        "reorder": reorder,
        "order_qty": order_qty,
    }


def hybrid_inventory_policy(hw_forecast, prophet_result, current_stock):
    details = hybrid_inventory_policy_with_details(
        hw_forecast,
        prophet_result,
        current_stock,
    )

    return {key: details[key] for key in POLICY_OUTPUT_KEYS}


def _resolve_current_stock(
    current_stock: CurrentStockInput,
    medicine_id: str,
) -> float:
    if isinstance(current_stock, Mapping):
        return float(current_stock.get(medicine_id, 0.0))
    return float(current_stock)


def hybrid_inventory_policy_by_medicine(
    hw_forecasts,
    prophet_results,
    current_stock: CurrentStockInput = 0,
) -> pd.DataFrame:
    hw_medicines = set(hw_forecasts)
    prophet_medicines = set(prophet_results)

    missing_hw = sorted(prophet_medicines - hw_medicines)
    missing_prophet = sorted(hw_medicines - prophet_medicines)
    if missing_hw or missing_prophet:
        raise ValueError(
            "Forecast sets do not match. "
            f"Missing HW forecasts: {missing_hw}. "
            f"Missing Prophet forecasts: {missing_prophet}."
        )

    rows = []
    for medicine_id in sorted(hw_forecasts):
        stock = _resolve_current_stock(current_stock, medicine_id)
        policy = hybrid_inventory_policy(
            hw_forecasts[medicine_id],
            prophet_results[medicine_id],
            stock,
        )
        rows.append(
            {
                "medicine_id": medicine_id,
                "current_stock": stock,
                "hw_forecast": float(hw_forecasts[medicine_id]),
                "prophet_forecast": float(
                    prophet_results[medicine_id]["prediction"]
                ),
                **policy,
            }
        )

    return pd.DataFrame(rows)