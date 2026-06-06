from datetime import datetime, timezone
from functools import lru_cache

from src.forecast import forecast_by_medicine, load_demand_by_medicine
from src.holtphet_main import MEDICINE_NAME_MAP, resolve_dataset_path


@lru_cache(maxsize=1)
def get_forecast_payload() -> dict:
    dataset_path = resolve_dataset_path()
    demand_by_medicine = load_demand_by_medicine(dataset_path)
    forecasts = forecast_by_medicine(demand_by_medicine)

    forecast_rows = []
    for medicine_id, forecast_value in forecasts.items():
        series = demand_by_medicine[medicine_id]
        medicine_meta = MEDICINE_NAME_MAP.get(str(medicine_id), {})
        last_observed_quantity = float(series.iloc[-1]) if not series.empty else 0.0

        forecast_rows.append(
            {
                "medicine_id": str(medicine_id),
                "medicine_name": medicine_meta.get("name", str(medicine_id)),
                "history_months": int(len(series)),
                "last_observed_quantity": round(last_observed_quantity, 2),
                "next_month_forecast": round(float(forecast_value), 2),
            }
        )

    forecast_rows.sort(
        key=lambda row: row["next_month_forecast"],
        reverse=True,
    )

    return {
        "dataset": dataset_path.name,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_medicines": len(forecast_rows),
        "forecasts": forecast_rows,
    }
