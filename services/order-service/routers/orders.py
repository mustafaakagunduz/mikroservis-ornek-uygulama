from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import httpx
from database import get_db
from models import Order
from kafka_producer import publish_order_created, publish_order_cancelled
from config import settings
from pydantic import BaseModel
from typing import Optional
import log_publisher as log

router = APIRouter()

class OrderItem(BaseModel):
    product_id: str
    quantity: int

class CreateOrderRequest(BaseModel):
    items: list[OrderItem]

async def get_current_user(authorization: Optional[str] = Header(None)) -> str:
    """Token'ı auth-service'e gönderip user_id alır."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.split(" ")[1]

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{settings.auth_service_url}/auth/verify",
            params={"token": token},
        )
    if resp.status_code != 200 or not resp.json().get("valid"):
        raise HTTPException(status_code=401, detail="Invalid token")
    return resp.json()["user_id"]

@router.post("/", status_code=201)
async def create_order(
    body: CreateOrderRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    # Ürün bilgilerini product-service'ten çek
    order_items = []
    total = 0.0

    async with httpx.AsyncClient() as client:
        for item in body.items:
            resp = await client.get(f"{settings.product_service_url}/products/{item.product_id}")
            if resp.status_code != 200:
                raise HTTPException(status_code=400, detail=f"Product {item.product_id} not found")
            product = resp.json()
            unit_price = product["price"]
            order_items.append({
                "product_id": item.product_id,
                "name": product["name"],
                "quantity": item.quantity,
                "unit_price": unit_price,
            })
            total += unit_price * item.quantity

    order = Order(user_id=user_id, items=order_items, total_price=total)
    db.add(order)
    await db.commit()

    item_summary = ", ".join(f"{i['name']} x{i['quantity']}" for i in order_items)
    log.publish(settings.redis_url, "order-service", "success", "order.created",
                f"Sipariş oluşturuldu #{order.id[:8]} | {item_summary} | Toplam: {total:.2f}₺")

    # Kafka'ya event publish et — notification ve inventory servisler bunu consume eder
    await publish_order_created({
        "order_id": order.id,
        "user_id": user_id,
        "items": order_items,
        "total_price": float(order.total_price),
        "status": order.status,
    })
    log.publish(settings.redis_url, "order-service", "info", "kafka.publish",
                f"Kafka'ya 'order.created' event'i gönderildi → order #{order.id[:8]}")

    return {"order_id": order.id, "total_price": float(order.total_price), "status": order.status}

@router.get("/")
async def list_orders(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    orders = await db.scalars(select(Order).where(Order.user_id == user_id))
    return [
        {"id": o.id, "items": o.items, "total_price": float(o.total_price), "status": o.status}
        for o in orders
    ]

@router.delete("/{order_id}")
async def cancel_order(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    order = await db.scalar(select(Order).where(Order.id == order_id, Order.user_id == user_id))
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != "pending":
        raise HTTPException(status_code=400, detail="Only pending orders can be cancelled")

    order.status = "cancelled"
    await db.commit()

    await publish_order_cancelled({"order_id": order.id, "user_id": user_id, "items": order.items})
    log.publish(settings.redis_url, "order-service", "warning", "order.cancelled",
                f"Sipariş iptal edildi #{order.id[:8]} → Kafka'ya 'order.cancelled' gönderildi")
    return {"message": "Order cancelled"}
