from fastapi import FastAPI
from contextlib import asynccontextmanager
from database import engine, Base
from routers import auth, users

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Uygulama başlarken tabloları oluştur
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(title="Auth Service", lifespan=lifespan)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(users.router, prefix="/users", tags=["users"])

@app.get("/health")
async def health():
    return {"status": "ok", "service": "auth"}
