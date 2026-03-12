"""
PostEval AI — 환경 설정
ChromaDB 제거, NCP MySQL 단일 DB 구성
"""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # ── App ──
    app_name: str = "PostEval AI"
    app_version: str = "0.2.0"
    debug: bool = True

    # ── Gemini API ──
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash-lite"
    embedding_model: str = "models/gemini-embedding-001"
    embedding_dimensions: int = 768

    # ── MySQL (NCP Cloud DB) ──
    mysql_host: str = "localhost"
    mysql_port: int = 3306
    mysql_user: str = "posteval"
    mysql_password: str = ""
    mysql_db: str = "posteval_db"

    @property
    def mysql_url(self) -> str:
        """SQLAlchemy 동기 연결 URL"""
        return (
            f"mysql+pymysql://{self.mysql_user}:{self.mysql_password}"
            f"@{self.mysql_host}:{self.mysql_port}/{self.mysql_db}"
            f"?charset=utf8mb4"
        )

    @property
    def mysql_async_url(self) -> str:
        """SQLAlchemy 비동기 연결 URL"""
        return (
            f"mysql+aiomysql://{self.mysql_user}:{self.mysql_password}"
            f"@{self.mysql_host}:{self.mysql_port}/{self.mysql_db}"
            f"?charset=utf8mb4"
        )

    # ── Upload ──
    upload_dir: str = "./uploads"
    max_upload_size_mb: int = 500

    class Config:
        env_file = "../.env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
