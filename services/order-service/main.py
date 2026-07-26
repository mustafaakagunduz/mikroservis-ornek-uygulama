from fastapi import FastAPI
from contextlib import asynccontextmanager
from database import engine, Base
from routers import orders
from kafka_producer import stop_producer

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await stop_producer()

app = FastAPI(title="Order Service", lifespan=lifespan)

app.include_router(orders.router, prefix="/orders", tags=["orders"])

@app.get("/health")
async def health():
    return {"status": "ok", "service": "order"}
