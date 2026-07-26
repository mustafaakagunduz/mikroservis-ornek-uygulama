import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

os.environ.setdefault("RABBITMQ_URL", "amqp://user:password@localhost/")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")

import pytest


@pytest.fixture(autouse=True)
def mock_log_publish(mocker):
    """Redis'e gerçekten bağlanmaya çalışmasın — her testte otomatik mock'lanır."""
    mocker.patch("main.log.publish")
