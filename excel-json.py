import pandas as pd
import json
import re

INPUT_CSV = "inventory.csv"
OUTPUT_JSON = "inventory_output.json"

# Read CSV safely (fix broken encodings)
df = pd.read_csv(INPUT_CSV, encoding="latin1")

def clean_text(text):
    if not isinstance(text, str):
        return text
    return (
        text.replace("��", "")
            .replace("?", "₹")
            .replace("�C", "°C")
            .replace("\xa0", " ")
            .strip()
    )

def infer_dosage_form(name):
    if not isinstance(name, str):
        return None
    name = name.lower()
    if "tablet" in name: return "Tablet"
    if "capsule" in name: return "Capsule"
    if "syrup" in name: return "Syrup"
    if "injection" in name: return "Injection"
    if "cream" in name: return "Cream"
    return None

def infer_therapeutic_class_from_description(desc):
    if not isinstance(desc, str):
        return None

    desc = desc.lower()

    if any(word in desc for word in ["antibiotic", "bacterial infection", "kills bacteria"]):
        return "Antibiotic"

    if any(word in desc for word in ["pain", "fever", "headache", "analgesic"]):
        return "Analgesic"

    if any(word in desc for word in ["blood pressure", "hypertension", "heart failure"]):
        return "Antihypertensive"

    if any(word in desc for word in ["diabetes", "blood sugar", "insulin"]):
        return "Antidiabetic"

    if any(word in desc for word in ["allergy", "anti allergic", "histamine"]):
        return "Antihistamine"

    if any(word in desc for word in ["acid reflux", "ulcer", "stomach acid"]):
        return "Antacid"

    if any(word in desc for word in ["asthma", "bronchodilator", "breathing"]):
        return "Respiratory"

    if any(word in desc for word in ["skin infection", "dermatological", "cream", "ointment"]):
        return "Dermatological"

    if any(word in desc for word in ["vitamin", "nutritional supplement", "mineral"]):
        return "Supplement"

    if any(word in desc for word in ["vaccine", "immunization"]):
        return "Vaccine"

    return None


import re

def extract_mrp_discount(text):
    if not isinstance(text, str):
        return None, None

    # Extract discount (always from %)
    discount_match = re.search(r'(\d+)\s*%', text)
    discount = int(discount_match.group(1)) if discount_match else None

    # Extract price (first decimal or integer number ONLY)
    price_match = re.search(r'([0-9]+(?:\.[0-9]+)?)', text)
    mrp = float(price_match.group(1)) if price_match else None

    return mrp, discount


records = []

for _, row in df.head(10).iterrows():

    mrp, discount = extract_mrp_discount(str(row.get("mrpWithDiscount")))

    record = {
        "productID": row.get("productID"),
        "pharmaID": row.get("pharmaID"),
        "batchCode": row.get("batchCode"),

        "medicineName": clean_text(row.get("medicineName")),
        "composition": clean_text(row.get("composition")),

        "category": {
            "primaryCategory": row.get("category"),
            
            "therapeuticClass": infer_therapeutic_class_from_description(row.get("description")),
            "dosageForm": infer_dosage_form(row.get("medicineName"))
        },

        "description": clean_text(row.get("description")),

        "prescriptionRequired": str(row.get("prescriptionRequired")).lower() == "yes",
        "manufacturer": clean_text(row.get("manufacturer")),

        "packaging": {
            "quantityDescription": clean_text(row.get("quantity")),
            "mrp": mrp,
            "discountPercent": discount,
            "price": row.get("price"),
            "pricePerUnit": row.get("pricePerUnit")
        },

        "stock": {
            "unitsAvailable": row.get("unitsAvailable"),
            "threshold": row.get("threshold"),
            "status": row.get("status")
        },

        "storageCondition": clean_text(row.get("storageCondition")),

        "manufacturedDate": str(row.get("manufacturedDate")),
        "expiryDate": str(row.get("expiryDate")),
        "lastUpdated": str(row.get("lastUpdated"))
    }

    records.append(record)

with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
    json.dump(records, f, indent=2, ensure_ascii=False)

print("✅ JSON created successfully:", OUTPUT_JSON)
