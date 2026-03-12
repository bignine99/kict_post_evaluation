"""
PostEval AI — FastAPI 엔트리포인트
건설공사 사후평가서 자동작성 시스템
(v0.2.0: ChromaDB 제거, NCP MySQL 단일 DB 구성)
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import get_settings
from app.routers import health
from app.routers.projects import router as projects_router
from app.routers.processing import router as processing_router
from app.routers.evaluation import router as evaluation_router
from app.routers.dashboard import router as dashboard_router
from app.database import init_db
import app.models  # noqa: F401 — 모델 등록


@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 시작/종료 시 실행되는 라이프사이클"""
    settings = get_settings()
    print(f"[START] {settings.app_name} v{settings.app_version}")
    print(f"[DB] MySQL: {settings.mysql_host}:{settings.mysql_port}/{settings.mysql_db}")
    print(f"[LLM] {settings.gemini_model}")
    print(f"[EMB] {settings.embedding_model} ({settings.embedding_dimensions}d)")

    # DB 테이블 자동 생성
    try:
        init_db()
    except Exception as e:
        print(f"[WARN] DB init failed (server continues): {e}")

    yield
    print(f"[STOP] {settings.app_name}")


app = FastAPI(
    title="PostEval AI API",
    description="건설공사 사후평가서 자동작성 시스템 API",
    version="0.2.0",
    lifespan=lifespan,
)

# ── CORS 설정 ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── 라우터 등록 ──
app.include_router(health.router, tags=["Health"])
app.include_router(projects_router, prefix="/api/v1", tags=["Projects"])
app.include_router(processing_router, prefix="/api/v1", tags=["Processing"])
app.include_router(evaluation_router, prefix="/api/v1", tags=["Evaluation"])
app.include_router(dashboard_router, prefix="/api/v1", tags=["Dashboard"])
