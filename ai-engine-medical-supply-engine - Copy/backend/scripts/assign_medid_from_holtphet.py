import argparse
import ast
import os
import re
from pathlib import Path
from typing import Any

from pymongo import MongoClient

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - optional helper
    load_dotenv = None


def normalize_name(value: str) -> str:
    text = value.strip().lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def load_holtphet_map(holtphet_path: Path) -> dict[str, dict[str, Any]]:
    source = holtphet_path.read_text(encoding="utf-8")
    module = ast.parse(source, filename=str(holtphet_path))

    for node in module.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == "MEDICINE_NAME_MAP":
                    value = ast.literal_eval(node.value)
                    if not isinstance(value, dict):
                        raise ValueError("MEDICINE_NAME_MAP is not a dictionary.")
                    return value

    raise ValueError("MEDICINE_NAME_MAP not found in holtphet_main.py")


def build_name_to_medid(medicine_map: dict[str, dict[str, Any]]) -> dict[str, str]:
    name_to_medid: dict[str, str] = {}
    for med_id, details in medicine_map.items():
        name = str(details.get("name", "")).strip()
        if not name:
            continue

        key = normalize_name(name)
        if key in name_to_medid and name_to_medid[key] != med_id:
            raise ValueError(
                f"Duplicate normalized medicine name in MEDICINE_NAME_MAP: {name}"
            )
        name_to_medid[key] = med_id

    return name_to_medid


def main() -> None:
    script_dir = Path(__file__).resolve().parent
    backend_dir = script_dir.parent
    env_path = backend_dir / ".env"
    if load_dotenv is not None and env_path.exists():
        load_dotenv(env_path)

    parser = argparse.ArgumentParser(
        description=(
            "Match product medicine names from MongoDB against MEDICINE_NAME_MAP "
            "and set products.medID."
        )
    )
    parser.add_argument(
        "--mongo-url",
        default=os.getenv("MONGO_URL", "").strip(),
        help="Mongo connection URL (defaults to MONGO_URL env).",
    )
    parser.add_argument(
        "--db-name",
        default=os.getenv("DB_NAME", "").strip(),
        help="Database name (defaults to DB_NAME env).",
    )
    parser.add_argument(
        "--pharma-id",
        default=os.getenv("PHARMA_ID", "").strip() or None,
        help="Optional pharmaID filter for products collection.",
    )
    parser.add_argument(
        "--products-collection",
        default="products",
        help="Products collection name.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply updates to Mongo. Default is dry-run.",
    )
    parser.add_argument(
        "--holtphet-path",
        default=str(Path(__file__).resolve().parents[1] / "src" / "holtphet_main.py"),
        help="Path to holtphet_main.py.",
    )

    args = parser.parse_args()

    if not args.mongo_url:
        raise ValueError("Missing --mongo-url or MONGO_URL environment variable.")
    if not args.db_name:
        raise ValueError("Missing --db-name or DB_NAME environment variable.")

    holtphet_path = Path(args.holtphet_path)
    medicine_map = load_holtphet_map(holtphet_path)
    name_to_medid = build_name_to_medid(medicine_map)

    client = MongoClient(args.mongo_url, serverSelectionTimeoutMS=5000)
    db = client[args.db_name]
    products = db[args.products_collection]

    query: dict[str, Any] = {}
    if args.pharma_id:
        query["pharmaID"] = args.pharma_id

    matched = 0
    updated = 0
    skipped_existing = 0
    not_found = 0

    sample_not_found: list[str] = []

    try:
        for product in products.find(
            query,
            {
                "_id": 1,
                "productID": 1,
                "medicineName": 1,
                "medID": 1,
                "pharmaID": 1,
            },
        ):
            medicine_name = str(product.get("medicineName", "")).strip()
            if not medicine_name:
                continue

            key = normalize_name(medicine_name)
            med_id = name_to_medid.get(key)
            if not med_id:
                not_found += 1
                if len(sample_not_found) < 20:
                    sample_not_found.append(medicine_name)
                continue

            matched += 1
            current_med_id = str(product.get("medID", "")).strip() if product.get("medID") else ""
            if current_med_id == med_id:
                skipped_existing += 1
                continue

            if args.apply:
                products.update_one(
                    {"_id": product["_id"]},
                    {"$set": {"medID": med_id}},
                )
            updated += 1

        mode = "APPLY" if args.apply else "DRY-RUN"
        print(f"mode: {mode}")
        print(f"products_matched_by_name: {matched}")
        print(f"products_to_update: {updated}")
        print(f"products_already_correct: {skipped_existing}")
        print(f"products_not_matched: {not_found}")

        if sample_not_found:
            print("sample_unmatched_medicine_names:")
            for name in sample_not_found:
                print(f"- {name}")

        if not args.apply:
            print("No database updates were made. Re-run with --apply to persist medID changes.")
    finally:
        client.close()


if __name__ == "__main__":
    main()
