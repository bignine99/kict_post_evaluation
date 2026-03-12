# 📋 PostEval AI — 상세 작업 기록
> 작성일: 2026-03-11 (화)  
> 작업 시간: 16:00 ~ 21:10 (약 5시간)

---

## 1. 프로젝트 개요

- **프로젝트명**: PostEval AI — AI 기반 건설공사 사후평가서 자동작성 시스템
- **목표**: 건설공사 준공 후 사후평가서(별지 제3호·제4호) 자동 작성
- **기술 스택**: Next.js 14 + FastAPI + NCP MySQL + Gemini API
- **프로젝트 경로**: `c:\Users\cho\Desktop\Temp\05 Code\260310_post_evaluation`

---

## 2. 오늘 완료된 작업 (Phase별 정리)

### 2.1 Phase 2: 파일 업로드 UI 완성

**수정된 파일:**
- `frontend/src/app/upload/page.tsx` — 전면 개편

**변경 내용:**
- 프로젝트 관리 기능 추가 (목록 조회, 선택, 새 프로젝트 생성)
- "문서 업로드" 버튼 동작 문제 수정
- 드래그&드롭 업로드 UI 개선
- 프로젝트명 "새만금" 입력을 통한 프로젝트 생성 후 16개 PDF 업로드 완료

---

### 2.2 Phase 3: RAG 파이프라인 실행 + 실시간 시각화

**수정/생성된 파일:**
- `backend/app/routers/processing.py` — SSE 실시간 스트리밍으로 전면 재작성
- `frontend/src/app/upload/page.tsx` — 파이프라인 시각화 추가

**RAG 파이프라인 구현 내용:**
1. **텍스트 추출**: PyMuPDF로 16개 PDF에서 텍스트+테이블 추출
2. **시맨틱 청킹**: 800토큰/150오버랩, 표 독립 청크 처리
3. **Gemini 임베딩**: `models/gemini-embedding-001` (768차원)
4. **MySQL 저장**: chunks 테이블에 텍스트+임베딩 JSON 저장

**파이프라인 결과 (프로젝트 id: 2 "새만금"):**
- 문서: 16개 PDF 전체 처리 완료
- 청크: **6,865개** 생성 및 임베딩 저장
- 상태: `ready`

**SSE 실시간 시각화:**
- 문서별 4단계(추출→청킹→임베딩→저장) 진행 애니메이션
- 현재 처리 중인 문서 정보 표시
- 임베딩 단계에서 청크별 진행률 상세 표시

---

### 2.3 Phase 4: 별지 3호/4호 자동 작성 기능 구현

#### 2.3.1 파싱 엔진 구현

**생성된 파일:** `backend/app/services/parsing_engine.py`

**핵심 구현:**
- **47개 필드 매핑** (별지3호 32개 + 별지4호 15개)
- 각 필드별로 다음 정보 정의:
  - `query`: 벡터검색 쿼리 (한국어 자연어 질문)
  - `target_docs`: 참조 문서 유형 필터
  - `output_schema`: JSON 출력 스키마
  - `extraction_type`: `structured` (정형) 또는 `narrative` (비정형 서술)

**추출 파이프라인:**
```
[쿼리 임베딩] → [벡터 검색 (코사인 유사도)] → [LLM 추출/요약] → [결과 반환]
```

**정형 데이터 추출:**
- Gemini `response_mime_type="application/json"` 강제 JSON 출력
- temperature=0.1 (결정론적 추출)
- 출처 문서, 페이지, 신뢰도 포함

**비정형 데이터 서술:**
- 목표 글자 수 지정 (1000~2000자)
- 개조식, ~함/~됨 체
- 핵심 사실 목록 + 출처 포함

**신뢰도 산출:**
- LLM 자체 판단 60% + 벡터 유사도 상위 3개 평균 40%
- 정보 미발견 시 0.1 반환

#### 2.3.2 평가 API 구현

**생성된 파일:** `backend/app/routers/evaluation.py`

