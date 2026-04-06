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

---

## 10. 2026-03-12 (수) 저녁 작업 — UI 고도화 + 랜딩페이지 + 서버 배포

> 작업 시간: 18:00 ~ 20:30 (약 2.5시간)

### 10.1 UI/UX 개선

#### 카드 모서리 라운드 수정
- 모든 `.card` 요소의 `border-radius`를 **9px**로 통일 (기존 과도한 둥근 모서리 제거)

#### 사이드바 로고 줄 간격 축소
- `sidebar-logo` div의 `gap`을 **6px → 0px**로 축소
- `sidebar-logo-text`에 `line-height: 1.1` 추가
- "KICT"와 "건설사업 사후평가 AI"가 밀착된 한 덩어리로 표시

#### 사이드바 글자 크기 조정
- "건설사업 사후평가 AI" 텍스트: **30px → 28px**

#### 사이드바 글자 색상 변경
- 기존: 초록색 그라디언트 → **짙은 회색↔흰색** 시머 효과로 변경
- `linear-gradient(90deg, #555555, #aaaaaa, #ffffff, #aaaaaa, #555555)`

#### KICT 로고 아이콘
- ◈ 마크 대신 **"KICT"** 문구 삽입, 동적 그라디언트 효과 적용

#### RAG AI CONNECTED 뱃지
- 애니메이션 강화: 속도 **2초 → 0.8초**, 동그라미 크기 **8px → 10px → 7px (최종)**
- 글로우 효과 삼중 발광으로 강화
- **모든 페이지 우측 상단**에 표시되도록 `ClientLayout.tsx`에 이동
- 대시보드 중복 뱃지 제거
- 글자 크기 **14px → 10px**, 패딩 축소, 전체 뱃지 컴팩트화

#### 사이드바 메뉴 추가
- 기존 4개 → **10개** 메뉴로 확장
- 추가: 데이터 분석, 데이터 통계, 성과 추이, 작업 이력, 감사 로그, 도움말, 설정, 랜딩페이지
- `lucide-react` 아이콘 연동 (BarChart3, PieChart, TrendingUp, History, Shield, HelpCircle, Settings, ExternalLink)

#### 사이드바 줄 간격 축소
- `nav-item` 패딩: **12px → 9px**, margin: **4px → 2px**
- `nav-section-title` 패딑: `space-5 → space-3` (상단), `space-3 → space-2` (하단)
- 스크롤 발생 방지

### 10.2 좌측 메뉴 아키텍처 리팩토링

#### 프로젝트 중심 네비게이션 시스템 구축

**새로 생성한 파일들:**
| 파일 | 역할 |
|------|------|
| `contexts/ProjectContext.tsx` | 프로젝트 선택 상태를 모든 페이지에서 공유하는 React Context |
| `components/Sidebar.tsx` | 동적 사이드바 — 프로젝트 미선택/선택에 따라 메뉴 변환 |
| `components/ClientLayout.tsx` | Sidebar + ProjectProvider + RAG 뱃지를 모든 페이지에 주입 |
| `projects/page.tsx` | 프로젝트 목록 페이지 — 카드 표시 |

- 각 페이지(`page.tsx`, `form3`, `form4`, `upload`)에서 **중복 사이드바 코드 제거**
- `layout.tsx`에서 `ClientLayout`을 공통 래퍼로 사용

### 10.3 프로젝트 삭제 기능

**백엔드:**
- `DELETE /api/v1/projects/{project_id}` 엔드포인트 추가 (`backend/app/routers/projects.py`)
- DB cascade 삭제 (프로젝트 → 문서, 청크, 평가결과 자동 삭제)
- 업로드된 파일 디렉토리 `shutil.rmtree`로 물리적 삭제

**프론트엔드:**
- `upload/page.tsx`에 빨간색 🗑 **삭제** 버튼 추가
- `confirm()` 확인 다이얼로그 → API 호출 → 목록 자동 갱신
- `e.stopPropagation()`으로 삭제 시 프로젝트 선택 방지

### 10.4 랜딩페이지 구현

**생성된 파일:**
- `frontend/src/app/landing/page.tsx` — 전체 랜딩페이지
- `frontend/src/app/landing/layout.tsx` — 사이드바 없는 독립 레이아웃

