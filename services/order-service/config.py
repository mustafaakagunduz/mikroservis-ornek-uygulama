from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    kafka_bootstrap_servers: str
    product_service_url: str
    auth_service_url: str
    redis_url: str

    class Config:
        env_file = ".env"

settings = Settings()
