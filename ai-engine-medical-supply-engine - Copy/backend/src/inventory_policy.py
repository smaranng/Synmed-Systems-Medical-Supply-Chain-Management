import math

SERVICE_LEVEL_Z = 1.65
LEAD_TIME_MONTHS = 0.5

def compute_inventory_policy(forecast_result, current_stock):

    mean = forecast_result["prediction"]
    lower = forecast_result["lower"]
    upper = forecast_result["upper"]

    # Prophet uncertainty ≈ 2 sigma range
    sigma = (upper - lower) / 4

    expected_lt_demand = mean * LEAD_TIME_MONTHS

    safety_stock = SERVICE_LEVEL_Z * sigma * math.sqrt(LEAD_TIME_MONTHS)

    rop = expected_lt_demand + safety_stock

    target_stock = mean + safety_stock + expected_lt_demand

    reorder = current_stock < rop

    order_qty = max(0, target_stock - current_stock) if reorder else 0

    return {
        "forecast": mean,
        "sigma": sigma,
        "safety_stock": safety_stock,
        "rop": rop,
        "target_stock": target_stock,
        "reorder": reorder,
        "order_qty": order_qty
    }