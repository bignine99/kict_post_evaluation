"""
PostEval AI — 프로젝트 모델
건설공사 사후평가 프로젝트 관리
"""
from sqlalchemy import Column, Integer, String, Enum, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False, comment="프로젝트명")
    description = Column(Text, nullable=True, comment="프로젝트 설명")
    status = Column(
        Enum("uploading", "processing", "ready", "completed", name="project_status"),
        default="uploading",
        comment="진행 상태"
    )
    total_documents = Column(Integer, default=0, comment="업로드된 문서 수")
    total_chunks = Column(Integer, default=0, comment="생성된 청크 수")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    documents = relationship("Document", back_populates="project", cascade="all, delete-orphan")
    chunks = relationship("Chunk", back_populates="project", cascade="all, delete-orphan")
    evaluations = relationship("EvaluationResult", back_populates="project", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Project(id={self.id}, name='{self.name}', status='{self.status}')>"
