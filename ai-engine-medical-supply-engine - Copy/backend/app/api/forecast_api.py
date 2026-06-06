from fastapi import APIRouter, HTTPException

from app.services.forecast_service import get_forecast_payload


router = APIRouter(tags=["forecast"])


@router.get("")
def fetch_forecast() -> dict:
    try:
        return get_forecast_payload()
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(exc)) from exc
