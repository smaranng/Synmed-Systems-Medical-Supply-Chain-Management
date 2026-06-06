import json
import os
import tempfile
import threading
from hashlib import sha256
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ORDERS_FILE_PATH = Path(__file__).resolve().parents[2] / "data" / "orders.json"
ORDERS_FILE_LOCK = threading.RLock()
TOP_LEVEL_ORDER_FIELDS = {
    "orderNumber": ("orderNumber", "orderid"),
    "pharmaID": ("pharmaID", "pharmaid"),
    "distributorID": ("distributorID", "distributorid"),
}


def _ensure_orders_file() -> None:
    ORDERS_FILE_PATH.parent.mkdir(parents=True, exist_ok=True)

    if not ORDERS_FILE_PATH.exists():
        ORDERS_FILE_PATH.write_text("[]\n", encoding="utf-8")


def _read_orders() -> list[dict[str, Any]]:
    _ensure_orders_file()

    with ORDERS_FILE_PATH.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)

    if not isinstance(payload, list):
        raise ValueError("orders.json must contain a JSON array.")

    return payload


def _normalize_order_shape(order: dict[str, Any]) -> tuple[dict[str, Any], bool]:
    normalized_order = dict(order)
    has_changes = False

    for canonical_key, aliases in TOP_LEVEL_ORDER_FIELDS.items():
        selected_value = None
        selected_key = None
        for alias in aliases:
            if alias in normalized_order:
                selected_value = normalized_order[alias]
                selected_key = alias
                break

        if selected_key is None:
            continue

        if normalized_order.get(canonical_key) != selected_value:
            normalized_order[canonical_key] = selected_value
            has_changes = True

        for alias in aliases:
            if alias != canonical_key and alias in normalized_order:
                normalized_order.pop(alias)
                has_changes = True

    return normalized_order, has_changes


def _write_orders(orders: list[dict[str, Any]]) -> None:
    _ensure_orders_file()

    with tempfile.NamedTemporaryFile(
        "w",
        delete=False,
        dir=str(ORDERS_FILE_PATH.parent),
        encoding="utf-8",
        newline="\n",
    ) as handle:
        json.dump(orders, handle, indent=2)
        handle.write("\n")
        temp_path = Path(handle.name)

    os.replace(temp_path, ORDERS_FILE_PATH)


def _build_order_fingerprint(order: dict[str, Any]) -> str:
    normalized_order, _ = _normalize_order_shape(order)
    items = normalized_order.get("items")
    if not isinstance(items, dict) or len(items) == 0:
        raise ValueError("Order items must be a non-empty object.")

    canonical_items: list[dict[str, Any]] = []
    for raw_item in items.values():
        if not isinstance(raw_item, dict):
            raise ValueError("Each order item must be an object.")

        name = raw_item.get("name")
        quantity = raw_item.get("quantity")

        if not isinstance(name, str) or not name.strip():
            raise ValueError("Each order item must include a medicine name.")

        if not isinstance(quantity, int):
            raise ValueError("Each order item must include an integer quantity.")

        canonical_items.append(
            {
                "name": name.strip().casefold(),
                "quantity": quantity,
            }
        )

    canonical_items.sort(key=lambda item: (item["name"], item["quantity"]))
    canonical_order = {
        "pharmaID": str(normalized_order.get("pharmaID", "")).strip(),
        "distributorID": str(normalized_order.get("distributorID", "")).strip(),
        "items": canonical_items,
    }
    serialized_order = json.dumps(
        canonical_order,
        sort_keys=True,
        separators=(",", ":"),
    )
    return sha256(serialized_order.encode("utf-8")).hexdigest()


def _normalize_order(order: dict[str, Any]) -> tuple[dict[str, Any], bool]:
    normalized_order, has_changes = _normalize_order_shape(order)
    fingerprint = normalized_order.get("fingerprint")
    if isinstance(fingerprint, str) and fingerprint.strip():
        return normalized_order, has_changes

    normalized_order = {
        **normalized_order,
        "fingerprint": _build_order_fingerprint(normalized_order),
    }
    return normalized_order, True


def _normalize_orders_for_storage(
    orders: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], bool]:
    normalized_orders: list[dict[str, Any]] = []
    has_changes = False

    for order in orders:
        normalized_order, changed = _normalize_order(order)
        normalized_orders.append(normalized_order)
        has_changes = has_changes or changed

    return normalized_orders, has_changes


def list_orders() -> list[dict[str, Any]]:
    with ORDERS_FILE_LOCK:
        orders = _read_orders()
        normalized_orders, has_changes = _normalize_orders_for_storage(orders)

        if has_changes:
            _write_orders(normalized_orders)

        return normalized_orders


def create_or_get_order(order: dict[str, Any]) -> dict[str, Any]:
    with ORDERS_FILE_LOCK:
        orders = _read_orders()
        normalized_orders, has_changes = _normalize_orders_for_storage(orders)
        normalized_order, _ = _normalize_order_shape(order)
        fingerprint = _build_order_fingerprint(normalized_order)

        for existing_order in normalized_orders:
            if existing_order.get("fingerprint") == fingerprint:
                if has_changes:
                    _write_orders(normalized_orders)

                return {
                    "status": "duplicate",
                    "order": existing_order,
                }

        stored_order = {
            **normalized_order,
            "fingerprint": fingerprint,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        normalized_orders.append(stored_order)
        _write_orders(normalized_orders)
        return {
            "status": "created",
            "order": stored_order,
        }