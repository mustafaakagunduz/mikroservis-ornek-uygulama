"""
Email Worker — RabbitMQ consumer.

RabbitMQ'daki "email_jobs" kuyruğunu dinler.
Her job için mock email gönderir (gerçek projede SMTP/SendGrid kullanılır).

Neden ayrı bir worker?
- Email gönderme yavaş olabilir (SMTP timeout vs.)
- Notification service'i bloklamaz
- Worker crash ederse job RabbitMQ'da kalır, tekrar işlenir (acknowledgement)
- Scale etmek istersen birden fazla worker instance çalıştırabilirsin
"""
import asyncio
import json
import logging
import aio_pika
from config import settings
import log_publisher as log

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def send_mock_email(job: dict):
    """Gerçek email gönderme simülasyonu."""
    job_type = job["type"]
    user_id = job["user_id"]

    if job_type == "order_confirmation":
        log.publish(settings.redis_url, "email-worker", "success", "email.sent",
                    f"Sipariş onay maili gönderildi → user: {user_id[:8]}… | "
                    f"Sipariş #{job['order_id'][:8]} | Tutar: {job.get('total_price', '?')}₺")
    elif job_type == "order_cancellation":
        log.publish(settings.redis_url, "email-worker", "warning", "email.sent",
                    f"İptal maili gönderildi → user: {user_id[:8]}… | Sipariş #{job['order_id'][:8]}")

async def process_message(message: aio_pika.abc.AbstractIncomingMessage):
    async with message.process():  # başarıyla işlenirse otomatik ACK gönderir
        job = json.loads(message.body.decode())
        logger.info(f"Processing email job: {job['type']}")
        await send_mock_email(job)

async def main():
    logger.info("Email worker starting...")
    connection = await aio_pika.connect_robust(settings.rabbitmq_url)

    async with connection:
        channel = await connection.channel()
        await channel.set_qos(prefetch_count=10)  # aynı anda max 10 mesaj işle
        queue = await channel.declare_queue("email_jobs", durable=True)
        await queue.consume(process_message)
        logger.info("Email worker ready, waiting for jobs...")
        await asyncio.Future()  # sonsuza kadar çalış

if __name__ == "__main__":
    asyncio.run(main())
