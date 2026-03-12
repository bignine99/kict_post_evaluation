"""
PostEval AI — 모델 패키지
모든 SQLAlchemy 모델을 여기서 import하여 Base.metadata에 등록
"""
from app.models.project import Project
from app.models.document import Document
from app.models.chunk import Chunk
from app.models.evaluation import EvaluationResult

__all__ = ["Project", "Document", "Chunk", "EvaluationResult"]
