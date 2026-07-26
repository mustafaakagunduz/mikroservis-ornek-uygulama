import asyncio
import json
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from aiokafka import AIOKafkaConsumer
from sqlalchemy import select
from database import engine, Base, AsyncSessionLocal
from models import InventoryItem
from routers import inventory
from config import settings
import log_publisher as log

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def apply_order_event(topic: str, event: dict, db) -> None:
    """
    order.created → ürünleri 'reserved' olarak işaretle
    order.cancelled → rezervasyonu geri al

    Kafka'dan bağımsız, saf bir fonksiyon — test'ler gerçek Kafka'ya ihtiyaç
    duymadan bunu doğrudan çağırabilir.
    """
    for item in event.get("items", []):
        product_id = item["product_id"]
        qty = item["quantity"]

        inv = await db.scalar(
            select(InventoryItem).where(InventoryItem.product_id == product_id)
        )
        if not inv:
            inv = InventoryItem(product_id=product_id, reserved=0)
            db.add(inv)

        if topic == "order.created":
            inv.reserved += qty
            log.publish(settings.redis_url, "inventory-service", "info", "stock.reserved",
                        f"Stok rezerve edildi: {product_id[:8]}… → {qty} adet (toplam rezerve: {inv.reserved})")
        elif topic == "order.cancelled":
            inv.reserved = max(0, inv.reserved - qty)
            log.publish(settings.redis_url, "inventory-service", "info", "stock.released",
                        f"Stok serbest bırakıldı: {product_id[:8]}… → {qty} adet iade")

    await db.commit()

async def consume_order_events():
    consumer = AIOKafkaConsumer(
        "order.created",
        "order.cancelled",
        bootstrap_servers=settings.kafka_bootstrap_servers,
        group_id="inventory-service",
        value_deserializer=lambda v: json.loads(v.decode()),
        auto_offset_reset="earliest",
    )
    await consumer.start()
    logger.info("Inventory Kafka consumer started...")

    try:
        async for msg in consumer:
            async with AsyncSessionLocal() as db:
                await apply_order_event(msg.topic, msg.value, db)
    finally:
        await consumer.stop()

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    task = asyncio.create_task(consume_order_events())
    yield
    task.cancel()

app = FastAPI(title="Inventory Service", lifespan=lifespan)

app.include_router(inventory.router, prefix="/inventory", tags=["inventory"])

@app.get("/health")
async def health():
    return {"status": "ok", "service": "inventory"}
