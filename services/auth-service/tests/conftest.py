"""
Integration test altyapısı.

Gerçek PostgreSQL yerine SQLite (in-memory) kullanır.
Gerçek Redis yerine fakeredis kullanır.
Her test fonksiyonu temiz bir DB ile başlar.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# Testler import etmeden önce config'in beklediği env var'ları set et
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")
os.environ.setdefault("SECRET_KEY", "test-secret-key")

import pytest
import pytest_asyncio
import fakeredis.aioredis
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from httpx import AsyncClient, ASGITransport

from unittest.mock import patch
from main import app
from database import Base, get_db
from routers.auth import get_redis

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture
async def client():
    engine = create_async_engine(TEST_DB_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    TestSession = async_sessionmaker(engine, expire_on_commit=False)
    fake_redis = fakeredis.aioredis.FakeRedis(decode_responses=True)

    async def override_db():
        async with TestSession() as session:
            yield session

    async def override_redis():
        yield fake_redis

    # FastAPI'nin dependency injection sistemine test versiyonlarını enjekte et
    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_redis] = override_redis

    # log_publisher fire-and-forget görevleri gerçek Redis'e bağlanmaya çalışır, mock'la
    with patch("routers.auth.log.publish"):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            yield ac

    # Cleanup
    app.dependency_overrides.clear()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()
