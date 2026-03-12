"""
PostEval AI — 데이터베이스 연결 설정
SQLAlchemy 엔진 및 세션 관리
"""
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.config import get_settings


class Base(DeclarativeBase):
    """SQLAlchemy 모델 베이스 클래스"""
    pass


def get_engine():
    """동기 엔진 (마이그레이션, 테이블 생성용)"""
    settings = get_settings()
    return create_engine(
        settings.mysql_url,
        echo=settings.debug,
        pool_pre_ping=True,
        pool_recycle=3600,
    )


def get_async_engine():
    """비동기 엔진 (API 요청 처리용)"""
    settings = get_settings()
    return create_async_engine(
        settings.mysql_async_url,
        echo=settings.debug,
        pool_pre_ping=True,
        pool_recycle=3600,
    )


# 비동기 세션 팩토리
AsyncSessionLocal = sessionmaker(
    bind=get_async_engine(),
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db():
    """FastAPI Dependency: 비동기 DB 세션"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


def init_db():
    """테이블 생성 (동기, 초기화용)"""
    engine = get_engine()
    Base.metadata.create_all(bind=engine)
    print("✅ 데이터베이스 테이블 초기화 완료")
