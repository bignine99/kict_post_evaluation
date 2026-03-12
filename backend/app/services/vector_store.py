"""
PostEval AI — 벡터 스토어 서비스
MySQL에 임베딩 저장 + Python 코사인 유사도 검색
(ChromaDB 대체)
"""
import numpy as np
from typing import Optional
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.chunk import Chunk


class VectorStore:
    """MySQL 기반 벡터 저장/검색 엔진"""

    async def store_chunks(
        self,
        session: AsyncSession,
        project_id: int,
        document_id: int,
        chunks: list[dict],
        embeddings: list[list[float]]
    ) -> int:
        """
        청크 + 임베딩을 MySQL에 저장

        Args:
            chunks: SemanticChunker의 출력 [{"text": ..., "metadata": ...}]
            embeddings: Gemini 임베딩 벡터 [768d float 배열] 리스트

        Returns:
            저장된 청크 수
        """
        db_chunks = []
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            meta = chunk.get("metadata", {})
            db_chunk = Chunk(
                project_id=project_id,
                document_id=document_id,
                chunk_text=chunk["text"],
                chunk_index=i,
                embedding=embedding,
                source_file=meta.get("source_file"),
                page_num=meta.get("page_num"),
                content_type=meta.get("content_type", "text"),
                doc_type=meta.get("doc_type"),
                char_count=meta.get("char_count"),
            )
            db_chunks.append(db_chunk)

        session.add_all(db_chunks)
        await session.flush()
        return len(db_chunks)

    async def search(
        self,
        session: AsyncSession,
        project_id: int,
        query_embedding: list[float],
        n_results: int = 10,
        doc_type_filter: Optional[list[str]] = None,
        content_type_filter: Optional[str] = None,
    ) -> list[dict]:
        """
        코사인 유사도 기반 벡터 검색

        Args:
            query_embedding: 쿼리 임베딩 벡터 (768d)
            n_results: 반환할 결과 수
            doc_type_filter: 문서 유형 필터 (예: ["감리보고서", "시공내역서"])

        Returns:
            [{"chunk": Chunk, "score": float, "text": str, "metadata": dict}]
        """
        # 1. 필터 조건 구성
        conditions = [
            Chunk.project_id == project_id,
            Chunk.embedding.isnot(None),
        ]
        if doc_type_filter:
            conditions.append(Chunk.doc_type.in_(doc_type_filter))
        if content_type_filter:
            conditions.append(Chunk.content_type == content_type_filter)

        # 2. 해당 프로젝트의 모든 청크 로드
        stmt = select(Chunk).where(and_(*conditions))
        result = await session.execute(stmt)
        chunks = result.scalars().all()

        if not chunks:
            return []

        # 3. 코사인 유사도 계산
        query_vec = np.array(query_embedding, dtype=np.float32)
        query_norm = np.linalg.norm(query_vec)

        if query_norm == 0:
            return []

        scored_chunks = []
        for chunk in chunks:
            if not chunk.embedding:
                continue
            chunk_vec = np.array(chunk.embedding, dtype=np.float32)
            chunk_norm = np.linalg.norm(chunk_vec)
            if chunk_norm == 0:
                continue

            # 코사인 유사도
            score = float(np.dot(query_vec, chunk_vec) / (query_norm * chunk_norm))
            scored_chunks.append({
                "chunk": chunk,
                "score": score,
                "text": chunk.chunk_text,
                "metadata": {
                    "source_file": chunk.source_file,
                    "page_num": chunk.page_num,
                    "doc_type": chunk.doc_type,
                    "content_type": chunk.content_type,
                    "section_name": chunk.section_name,
                }
            })

        # 4. 유사도 높은 순 정렬 후 상위 N개 반환
        scored_chunks.sort(key=lambda x: x["score"], reverse=True)
        return scored_chunks[:n_results]

    async def get_project_stats(
        self,
        session: AsyncSession,
        project_id: int
    ) -> dict:
        """프로젝트의 청크/임베딩 통계"""
        from sqlalchemy import func as sql_func

        total = await session.execute(
            select(sql_func.count(Chunk.id)).where(Chunk.project_id == project_id)
        )
        embedded = await session.execute(
            select(sql_func.count(Chunk.id)).where(
                and_(Chunk.project_id == project_id, Chunk.embedding.isnot(None))
            )
        )

        return {
            "total_chunks": total.scalar() or 0,
            "embedded_chunks": embedded.scalar() or 0,
        }
