"""
PostEval AI — 시맨틱 청킹 서비스
문서 텍스트를 의미 단위로 분할하여 RAG 검색에 최적화
"""
import re
from typing import Optional


class SemanticChunker:
    """
    문서 텍스트를 시맨틱 청크로 분할
    - 표(table)는 독립 청크로 처리
    - 문단 경계 기준 분할
    - 목표 크기에 맞춰 병합
    """

    CHUNK_SIZE = 800       # 목표 청크 크기 (글자 수)
    CHUNK_OVERLAP = 150    # 청크 간 오버랩 (글자 수)
    MIN_CHUNK_SIZE = 100   # 최소 청크 크기

    def __init__(
        self,
        chunk_size: int = 800,
        chunk_overlap: int = 150,
        min_chunk_size: int = 100
    ):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.min_chunk_size = min_chunk_size

    def chunk_document(self, extracted: dict) -> list[dict]:
        """
        추출된 문서 데이터를 청크로 분할

        Args:
            extracted: DocumentExtractor.extract_pdf()의 결과

        Returns:
            [
                {
                    "text": str,
                    "metadata": {
                        "source_file": str,
                        "page_num": int,
                        "content_type": "text" | "table",
                        "doc_type": str,
                        "char_count": int
                    }
                }
            ]
        """
        chunks = []
        doc_type = extracted.get("doc_type", "기타")

        for page in extracted["pages"]:
            # ── 1. 표(Table)는 독립 청크로 처리 ──
            for table in page.get("tables", []):
                table_text = self._table_to_text(table)
                if len(table_text) >= self.min_chunk_size:
                    chunks.append({
                        "text": table_text,
                        "metadata": {
                            "source_file": page["source_file"],
                            "page_num": page["page_num"],
                            "content_type": "table",
                            "doc_type": doc_type,
                            "char_count": len(table_text),
                        }
                    })

            # ── 2. 텍스트는 문단 단위로 분할 후 병합 ──
            text = page.get("text", "").strip()
            if not text or len(text) < self.min_chunk_size:
                continue

            paragraphs = self._split_by_paragraph(text)
            merged_chunks = self._merge_to_target_size(paragraphs)

            for chunk_text in merged_chunks:
                if len(chunk_text) >= self.min_chunk_size:
                    chunks.append({
                        "text": chunk_text,
                        "metadata": {
                            "source_file": page["source_file"],
                            "page_num": page["page_num"],
                            "content_type": "text",
                            "doc_type": doc_type,
                            "char_count": len(chunk_text),
                        }
                    })

        return chunks

    def _table_to_text(self, table: list[list]) -> str:
        """표 데이터를 텍스트로 변환"""
        rows = []
        for row in table:
            cells = [str(cell).strip() if cell else "" for cell in row]
            row_text = " | ".join(cells)
            if row_text.replace("|", "").replace(" ", ""):
                rows.append(row_text)
        return "\n".join(rows)

    def _split_by_paragraph(self, text: str) -> list[str]:
        """텍스트를 문단 단위로 분할"""
        # 빈 줄 또는 제목 패턴으로 분할
        paragraphs = re.split(r'\n\s*\n|\n(?=\d+[\.\)]\s)|(?=제\d+[조장절])', text)
        return [p.strip() for p in paragraphs if p.strip()]

    def _merge_to_target_size(self, paragraphs: list[str]) -> list[str]:
        """문단들을 목표 크기에 맞게 병합"""
        chunks = []
        current_chunk = ""

        for para in paragraphs:
            # 현재 청크 + 새 문단이 목표 크기 이하이면 병합
            if len(current_chunk) + len(para) + 1 <= self.chunk_size:
                current_chunk = f"{current_chunk}\n{para}".strip()
            else:
                # 현재 청크 저장
                if current_chunk:
                    chunks.append(current_chunk)

                # 단일 문단이 목표 크기보다 크면 강제 분할
                if len(para) > self.chunk_size:
                    sub_chunks = self._force_split(para)
                    chunks.extend(sub_chunks)
                    current_chunk = ""
                else:
                    # 오버랩: 이전 청크 마지막 부분 포함
                    if chunks and self.chunk_overlap > 0:
                        overlap_text = chunks[-1][-self.chunk_overlap:]
                        current_chunk = f"{overlap_text}\n{para}".strip()
                    else:
                        current_chunk = para

        # 마지막 청크 저장
        if current_chunk and len(current_chunk) >= self.min_chunk_size:
            chunks.append(current_chunk)

        return chunks

    def _force_split(self, text: str) -> list[str]:
        """긴 텍스트를 강제 분할 (문장 경계 기준)"""
        chunks = []
        sentences = re.split(r'(?<=[.!?。])\s+', text)
        current = ""

        for sentence in sentences:
            if len(current) + len(sentence) + 1 <= self.chunk_size:
                current = f"{current} {sentence}".strip()
            else:
                if current:
                    chunks.append(current)
                current = sentence

        if current:
            chunks.append(current)

        return chunks