**엔드포인트 3개:**
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/v1/projects/{id}/evaluate/fields` | 추출 가능한 필드 목록 |
| POST | `/api/v1/projects/{id}/evaluate/{field_id}` | 단일 필드 추출 |
| POST | `/api/v1/projects/{id}/evaluate/all` | 전체 필드 일괄 추출 |

**main.py 수정:**
- `from app.routers.evaluation import router as evaluation_router` 추가
- `app.include_router(evaluation_router, prefix="/api/v1", tags=["Evaluation"])` 등록

#### 2.3.3 "계약 공사비" 단일 필드 테스트

**API 호출:** `POST /api/v1/projects/2/evaluate/form3_cost_contract`

**추출 결과:**
```json
{
  "계약공사비": 3373500000,
  "단위": "원",
  "계약일자": "2021-03-29",
  "출처문서": "04. 1. 1. 준공검사 결과 보고.pdf",
  "출처페이지": 3,
  "신뢰도": "high"
}
```
- confidence: 0.844
- 5개 출처 청크 (전체공사 증감대비표, 4차공사 대비표 등)

> ⚠️ **주의**: 이 값(33.7억)은 나중에 정답지와 비교했을 때 실제 계약 공사비(1,437억)와 다릅니다. 단일 공구 또는 특정 차수의 금액으로 보이며, 추출 쿼리 개선이 필요합니다.

#### 2.3.4 별지 3호 프론트엔드

**생성된 파일:** `frontend/src/app/form3/page.tsx`

**UI 기능:**
- 프로젝트 선택 (ready 상태만 표시)
- "🚀 전체 필드 추출" 버튼 → 31개 필드 순차 추출
- 그래디언트 진행률 바 (현재 필드명 + N/31 카운터)
- 3개 섹션으로 분류 표시:
  - 📋 1. 건설공사 개요 (10개)
  - 📊 2. 사업유형별 세부내용 (3개)
  - 📈 3. 수행성과평가 (18개)
- 각 필드: 카테고리 · 라벨 · 추출값(요약) · 신뢰도% 뱃지
- 클릭 펼침: 상세 JSON/서술, 출처 청크 목록, 🔄 재추출 버튼

#### 2.3.5 별지 4호 프론트엔드

**생성된 파일:** `frontend/src/app/form4/page.tsx`

**UI 기능:**
- 8개 섹션으로 분류:
  - 💰 1. 공사비 및 공사기간 분석
  - 🔄 2. 공사 중 설계변경 내용
  - ⚡ 3. 사업의 특이성
  - 🤖 4. 스마트 건설기술 적용
  - 📢 5. 시공 중 민원
  - 🚨 6. 안전사고(재해)
  - 🔧 7. 재시공
  - 📝 8. 결론
- ✏️ 편집 버튼 → textarea 인라인 편집 → 💾 저장
- 📌 핵심 사실 목록 (key_facts)
- 출처 문서 태그

#### 2.3.6 별지 3호 전체 필드 추출 실행

**실행 결과 (약 3분 소요):**

| 섹션 | 추출 수 | 주요 결과 |
|------|---------|-----------|
| 1. 건설공사 개요 | 10개 | 발주기관: 새만금개발공사, 사업유형: 간척·매립공사, 사업명: 새만금 스마트 수변도시 매립공사 |
| 2. 사업유형별 세부 | 3개 | 민원발생여부: 유, 사업 특이성: 유 (매립부지) |
| 3. 수행성과평가 | 18개 | 추정공사비: 790,047백만원, 계약공사비: 143,712,000,000원, 기본설계비: 1,413,000,000원 |

**대부분 83~85% 신뢰도**, 일부 null 항목:
- 공사성격: null (10%)
- 실집행 보상비: null (10%)
- 타당성조사비: null (10%)
- 실시설계비: null (10%)

---

### 2.4 정답지 비교 시도 (미완료)

**정답지 파일:** `.013_report_case/99. 1. 사후평가서(최종).pdf` (4.3MB)

**문제점:**
- PyMuPDF (fitz)로 이 PDF를 열 때 응답이 없음 (hang)
- 여러 접근법 시도했으나 모두 실패:
  - 직접 Python 명령 실행 → cmd 콘솔 출력 문제
  - 파일 리다이렉트 → 여전히 hang
  - 브라우저에서 file:// 접근 → 보안 차단
- **내일 우선 해결 필요**

---

## 3. 현재 디렉토리 구조

```
260310_post_evaluation/
├── .env                          # API 키, DB 접속 정보
├── implementation_plan.md        # 전체 구현 계획 (Phase 1~7)
├── mapping_table.txt             # 47개 필드 ↔ 참조문서 매핑
├── .011_report_format/           # 별지 3호/4호 양식 PDF
├── .012_raw_data_report/         # 원본 16개 PDF
├── .013_report_case/             # 정답지 사후평가서
│
├── backend/
│   ├── app/
│   │   ├── main.py               # FastAPI 엔트리포인트 (4개 라우터 등록)
│   │   ├── config.py             # 환경설정 (Gemini, MySQL 등)
│   │   ├── database.py           # SQLAlchemy 동기/비동기 엔진
│   │   ├── models/
│   │   │   ├── project.py        # 프로젝트 모델
│   │   │   ├── document.py       # 문서 모델
│   │   │   ├── chunk.py          # 청크+임베딩 모델
│   │   │   └── evaluation.py     # 평가 결과 모델
│   │   ├── routers/
│   │   │   ├── health.py         # 헬스체크
│   │   │   ├── projects.py       # 프로젝트 CRUD + 업로드
│   │   │   ├── processing.py     # RAG 파이프라인 (SSE)
│   │   │   ├── evaluation.py     # ★ 평가서 추출 API
│   │   │   └── upload.py         # 업로드 라우터
│   │   ├── services/
│   │   │   ├── document_extractor.py  # PyMuPDF PDF 추출
│   │   │   ├── chunking.py            # 시맨틱 청킹
│   │   │   ├── vector_store.py        # 벡터 저장/검색
│   │   │   └── parsing_engine.py      # ★ 47개 필드 추출 엔진
│   │   └── prompts/
│   │       └── __init__.py
│   └── venv/                     # Python 가상환경
│
├── frontend/
│   └── src/app/
│       ├── page.tsx              # 대시보드
│       ├── upload/page.tsx       # 데이터 업로드 (RAG 포함)
│       ├── form3/page.tsx        # ★ 별지 제3호 폼 뷰
│       ├── form4/page.tsx        # ★ 별지 제4호 폼 뷰
│       ├── globals.css           # 전역 스타일
│       └── layout.tsx            # 레이아웃
│
└── gt_extract.py                 # 정답지 추출 스크립트 (임시)
```

---

## 4. 데이터베이스 현황 (NCP MySQL)

| 테이블 | 데이터 |
|--------|--------|
| projects | id=2, name="새만금", status="ready", total_documents=16, total_chunks=6865 |
| documents | 16개 PDF 메타데이터 |
| chunks | 6,865개 (텍스트 + 768차원 임베딩 JSON) |
| evaluation_results | 아직 비어있음 (추출 결과 저장 미구현) |

---

## 5. 서버 실행 방법

```bash
# 백엔드 (터미널 1)
cd backend
venv\Scripts\activate
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --env-file ..\.env

