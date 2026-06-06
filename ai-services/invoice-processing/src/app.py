from fastapi import FastAPI, File, UploadFile, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import re
from datetime import datetime

app = FastAPI(title="Invoice Processing Service")

class InvoiceItem(BaseModel):
    medicine_name: str
    quantity: int
    unit_price: float
    total_price: float
    batch_number: Optional[str] = None
    expiry_date: Optional[str] = None

class InvoiceData(BaseModel):
    invoice_number: str
    distributor_name: str
    date: str
    items: List[InvoiceItem]
    total_amount: float
    confidence_score: float

@app.get("/health")
async def health_check():
    return {"service": "invoice-processing", "status": "ok"}

@app.post("/process-invoice", response_model=InvoiceData)
async def process_invoice(file: UploadFile = File(...)):
    """
    Process invoice using OCR and extract structured data
    """
    try:
        # Mock invoice processing
        # In production, this would use Tesseract OCR and NLP
        
        # Simulate processing
        mock_data = InvoiceData(
            invoice_number=f"INV-{datetime.now().strftime('%Y%m%d')}-001",
            distributor_name="PharmaDist Ltd",
            date=datetime.now().strftime("%Y-%m-%d"),
            items=[
                InvoiceItem(
                    medicine_name="Paracetamol 500mg",
                    quantity=100,
                    unit_price=20.00,
                    total_price=2000.00,
                    batch_number="BATCH-2024-001",
                    expiry_date="2025-12-31"
                ),
                InvoiceItem(
                    medicine_name="Amoxicillin 250mg",
                    quantity=50,
                    unit_price=45.00,
                    total_price=2250.00,
                    batch_number="BATCH-2024-002",
                    expiry_date="2025-10-15"
                )
            ],
            total_amount=4250.00,
            confidence_score=0.92
        )
        
        return mock_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/extract-text")
async def extract_text(file: UploadFile = File(...)):
    """
    Extract raw text from invoice document
    """
    return {
        "filename": file.filename,
        "text": "Mock extracted text from invoice",
        "pages": 1
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5002)
