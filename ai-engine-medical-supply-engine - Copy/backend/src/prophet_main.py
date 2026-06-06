import pandas as pd

try:
    from .inventory_policy import compute_inventory_policy
    from .prophet_model import prophet_forecast
except ImportError:  # pragma: no cover - script execution fallback
    from inventory_policy import compute_inventory_policy
    from prophet_model import prophet_forecast

FILE = "../data/medicine_history.xlsx"
CURRENT_STOCK = 85

def run():

    df = pd.read_excel(FILE, sheet_name="demand")

    # clean headers
    df.columns = df.columns.str.strip().str.lower()

    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values('date')

    demand_series = df.set_index('date')['quantity'].astype(float)

    forecast = prophet_forecast(demand_series)

    policy = compute_inventory_policy(forecast, CURRENT_STOCK)

    print("\n=== PROPHET INVENTORY OUTPUT ===")
    print("Forecast:", round(policy["forecast"],2))
    print("Uncertainty σ:", round(policy["sigma"],2))
    print("Safety Stock:", round(policy["safety_stock"],2))
    print("ROP:", round(policy["rop"],2))
    print("Target Stock:", round(policy["target_stock"],2))
    print("Reorder:", policy["reorder"])
    print("Order Qty:", round(policy["order_qty"],2))

if __name__ == "__main__":
    run()
