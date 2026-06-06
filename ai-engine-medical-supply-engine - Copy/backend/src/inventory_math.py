import numpy as np
import math
from scipy.stats import norm

SERVICE_LEVEL = 0.95
Z = norm.ppf(SERVICE_LEVEL)

def compute_statistics(demand):
    mu = np.mean(demand)
    sigma = np.std(demand)
    return mu, sigma

def expected_demand_during_lead_time(forecast, lead_time_months):
    return forecast * lead_time_months

def safety_stock(sigma, lead_time_months):
    sigma_lt = sigma * math.sqrt(lead_time_months)
    return Z * sigma_lt

def reorder_point(expected_lt, safety):
    return expected_lt + safety

def update_threshold(current_threshold, new_rop):
    return round(new_rop)