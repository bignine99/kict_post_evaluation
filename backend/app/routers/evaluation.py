"""
PostEval AI — 평가서 추출 라우터
별지 3호/4호 필드 자동 추출 API
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.database import get_db
from app.models.project import Project
from app.models.evaluation import EvaluationResult
from app.services.parsing_engine import ParsingEngine, FIELD_QUERY_MAP

router = APIRouter()
engine = ParsingEngine()

@router.get("/projects/{project_id}/evaluate/results")
async def get_evaluation_results(project_id: int, db: AsyncSession = Depends(get_db)):
    """저장된 전체 평가 결과 조회"""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다")
    
    stmt = select(EvaluationResult).where(EvaluationResult.project_id == project_id)
    result = await db.execute(stmt)
    evals = result.scalars().all()
    
    saved_data = []
    for e in evals:
        # DB에서 가져온 데이터에 맵핑(form, section, extraction_type) 정보 추가
        info = FIELD_QUERY_MAP.get(e.field_id, {})
        saved_data.append({
            "field_id": e.field_id,
            "form": info.get("form", ""),
            "section": info.get("section", ""),
            "category": e.field_category,
            "label": e.field_name,
            "value": e.extracted_value,
            "confidence": e.confidence,
            "source_refs": e.source_refs,
            "extraction_type": info.get("extraction_type", "structured"),
            "context_chunks_used": len(e.source_refs) if e.source_refs else 0
        })
    return {"project_id": project_id, "results": saved_data}


@router.get("/projects/{project_id}/evaluate/fields")
async def list_fields(project_id: int):
    """추출 가능한 필드 목록"""
    fields = []
    for field_id, info in FIELD_QUERY_MAP.items():
        fields.append({
            "field_id": field_id,
            "form": info.get("form", ""),
            "section": info.get("section", ""),
            "category": info.get("category", ""),
            "label": info.get("label", ""),
            "extraction_type": info.get("extraction_type", "structured"),
            "target_docs": info.get("target_docs", []),
        })
    return {"project_id": project_id, "fields": fields, "total": len(fields)}


@router.post("/projects/{project_id}/evaluate/{field_id}")
async def extract_single_field(
    project_id: int,
    field_id: str,
    db: AsyncSession = Depends(get_db),
):
    """단일 필드 추출 (테스트/디버그용)"""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다")

    if field_id not in FIELD_QUERY_MAP:
        raise HTTPException(
            status_code=400,
            detail=f"알 수 없는 필드: {field_id}. 사용 가능: {list(FIELD_QUERY_MAP.keys())}",
        )

    result = await engine.extract_field(db, project_id, field_id)
    
    # DB 저장 (기존 내용 삭제 후 새로 삽입)
    stmt = delete(EvaluationResult).where(
        EvaluationResult.project_id == project_id,
        EvaluationResult.field_id == field_id
    )
    await db.execute(stmt)
    
    er = EvaluationResult(
        project_id=project_id,
        field_id=field_id,
        field_category=result.get("category"),
        field_name=result.get("label"),
        extracted_value=result.get("value"),
        confidence=result.get("confidence", 0.0),
        source_refs=result.get("source_refs", [])
    )
    db.add(er)
    await db.commit()
    
    return result


@router.post("/projects/{project_id}/evaluate/all")
async def extract_all_fields(
    project_id: int,
    db: AsyncSession = Depends(get_db),
):
    """모든 필드 일괄 추출"""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다")

    results = await engine.extract_all_fields(db, project_id)
    
    # DB 저장 (기존 전체 삭제 후 새 삽입 - 갱신)
    stmt = delete(EvaluationResult).where(EvaluationResult.project_id == project_id)
    await db.execute(stmt)
    
    for r in results:
        er = EvaluationResult(
            project_id=project_id,
            field_id=r.get("field_id"),
            field_category=r.get("category"),
            field_name=r.get("label"),
            extracted_value=r.get("value"),
            confidence=r.get("confidence", 0.0),
            source_refs=r.get("source_refs", [])
        )
        db.add(er)
    await db.commit()
    
    return {
        "project_id": project_id,
        "project_name": project.name,
        "total_fields": len(results),
        "results": results,
    }
