# 📌 다음에 할 일 — 2026-03-14 (금) 이후

> PostEval AI — 기능 고도화 및 운영 최적화

---

## 🎯 우선순위 높은 작업

### 1. 홈페이지에 PostEval AI 솔루션 카드 추가
- `ninetynine99.co.kr/solutions` 솔루션 목록에 카드 추가
- 카테고리: `Construction / RAG`
- 제목: **PostEval AI — 건설사업 사후평가**
- 설명: 건설공사 사후평가서(별지 3·4호)를 AI가 자동으로 작성합니다.
- 기술 설명: RAG 파이프라인으로 16개 PDF를 분석, 47개 필드를 자동 추출. Gemini AI + MySQL 벡터 검색 기반.
- 링크: `https://posteval.ninetynine99.co.kr/landing`
- **작업 위치**: 홈페이지 프로젝트 폴더에서 직접 작업

### 2. ACG 보안 강화 (NCP 콘솔)
- 포트 **3002**, **8000** ACG에서 제거 (Nginx 프록시 사용으로 불필요)
- 80(HTTP), 443(HTTPS)만 외부 오픈 유지

### 3. 프로덕션 빌드 전환 (선택)
- 현재 `next dev` → `next build && next start` (프로덕션 모드)
- Dockerfile 수정 필요
- 성능 + 보안 개선

---

## 📋 추후 개발 예정 메뉴 (사이드바)

| 메뉴 | 설명 | 우선순위 |
|------|------|---------|
| 데이터 관리 | 프로젝트별 문서/청크 관리 | 중 |
| 데이터 분석 | 추출 결과 분석 뷰 | 중 |
| 데이터 통계 | 프로젝트별 통계 대시보드 | 중 |
| 성과 추이 | 추출 정확도 변화 추이 | 하 |
| 작업 이력 | 추출/생성 이력 로그 | 하 |
| 감사 로그 | 시스템 접근 기록 | 하 |
| 도움말 | 사용자 가이드 | 하 |
| 설정 | API Key, DB 설정 | 중 |

---

## 🔧 기술 부채 / 개선 사항

- [ ] `google.generativeai` → `google.genai` 마이그레이션 (deprecated 패키지 전환)
- [ ] `evaluation_results` 테이블에 추출 결과 DB 영구 저장 구현
- [ ] 정답지 PDF 읽기 문제 해결 (`.013_report_case/99. 1. 사후평가서(최종).pdf`)
- [ ] Nginx 설정 정리 (중복 `/health` 블록 제거)
- [ ] 로컬 `docker-compose.yml`도 서버와 동기화 (NEXT_PUBLIC_API_URL 등)

---

## 📍 현재 운영 상태

| 항목 | 상태 |
|------|------|
| 서비스 URL | `https://posteval.ninetynine99.co.kr` 🔒 |
| 서버 IP | `110.165.17.170` (NCP) |
| Docker 자동 재시작 | ✅ 설정됨 |
| SSL 인증서 | ✅ Let's Encrypt (만료: 2026-06-11, 자동 갱신) |
| 프론트엔드 | Docker `next dev` (포트 3002) |
| 백엔드 | Docker `uvicorn` (포트 8000) |
| DB | NCP MySQL `posteval_db` |
| GitHub | `bignine99/kict_post_evaluation` (main 브랜치) |
