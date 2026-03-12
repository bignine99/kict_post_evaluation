"""
PostEval AI — 청크 모델
텍스트 청크 + 임베딩 벡터 저장 (ChromaDB 대체)
MySQL JSON 컬럼에 임베딩 저장, Python에서 코사인 유사도 계산
"""
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Chunk(Base):
    __tablename__ = "chunks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)

    # ── 텍스트 데이터 ──
    chunk_text = Column(Text, nullable=False, comment="청크 텍스트 내용")
    chunk_index = Column(Integer, nullable=False, comment="문서 내 청크 순서")

    # ── 임베딩 벡터 (768차원, JSON 배열로 저장) ──
    embedding = Column(JSON, nullable=True, comment="Gemini 임베딩 벡터 (768d float 배열)")

    # ── 메타데이터 ──
    source_file = Column(String(500), comment="원본 파일명")
    page_num = Column(Integer, comment="원본 페이지 번호")
    content_type = Column(
        String(20), default="text",
        comment="콘텐츠 유형: text, table, header"
    )
    doc_type = Column(String(100), comment="문서 유형: 감리보고서, 시공내역서 등")
    section_name = Column(String(200), nullable=True, comment="섹션/챕터명")
    char_count = Column(Integer, nullable=True, comment="텍스트 글자 수")

    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    project = relationship("Project", back_populates="chunks")
    document = relationship("Document", back_populates="chunks")

    def __repr__(self):
        preview = self.chunk_text[:50] if self.chunk_text else ""
        return f"<Chunk(id={self.id}, doc='{self.source_file}', p.{self.page_num}, '{preview}...')>"
