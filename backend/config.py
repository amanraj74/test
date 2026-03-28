import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings
from pydantic import field_validator
from functools import lru_cache

# Load .env from project root — works from any working directory
_env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=_env_path, override=True)


class Settings(BaseSettings):
    # Supabase
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str

    # Sarvam AI
    SARVAM_API_KEY: str

    # Groq
    GROQ_API_KEY: str

    # Twilio (optional for demo mode)
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_PHONE_NUMBER: str = ""

    # WhatsApp
    WHATSAPP_TO: str = ""
    WHATSAPP_FROM: str = "whatsapp:+14155238886"

    # App
    APP_ENV: str = "development"
    APP_PORT: int = 8000

    # Sarvam endpoints
    SARVAM_STT_URL: str = "https://api.sarvam.ai/speech-to-text"
    SARVAM_TTS_URL: str = "https://api.sarvam.ai/text-to-speech"

    # Groq model
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    @field_validator("SUPABASE_URL")
    @classmethod
    def validate_supabase_url(cls, v):
        if not v.startswith("https://"):
            raise ValueError("SUPABASE_URL must start with https://")
        return v.rstrip("/")

    @field_validator("SARVAM_API_KEY", "GROQ_API_KEY", "SUPABASE_SERVICE_ROLE_KEY")
    @classmethod
    def validate_not_empty(cls, v):
        if not v or v.strip() == "":
            raise ValueError("This API key cannot be empty")
        return v.strip()

    @property
    def is_demo_mode(self) -> bool:
        return not bool(self.TWILIO_ACCOUNT_SID)

    class Config:
        env_file = None
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()