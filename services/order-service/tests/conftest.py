"""
Order service integration test altyapısı.

Önemli mock kararları:
- auth-service HTTP çağrısı → dependency override ile bypass (get_current_user)
- product-service HTTP çağrısı → respx ile mock (gerçek HTTP, fake response)
- Kafka producer → unittest.mock ile mock (publish çağrısı assert edilebilir)
- DB → SQLite in-memory

Bu yaklaşım "servis bağımsızlığı"nı test seviyesinde de gösterir:
order-service testi çalışmak için başka hiçbir servisin ayakta olmasına ihtiyaç duymaz.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")
os.environ.setdefault("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
os.environ.setdefault("PRODUCT_SERVICE_URL", "http://product-service:8000")
os.environ.setdefault("AUTH_SERVICE_URL", "http://auth-service:8000")

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, patch
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from httpx import AsyncClient, ASGITransport

from main import app
from database import Base, get_db
from routers.orders import get_current_user

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"
FAKE_USER_ID = "test-user-uuid-1234"


@pytest_asyncio.fixture
async def client(mocker):
    engine = create_async_engine(TEST_DB_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    TestSession = async_sessionmaker(engine, expire_on_commit=False)

    async def override_db():
        async with TestSession() as session:
            yield session

    # Auth kontrolünü bypass et — her istekte FAKE_USER_ID döndür
    async def override_user():
        return FAKE_USER_ID

    # Kafka publish'leri mock'la — gerçek Kafka bağlantısı gerekmez
    mocker.patch("routers.orders.publish_order_created", new_callable=AsyncMock)
    mocker.patch("routers.orders.publish_order_cancelled", new_callable=AsyncMock)

    # log publisher'ı da mock'la — Redis bağlantısı gerekmez
    mocker.patch("routers.orders.log.publish")

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = override_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()
