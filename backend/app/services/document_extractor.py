"""
PostEval AI — PDF 문서 추출 서비스
PyMuPDF(fitz)를 사용하여 PDF에서 텍스트와 표 추출
"""
import os
import fitz  # PyMuPDF
from typing import Optional


# ── 문서 유형 자동 분류 매핑 ──
DOC_TYPE_KEYWORDS = {
    "예비타당성": "예비타당성조사",
    "타당성조사": "타당성조사",
    "기본설계": "기본설계보고서",
    "실시설계": "실시설계보고서",
    "준공검사": "준공검사보고서",
    "정산": "정산보고서",
    "감리": "감리보고서",
    "시공평가": "시공평가보고서",
    "설계변경": "설계변경보고서",
    "건설사업관리": "건설사업관리보고서",
    "시공내역": "시공내역서",
    "실정보고": "실정보고서",
    "안전": "안전관리보고서",
}


class DocumentExtractor:
    """PDF 문서에서 텍스트와 표를 추출하는 서비스"""

    def classify_doc_type(self, filename: str) -> str:
        """파일명에서 문서 유형을 자동 분류"""
        filename_lower = filename.lower()
        for keyword, doc_type in DOC_TYPE_KEYWORDS.items():
            if keyword in filename_lower:
                return doc_type
        return "기타"

    def extract_pdf(self, file_path: str) -> dict:
        """
        PDF 파일에서 텍스트와 표를 추출

        Returns:
            {
                "filename": str,
                "doc_type": str,
                "total_pages": int,
                "pages": [
                    {
                        "page_num": int,
                        "text": str,
                        "tables": [[[str]]],
                        "source_file": str
                    }
                ]
            }
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"파일을 찾을 수 없습니다: {file_path}")

        filename = os.path.basename(file_path)
        doc_type = self.classify_doc_type(filename)
        doc = fitz.open(file_path)
        pages = []

        for page_num in range(len(doc)):
            page = doc[page_num]

            # 텍스트 추출
            text = page.get_text("text")

            # 표 추출
            tables_data = []
            try:
                tables = page.find_tables()
                if tables and tables.tables:
                    for table in tables.tables:
                        extracted = table.extract()
                        if extracted:
                            tables_data.append(extracted)
            except Exception:
                pass  # 표 추출 실패 시 무시

            pages.append({
                "page_num": page_num + 1,
                "text": text.strip(),
                "tables": tables_data,
                "source_file": filename,
                "char_count": len(text.strip()),
            })

        doc.close()

        return {
            "filename": filename,
            "doc_type": doc_type,
            "total_pages": len(pages),
            "file_size": os.path.getsize(file_path),
            "pages": pages,
        }

    def extract_text_only(self, file_path: str) -> str:
        """PDF에서 전체 텍스트만 빠르게 추출 (미리보기용)"""
        doc = fitz.open(file_path)
        full_text = []
        for page in doc:
            full_text.append(page.get_text("text"))
        doc.close()
        return "\n".join(full_text)

    def get_page_count(self, file_path: str) -> int:
        """PDF 페이지 수만 빠르게 확인"""
        doc = fitz.open(file_path)
        count = len(doc)
        doc.close()
        return count
