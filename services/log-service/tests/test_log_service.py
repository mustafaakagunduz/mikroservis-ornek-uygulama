from httpx import AsyncClient, ASGITransport

import main


class FakePubSub:
    """redis.asyncio pubsub nesnesini taklit eder. Gerçek Redis'te listen()
    sonsuza kadar bloklar; testte sadece verilen mesajları verip durur."""

    def __init__(self, messages):
        self._messages = messages

    async def subscribe(self, channel):
        pass

    async def listen(self):
        for m in self._messages:
            yield {"type": "message", "data": m}

    async def unsubscribe(self, channel):
        pass


class FakeRedisClient:
    def __init__(self, messages):
        self._messages = messages

    def pubsub(self):
        return FakePubSub(self._messages)

    async def aclose(self):
        pass


class TestHealth:
    async def test_health_returns_ok(self):
        async with AsyncClient(transport=ASGITransport(app=main.app), base_url="http://test") as ac:
            resp = await ac.get("/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok", "service": "log"}


class TestRedisToSse:
    """
    Gerçek Redis'e bağlanmadan, Redis Pub/Sub → SSE dönüşüm mantığını test eder.
    """

    async def test_yields_welcome_message_first(self, mocker):
        mocker.patch("main.aioredis.from_url", return_value=FakeRedisClient([]))

        chunks = [chunk async for chunk in main.redis_to_sse()]

        assert len(chunks) == 1
        assert chunks[0].startswith("data: ")
        assert '"event": "connected"' in chunks[0]

    async def test_forwards_published_log_message(self, mocker):
        fake_message = '{"service": "order-service", "event": "order.created"}'
        mocker.patch("main.aioredis.from_url", return_value=FakeRedisClient([fake_message]))

        chunks = [chunk async for chunk in main.redis_to_sse()]

        assert len(chunks) == 2
        assert chunks[1] == f"data: {fake_message}\n\n"

    async def test_forwards_multiple_messages_in_order(self, mocker):
        messages = ['{"event": "a"}', '{"event": "b"}', '{"event": "c"}']
        mocker.patch("main.aioredis.from_url", return_value=FakeRedisClient(messages))

        chunks = [chunk async for chunk in main.redis_to_sse()]

        # ilk chunk welcome mesajı, geri kalanı sırasıyla gelen event'ler
        assert chunks[1:] == [f"data: {m}\n\n" for m in messages]

    async def test_decodes_bytes_messages(self, mocker):
        fake_message = b'{"event": "bytes-message"}'
        mocker.patch("main.aioredis.from_url", return_value=FakeRedisClient([fake_message]))

        chunks = [chunk async for chunk in main.redis_to_sse()]

        assert chunks[1] == 'data: {"event": "bytes-message"}\n\n'