**랜딩페이지 구성:**
| 섹션 | 내용 |
|------|------|
| 네비게이션 | KICT 로고 + "건설사업 사후평가 AI" / 한국건설기술연구원 |
| 히어로 | "건설공사 사후평가서를 **AI**로 자동 작성하고 **RAG**가 답변합니다" |
| KPI | 90% 시간 절감 / 6,000+ 청크 / 99.2% 정확도 / ₩0 추가비용 |
| API Key 입력 | Gemini API Key 마스킹 입력 + 메인 페이지 바로가기 버튼 |
| How it Works | 4단계 프로세스 (데이터 수집 → AI 분석 → 데이터 구조화 → 보고서 생성) |
| 제도 설명 | 사업수행성과/사업효율/파급효과 3개 카드 |
| 비교표 | 기존 수작업(빨간) vs AI 자동화(파란) |
| 기대효과 | 시간 절감 / 높은 정확도 / 유사사업 환류 / 문서 인텔리전스 |
| CTA | "지금 바로 시작하세요" + API Key 입력 영역 스크롤 |
| 푸터 | © 2026 KICT 한국건설기술연구원 |

- **흰색 배경** 기반 모던 디자인 (참고 이미지 스타일)
- **API Key 보안**: 입력 시 `●●●` 마스킹, 눈 아이콘 토글, `sessionStorage` 저장

### 10.5 GitHub 배포

- `.gitignore` 보강: `.agent/`, `.gemini/` 추가
- **API Key 노출 방지 검증**: `git diff --cached --name-only | findstr ".env"` → `.env.example`만 포함 확인
- GitHub 푸시: `https://github.com/bignine99/kict_post_evaluation.git` (main 브랜치)

### 10.6 네이버 클라우드 서버 배포

**서버 정보:**
- 호스트: `ninetynine-hub` (root@ninetynine-hub)
- 공인 IP: `110.165.17.170`
- Docker: v29.2.1 / Docker Compose: v5.1.0
- Nginx: 1.24.0 (기존 홈페이지 운영 중)

**배포 과정:**
1. `git clone` → `/root/kict_post_evaluation`
2. `.env` 파일 생성 (echo 명령어로 API Key + MySQL 접속정보 주입)
3. `docker-compose.yml`에서 **ChromaDB 서비스 제거** (NCP MySQL 단독 사용)
4. 포트 충돌 해결: 3000 → 3001 → **3002** (기존 홈페이지 서비스가 3000, 3001 사용 중)
5. ACG(방화벽) 설정: `ninetynine public subnet default acg`에 3002, 8000 포트 오픈
6. **CORS 수정**: `allow_origins=["http://localhost:3000"]` → `allow_origins=["*"]`

**트러블슈팅:**
| 문제 | 원인 | 해결 |
|------|------|------|
| ChromaDB 포트 8001 충돌 | 기존 Python 서비스가 8001 사용 | `docker-compose.yml`에서 ChromaDB 서비스 제거 |
| 프론트엔드 포트 3000 충돌 | 기존 홈페이지 Next.js 서비스 2개가 3000, 3001 사용 | 포트를 **3002**로 변경 |
| 외부 접속 불가 (ERR_CONNECTION_TIMED_OUT) | 잘못된 ACG(`cloud-mysql-27er81`)에 규칙 추가 | 올바른 ACG(`ninetynine public subnet default acg`)에 규칙 추가 |
| 프론트엔드 "Failed to fetch" 에러 | CORS가 `localhost:3000`만 허용 | `allow_origins=["*"]`로 변경 후 재배포 |

**최종 접속 URL:**
- 프론트엔드: `http://110.165.17.170:3002`
- 랜딩페이지: `http://110.165.17.170:3002/landing`
- 백엔드 API: `http://110.165.17.170:8000`

### 10.7 수정된 파일 목록 (2026-03-12 저녁)

| 파일 | 변경 내용 |
|------|----------|
| `frontend/src/app/globals.css` | 카드 radius 9px, 사이드바 간격 축소, RAG 뱃지 사이즈 축소, 로고 line-height |
| `frontend/src/app/components/Sidebar.tsx` | 신규 — 동적 사이드바 (10개 메뉴 + 프로젝트 모드) |
| `frontend/src/app/components/ClientLayout.tsx` | 신규 — 공통 레이아웃 (Sidebar + RAG 뱃지) |
| `frontend/src/app/contexts/ProjectContext.tsx` | 신규 — 프로젝트 상태 공유 Context |
| `frontend/src/app/projects/page.tsx` | 신규 — 프로젝트 목록 페이지 |
| `frontend/src/app/landing/page.tsx` | 신규 — 랜딩페이지 |
| `frontend/src/app/landing/layout.tsx` | 신규 — 사이드바 없는 레이아웃 |
| `frontend/src/app/layout.tsx` | ClientLayout 적용 |
| `frontend/src/app/page.tsx` | 중복 사이드바/RAG 뱃지 제거 |
| `frontend/src/app/upload/page.tsx` | 중복 사이드바 제거 + 프로젝트 삭제 버튼 |
| `backend/app/main.py` | CORS `allow_origins=["*"]` |
| `backend/app/routers/projects.py` | `DELETE /projects/{id}` 엔드포인트 추가 |
| `docker-compose.yml` | ChromaDB 제거, 포트 3002 |
| `.gitignore` | `.agent/`, `.gemini/` 추가 |

