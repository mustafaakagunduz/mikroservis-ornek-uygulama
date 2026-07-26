"""
Kafka Producer — Order Service bu modülü kullanarak event publish eder.

Neden Kafka?
- Order service, notification ve inventory service'i direkt çağırmaz.
- Bunun yerine "order.created" event'i yayınlar.
- İki servis de bağımsız olarak bu event'i consume eder.
- Yeni bir servis eklemek istersen (analytics, fraud-detection), order service'e dokunmadan
  sadece yeni consumer eklersin. Bu "loose coupling"tir.
"""
import json
from aiokafka import AIOKafkaProducer
from config import settings

_producer: AIOKafkaProducer | None = None

async def get_producer() -> AIOKafkaProducer:
    global _producer
    if _producer is None:
        _producer = AIOKafkaProducer(
            bootstrap_servers=settings.kafka_bootstrap_servers,
            value_serializer=lambda v: json.dumps(v).encode(),
        )
        await _producer.start()
    return _producer

async def stop_producer():
    global _producer
    if _producer:
        await _producer.stop()
        _producer = None

async def publish_order_created(order_data: dict):
    producer = await get_producer()
    await producer.send_and_wait("order.created", order_data)

async def publish_order_cancelled(order_data: dict):
    producer = await get_producer()
    await producer.send_and_wait("order.cancelled", order_data)
