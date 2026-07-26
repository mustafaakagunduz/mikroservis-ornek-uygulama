"""
Log Service — Redis Pub/Sub → SSE (Server-Sent Events)

Gerçek dünyada bu rol ELK Stack veya Loki + Grafana'ya aittir.
Burada aynı konsepti Redis Pub/Sub + SSE ile minimal olarak gösteriyoruz:
  - Her servis Redis'e "logs" channel'ına publish eder
  - Bu servis subscribe olur, gelen mesajları SSE stream ile frontend'e iletir
  - Frontend EventSource API ile dinler, sayfayı yenilemeden canlı görür
"""
import asyncio
import json
from datetime import datetime, timezone

import redis.asyncio as aioredis
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from config import settings

app = FastAPI(title="Log Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

async def redis_to_sse():
    client = aioredis.from_url(settings.redis_url)
    pubsub = client.pubsub()
    await pubsub.subscribe("logs")

    try:
        # Bağlantı kurulduğunda hoşgeldin mesajı
        welcome = json.dumps({
            "service": "system",
            "level": "info",
            "event": "connected",
            "message": "Log stream bağlandı. Servislerden gelecek event'ler burada görünecek.",
            "ts": datetime.now(timezone.utc).strftime("%H:%M:%S"),
        })
        yield f"data: {welcome}\n\n"

        # Kafka/RabbitMQ gibi SSE bağlantısını canlı tutan heartbeat
        # Nginx 60s'den uzun sessiz bağlantıyı keser
        async def message_iter():
            async for message in pubsub.listen():
                if message["type"] == "message":
                    data = message["data"]
                    yield data.decode() if isinstance(data, bytes) else data

        heartbeat_interval = 25  # saniye
        last_msg_time = asyncio.get_event_loop().time()

        async for raw in message_iter():
            yield f"data: {raw}\n\n"
            last_msg_time = asyncio.get_event_loop().time()

            # Heartbeat: 25s sessizlik olduysa boş comment gönder
            if asyncio.get_event_loop().time() - last_msg_time > heartbeat_interval:
                yield ": heartbeat\n\n"

    finally:
        await pubsub.unsubscribe("logs")
        await client.aclose()

@app.get("/stream")
async def log_stream():
    """
    SSE endpoint. Frontend EventSource ile bağlanır.
    Nginx proxy_buffering off + X-Accel-Buffering: no ile çalışır.
    """
    return StreamingResponse(
        redis_to_sse(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # nginx'e buffering yapma de
        },
    )

@app.get("/health")
async def health():
    return {"status": "ok", "service": "log"}
