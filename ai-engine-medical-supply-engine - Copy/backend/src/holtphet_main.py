import json
import math
import os
from pathlib import Path

try:
    from pymongo import MongoClient
except ImportError:  # pragma: no cover - optional for static-only mode
    MongoClient = None

try:
    from .Holtphet import hybrid_inventory_policy_by_medicine
    from .forecast import forecast_by_medicine, load_demand_by_medicine
    from .procurement_data import (
        DEFAULT_PHARMACY_ID,
        DEFAULT_REORDER_REQUESTS_FILE,
    )
    from .prophet_model import prophet_forecast_by_medicine
except ImportError:  # pragma: no cover - script execution fallback
    from Holtphet import hybrid_inventory_policy_by_medicine
    from forecast import forecast_by_medicine, load_demand_by_medicine
    from procurement_data import (
        DEFAULT_PHARMACY_ID,
        DEFAULT_REORDER_REQUESTS_FILE,
    )
    from prophet_model import prophet_forecast_by_medicine

DATASET_CANDIDATES = (
    "pharmacy_demand.xlsx",
    "synthetic_pharmacy_demand.xlsx",
    "synthetic_pharmacy_dataset.xlsx",
)

MEDICINE_NAME_MAP = {
    "MED001": {"name": "Crocin 650", "current_stock": 340},
    "MED002": {"name": "Brufen 400 Tablet", "current_stock": 420},
    "MED003": {"name": "Almox 500 Capsule", "current_stock": 180},
    "MED004": {"name": "Cetirizine 10mg Tablet", "current_stock": 95},
    "MED005": {"name": "Azithral 500 Tablet", "current_stock": 290},
    "MED006": {"name": "Okamet 500 Tablet", "current_stock": 150},
    "MED007": {"name": "Omepraz 20 mg", "current_stock": 130},
    "MED008": {"name": "LipVAS 20 Tablet", "current_stock": 260},
    "MED009": {"name": "Amloheal 5mg Tablet", "current_stock": 360},
    "MED010": {"name": "Losar 50 Tablet", "current_stock": 175},
    "MED011": {"name": "Lethyrox 50mcg", "current_stock": 600},
    "MED012": {"name": "Pantop-D Capsule", "current_stock": 240},
    #"MED013": {"name": "Rosuvastatin 10 mg", "current_stock": 710},
    "MED014": {"name": "Montek-10", "current_stock": 310},
    #"MED015": {"name": "Diclofenac 50 mg", "current_stock": 140},
    "MED016": {"name": "Taxim-O 200 Tablet", "current_stock": 32},
    #"MED017": {"name": "Vitamin D3 60000 IU", "current_stock": 520},
    #"MED018": {"name": "Zinc Sulfate 50 mg", "current_stock": 160},
    #"MED019": {"name": "Iron Folic Acid", "current_stock": 120},
    #"MED020": {"name": "Calcium Carbonate", "current_stock": 340},
    #"MED021": {"name": "Clopidogrel 75 mg", "current_stock": 390},
    "MED022": {"name": "Ecosprin 75 Tablet", "current_stock": 150},
    #"MED023": {"name": "Glimepiride 2 mg", "current_stock": 210},
    #"MED024": {"name": "Sitagliptin 100 mg", "current_stock": 250},
    "MED025": {"name": "Telma 40 Tablet", "current_stock": 330},
    #"MED026": {"name": "Hydrochlorothiazide 25 mg","current_stock": 230,},
    #"MED027": {"name": "Salbutamol Syrup", "current_stock": 135},
    #"MED028": {"name": "Amoxicillin Clavulanate 625 mg","current_stock": 195,},
   # "MED029": {"name": "Ondansetron 4 mg", "current_stock": 145},
   # "MED030": {"name": "Dextromethorphan Syrup", "current_stock": 185},
   # "MED031": {"name": "Insulin Glargine", "current_stock": 540},
    #"MED032": {"name": "Lisinopril 10 mg", "current_stock": 380},
    #"MED033": {"name": "Furosemide 40 mg", "current_stock": 275},
    #"MED034": {"name": "Loratadine 10 mg", "current_stock": 110},
    #"MED035": {"name": "Ciprofloxacin 500 mg", "current_stock": 365},
    #"MED036": {"name": "Methylcobalamin 1500 mcg", "current_stock": 190},
    #"MED037": {"name": "Prednisolone 10 mg", "current_stock": 125},
    #"MED038": {"name": "Tramadol 50 mg", "current_stock": 205},
    #"MED039": {"name": "Enoxaparin 40 mg", "current_stock": 610},
    #"MED040": {"name": "Meropenem 1 g", "current_stock": 470},
    #"MED041": {"name": "Linezolid 600 mg", "current_stock": 445},
    #"MED042": {"name": "Doxycycline 100 mg", "current_stock": 260},
    "MED043": {"name": "ORS Sachets", "current_stock": 105},
    #"MED044": {"name": "Human Albumin 20%", "current_stock": 590},
    #"MED045": {"name": "Rabeprazole 20 mg", "current_stock": 135},
    #"MED046": {"name": "Clindamycin 300 mg", "current_stock": 200},
    #"MED047": {"name": "Fluconazole 150 mg", "current_stock": 225},
    #"MED048": {"name": "Piperacillin Tazobactam 4.5 g","current_stock": 720,},
    #"MED049": {"name": "Vancomycin 500 mg", "current_stock": 630},
    "MED050": {"name": "Levoquin 500mg Tablet", "current_stock": 180},
}


