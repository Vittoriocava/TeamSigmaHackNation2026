from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    sqlite_path: str = "playthecity.db"
    regolo_api_key: str = ""
    regolo_chat_model: str = "gpt-oss-120b"
    regolo_vision_model: str = "Llama-3.2-11B-Vision-Instruct"
    regolo_image_model: str = "flux-dev"
    elevenlabs_api_key: str = ""
    elevenlabs_voice_id: str = "21m00Tcm4TlvDq8ikWAM"
    jwt_secret: str = "playthecity-secret-change-in-production"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