# 프론트엔드 (터미널 2)
cd frontend
npm run dev
```

- 프론트엔드: http://localhost:3000
- 백엔드 API: http://localhost:8000
- Swagger: http://localhost:8000/docs

---

## 6. API 엔드포인트 전체 목록

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/` | 헬스체크 |
| POST | `/api/v1/projects` | 프로젝트 생성 |
| GET | `/api/v1/projects` | 프로젝트 목록 |
| GET | `/api/v1/projects/{id}` | 프로젝트 상세 |
| POST | `/api/v1/projects/{id}/upload` | 파일 업로드 |
| GET | `/api/v1/projects/{id}/documents` | 문서 목록 |
| POST | `/api/v1/projects/{id}/process` | RAG 파이프라인 (SSE) |
| GET | `/api/v1/projects/{id}/evaluate/fields` | 추출 필드 목록 |
| POST | `/api/v1/projects/{id}/evaluate/{field_id}` | 단일 필드 추출 |
| POST | `/api/v1/projects/{id}/evaluate/all` | 전체 필드 추출 |

---

## 7. 사용된 기술 및 라이브러리

| 기술 | 버전/모델 | 용도 |
|------|-----------|------|
| Next.js | 14 (App Router) | 프론트엔드 |
| FastAPI | latest | 백엔드 |
| SQLAlchemy | latest | ORM (비동기) |
| PyMuPDF (fitz) | latest | PDF 텍스트 추출 |
| Gemini | gemini-2.5-flash-lite | LLM 추출/요약 |
| Gemini Embedding | models/gemini-embedding-001 | 768차원 벡터 임베딩 |
| google.generativeai | deprecated → google.genai 전환 필요 | Gemini SDK |
| MySQL | 8.0 (NCP Cloud DB) | 메타+벡터 저장소 |
| aiomysql | latest | MySQL 비동기 드라이버 |
| numpy | latest | 코사인 유사도 계산 |

---

## 8. 알려진 이슈 및 주의사항

1. **`google.generativeai` 패키지 지원 종료 예정**
   - `backend/app/routers/processing.py` 및 `services/parsing_engine.py`에서 사용 중
   - `google.genai`로 마이그레이션 필요

2. **정답지 PDF 읽기 실패**
   - `.013_report_case/99. 1. 사후평가서(최종).pdf` (4.3MB)
   - PyMuPDF가 이 파일에서 hang됨 → 다른 방법 필요

3. **추출 정확도 이슈**
   - "계약 공사비" 첫 테스트: 33.7억 (단일 공구/차수 금액 추출)
   - 전체 추출 재실행 시: 1,437억 (올바른 값)
   - 쿼리 종속적으로 결과가 달라질 수 있음

4. **evaluation_results 테이블 미사용**
   - 추출 결과가 DB에 저장되지 않고 프론트엔드 메모리에만 존재
   - 추후 DB 영구 저장 구현 필요

5. **별지 4호 템플릿 맞춤화 완료 (2026-03-12)**
   - 실제 배포용 '사후평가서(최종)' PDF 양식과 동일하게 출력되도록 `parsing_engine.py` 프롬프트 전면 수정
   - 개조식 기호(■, -, ○) 강제 도입
   - 이미지 대체 캡션(Placeholder) 기능 적용

## 9. 트러블슈팅 내역 (2026-03-12)

- **MySQL 연결 에러 (`OperationalError`)**: `backend/app/config.py`에서 `.env` 파일 경로를 `../.env`로 명시적으로 지정하여 해결.
- **Pydantic Validation 에러 (`Extra inputs are not permitted`)**: `.env`에 포함된 백엔드/프론트엔드 공용 변수들을 무시하도록 `Settings` 클래스의 `Config` 하위에 `extra = "ignore"` 추가로 해결.
- **Hydration Error (프론트엔드)**: `app/form3/page.tsx`, `app/form4/page.tsx`, `app/upload/page.tsx` 등에서 사이드바의 `<a>` 태그를 `Next.js` 공식 `<Link>` 컴포넌트로 일괄 교체하여 프리렌더링/클라이언트 미스매치 에러를 해소함.
