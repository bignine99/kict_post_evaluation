# 🏗️ AI 기반 건설공사 사후평가서 자동작성 시스템 — Implementation Plan

> **프로젝트명**: PostEval AI  
> **작성일**: 2026-03-10  
> **목표**: 건설공사 준공 후 사후평가서(별지 제3호·제4호) 자동 작성 시스템  
> **배포 대상**: 단일 조직 내부 도구 (B2B SaaS 확장 대비 설계)

---

## 1. 시스템 아키텍처

### 핵심 데이터 흐름

```
[사용자 PDF 업로드] → [텍스트 추출 (PyMuPDF)] → [시맨틱 청킹]
    → [Gemini 임베딩] → [ChromaDB 저장]
    → [항목별 자동 쿼리] → [LLM 파싱/생성] → [JSON 정형 데이터]
    → [대시보드 시각화] → [PDF 다운로드]
```

### 서비스 구성

| 서비스 | 역할 | 포트 |
|--------|------|------|
| Frontend (Next.js 14) | 대시보드 UI | 3000 |
| Backend (FastAPI) | API, RAG, LLM 파이프라인 | 8000 |
| ChromaDB | 벡터 검색 엔진 | 8001 |
| NCP MySQL | 메타데이터·프로젝트 관리 | 3306 |

---

## 2. 기술 스택

| 계층 | 기술 | 선정 사유 |
|------|------|-----------|
| **Frontend** | Next.js 14 (App Router) | 사용자 기존 경험, SSR 지원 |
| **Backend** | Python FastAPI | 기존 RAG 코드 재활용, 비동기 처리 |
| **Vector DB** | ChromaDB (Persistent) | 기존 운영 경험, Docker 호환 |
| **RDB** | MySQL 8.0 (NCP Cloud DB) | 기존 인프라 활용 |
| **LLM** | gemini-2.5-flash-lite | 비용 효율, 한국어 성능 |
| **Embedding** | gemini-embedding-001 (768d) | 무료 티어, 검증 완료 |
| **PDF 추출** | PyMuPDF (fitz) | OCR 불필요, 표 추출 지원 |
| **PDF 생성** | Puppeteer (서버사이드) | HTML→PDF 무손실 변환 |
| **컨테이너** | Docker + docker-compose | 환경 일관성, 격리 관리 |

---

## 3. 데이터 분석

### 3.1 원본 데이터 (16개 PDF)

| # | 파일명 | 크기 | 역할 |
|---|--------|------|------|
| 01 | 예비타당성조사 보고서 | 6.2MB | 추정 공사비·기간 |
| 02 | 타당성조사 보고서 | 47.4MB | 사업추진경위 |
| 03 | 기본설계보고서 | 103MB | 설계비, 사업규모 |
| 04.x | 준공검사·정산 관련 (8건) | ~10MB | 실제 공사비 |
| 05 | 실시설계보고서(통합) | 263MB | 실시설계비 |
| 06 | 설계변경 검토 보고 (2건) | ~0.9MB | 설계변경 증감액 |
| 12 | 최종 건설사업관리 보고서 | 14.9MB | 핵심 참조 문서 |

### 3.2 매핑 테이블 (47개 필드)

| 카테고리 | 필드 수 | 주요 참조 문서 |
|----------|---------|---------------|
| 별지3 - 건설공사 개요 | 19개 | 감리보고서, 준공보고서 |
| 별지3 - 사업유형별 세부 | 4개 | 시공평가, 감리보고서 |
| 별지3 - 수행성과 평가 | 20개 | 감리보고서, 시공내역서 |
| 별지4 - 결과보고서 | 16개 | 감리보고서, 실정보고서 |

### 3.3 필드 유형 분류

- **정형 데이터** (직접 추출): 공사비, 공사기간, 설계변경 건수, 참여자 정보 → JSON 강제 출력
- **비정형 데이터** (요약 생성): 스마트건설기술 적용, 사업 특이성, 민원·안전사고 분석 → 2000자 Prompt Chaining

