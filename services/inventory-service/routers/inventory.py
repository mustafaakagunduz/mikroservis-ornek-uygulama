from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import InventoryItem

router = APIRouter()

@router.get("/{product_id}")
async def get_inventory(product_id: str, db: AsyncSession = Depends(get_db)):
    item = await db.scalar(select(InventoryItem).where(InventoryItem.product_id == product_id))
    if not item:
        return {"product_id": product_id, "reserved": 0}
    return {"product_id": item.product_id, "reserved": item.reserved}

@router.get("/")
async def list_inventory(db: AsyncSession = Depends(get_db)):
    items = await db.scalars(select(InventoryItem))
    return [{"product_id": i.product_id, "reserved": i.reserved} for i in items]
