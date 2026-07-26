import json
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock

import main


class FakeIncomingMessage:
    """aio_pika'nın gerçek mesaj objesini taklit eder — RabbitMQ'ya bağlanmadan
    process_message'ı test edebilmek için."""

    def __init__(self, body: dict):
        self.body = json.dumps(body).encode()

    def process(self):
        @asynccontextmanager
        async def _ctx():
            yield
        return _ctx()


class TestSendMockEmail:
    async def test_order_confirmation_logs_success(self, mocker):
        publish = mocker.patch("main.log.publish")
        job = {"type": "order_confirmation", "user_id": "user-12345678", "order_id": "order-12345678", "total_price": 199.90}

        await main.send_mock_email(job)

        publish.assert_called_once()
        args = publish.call_args.args
        assert args[2] == "success"          # level
        assert args[3] == "email.sent"        # event
        assert "onay maili" in args[4]

    async def test_order_cancellation_logs_warning(self, mocker):
        publish = mocker.patch("main.log.publish")
        job = {"type": "order_cancellation", "user_id": "user-12345678", "order_id": "order-12345678"}

        await main.send_mock_email(job)

        publish.assert_called_once()
        args = publish.call_args.args
        assert args[2] == "warning"
        assert "İptal maili" in args[4]

    async def test_unknown_job_type_does_not_publish(self, mocker):
        publish = mocker.patch("main.log.publish")
        job = {"type": "something_else", "user_id": "user-1"}

        await main.send_mock_email(job)

        publish.assert_not_called()


class TestProcessMessage:
    async def test_process_message_parses_job_and_sends_email(self, mocker):
        send_mock = mocker.patch("main.send_mock_email", new_callable=AsyncMock)
        job = {"type": "order_confirmation", "user_id": "u1", "order_id": "o1", "total_price": 50}
        message = FakeIncomingMessage(job)

        await main.process_message(message)

        send_mock.assert_called_once_with(job)
