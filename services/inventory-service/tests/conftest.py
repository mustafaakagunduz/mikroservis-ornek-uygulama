"""
Inventory service test altyapısı.

Önemli mock kararları:
- Kafka consumer → hiç başlatılmıyor (main.py'deki apply_order_event fonksiyonu
  doğrudan çağrılıyor, gerçek Kafka mesajı gerekmez)
- Redis (log publisher) → mock'lanıyor
- DB → SQLite in-memory

Bu yaklaşım "servis bağımsızlığı"nı test seviyesinde de gösterir:
inventory-service testi çalışmak için başka hiçbir servisin ayakta olmasına ihtiyaç duymaz.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")
os.environ.setdefault("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")

import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from httpx import AsyncClient, ASGITransport

from main import app
from database import Base, get_db

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture
async def db_session(mocker):
    """apply_order_event fonksiyonunu doğrudan test etmek için ham DB session."""
    engine = create_async_engine(TEST_DB_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    TestSession = async_sessionmaker(engine, expire_on_commit=False)
    mocker.patch("main.log.publish")

    async with TestSession() as session:
        yield session

    await engine.dispose()


@pytest_asyncio.fixture
async def client():
    """HTTP endpoint'lerini (GET /inventory/...) test etmek için.
    İkinci elemanı (TestSession) testlerin veri hazırlamak için DB'ye
    doğrudan erişmesini sağlar."""
    engine = create_async_engine(TEST_DB_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    TestSession = async_sessionmaker(engine, expire_on_commit=False)

    async def override_db():
        async with TestSession() as session:
            yield session

    app.dependency_overrides[get_db] = override_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac, TestSession

    app.dependency_overrides.clear()
    await engine.dispose()
