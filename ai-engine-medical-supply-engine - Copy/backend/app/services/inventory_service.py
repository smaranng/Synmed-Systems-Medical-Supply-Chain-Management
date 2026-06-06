from datetime import datetime, timezone
from functools import lru_cache
import math

from src.Holtphet import hybrid_inventory_policy_by_medicine
from src.forecast import forecast_by_medicine, load_demand_by_medicine
from src.holtphet_main import (
    MEDICINE_NAME_MAP,
    attach_medicine_names,
    build_current_price_map,
    build_current_stock_map,
    build_display_frame,
    build_mongo_mapped_med_id_set,
    build_reorder_requests_payload,
    resolve_dataset_path,
)
from src.prophet_model import prophet_forecast_by_medicine


def _coerce_optional_float(value):
    if value is None:
        return None
    numeric_value = float(value)
    if math.isnan(numeric_value):
        return None
    return numeric_value


def _serialize_inventory_row(row: dict) -> dict:
    current_price = _coerce_optional_float(row.get("current_price"))
    return {
        "medicine_id": str(row["medicine_id"]),
        "medicine_name": str(row["medicine_name"]),
        "forecast_quantity": round(float(row["ensemble_forecast"]), 2),
        "current_stock": round(float(row["current_stock"]), 2),
        "current_price": round(current_price, 2) if current_price is not None else None,
        "mongo_mapped": bool(row.get("mongo_mapped", False)),
        "safety_stock": round(float(row["safety_stock"]), 2),
        "reorder_point": round(float(row["rop"]), 2),
        "target_stock": round(float(row["target_stock"]), 2),
        "reorder": bool(row["reorder"]),
        "order_quantity": round(float(row["order_qty"]), 2),
    }


@lru_cache(maxsize=1)
def build_inventory_snapshot() -> dict:
    dataset_path = resolve_dataset_path()
    demand_by_medicine = load_demand_by_medicine(dataset_path)
    hw_forecasts = forecast_by_medicine(demand_by_medicine)
    prophet_results = prophet_forecast_by_medicine(demand_by_medicine)

    policy_df = hybrid_inventory_policy_by_medicine(
        hw_forecasts,
        prophet_results,
        current_stock=build_current_stock_map(),
    )
    allowed_medicine_ids = {str(medicine_id) for medicine_id in MEDICINE_NAME_MAP.keys()}
    policy_df = policy_df[policy_df["medicine_id"].astype(str).isin(allowed_medicine_ids)].copy()
    current_price_map = build_current_price_map()
    mongo_mapped_med_ids = build_mongo_mapped_med_id_set()
    policy_df["current_price"] = policy_df["medicine_id"].map(current_price_map)
    policy_df["mongo_mapped"] = policy_df["medicine_id"].map(
        lambda med_id: str(med_id) in mongo_mapped_med_ids
    )
    named_policy_df = attach_medicine_names(policy_df)
    display_df = build_display_frame(named_policy_df)
    reorder_payload = build_reorder_requests_payload(named_policy_df)

    inventory_rows = [
        _serialize_inventory_row(row)
        for row in named_policy_df.sort_values(
            "ensemble_forecast",
            ascending=False,
        ).to_dict("records")
    ]

    return {
        "dataset": dataset_path.name,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_medicines": len(inventory_rows),
        "reorder_count": len(reorder_payload["reorder_requests"]),
        "inventory": inventory_rows,
        "display_inventory": [
            {
                "medicine": str(row["medicine"]),
                "forecast_quantity": round(float(row["forecast_quantity"]), 2),
                "current_stock": round(float(row["current_stock"]), 2),
                "current_price": (
                    round(_coerce_optional_float(row.get("current_price")), 2)
                    if _coerce_optional_float(row.get("current_price")) is not None
                    else None
                ),
                "mongo_mapped": bool(row.get("mongo_mapped", False)),
                "safety_stock": round(float(row["safety_stock"]), 2),
                "reorder_point": round(float(row["rop"]), 2),
                "target_stock": round(float(row["target_stock"]), 2),
                "reorder": bool(row["reorder"]),
                "order_quantity": round(float(row["order_qty"]), 2),
            }
            for row in display_df.sort_values(
                "forecast_quantity",
                ascending=False,
            ).to_dict("records")
        ],
        "reorder_requests": reorder_payload["reorder_requests"],
        "_raw_reorder_payload": reorder_payload,
    }


def get_inventory_payload() -> dict:
    snapshot = dict(build_inventory_snapshot())
    snapshot.pop("_raw_reorder_payload", None)
    return snapshot
