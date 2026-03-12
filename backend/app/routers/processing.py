"""
PostEval AI — 문서 처리 라우터 (SSE 실시간 진행 상태)
PDF 추출 → 시맨틱 청킹 → 임베딩 생성 → MySQL 저장
"""
import os
import json
import asyncio
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import select, and_, func as sql_func
import google.generativeai as genai

from app.config import get_settings
from app.database import get_db
from app.models.project import Project
from app.models.document import Document
from app.models.chunk import Chunk
from app.services.document_extractor import DocumentExtractor
from app.services.chunking import SemanticChunker
from app.services.vector_store import VectorStore

router = APIRouter()
extractor = DocumentExtractor()
chunker = SemanticChunker()
vector_store = VectorStore()


def sse_event(data: dict) -> str:
    """SSE 이벤트 포맷"""
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


@router.post("/projects/{project_id}/process")
async def process_documents_stream(project_id: int):
    """
    SSE 스트리밍으로 RAG 파이프라인 실시간 진행 상태 전송
    프론트엔드에서 EventSource로 연결하여 진행 상태를 실시간 표시
    """
    settings = get_settings()

    if not settings.gemini_api_key:
        raise HTTPException(status_code=400, detail="Gemini API 키가 설정되지 않았습니다")

    genai.configure(api_key=settings.gemini_api_key)

    # 비동기 세션을 수동으로 관리 (SSE 스트리밍에서는 FastAPI DI 사용 불가)
    engine = create_async_engine(settings.mysql_async_url, echo=False)
    async_session = async_sessionmaker(engine, expire_on_commit=False)

    async def event_generator():
        async with async_session() as db:
            try:
                # 프로젝트 확인
                project = await db.get(Project, project_id)
                if not project:
                    yield sse_event({"type": "error", "message": "프로젝트를 찾을 수 없습니다"})
                    return

                # 처리할 문서 목록
                result = await db.execute(
                    select(Document).where(
                        and_(
                            Document.project_id == project_id,
                            Document.extraction_status.in_(["pending", "failed"])
                        )
                    )
                )
                documents = result.scalars().all()

                if not documents:
                    yield sse_event({"type": "complete", "message": "처리할 문서가 없습니다 (이미 모두 처리됨)"})
                    return

                total_docs = len(documents)
                project.status = "processing"
                await db.flush()

                yield sse_event({
                    "type": "start",
                    "total_documents": total_docs,
                    "documents": [{"id": d.id, "filename": d.filename, "pages": d.page_count} for d in documents]
                })

                total_chunks = 0
                processed_docs = []
                failed_docs = []

                for doc_idx, doc in enumerate(documents):
                    try:
                        # ═══ Step 1: 텍스트 추출 ═══
                        yield sse_event({
                            "type": "progress",
                            "doc_index": doc_idx,
                            "doc_total": total_docs,
                            "filename": doc.filename,
                            "step": "extracting",
                            "step_label": "PDF 텍스트 추출 중",
                            "percent": round((doc_idx / total_docs) * 100),
                        })

                        doc.extraction_status = "extracting"
                        await db.flush()

                        if not doc.file_path or not os.path.exists(doc.file_path):
                            raise FileNotFoundError(f"파일을 찾을 수 없습니다: {doc.file_path}")

                        # 실제 추출 (동기 → 비동기 래핑)
                        extracted = await asyncio.to_thread(extractor.extract_pdf, doc.file_path)
                        doc.page_count = extracted["total_pages"]

                        # ═══ Step 2: 시맨틱 청킹 ═══
                        yield sse_event({
                            "type": "progress",
                            "doc_index": doc_idx,
                            "doc_total": total_docs,
                            "filename": doc.filename,
                            "step": "chunking",
                            "step_label": "시맨틱 청킹 중",
                            "pages": doc.page_count,
                            "percent": round(((doc_idx + 0.3) / total_docs) * 100),
                        })

                        chunks = await asyncio.to_thread(chunker.chunk_document, extracted)

                        if not chunks:
                            doc.extraction_status = "embedded"
                            processed_docs.append({
                                "id": doc.id, "filename": doc.filename,
                                "pages": doc.page_count, "chunks": 0, "status": "no_text"
                            })
                            yield sse_event({
                                "type": "doc_complete",
                                "doc_index": doc_idx,
                                "filename": doc.filename,
                                "pages": doc.page_count,
                                "chunks": 0,
                            })
                            continue

                        # ═══ Step 3: Gemini 임베딩 생성 ═══
                        yield sse_event({
                            "type": "progress",
                            "doc_index": doc_idx,
                            "doc_total": total_docs,
                            "filename": doc.filename,
                            "step": "embedding",
                            "step_label": f"Gemini 임베딩 생성 중 ({len(chunks)}개 청크)",
                            "chunks_count": len(chunks),
                            "percent": round(((doc_idx + 0.5) / total_docs) * 100),
                        })

                        embeddings = []
                        chunk_texts = [c["text"] for c in chunks]

                        for ci, text in enumerate(chunk_texts):
                            try:
                                embed_result = genai.embed_content(
                                    model=settings.embedding_model,
                                    content=text,
                                    task_type="retrieval_document",
                                )
                                embeddings.append(embed_result["embedding"])
                            except Exception as e:
                                print(f"⚠️ 임베딩 실패 ({doc.filename}, chunk {ci}): {e}")
                                embeddings.append(None)

                            # 임베딩 진행률 (매 10개마다 보고)
                            if (ci + 1) % 10 == 0 or ci == len(chunk_texts) - 1:
                                yield sse_event({
                                    "type": "embedding_progress",
                                    "doc_index": doc_idx,
                                    "filename": doc.filename,
                                    "embedded": ci + 1,
                                    "total_chunks": len(chunk_texts),
                                    "percent": round(((doc_idx + 0.5 + 0.4 * (ci + 1) / len(chunk_texts)) / total_docs) * 100),
                                })

                        # ═══ Step 4: MySQL 저장 ═══
                        yield sse_event({
                            "type": "progress",
                            "doc_index": doc_idx,
                            "doc_total": total_docs,
                            "filename": doc.filename,
                            "step": "saving",
                            "step_label": "MySQL에 저장 중",
                            "percent": round(((doc_idx + 0.9) / total_docs) * 100),
                        })

                        valid_chunks = []
                        valid_embeddings = []
                        for chunk, embedding in zip(chunks, embeddings):
                            if embedding is not None:
                                valid_chunks.append(chunk)
                                valid_embeddings.append(embedding)

                        saved_count = await vector_store.store_chunks(
                            session=db,
                            project_id=project_id,
                            document_id=doc.id,
                            chunks=valid_chunks,
                            embeddings=valid_embeddings,
                        )

                        doc.extraction_status = "embedded"
                        total_chunks += saved_count
                        await db.flush()

                        processed_docs.append({
                            "id": doc.id, "filename": doc.filename,
                            "pages": doc.page_count, "chunks": saved_count, "status": "success"
                        })

                        yield sse_event({
                            "type": "doc_complete",
                            "doc_index": doc_idx,
                            "filename": doc.filename,
                            "pages": doc.page_count,
                            "chunks": saved_count,
                            "percent": round(((doc_idx + 1) / total_docs) * 100),
                        })

                    except Exception as e:
                        doc.extraction_status = "failed"
                        doc.error_message = str(e)[:500]
                        await db.flush()
                        failed_docs.append({
                            "id": doc.id, "filename": doc.filename, "error": str(e)[:200]
                        })
                        yield sse_event({
                            "type": "doc_error",
                            "doc_index": doc_idx,
                            "filename": doc.filename,
                            "error": str(e)[:200],
                        })
                        print(f"❌ 문서 처리 실패 ({doc.filename}): {e}")

                # 프로젝트 통계 업데이트
                project.total_chunks = total_chunks
                project.status = "ready" if not failed_docs else "processing"
                await db.commit()

                yield sse_event({
                    "type": "complete",
                    "summary": {
                        "total_documents": total_docs,
                        "processed": len(processed_docs),
                        "failed": len(failed_docs),
                        "total_chunks": total_chunks,
                    },
                    "processed": processed_docs,
                    "failed": failed_docs,
                })

            except Exception as e:
                yield sse_event({"type": "error", "message": str(e)[:300]})
                print(f"❌ 파이프라인 전체 오류: {e}")

        await engine.dispose()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@router.get("/projects/{project_id}/process-status")
async def get_process_status(project_id: int, db: AsyncSession = Depends(get_db)):
    """프로젝트의 문서 처리 현황 조회"""
    result = await db.execute(
        select(Document).where(Document.project_id == project_id)
    )
    documents = result.scalars().all()

    status_counts = {"pending": 0, "extracting": 0, "chunked": 0, "embedded": 0, "failed": 0}
    doc_details = []

    for doc in documents:
        status_counts[doc.extraction_status] = status_counts.get(doc.extraction_status, 0) + 1
        doc_details.append({
            "id": doc.id,
            "filename": doc.filename,
            "status": doc.extraction_status,
            "page_count": doc.page_count,
            "error": doc.error_message,
        })

    total = len(documents)
    completed = status_counts.get("embedded", 0)

    return {
        "project_id": project_id,
        "total_documents": total,
        "progress_percent": round((completed / total * 100) if total > 0 else 0),
        "status_counts": status_counts,
        "documents": doc_details,
    }