def _build_trigger_reason(row):
    current_stock = round(float(row["current_stock"]), 2)
    reorder_point = round(float(row["rop"]), 2)
    return (
        f"Current stock {current_stock} is below the reorder point "
        f"of {reorder_point}."
    )


def build_reorder_requests_payload(
    policy_df,
    pharmacy_id=DEFAULT_PHARMACY_ID,
):
    reorder_rows = policy_df.loc[policy_df["reorder"]].copy()
    reorder_rows["order_quantity"] = reorder_rows["order_qty"].apply(
        lambda value: int(math.ceil(max(float(value), 0.0)))
    )
    reorder_rows = reorder_rows.loc[reorder_rows["order_quantity"] > 0]

    reorder_requests = []
    for row in reorder_rows.to_dict("records"):
        reorder_requests.append(
            {
                "pharmacy_id": pharmacy_id,
                "medicine_id": str(row["medicine_id"]),
                "medicine_name": row.get("medicine_name", row["medicine_id"]),
                "current_stock": round(float(row["current_stock"]), 2),
                "required_stock": round(float(row["target_stock"]), 2),
                "order_quantity": int(row["order_quantity"]),
                "trigger_reason": _build_trigger_reason(row),
            }
        )

    return {
        "pharmacy_id": pharmacy_id,
        "reorder_requests": reorder_requests,
    }


def save_reorder_requests(
    policy_df,
    output_path=DEFAULT_REORDER_REQUESTS_FILE,
    pharmacy_id=DEFAULT_PHARMACY_ID,
):
    payload = build_reorder_requests_payload(
        policy_df,
        pharmacy_id=pharmacy_id,
    )
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with output_path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)

    return payload, output_path


def attach_medicine_names(policy_df, medicine_catalog=MEDICINE_NAME_MAP):
    named_df = policy_df.copy()
    named_df.insert(
        1,
        "medicine_name",
        named_df["medicine_id"].map(
            lambda medicine_id: medicine_catalog.get(medicine_id, {}).get(
                "name",
                medicine_id,
            )
        ),
    )
    return named_df


def build_current_stock_map(medicine_catalog=MEDICINE_NAME_MAP):
    stock_map = {
        medicine_id: details["current_stock"]
        for medicine_id, details in medicine_catalog.items()
        if "current_stock" in details
    }

    # Overlay static defaults with live stock from MongoDB when configured.
    mongo_stock_map, _ = _build_current_stock_and_price_maps_from_mongo(
        medicine_catalog
    )
    stock_map.update(mongo_stock_map)
    return stock_map


def build_current_price_map(medicine_catalog=MEDICINE_NAME_MAP):
    _, mongo_price_map = _build_current_stock_and_price_maps_from_mongo(
        medicine_catalog
    )
    return mongo_price_map


def _normalize_medicine_name(value):
    return " ".join(str(value).strip().lower().split())


def _build_name_to_med_id_map(medicine_catalog):
    return {
        _normalize_medicine_name(details.get("name", med_id)): med_id
        for med_id, details in medicine_catalog.items()
    }


def _resolve_product_med_id(product, name_to_med_id):
    explicit_med_id = product.get("medID")
    if explicit_med_id:
        return str(explicit_med_id).strip().upper(), True

    medicine_name = product.get("medicineName")
    if not medicine_name:
        return None, False

    return name_to_med_id.get(_normalize_medicine_name(medicine_name)), False


