from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import AliasChoices, BaseModel, ConfigDict, Field

from app.services.order_service import create_or_get_order, list_orders


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class OrderTaxBreakdown(StrictModel):
    gross: float
    discount: float
    taxable: float
    gst: float
    cgst: float
    sgst: float


class OrderItem(StrictModel):
    name: str
    price: float
    quantity: int
    discountPercent: float
    gstRate: float
    hsnCode: str
    mrpPerPack: float
    taxBreakdown: OrderTaxBreakdown
    productID_Dtb: str
    productID_Phm: str


class OrderPayload(StrictModel):
    orderNumber: str = Field(validation_alias=AliasChoices("orderNumber", "orderid"))
    pharmaID: str = Field(validation_alias=AliasChoices("pharmaID", "pharmaid"))
    distributorID: str = Field(
        validation_alias=AliasChoices("distributorID", "distributorid")
    )
    items: dict[str, OrderItem]
    totalAmount: float


class StoredOrder(OrderPayload):
    fingerprint: str
    created_at: str


class OrdersResponse(StrictModel):
    orders: list[StoredOrder]


class CreateOrderResponse(StrictModel):
    status: Literal["created", "duplicate"]
    orderNumber: str
    message: str
    order: StoredOrder


router = APIRouter(tags=["orders"])


@router.get("/orders", response_model=OrdersResponse)
def fetch_orders() -> dict:
    try:
        return {"orders": list_orders()}
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/orders", response_model=CreateOrderResponse)
def create_order(order: OrderPayload) -> dict:
    try:
        result = create_or_get_order(order.model_dump())
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    stored_order = result["order"]
    status = result["status"]

    return {
        "status": status,
        "orderNumber": stored_order["orderNumber"],
        "message": (
            "Order already placed. Showing existing receipt."
            if status == "duplicate"
            else "Order placed successfully"
        ),
        "order": stored_order,
    }