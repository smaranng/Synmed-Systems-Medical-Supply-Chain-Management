from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

app = FastAPI(title="Analytics Engine Service")

class AnalyticsRequest(BaseModel):
    entity_id: str
    entity_type: str  # pharmacy, distributor, customer
    metric: str  # sales, inventory, orders
    period: str  # daily, weekly, monthly

class AnalyticsResponse(BaseModel):
    metric: str
    data: List[Dict]
    summary: Dict
    insights: List[str]

@app.get("/health")
async def health_check():
    return {"service": "analytics-engine", "status": "ok"}

@app.post("/analyze", response_model=AnalyticsResponse)
async def analyze_data(request: AnalyticsRequest):
    """
    Analyze data and provide insights
    """
    try:
        # Mock analytics generation
        # In production, this would fetch and analyze real data
        
        # Generate mock time series data
        dates = pd.date_range(end=datetime.now(), periods=30, freq='D')
        values = np.random.randint(50, 200, size=30)
        
        data = [
            {"date": date.strftime("%Y-%m-%d"), "value": int(value)}
            for date, value in zip(dates, values)
        ]
        
        # Calculate summary statistics
        summary = {
            "total": int(np.sum(values)),
            "average": float(np.mean(values)),
            "max": int(np.max(values)),
            "min": int(np.min(values)),
            "trend": "increasing" if values[-1] > values[0] else "decreasing"
        }
        
        # Generate insights
        insights = [
            f"Average daily {request.metric}: {summary['average']:.2f}",
            f"Peak value reached on {data[np.argmax(values)]['date']}",
            f"Overall trend is {summary['trend']}"
        ]
        
        return AnalyticsResponse(
            metric=request.metric,
            data=data,
            summary=summary,
            insights=insights
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/anomalies/{entity_id}")
async def detect_anomalies(entity_id: str):
    """
    Detect anomalies in data patterns
    """
    return {
        "entity_id": entity_id,
        "anomalies_detected": 2,
        "anomalies": [
            {
                "date": "2024-01-15",
                "metric": "sales",
                "expected": 120,
                "actual": 45,
                "severity": "high"
            }
        ]
    }

@app.get("/recommendations/{pharmacy_id}")
async def get_recommendations(pharmacy_id: str):
    """
    Generate business recommendations based on analytics
    """
    return {
        "pharmacy_id": pharmacy_id,
        "recommendations": [
            {
                "type": "inventory",
                "priority": "high",
                "message": "Consider reordering Paracetamol - predicted stockout in 5 days"
            },
            {
                "type": "pricing",
                "priority": "medium",
                "message": "Competitor pricing analysis suggests 5% reduction on Ibuprofen"
            }
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5003)
