"""
Health Check 라우터
- MySQL 연결 상태 확인 (SQLAlchemy 엔진 사용)
- Gemini API 키 설정 확인
"""
from fastapi import APIRouter
from app.config import get_settings
from app.database import get_engine
from sqlalchemy import text

router = APIRouter()


@router.get("/health")
async def health_check():
    """시스템 전체 헬스체크"""
    settings = get_settings()
    status = {
        "app": settings.app_name,
        "version": settings.app_version,
        "status": "healthy",
        "services": {}
    }

    # MySQL 연결 확인 (SQLAlchemy 동기 엔진 사용)
    try:
        engine = get_engine()
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            result.fetchone()
        status["services"]["mysql"] = {
            "status": "connected",
            "host": settings.mysql_host,
            "database": settings.mysql_db
        }
    except Exception as e:
        status["services"]["mysql"] = {
            "status": "disconnected",
            "error": str(e)
        }
        status["status"] = "degraded"

    # Gemini API 키 확인
    status["services"]["gemini"] = {
        "status": "configured" if settings.gemini_api_key else "not_configured",
        "model": settings.gemini_model,
        "embedding_model": settings.embedding_model
    }

    return status
