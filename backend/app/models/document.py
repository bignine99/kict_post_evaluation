"""
PostEval AI — 문서 모델
업로드된 PDF 문서 관리
"""
from sqlalchemy import Column, Integer, String, BigInteger, Enum, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    filename = Column(String(500), nullable=False, comment="원본 파일명")
    doc_type = Column(String(100), nullable=True, comment="문서 유형 (감리보고서, 시공내역서 등)")
    file_path = Column(String(1000), nullable=True, comment="저장 경로")
    file_size = Column(BigInteger, nullable=True, comment="파일 크기 (bytes)")
    page_count = Column(Integer, nullable=True, comment="총 페이지 수")
    extraction_status = Column(
        Enum("pending", "extracting", "chunked", "embedded", "failed", name="extraction_status"),
        default="pending",
        comment="추출 진행 상태"
    )
    error_message = Column(String(1000), nullable=True, comment="오류 메시지")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    project = relationship("Project", back_populates="documents")
    chunks = relationship("Chunk", back_populates="document", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Document(id={self.id}, filename='{self.filename}', status='{self.extraction_status}')>"
