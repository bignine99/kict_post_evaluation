"""
PostEval AI — 대시보드 RAG 통계 API
MySQL DB에서 실제 프로젝트/문서/청크 데이터를 조회하여 통계 반환
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func as sql_func, select, and_
from app.database import get_db
from app.models.project import Project
from app.models.document import Document
from app.models.chunk import Chunk

router = APIRouter()


@router.get("/dashboard/rag-stats")
async def get_rag_stats(db: AsyncSession = Depends(get_db)):
    """
    MySQL DB에서 실제 데이터를 조회하여 대시보드 통계를 반환합니다.
    """
    # ── 1. 문서 카테고리별 분류 ──
    result = await db.execute(select(Document))
    documents = result.scalars().all()

    cat_report = 0
    cat_spec = 0
    cat_detail = 0
    cat_other = 0

    for doc in documents:
        filename = (doc.filename or "").lower()
        if any(k in filename for k in ["보고", "조사", "설계", "준공", "검사"]):
            cat_report += 1
        elif any(k in filename for k in ["시방", "지침", "기준"]):
            cat_spec += 1
        elif any(k in filename for k in ["내역", "대비표", "정산", "단가"]):
            cat_detail += 1
        else:
            cat_other += 1

    total_docs = len(documents)
    max_val = max(20, total_docs)

    # ── 2. 전체 청크 수 ──
    total_result = await db.execute(select(sql_func.count(Chunk.id)))
    total_chunks = total_result.scalar() or 0

    # ── 3. 청크 사이즈 분포 (char_count 기반) ──
    r256 = await db.execute(select(sql_func.count(Chunk.id)).where(
        and_(Chunk.char_count != None, Chunk.char_count <= 256)
    ))
    c256 = r256.scalar() or 0

    r512 = await db.execute(select(sql_func.count(Chunk.id)).where(
        and_(Chunk.char_count != None, Chunk.char_count > 256, Chunk.char_count <= 512)
    ))
    c512 = r512.scalar() or 0

    r1024 = await db.execute(select(sql_func.count(Chunk.id)).where(
        and_(Chunk.char_count != None, Chunk.char_count > 512, Chunk.char_count <= 1024)
    ))
    c1024 = r1024.scalar() or 0

    r2048 = await db.execute(select(sql_func.count(Chunk.id)).where(
        and_(Chunk.char_count != None, Chunk.char_count > 1024, Chunk.char_count <= 2048)
    ))
    c2048 = r2048.scalar() or 0

    rmax = await db.execute(select(sql_func.count(Chunk.id)).where(
        and_(Chunk.char_count != None, Chunk.char_count > 2048)
    ))
    cmax = rmax.scalar() or 0

    # char_count가 NULL인 청크 → 512 구간에 포함
    c_null = total_chunks - (c256 + c512 + c1024 + c2048 + cmax)
    if c_null > 0:
        c512 += c_null

    max_chunk_val = max(c256, c512, c1024, c2048, cmax, 1)

    # ── 4. RAG 파이프라인 학습률 ──
    embedded_result = await db.execute(
        select(sql_func.count(Chunk.id)).where(Chunk.embedding != None)
    )
    embedded_chunks = embedded_result.scalar() or 0
    percent = int((embedded_chunks / total_chunks * 100)) if total_chunks > 0 else 0

    return {
        "categories": [
            {"label": "보고서 (타당성/설계/준공 등)", "value": cat_report, "max": max_val, "color": "var(--accent-primary)"},
            {"label": "시방서 및 지침서", "value": cat_spec, "max": max_val, "color": "var(--warning)"},
            {"label": "내역서 및 대비표", "value": cat_detail, "max": max_val, "color": "var(--success)"},
            {"label": "기타 기술/안전 문서", "value": cat_other, "max": max_val, "color": "#A855F7"},
        ],
        "chunks": [
            {"size": "256", "count": c256, "height": f"{(c256/max_chunk_val)*100}%"},
            {"size": "512", "count": c512, "height": f"{(c512/max_chunk_val)*100}%"},
            {"size": "1024", "count": c1024, "height": f"{(c1024/max_chunk_val)*100}%"},
            {"size": "2048", "count": c2048, "height": f"{(c2048/max_chunk_val)*100}%"},
            {"size": "Max", "count": cmax, "height": f"{(cmax/max_chunk_val)*100}%"},
        ],
        "progress": {
            "percent": percent,
            "total_chunks": total_chunks
        }
    }