def _build_current_stock_and_price_maps_from_mongo(medicine_catalog):
    if MongoClient is None:
        return {}, {}

    mongo_url = os.getenv("MONGO_URL", "").strip()
    db_name = os.getenv("DB_NAME", "").strip()
    if not mongo_url or not db_name:
        return {}, {}

    target_pharma_id = os.getenv("PHARMA_ID", "").strip() or None
    name_to_med_id = _build_name_to_med_id_map(medicine_catalog)

    try:
        client = MongoClient(mongo_url, serverSelectionTimeoutMS=3000)
        db = client[db_name]
        products_collection = db["products"]
        batches_collection = db["batches"]

        product_filter = {"pharmaID": target_pharma_id} if target_pharma_id else {}
        products = list(
            products_collection.find(
                product_filter,
                {
                    "_id": 0,
                    "productID": 1,
                    "medID": 1,
                    "medicineName": 1,
                },
            )
        )

        # If PHARMA_ID is configured but mismatched, fallback to all products.
        if not products and target_pharma_id:
            products = list(
                products_collection.find(
                    {},
                    {
                        "_id": 0,
                        "productID": 1,
                        "medID": 1,
                        "medicineName": 1,
                    },
                )
            )

        product_to_med_id = {}
        for product in products:
            product_id = product.get("productID")
            if not product_id:
                continue

            med_id, _ = _resolve_product_med_id(product, name_to_med_id)
            if med_id not in medicine_catalog:
                continue

            product_to_med_id[str(product_id)] = med_id

        if not product_to_med_id:
            return {}, {}

        batch_filter = {"productID": {"$in": list(product_to_med_id.keys())}}
        if target_pharma_id:
            batch_filter["pharmaID"] = target_pharma_id

        mongo_stock_map = {}
        mongo_price_map = {}
        medicine_latest_update = {}
        for batch in batches_collection.find(
            batch_filter,
            {
                "_id": 0,
                "productID": 1,
                "lastUpdated": 1,
                "pricing.price": 1,
                "stock.unitsAvailable": 1,
            },
        ):
            product_id = batch.get("productID")
            med_id = product_to_med_id.get(str(product_id))
            if not med_id:
                continue

            units = ((batch.get("stock") or {}).get("unitsAvailable"))
            if units is None:
                continue

            mongo_stock_map[med_id] = round(
                float(mongo_stock_map.get(med_id, 0.0)) + float(units),
                2,
            )

            pricing_price = ((batch.get("pricing") or {}).get("price"))
            if pricing_price is None:
                continue

            last_updated = batch.get("lastUpdated")
            previous_last_updated = medicine_latest_update.get(med_id)
            if previous_last_updated is None or (
                last_updated is not None and last_updated >= previous_last_updated
            ):
                medicine_latest_update[med_id] = last_updated
                mongo_price_map[med_id] = round(float(pricing_price), 2)

        return mongo_stock_map, mongo_price_map
    except Exception:
        return {}, {}
    finally:
        try:
            client.close()
        except Exception:
            pass


def build_mongo_mapped_med_id_set(medicine_catalog=MEDICINE_NAME_MAP):
    if MongoClient is None:
        return set()

    mongo_url = os.getenv("MONGO_URL", "").strip()
    db_name = os.getenv("DB_NAME", "").strip()
    if not mongo_url or not db_name:
        return set()

    target_pharma_id = os.getenv("PHARMA_ID", "").strip() or None

    try:
        client = MongoClient(mongo_url, serverSelectionTimeoutMS=3000)
        db = client[db_name]
        products_collection = db["products"]

        product_filter = {"pharmaID": target_pharma_id} if target_pharma_id else {}
        products = list(
            products_collection.find(
                product_filter,
                {"_id": 0, "medID": 1},
            )
        )

        mapped_med_ids = set()
        for product in products:
            med_id = product.get("medID")
            if not med_id:
                continue
            med_id = str(med_id).strip().upper()
            if med_id in medicine_catalog:
                mapped_med_ids.add(med_id)

        return mapped_med_ids
    except Exception:
        return set()
    finally:
        try:
            client.close()
        except Exception:
            pass


def _build_current_stock_map_from_mongo(medicine_catalog):
    mongo_stock_map, _ = _build_current_stock_and_price_maps_from_mongo(
        medicine_catalog
    )
    return mongo_stock_map