---

## 4. 단계별 개발 계획 (Phase 1~7)

### Phase 1: 프로젝트 셋업 & Docker (3일)

| 태스크 | 산출물 |
|--------|--------|
| Git 저장소 초기화, .gitignore | Git repo |
| Docker Compose (3 서비스) | docker-compose.yml |
| FastAPI 백엔드 스캐폴딩 | backend/ |
| Next.js 14 프론트엔드 초기화 | frontend/ |
| ChromaDB 컨테이너 + 볼륨 | persistent volume |
| 환경변수 관리 (.env) | API 키, DB 정보 |

### Phase 2: 파일 업로드 & PDF 추출 (4일)

| 태스크 | 상세 |
|--------|------|
| 드래그&드롭 업로드 UI | Progress Bar 포함 |
| FastAPI 파일 수신 API | 로컬 스토리지 저장 |
| PyMuPDF PDF 텍스트 추출 | 표(Table) 구조 인식 포함 |
| MySQL 메타데이터 테이블 | 프로젝트·문서 관리 |

**핵심 코드**:
```python
# backend/app/services/document_extractor.py
import fitz
class DocumentExtractor:
    def extract_pdf(self, file_path: str) -> dict:
        doc = fitz.open(file_path)
        pages = []
        for page_num, page in enumerate(doc):
            text = page.get_text("text")
            tables = page.find_tables()
            pages.append({
                "page_num": page_num + 1, "text": text,
                "tables": [t.extract() for t in tables],
                "source_file": os.path.basename(file_path)
            })
        return {"pages": pages, "total_pages": len(pages)}
```

**MySQL 스키마**:
```sql
CREATE TABLE projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    status ENUM('uploading','processing','ready','completed') DEFAULT 'uploading',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE documents (
    id INT AUTO_INCREMENT PRIMARY KEY, project_id INT,
    filename VARCHAR(500), doc_type VARCHAR(100),
    file_size BIGINT, page_count INT,
    extraction_status ENUM('pending','extracting','chunked','embedded') DEFAULT 'pending',
    FOREIGN KEY (project_id) REFERENCES projects(id)
);
CREATE TABLE evaluation_results (
    id INT AUTO_INCREMENT PRIMARY KEY, project_id INT,
    field_id VARCHAR(100), field_category VARCHAR(50),
    extracted_value JSON, confidence FLOAT,
    source_refs JSON, user_confirmed BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);
```

### Phase 3: RAG 파이프라인 & ChromaDB (5일)

| 태스크 | 상세 |
|--------|------|
| 시맨틱 청킹 (문단·섹션 경계) | 800토큰/150오버랩 |
| 메타데이터 태깅 | 문서유형, 페이지, 섹션명 |
| Gemini Embedding 배치 호출 | Rate Limit 제어 (0.5초) |
| ChromaDB 컬렉션 적재 | 프로젝트별 독립 컬렉션 |
| 유사도 검색 API | 문서유형 필터링 지원 |
| 대용량 배치 처리 | WebSocket 진행률 |

**청킹 전략**:
```python
class SemanticChunker:
    CHUNK_SIZE = 800; CHUNK_OVERLAP = 150; MIN_CHUNK_SIZE = 100
    def chunk_document(self, extracted: dict) -> list[dict]:
        chunks = []
        for page in extracted["pages"]:
            for table in page["tables"]:  # 표는 독립 청크
                chunks.append({"text": self._table_to_text(table),
                    "metadata": {"source_file": page["source_file"],
                        "page_num": page["page_num"], "content_type": "table",
                        "doc_type": self._classify_doc(page["source_file"])}})
            paragraphs = self._split_by_paragraph(page["text"])
            for chunk_text in self._merge_to_target_size(paragraphs):
                chunks.append({"text": chunk_text,
                    "metadata": {"source_file": page["source_file"],
                        "page_num": page["page_num"], "content_type": "text",
                        "doc_type": self._classify_doc(page["source_file"])}})
        return chunks
```

