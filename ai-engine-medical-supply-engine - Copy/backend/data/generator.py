import numpy as np
import pandas as pd

np.random.seed(42)

# -----------------------------
# CONFIGURATION
# -----------------------------
NUM_MEDICINES = 50
START_DATE = "2018-01-01"
END_DATE = "2025-12-01"

# Generate medicine IDs
medicine_ids = [f"MED{str(i).zfill(3)}" for i in range(1, NUM_MEDICINES + 1)]

# Monthly date range
dates = pd.date_range(start=START_DATE, end=END_DATE, freq='MS')

# -----------------------------
# SEASONALITY FUNCTION
# -----------------------------
def seasonal_factor(month):
    """
    Custom pharma seasonality:
    - Peak: July–August
    - Low: March–April
    """
    peak_months = [7, 8]
    low_months = [3, 4]

    if month in peak_months:
        return 1.3
    elif month in low_months:
        return 0.7
    else:
        return 1.0 + 0.1 * np.sin((month / 12) * 2 * np.pi)

# -----------------------------
# GENERATE DATA
# -----------------------------
data = []

for med in medicine_ids:
    
    # Medicine-specific parameters
    base_demand = np.random.randint(50, 300)
    trend = np.random.uniform(0.5, 3.0)  # monthly growth
    volatility = np.random.uniform(5, 30)

    for i, date in enumerate(dates):
        
        month = date.month
        
        # Components
        seasonal = seasonal_factor(month)
        trend_component = 1 + (trend * i / len(dates))
        noise = np.random.normal(0, volatility)

        # Final demand
        demand = base_demand * seasonal * trend_component + noise
        
        # Ensure non-negative & realistic rounding
        demand = max(0, int(round(demand)))

        data.append([date, med, demand])

# -----------------------------
# CREATE DATAFRAME
# -----------------------------
df = pd.DataFrame(data, columns=["date", "medicine_id", "quantity"])

# -----------------------------
# SAVE DATASET
# -----------------------------
df.to_excel("synthetic_pharmacy_demand.xlsx", index=False)

print("Dataset generated successfully!")
print(df.head())