from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import redis.asyncio as aioredis
from database import get_db
from models import User
from security import hash_password, verify_password, create_access_token, decode_token
from config import settings
from pydantic import BaseModel, EmailStr
import log_publisher as log

router = APIRouter()

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

async def get_redis():
    client = aioredis.from_url(settings.redis_url, decode_responses=True)
    try:
        yield client
    finally:
        await client.aclose()

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.scalar(select(User).where(User.email == body.email))
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
    )
    db.add(user)
    await db.commit()
    log.publish(settings.redis_url, "auth-service", "success", "user.registered",
                f"Yeni kullanıcı kayıt oldu: {body.email}")
    return {"message": "User created", "user_id": user.id}

@router.post("/login", response_model=TokenResponse)
async def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
):
    user = await db.scalar(select(User).where(User.email == form.username))
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"sub": user.id, "email": user.email})

    # Redis'e cache: token → user_id (TTL: access_token_expire_minutes)
    await redis.setex(f"token:{token}", settings.access_token_expire_minutes * 60, user.id)
    log.publish(settings.redis_url, "auth-service", "info", "user.login",
                f"Giriş yapıldı: {user.email} → token Redis'e yazıldı")
    return {"access_token": token}

@router.post("/verify")
async def verify_token(
    token: str,
    redis: aioredis.Redis = Depends(get_redis),
):
    """
    Diğer servisler bu endpoint'i çağırarak token doğrular.
    Önce Redis cache'e bakar, yoksa JWT decode eder.
    """
    cached = await redis.get(f"token:{token}")
    if cached:
        log.publish(settings.redis_url, "auth-service", "info", "token.verify",
                    f"Token doğrulandı (Redis cache hit) → user_id: {cached}")
        return {"valid": True, "user_id": cached}

    try:
        payload = decode_token(token)
        return {"valid": True, "user_id": payload["sub"]}
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

@router.post("/logout")
async def logout(token: str, redis: aioredis.Redis = Depends(get_redis)):
    # Token'ı Redis'ten sil → blacklist etkisi
    await redis.delete(f"token:{token}")
    log.publish(settings.redis_url, "auth-service", "info", "user.logout",
                "Çıkış yapıldı → token Redis'ten silindi (blacklist)")
    return {"message": "Logged out"}
