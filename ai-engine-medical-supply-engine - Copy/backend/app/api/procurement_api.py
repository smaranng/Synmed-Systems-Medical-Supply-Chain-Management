from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.services.full_trace_service import get_full_trace_payload
from app.services.pharmacy_config_service import save_pharmacy_config
from app.services.procurement_service import (
    ensure_procurement_stream_ready,
    get_procurement_payload,
    stream_procurement_response,
)


router = APIRouter(tags=["procurement"])


class BudgetUpdateRequest(BaseModel):
    monthly_budget: float = Field(ge=0)


@router.get("")
def stream_procurement() -> StreamingResponse:
    try:
        ensure_procurement_stream_ready()
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return StreamingResponse(
        stream_procurement_response(),
        media_type="text/plain; charset=utf-8",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/data")
def fetch_procurement_data() -> dict:
    try:
        return get_procurement_payload()
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/config")
def update_procurement_config(payload: BudgetUpdateRequest) -> dict:
    try:
        save_pharmacy_config(monthly_budget=payload.monthly_budget)
        return get_procurement_payload()
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/trace/{medicine_id}")
def fetch_procurement_trace(medicine_id: str) -> dict:
    try:
        return get_full_trace_payload(medicine_id)
    except KeyError as exc:  # pragma: no cover
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(exc)) from exc