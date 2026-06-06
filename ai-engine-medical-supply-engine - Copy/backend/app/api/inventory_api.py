from fastapi import APIRouter, HTTPException

from app.services.inventory_service import get_inventory_payload


router = APIRouter(tags=["inventory"])


@router.get("")
def fetch_inventory() -> dict:
    try:
        return get_inventory_payload()
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(exc)) from exc