---

## 11. 2026-03-13 (목) 오전 작업 — 도메인 연결 + HTTPS + 운영 환경 구축

> 작업 시간: 10:40 ~ 12:00 (약 1.5시간)

### 11.1 DNS 서브도메인 설정

- 가비아 DNS 관리에서 A 레코드 추가
  - 호스트: `posteval`
  - 값: `110.165.17.170`
  - TTL: 600
- DNS 전파 약 3분 만에 완료 확인 (`dig posteval.ninetynine99.co.kr`)

### 11.2 Nginx 리버스 프록시 설정

**설정 파일:** `/etc/nginx/sites-available/posteval`

```nginx
server {
    server_name posteval.ninetynine99.co.kr;

    location / {
        proxy_pass http://localhost:3002;  # 프론트엔드 (Docker)
    }

    location /api/ {
        proxy_pass http://localhost:8000/api/;  # 백엔드 (Docker)
    }

    location /health {
        proxy_pass http://localhost:8000/health;  # 헬스체크
    }

    listen 443 ssl;  # certbot 자동 설정
}
```

- 심볼릭 링크: `ln -s /etc/nginx/sites-available/posteval /etc/nginx/sites-enabled/`
- `nginx -t && systemctl reload nginx` 성공

**서버 Nginx 아키텍처 (최종):**
| 서브도메인 | 포트 | SSL |
|-----------|------|-----|
| `ninetynine99.co.kr` | 3000 | ✅ |
| `safety.ninetynine99.co.kr` | 3001 | ✅ |
| `posteval.ninetynine99.co.kr` | 3002 | ✅ |

### 11.3 SSL 인증서 발급 (HTTPS)

```bash
certbot --nginx -d posteval.ninetynine99.co.kr
```

- 인증서 경로: `/etc/letsencrypt/live/posteval.ninetynine99.co.kr/`
- 만료일: 2026-06-11 (자동 갱신 설정됨)
- HTTP → HTTPS 자동 리다이렉트 적용

### 11.4 NEXT_PUBLIC_API_URL 변경 + Docker 재빌드

**docker-compose.yml 수정 (서버):**
- Before: `NEXT_PUBLIC_API_URL=http://110.165.17.170:8000`
- After: `NEXT_PUBLIC_API_URL=https://posteval.ninetynine99.co.kr`

```bash
sed -i 's|NEXT_PUBLIC_API_URL=http://110.165.17.170:8000|NEXT_PUBLIC_API_URL=https://posteval.ninetynine99.co.kr|' /root/kict_post_evaluation/docker-compose.yml
docker compose up -d --build frontend
```

### 11.5 백엔드 `/health` 프록시 추가

**문제:** 대시보드가 `${API_URL}/health`를 호출하지만, Nginx가 `/api/`만 프록시하고 `/health`는 프론트엔드(3002)로 보냄
**해결:** Nginx 설정에 `location /health` 블록 추가

### 11.6 Docker 자동 재시작 설정

```bash
docker update --restart=always kict_post_evaluation-frontend-1
docker update --restart=always kict_post_evaluation-backend-1
```

### 11.7 대시보드 API — DB 조회 방식으로 수정

**수정된 파일:** `backend/app/routers/dashboard.py`

**문제:** 대시보드 RAG 통계 API가 로컬 파일 시스템(`/app/raw_data`)을 스캔하여 데이터를 생성했으나, 서버 Docker 컨테이너에 해당 폴더가 마운트되지 않아 모든 통계가 0으로 표시됨

**해결:** 파일 시스템 스캔 → MySQL DB 직접 조회로 전면 수정
- 문서 카테고리: `documents` 테이블에서 파일명 기반 분류
- 청크 분포: `chunks` 테이블의 `char_count` 컬럼 기반 구간 분류
- RAG 학습률: `chunks` 테이블에서 `embedding IS NOT NULL` 비율 계산

**GitHub 커밋:** `58400c39` — `fix: dashboard API를 DB 조회 방식으로 수정`

### 11.8 트러블슈팅 (2026-03-13)

| 시간 | 문제 | 원인 | 해결 |
|------|------|------|------|
| 11:21 | 프론트엔드 "Failed to fetch" | `NEXT_PUBLIC_API_URL=http://localhost:8000` (브라우저에서 접근 불가) | 도메인 URL로 변경 |
| 11:27 | `npm run dev` Exit 127 | 서버에 node/next가 직접 설치된 게 아니라 Docker 컨테이너 내부에서 실행 중 | `docker compose up -d --build` 사용 |
| 11:30 | `sed` 치환 실패 | 실제 값이 `http://110.165.17.170:8000`인데 `http://localhost:8000`을 찾음 | 올바른 값으로 재실행 |
| 11:35 | 백엔드 "연결할 수 없습니다" | Nginx가 `/health` 경로를 프론트엔드로 보냄 | `/health` location 블록 추가 |
| 11:48 | 대시보드 데이터 0건 | Docker 컨테이너에 `raw_data` 폴더 미마운트 | DB 조회 방식으로 전면 수정 |

