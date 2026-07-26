from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    kafka_bootstrap_servers: str
    redis_url: str

    class Config:
        env_file = ".env"

settings = Settings()
