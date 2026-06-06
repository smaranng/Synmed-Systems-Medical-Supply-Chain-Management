from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

app = FastAPI(title="Demand Forecasting Service")

class ForecastRequest(BaseModel):
    pharmacy_id: str
    medicine_id: str
    historical_days: int = 90

class ForecastResponse(BaseModel):
    medicine_id: str
    predicted_demand: int
    confidence_score: float
    forecast_period_days: int
    factors: dict

@app.get("/health")
async def health_check():
    return {"service": "demand-forecasting", "status": "ok"}

@app.post("/forecast", response_model=ForecastResponse)
async def generate_forecast(request: ForecastRequest):
    """
    Generate demand forecast using historical sales data
    Uses simple moving average and trend analysis
    """
    try:
        # Mock historical data generation
        # In production, this would fetch from database
        np.random.seed(42)
        historical_sales = np.random.poisson(lam=50, size=request.historical_days)
        
        # Simple forecast using moving average
        window_size = 7
        moving_avg = pd.Series(historical_sales).rolling(window=window_size).mean()
        predicted_demand = int(moving_avg.iloc[-1])
        
        # Calculate trend
        recent_trend = moving_avg.iloc[-7:].mean() - moving_avg.iloc[-14:-7].mean()
        
        # Adjust prediction based on trend
        if recent_trend > 0:
            predicted_demand = int(predicted_demand * 1.1)
        elif recent_trend < 0:
            predicted_demand = int(predicted_demand * 0.9)
        
        # Calculate confidence score
        variance = np.var(historical_sales[-30:])
        confidence_score = max(0.6, min(0.95, 1 - (variance / 1000)))
        
        return ForecastResponse(
            medicine_id=request.medicine_id,
            predicted_demand=predicted_demand,
            confidence_score=round(confidence_score, 4),
            forecast_period_days=7,
            factors={
                "historical_avg": float(np.mean(historical_sales)),
                "recent_trend": "increasing" if recent_trend > 0 else "decreasing",
                "seasonality": "low"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/batch-forecast")
async def batch_forecast(pharmacy_id: str):
    """
    Generate forecasts for all medicines in a pharmacy
    """
    return {
        "pharmacy_id": pharmacy_id,
        "forecasts_generated": 0,
        "message": "Batch forecasting scheduled"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5001)