**검색 (문서유형 필터)**:
```python
results = collection.query(
    query_embeddings=[query_embedding], n_results=10,
    where={"doc_type": {"$in": ["감리보고서", "시공내역서"]}}
)
```

### Phase 4: 데이터 파싱 자동화 (5일)

| 태스크 | 상세 |
|--------|------|
| mapping_table → 쿼리 매핑 DB 변환 | 47개 필드 매핑 |
| 항목별 자동 쿼리 템플릿 | target_docs + JSON 스키마 |
| LLM Structured Output 파싱 | JSON 강제 출력 |
| 팩트체크 모듈 (수치 교차 검증) | confidence 산출 |
| 전체 항목 일괄 파싱 | 오케스트레이터 |

**쿼리 매핑 시스템**:
```python
FIELD_QUERY_MAP = {
    "3호_3_수행성과_계약공사비": {
        "query": "최초 시공계약 당시의 계약 공사비(금액)는 얼마인가?",
        "target_docs": ["시공계약서", "시공내역서"],
        "output_schema": {"계약공사비": "number", "단위": "string"},
        "extraction_type": "structured"
    }, # ... 47개 필드
}
```

**LLM 파싱 엔진**:
```python
class ParsingEngine:
    async def parse_field(self, project_id: str, field_id: str) -> dict:
        template = FIELD_QUERY_MAP[field_id]
        context_chunks = self.vector_db.query(  # 벡터검색
            query=template["query"], n_results=10,
            doc_filter=template["target_docs"])
        response = await self.llm.generate(     # LLM 파싱
            system_prompt=EXTRACTION_SYSTEM_PROMPT,
            user_prompt=self._build_extraction_prompt(
                template["query"], context_chunks, template["output_schema"]),
            response_mime_type="application/json")
        validated = self._validate_extraction(response, context_chunks)
        return {"field_id": field_id, "value": validated["data"],
                "confidence": validated["confidence"],
                "source_refs": [c["metadata"] for c in context_chunks[:3]]}
```

### Phase 5: 대시보드 & PDF 출력 (5일)

| 태스크 | 상세 |
|--------|------|
| 대시보드 레이아웃 | 사이드바 + 탭 네비게이션 |
| 별지 제3호 폼 뷰 | 정형 데이터 테이블/편집 |
| 별지 제4호 폼 뷰 | 서술형 데이터 편집 |
| KPI 카드 | 공사비 증감율, 공기 준수율 |
| PDF 생성 (Puppeteer) | 별지 서식 레이아웃 복제 |
| 출처 하이라이트 | 근거 문서·페이지 표시 |

**컴포넌트 구조**:
```
EvaluationTabs/
├── Form3Tab (별지 제3호)
│   ├── ProjectOverview (건설공사 개요)
│   ├── ProjectDetails (사업유형별 세부)
│   └── PerformanceEval (수행성과평가)
└── Form4Tab (별지 제4호)
    ├── CostAnalysis, DesignChanges, Uniqueness
    ├── SmartConstruction, Complaints
    ├── SafetyAccidents, Rework, Conclusion
```

### Phase 6: 콘텐츠 자동 요약 ~2000자 (4일)

**Prompt Chaining 구조**:
```
[Step 1] 벡터DB 관련 청크 20~30개 검색
    → [Step 2] LLM이 핵심 Fact 목록 추출
    → [Step 3] 2000자 초안 작성 (개조식, ~함/~됨)
    → [Step 4] 팩트체크 (원본 대조, 허위 제거)
    → [Step 5] 글자 수 조정, 논리구조 정리
```

### Phase 7: MCP/HWP Export API (3일)