def get_batch_price_from_mongo(product_id: str) -> float | None:
    """
    Fetch the batch pricing.price from MongoDB inventory_pharma database
    for a given product ID. Returns the most recently updated batch price.
    
    Args:
        product_id: The product ID to look up in the batches collection
        
    Returns:
        The price from batches.pricing.price or None if not found
    """
    if MongoClient is None:
        return None
        
    mongo_url = os.getenv("MONGO_URL", "").strip()
    db_name = os.getenv("DB_NAME", "").strip()
    if not mongo_url or not db_name:
        return None
    
    try:
        client = MongoClient(mongo_url, serverSelectionTimeoutMS=3000)
        db = client[db_name]
        batches_collection = db["batches"]
        
        # Find batches for this product, sorted by lastUpdated descending
        batch = batches_collection.find_one(
            {"productID": str(product_id)},
            {
                "_id": 0,
                "pricing.price": 1,
                "lastUpdated": 1,
            },
            sort=[("lastUpdated", -1)]
        )
        
        if batch and batch.get("pricing") and batch["pricing"].get("price") is not None:
            return round(float(batch["pricing"]["price"]), 2)
            
        return None
    except Exception:
        return None
    finally:
        try:
            client.close()
        except Exception:
            pass


def get_product_id_for_medicine(med_id: str) -> str | None:
    """
    Look up the productID from MongoDB products collection for a given medicine ID.
    
    Args:
        med_id: The medicine ID (e.g., "MED050")
        
    Returns:
        The productID or None if not found
    """
    if MongoClient is None:
        return None
        
    mongo_url = os.getenv("MONGO_URL", "").strip()
    db_name = os.getenv("DB_NAME", "").strip()
    if not mongo_url or not db_name:
        return None
    
    try:
        client = MongoClient(mongo_url, serverSelectionTimeoutMS=3000)
        db = client[db_name]
        products_collection = db["products"]
        
        # Find product with matching medID or genericKey
        product = products_collection.find_one(
            {"medID": str(med_id)},
            {"_id": 0, "productID": 1}
        )
        
        if product and product.get("productID"):
            return str(product["productID"])
            
        return None
    except Exception:
        return None
    finally:
        try:
            client.close()
        except Exception:
            pass


def resolve_dataset_path():
    project_root = Path(__file__).resolve().parent.parent
    for candidate in DATASET_CANDIDATES:
        candidate_path = project_root / candidate
        if candidate_path.exists():
            return candidate_path

    raise FileNotFoundError(
        "No demand workbook found. Checked: "
        + ", ".join(DATASET_CANDIDATES)
    )


def build_display_frame(policy_df):
    display_df = policy_df[
        [
            "medicine_name",
            "ensemble_forecast",
            "current_stock",
            "safety_stock",
            "rop",
            "target_stock",
            "reorder",
            "order_qty",
        ]
    ].copy()

    display_df = display_df.rename(
        columns={
            "medicine_name": "medicine",
            "ensemble_forecast": "forecast_quantity",
        }
    )

    numeric_columns = display_df.select_dtypes(include="number").columns
    display_df[numeric_columns] = display_df[numeric_columns].round(2)
    return display_df


def run(
    current_stock=None,
    pharmacy_id=DEFAULT_PHARMACY_ID,
    reorder_output_path=DEFAULT_REORDER_REQUESTS_FILE,
):
    demand_by_medicine = load_demand_by_medicine(resolve_dataset_path())
    hw_forecasts = forecast_by_medicine(demand_by_medicine)
    prophet_forecasts = prophet_forecast_by_medicine(demand_by_medicine)

    stock_input = (
        build_current_stock_map()
        if current_stock is None
        else current_stock
    )

    policy_df = hybrid_inventory_policy_by_medicine(
        hw_forecasts,
        prophet_forecasts,
        current_stock=stock_input,
    )
    policy_df = attach_medicine_names(policy_df)

    display_df = build_display_frame(policy_df)

    print("\n=== HYBRID INVENTORY OUTPUT ===")
    print(display_df.to_string(index=False))
    reorder_payload, output_path = save_reorder_requests(
        policy_df,
        output_path=reorder_output_path,
        pharmacy_id=pharmacy_id,
    )
    print(
        "\nSaved reorder requests for "
        f"{len(reorder_payload['reorder_requests'])} medicines to {output_path}"
    )
    return policy_df


if __name__ == "__main__":
    run()