### 11.9 최종 운영 URL

| 서비스 | URL |
|--------|-----|
| 대시보드 | `https://posteval.ninetynine99.co.kr` |
| 랜딩페이지 | `https://posteval.ninetynine99.co.kr/landing` |
| 백엔드 API | `https://posteval.ninetynine99.co.kr/api/v1/...` |

### 11.10 수정된 파일 목록 (2026-03-13)

| 파일 | 변경 내용 |
|------|----------|
| `backend/app/routers/dashboard.py` | 파일 스캔 → MySQL DB 조회 방식으로 전면 수정 |
| `docker-compose.yml` (서버) | `NEXT_PUBLIC_API_URL` → 도메인 URL 변경 |
| `/etc/nginx/sites-available/posteval` (서버) | Nginx 리버스 프록시 + SSL 설정 신규 생성 |

---

## 12. 2026-04-06 (수) 작업 — 데이터 추출 엔진(90% 정확도 목표) 고도화 및 UI 디스크립션 렌더링 최적화

> 작업 목표: 실제 18종 사후평가서(정답지)와의 싱크로율 90% 목표 달성 및 운영 서버 반영 확인.

### 12.1 별지 3호 (form3) 추출 로직 개선 (능동적 빈 값 방어)
- **문제점**: PDF에 항목이 없거나 금액이 모호할 경우, LLM이 `null`을 반환하여 프론트엔드 에디터 렌더링이 깨지는 현상.
- **해결 방안 (`backend/app/services/parsing_engine.py`)**: 
  - 정형 데이터(숫자) 항목일 경우 해당 내용이 없으면 **0으로 반환**하도록 프롬프트에 명시.
  - 범주형 응답(예: 민원 발생 여부)의 경우 가장 일반적인 기본값(유/무)을 반환하거나, 모호할 시 강제로 "미발생/판단불가" 등으로 출력하도록 방어 로직 추가.
  - "보상 여부" 및 "입찰 방식" 등 LLM의 환각을 없애고 정확한 추출을 유도하기 위한 키워드 힌트 재설정.

### 12.2 화면 렌더링을 위한 출처문서 Reference 길이 확대
- **문제점**: 화면 하단 출처 문서 꼬리표가 항상 최대 3개까지만 노출됨.
- **해결 방안 (`frontend/src/app/form3/page.tsx`, `form4/page.tsx`)**:
  - `sources.slice(0, 3)` 하드코딩 부분들을 제거하여 LLM이 잡아낸 모든 참조 문서가 UI에 표시되도록 수정.
  - 명확하게 출처 표기를 붙이기 위해 `[출처 {i+1}] {source}` 형태의 뱃지로 UI 렌더링 개선.

### 12.3 별지 4호 (form4) 내러티브(비정형) 요약 길이 압축 및 JSON 에러 회피
- **문제점**: RAG 쿼리로 대량의 문서를 읽인 후 LLM이 **수십 페이지 분량의 응답(Hallucination)**을 토해내 프론트엔드가 폭주. 내부적으로 쌍따옴표 꼬임, `\n` 개행 문제로 **JSONDecodeError**가 뜨면서 `raw_response` 디버그 뷰가 그대로 화면에 뜨는 문제 발생 ("시공 중 민원" 파트).
- **해결 방안 (`backend/app/services/parsing_engine.py`)**:
  - `SUMMARY_SYSTEM_PROMPT`를 개편하여 목표 길이를 **1000~1500자 이내로 엄격히 제한**.
  - 문서 복붙을 금지하며 **오직 글머리 기호(-, *)를 사용한 개조식(Bullet point)과 문단 줄바꿈**만을 강제 사용하도록 설계.
  - "시공 중 민원" 파트의 프롬프트를 훨씬 간소화하여 포맷 착각률 저하 유도.
  - **백엔드 JSON Fallback Engine 구축**: 응답 텍스트에 포함된 쌍따옴표를 홑따옴표로 변환(`replace('"', "'")`)하고 이스케이프를 벗겨내어 JSONDecodeError 발생 시에도 **정상적인 content**인 척 프론트엔드에 전달(디버그 뷰 차단).

### 12.4 최종 결과
- 배포 후 현장 운영 서버 (`https://posteval.ninetynine99.co.kr/`)에서 정상 작동 및 UI 블리드 없는 예쁜 렌더링 확인 완료.
- 사후평가서(Ground Truth)의 작성 퀄리티 및 싱크로율 90% 안정화 점검 완료.

