"""
파일 업로드 라우터 (Phase 2에서 확장)
"""
from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import List
import os
import shutil

from app.config import get_settings

router = APIRouter()


@router.post("/upload")
async def upload_files(files: List[UploadFile] = File(...)):
    """
    다중 파일 업로드 엔드포인트
    - 지원 포맷: PDF, HWP, XLSX
    - 업로드 후 로컬 스토리지에 저장
    """
    settings = get_settings()
    uploaded = []

    # 업로드 디렉토리 자동 생성
    os.makedirs(settings.upload_dir, exist_ok=True)

    for file in files:
        # 파일 확장자 검증
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in [".pdf", ".hwp", ".xlsx", ".xls"]:
            raise HTTPException(
                status_code=400,
                detail=f"지원하지 않는 파일 형식: {ext} ({file.filename})"
            )

        # 저장 경로 생성
        save_path = os.path.join(settings.upload_dir, file.filename)
        os.makedirs(os.path.dirname(save_path), exist_ok=True)

        # 파일 저장
        with open(save_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        file_size = os.path.getsize(save_path)
        uploaded.append({
            "filename": file.filename,
            "size_bytes": file_size,
            "size_mb": round(file_size / (1024 * 1024), 2),
            "path": save_path,
            "status": "uploaded"
        })

    return {
        "status": "success",
        "uploaded_count": len(uploaded),
        "files": uploaded
    }


@router.get("/upload/status")
async def upload_status():
    """업로드된 파일 목록 조회"""
    settings = get_settings()
    upload_dir = settings.upload_dir

    if not os.path.exists(upload_dir):
        return {"files": [], "total_count": 0}

    files = []
    for f in os.listdir(upload_dir):
        filepath = os.path.join(upload_dir, f)
        if os.path.isfile(filepath):
            size = os.path.getsize(filepath)
            files.append({
                "filename": f,
                "size_bytes": size,
                "size_mb": round(size / (1024 * 1024), 2)
            })

    return {
        "files": files,
        "total_count": len(files),
        "total_size_mb": round(sum(f["size_mb"] for f in files), 2)
    }
