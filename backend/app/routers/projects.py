"""
PostEval AI — 프로젝트 관리 라우터
프로젝트 CRUD + 파일 업로드 + PDF 추출 파이프라인
"""
import os
import shutil
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func as sql_func
from typing import List

from app.config import get_settings
from app.database import get_db
from app.models.project import Project
from app.models.document import Document
from app.services.document_extractor import DocumentExtractor
from app.services.chunking import SemanticChunker

router = APIRouter()
extractor = DocumentExtractor()
chunker = SemanticChunker()


# ══════════════════════════════════════
# 프로젝트 관리
# ══════════════════════════════════════

@router.post("/projects")
async def create_project(name: str, description: str = "", db: AsyncSession = Depends(get_db)):
    """새 프로젝트 생성"""
    project = Project(name=name, description=description)
    db.add(project)
    await db.flush()
    return {
        "status": "success",
        "project": {
            "id": project.id,
            "name": project.name,
            "status": project.status,
        }
    }


@router.get("/projects")
async def list_projects(db: AsyncSession = Depends(get_db)):
    """프로젝트 목록 조회"""
    result = await db.execute(
        select(Project).order_by(Project.created_at.desc())
    )
    projects = result.scalars().all()
    return {
        "projects": [
            {
                "id": p.id,
                "name": p.name,
                "description": p.description,
                "status": p.status,
                "total_documents": p.total_documents,
                "total_chunks": p.total_chunks,
                "created_at": str(p.created_at),
            }
            for p in projects
        ],
        "total": len(projects),
    }


@router.get("/projects/{project_id}")
async def get_project(project_id: int, db: AsyncSession = Depends(get_db)):
    """프로젝트 상세 조회"""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다")

    # 문서 목록 조회
    docs_result = await db.execute(
        select(Document).where(Document.project_id == project_id)
    )
    documents = docs_result.scalars().all()

    return {
        "project": {
            "id": project.id,
            "name": project.name,
            "description": project.description,
            "status": project.status,
            "total_documents": project.total_documents,
            "total_chunks": project.total_chunks,
            "created_at": str(project.created_at),
        },
        "documents": [
            {
                "id": d.id,
                "filename": d.filename,
                "doc_type": d.doc_type,
                "file_size": d.file_size,
                "page_count": d.page_count,
                "extraction_status": d.extraction_status,
                "error_message": d.error_message,
            }
            for d in documents
        ],
    }


@router.delete("/projects/{project_id}")
async def delete_project(project_id: int, db: AsyncSession = Depends(get_db)):
    """프로젝트 삭제 (관련 문서, 청크, 평가결과 일괄 삭제)"""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다")

    project_name = project.name

    # 업로드된 파일 디렉토리 삭제
    settings = get_settings()
    project_upload_dir = os.path.join(settings.upload_dir, str(project_id))
    if os.path.exists(project_upload_dir):
        shutil.rmtree(project_upload_dir, ignore_errors=True)

    # DB에서 프로젝트 삭제 (cascade로 documents, chunks, evaluations 자동 삭제)
    await db.delete(project)

    return {
        "status": "success",
        "message": f"프로젝트 '{project_name}'이(가) 삭제되었습니다.",
    }


# ══════════════════════════════════════
# 파일 업로드
# ══════════════════════════════════════

@router.post("/projects/{project_id}/upload")
async def upload_files(
    project_id: int,
    files: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    프로젝트에 다중 파일 업로드
    - 지원 포맷: PDF, HWP, XLSX
    - 업로드 후 DB에 문서 메타데이터 등록
    """
    settings = get_settings()

    # 프로젝트 존재 확인
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다")

    # 프로젝트별 업로드 디렉토리
    project_upload_dir = os.path.join(settings.upload_dir, str(project_id))
    os.makedirs(project_upload_dir, exist_ok=True)

    uploaded = []

    for file in files:
        # 파일 확장자 검증
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in [".pdf", ".hwp", ".xlsx", ".xls"]:
            raise HTTPException(
                status_code=400,
                detail=f"지원하지 않는 파일 형식: {ext} ({file.filename})"
            )

        # 파일 저장
        save_path = os.path.join(project_upload_dir, file.filename)
        with open(save_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        file_size = os.path.getsize(save_path)

        # 문서 유형 자동 분류
        doc_type = extractor.classify_doc_type(file.filename)

        # 페이지 수 확인 (PDF만)
        page_count = None
        if ext == ".pdf":
            try:
                page_count = extractor.get_page_count(save_path)
            except Exception:
                pass

        # DB에 문서 등록
        document = Document(
            project_id=project_id,
            filename=file.filename,
            doc_type=doc_type,
            file_path=save_path,
            file_size=file_size,
            page_count=page_count,
            extraction_status="pending",
        )
        db.add(document)
        await db.flush()

        uploaded.append({
            "id": document.id,
            "filename": file.filename,
            "doc_type": doc_type,
            "size_mb": round(file_size / (1024 * 1024), 2),
            "page_count": page_count,
            "status": "uploaded",
        })

    # 프로젝트 문서 수 업데이트
    total_docs = await db.execute(
        select(sql_func.count(Document.id)).where(Document.project_id == project_id)
    )
    project.total_documents = total_docs.scalar() or 0

    return {
        "status": "success",
        "uploaded_count": len(uploaded),
        "files": uploaded,
    }


@router.get("/projects/{project_id}/documents")
async def list_documents(project_id: int, db: AsyncSession = Depends(get_db)):
    """프로젝트의 문서 목록 조회"""
    result = await db.execute(
        select(Document).where(Document.project_id == project_id)
    )
    documents = result.scalars().all()
    return {
        "documents": [
            {
                "id": d.id,
                "filename": d.filename,
                "doc_type": d.doc_type,
                "file_size": d.file_size,
                "size_mb": round(d.file_size / (1024 * 1024), 2) if d.file_size else 0,
                "page_count": d.page_count,
                "extraction_status": d.extraction_status,
            }
            for d in documents
        ],
        "total": len(documents),
    }
