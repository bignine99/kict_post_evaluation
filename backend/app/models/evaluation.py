"""
PostEval AI — 평가 결과 모델
47개 필드 추출 결과 저장
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class EvaluationResult(Base):
    __tablename__ = "evaluation_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)

    # ── 필드 정보 ──
    field_id = Column(String(100), nullable=False, comment="필드 ID (예: 3호_1_개요_공사명)")
    field_category = Column(String(50), comment="카테고리 (별지3호_개요, 별지3호_수행성과, 별지4호)")
    field_name = Column(String(200), comment="필드 한글명")

    # ── 추출 결과 ──
    extracted_value = Column(JSON, comment="추출된 값 (정형: 숫자/텍스트, 비정형: 긴 텍스트)")
    confidence = Column(Float, default=0.0, comment="추출 신뢰도 (0.0~1.0)")
    source_refs = Column(JSON, comment="근거 출처 [{file, page, section}]")

    # ── 사용자 검증 ──
    user_confirmed = Column(Boolean, default=False, comment="사용자가 확인/수정 완료 여부")
    user_edited_value = Column(JSON, nullable=True, comment="사용자 수정값 (수정 시)")

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    project = relationship("Project", back_populates="evaluations")

    def __repr__(self):
        return f"<EvaluationResult(field='{self.field_id}', confidence={self.confidence})>"
