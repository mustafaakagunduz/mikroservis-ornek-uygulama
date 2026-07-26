"""
Fire-and-forget log publisher. Hiçbir zaman ana akışı bloklamaz.
Hata olursa sessizce geçer — log sistemi asla iş mantığını etkilemez.
"""
import asyncio
import json
from datetime import datetime, timezone
import redis.asyncio as aioredis

def publish(redis_url: str, service: str, level: str, event: str, message: str):
    payload = json.dumps({
        "service": service,
        "level": level,
        "event": event,
        "message": message,
        "ts": datetime.now(timezone.utc).strftime("%H:%M:%S"),
    })
    asyncio.create_task(_send(redis_url, payload))

async def _send(redis_url: str, payload: str):
    try:
        client = aioredis.from_url(redis_url, socket_connect_timeout=1)
        await client.publish("logs", payload)
        await client.aclose()
    except Exception:
        pass