```
GET  /api/v1/projects/{id}/export/json        # 전체 JSON
GET  /api/v1/projects/{id}/export/pdf         # 별지 PDF
POST /api/v1/projects/{id}/export/webhook     # Webhook
GET  /api/v1/projects/{id}/export/hwp-mapping # HWP 필드매핑
```

---

## 5. LLM 프롬프트 설계

### 5.1 데이터 추출 System Prompt
```
당신은 건설공사 사후평가 전문 데이터 추출 엔진입니다.
[규칙]
1. 제공된 컨텍스트 내의 정보만 사용. 추론/생성 금지.
2. 수치 데이터는 원문 그대로 추출 (단위 포함).
3. 정보 미발견 시 null + "not_found_reason" 기재.
4. 출처 정보(문서명, 페이지) 필수 포함.
[출력 형식] 지정된 JSON 스키마에 맞춰 출력.
```

### 5.2 콘텐츠 요약 System Prompt
```
당신은 건설공사 사후평가서 작성 전문가입니다.
[문체] 공공기관 보고서: 개조식, ~함/~됨/~임
[분량] 1,800~2,200자, 3~5개 문단
[품질] 원본 데이터 없는 내용 절대 생성 금지
```

---

## 6. Docker 구성

```yaml
# docker-compose.yml
version: "3.8"
services:
  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    volumes: ["./frontend/src:/app/src"]
    environment: [NEXT_PUBLIC_API_URL=http://localhost:8000]
  backend:
    build: ./backend
    ports: ["8000:8000"]
    volumes: ["./backend/app:/app/app", "upload_data:/app/uploads"]
    environment:
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - CHROMA_HOST=chromadb
    depends_on: [chromadb]
  chromadb:
    image: chromadb/chroma:latest
    ports: ["8001:8000"]
    volumes: ["chroma_data:/chroma/chroma"]
    environment: [IS_PERSISTENT=TRUE]
volumes:
  upload_data:
  chroma_data:
```

---

## 7. 배포 전략

```
[로컬] docker-compose up → 개발·테스트
    → [git push] → Git Repository
    → [NCP 서버] git pull → docker-compose -f docker-compose.prod.yml up -d
    → [Nginx] 리버스 프록시 (3000/8000 통합 라우팅)
```

---

## 8. 디렉토리 구조

```
260310_post_evaluation/
├── .011_report_format/       # 별지 서식 PDF
├── .012_raw_data_report/     # 원본 데이터 (16 PDF)
├── .013_report_case/         # 참고 사례
├── mapping_table.txt         # 항목-참조문서 매핑
├── implementation_plan.md    # 본 문서
├── docker-compose.yml
├── .env
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── models/           # SQLAlchemy (project, document, evaluation)
│   │   ├── routers/          # API (upload, parsing, evaluation, export)
│   │   ├── services/         # 비즈니스 로직
│   │   │   ├── document_extractor.py
│   │   │   ├── chunking.py
│   │   │   ├── embedding.py
│   │   │   ├── vector_store.py
│   │   │   ├── parsing_engine.py
│   │   │   ├── summarizer.py
│   │   │   └── pdf_generator.py
│   │   └── prompts/          # LLM 프롬프트 템플릿
│   └── tests/
└── frontend/
    ├── Dockerfile
    ├── src/
    │   ├── app/              # Next.js App Router
    │   ├── components/       # UI, upload, dashboard, forms, viewer
    │   ├── hooks/
    │   ├── lib/
    │   └── styles/
    └── public/
```

---

## 부록: 핵심 성공 지표

| 지표 | 목표값 |
|------|--------|
| 정형 데이터 추출 정확도 | ≥ 90% |
| 서술형 콘텐츠 팩트 정확도 | ≥ 85% |
| 전체 평가서 생성 소요 시간 | ≤ 30분 |
| PDF 출력 서식 일치도 | ≥ 95% |

> **테스트 전략**: `.013_report_case/99. 1. 사후평가서(최종).pdf`를 정답지(Ground Truth)로 활용하여 추출 정확도 측정.
