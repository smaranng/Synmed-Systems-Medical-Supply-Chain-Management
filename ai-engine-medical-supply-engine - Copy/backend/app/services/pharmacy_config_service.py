import json
from pathlib import Path
from typing import Any


PHARMACY_CONFIG_PATH = (
    Path(__file__).resolve().parents[2] / "data" / "pharmacy_config.json"
)


def _require_key(config: dict[str, Any], key: str) -> Any:
    if key not in config:
        raise ValueError(f"Missing required pharmacy config key: {key}")
    return config[key]


def _normalize_pharmacy_config(config: dict[str, Any]) -> dict[str, Any]:
    pharmacy_id = str(_require_key(config, "pharmacy_id")).strip()
    monthly_budget = float(_require_key(config, "monthly_budget"))
    order_cycles = int(_require_key(config, "order_cycles"))

    if not pharmacy_id:
        raise ValueError("pharmacy_id must be a non-empty string.")

    if monthly_budget < 0:
        raise ValueError("monthly_budget must be greater than or equal to 0.")

    if order_cycles <= 0:
        raise ValueError("order_cycles must be greater than 0.")

    return {
        "pharmacy_id": pharmacy_id,
        "monthly_budget": monthly_budget,
        "order_cycles": order_cycles,
    }


def load_pharmacy_config() -> dict[str, Any]:
    if not PHARMACY_CONFIG_PATH.exists():
        raise FileNotFoundError(
            "Pharmacy config file not found at "
            f"{PHARMACY_CONFIG_PATH}."
        )

    with PHARMACY_CONFIG_PATH.open("r", encoding="utf-8") as handle:
        config = json.load(handle)

    return _normalize_pharmacy_config(config)


def save_pharmacy_config(
    *,
    monthly_budget: float | None = None,
    order_cycles: int | None = None,
    pharmacy_id: str | None = None,
) -> dict[str, Any]:
    config = load_pharmacy_config()

    if monthly_budget is not None:
        config["monthly_budget"] = float(monthly_budget)

    if order_cycles is not None:
        config["order_cycles"] = int(order_cycles)

    if pharmacy_id is not None:
        config["pharmacy_id"] = str(pharmacy_id).strip()

    normalized_config = _normalize_pharmacy_config(config)

    PHARMACY_CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with PHARMACY_CONFIG_PATH.open("w", encoding="utf-8") as handle:
        json.dump(normalized_config, handle, indent=2)
        handle.write("\n")

    return normalized_config
