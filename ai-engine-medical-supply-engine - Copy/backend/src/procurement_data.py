from __future__ import annotations

from pathlib import Path
from typing import Any, Optional


DEFAULT_PHARMACY_ID = "PHM-697aae8fe53b28115f0251e2"
DEFAULT_PHARMACY_LOCATION = (10, 10)
DEFAULT_MAX_LEAD_DAYS = 5
DEFAULT_REORDER_REQUESTS_FILE = (
    Path(__file__).resolve().parents[1] / "data" / "monthly_reorder_requests.json"
)
DEFAULT_PROCUREMENT_ORDERS_FILE = (
    Path(__file__).resolve().parents[1] / "data" / "monthly_procurement_orders.json"
)


def _sample_medicine_ids() -> tuple[str, ...]:
    return tuple(f"MED{index:03d}" for index in range(1, 51))


def _build_inventory_map(
    *,
    medicine_ids: tuple[str, ...],
    base_price: float,
    distributor_markup: float,
    quantity_base: int,
    quantity_window: int,
    quantity_step: int,
    excluded_every: Optional[int] = None,
) -> dict[str, dict[str, float | int]]:
    inventory: dict[str, dict[str, float | int]] = {}

    for medicine_index, medicine_id in enumerate(medicine_ids, start=1):
        if excluded_every and medicine_index % excluded_every == 0:
            continue

        inventory[medicine_id] = {
            "price_per_unit": round(
                base_price + distributor_markup + ((medicine_index % 7) * 0.18),
                2,
            ),
            "available_qty": max(
                quantity_base - ((medicine_index * quantity_step) % quantity_window),
                0,
            ),
        }

    return inventory


def get_distributor_inventory_entry(
    distributor: dict[str, Any],
    medicine_id: str,
) -> Optional[dict[str, float | int]]:
    inventory = distributor.get("inventory")
    if not isinstance(inventory, dict):
        return None

    entry = inventory.get(str(medicine_id))
    if not isinstance(entry, dict):
        return None

    price_per_unit = entry.get("price_per_unit")
    available_qty = entry.get("available_qty")
    if price_per_unit is None or available_qty is None:
        return None

    return {
        "price_per_unit": round(float(price_per_unit), 2),
        "available_qty": max(int(float(available_qty)), 0),
    }


def materialize_distributor_for_medicine(
    distributor: dict[str, Any],
    medicine_id: str,
) -> Optional[dict[str, Any]]:
    inventory_entry = get_distributor_inventory_entry(distributor, medicine_id)
    if inventory_entry is None:
        return None

    return {
        **distributor,
        "price_per_unit": inventory_entry["price_per_unit"],
        "available_qty": inventory_entry["available_qty"],
    }


_SAMPLE_MEDICINE_IDS = _sample_medicine_ids()

SAMPLE_DISTRIBUTORS = [
    {
        "id": "DST-69789061da40d7dc08aadd79",
        "name": "Swastik Distributors",
        "location": (12, 14),
        "lead_days": 2,
        "rating": 4.8,
        "inventory": _build_inventory_map(
            medicine_ids=_SAMPLE_MEDICINE_IDS,
            base_price=5.2,
            distributor_markup=0.0,
            quantity_base=1600,
            quantity_window=260,
            quantity_step=17,
        ),
        "min_order_value": 200,
    },
    {
        "id": "D002",
        "name": "PrimeCare Wholesale",
        "location": (22, 18),
        "lead_days": 4,
        "rating": 4.5,
        "inventory": _build_inventory_map(
            medicine_ids=_SAMPLE_MEDICINE_IDS,
            base_price=5.2,
            distributor_markup=0.35,
            quantity_base=980,
            quantity_window=330,
            quantity_step=29,
            excluded_every=8,
        ),
        "min_order_value": 250,
    },
    {
        "id": "D003",
        "name": "CityMeds Distributor",
        "location": (42, 39),
        "lead_days": 3,
        "rating": 4.2,
        "inventory": _build_inventory_map(
            medicine_ids=_SAMPLE_MEDICINE_IDS,
            base_price=5.2,
            distributor_markup=0.55,
            quantity_base=760,
            quantity_window=300,
            quantity_step=31,
            excluded_every=6,
        ),
        "min_order_value": 500,
    },
    {
        "id": "D004",
        "name": "Remote Bulk Pharma",
        "location": (80, 75),
        "lead_days": 1,
        "rating": 4.0,
        "inventory": _build_inventory_map(
            medicine_ids=_SAMPLE_MEDICINE_IDS,
            base_price=5.2,
            distributor_markup=0.8,
            quantity_base=540,
            quantity_window=220,
            quantity_step=23,
            excluded_every=5,
        ),
        "min_order_value": 150,
    },
    {
        "id": "D005",
        "name": "SlowShip Medline",
        "location": (18, 21),
        "lead_days": 7,
        "rating": 4.6,
        "inventory": _build_inventory_map(
            medicine_ids=_SAMPLE_MEDICINE_IDS,
            base_price=5.2,
            distributor_markup=1.05,
            quantity_base=420,
            quantity_window=180,
            quantity_step=19,
            excluded_every=4,
        ),
        "min_order_value": 180,
    },
]

SAMPLE_PROCUREMENT_REQUEST = {
    "pharmacy_id": DEFAULT_PHARMACY_ID,
    "pharmacy_location": DEFAULT_PHARMACY_LOCATION,
    "max_lead_days": DEFAULT_MAX_LEAD_DAYS,
    "medicine_id": "MED001",
    "required_units": 40,
}

DEFAULT_WEIGHTS = {
    "distance": 0.3,
    "lead_time": 0.3,
    "rating": 0.25,
    "price": 0.15,
}