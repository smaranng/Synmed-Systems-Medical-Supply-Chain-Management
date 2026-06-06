from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import forecast_api, inventory_api, orders_api, procurement_api
from app.core.config import load_app_environment


load_app_environment()

app = FastAPI(
    title="AI Medical Supply Engine",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(forecast_api.router, prefix="/forecast")
app.include_router(inventory_api.router, prefix="/inventory")
app.include_router(procurement_api.router, prefix="/procurement")
app.include_router(orders_api.router)


@app.get("/")
def root() -> dict:
    return {"status": "AI Pharmacy Backend Running"}
