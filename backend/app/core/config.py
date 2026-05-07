from functools import lru_cache
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "CareSphere AI"
    environment: str = "development"
    api_v1_prefix: str = "/api/v1"
    frontend_origin: str = "http://localhost:5173"

    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "caresphere_ai"

    jwt_secret: str = "change-this-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 720
    staff_email_domain: str = "caresphere.health"

    openai_api_key: str | None = None
    gemini_api_key: str | None = None
    llm_provider: str = "mock"

    azure_openai_api_key: str | None = None
    azure_openai_endpoint: str | None = None
    azure_openai_api_version: str | None = None
    azure_openai_deployment_name: str | None = None

    razorpay_key_id: str | None = None
    razorpay_key_secret: str | None = None
    razorpay_webhook_secret: str | None = None

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @field_validator("api_v1_prefix", mode="before")
    @classmethod
    def default_api_prefix_when_blank(cls, value: str | None) -> str:
        return value or "/api/v1"


@lru_cache
def get_settings() -> Settings:
    return Settings()
