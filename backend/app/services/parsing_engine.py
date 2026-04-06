"""
PostEval AI — 파싱 엔진
벡터검색 → LLM 추출/요약 핵심 엔진
"""
import json
import google.generativeai as genai
from app.config import get_settings
from app.services.vector_store import VectorStore

vector_store = VectorStore()

# ═══════════════════════════════════════════
# 시스템 프롬프트
# ═══════════════════════════════════════════

EXTRACTION_SYSTEM_PROMPT = """당신은 건설공사 사후평가 전문 데이터 추출 엔진입니다.

[규칙]
1. 제공된 컨텍스트(Context) 내의 정보만 사용하세요. 추론이나 생성은 금지합니다.
2. 수치 데이터는 원문 그대로 추출하세요 (단위 포함).
3. 정보를 찾을 수 없는 경우 null을 반환하고, "not_found_reason"에 이유를 기재하세요.
4. 출처 정보(문서명, 페이지)를 반드시 포함하세요.
5. JSON 형식으로만 응답하세요.

[금액 규모 판별 기준]
- '시공 공사비(계약/준공)': 통상 수백~수천억원 규모 (백만원 단위 시 100,000 이상)
- '건설사업관리(감리) 용역비': 통상 수십억원 규모 (백만원 단위 시 1,000~10,000)
- '설계 용역비(기본설계/실시설계)': 통상 수억~수십억원 규모 (백만원 단위 시 100~5,000)
- '타당성조사비': 통상 수억원 규모 (백만원 단위 시 100~1,000)
→ 질문이 '시공 공사비'를 묻는다면, 수십억원 이하 금액은 용역비이므로 제외하세요.

[문서 우선순위]
- 공사비/공사기간 관련: '준공정산 및 변경계약 검토보고' > '준공검사 결과 보고' > '전체공사 증감 대비표' > '건설사업관리보고서'
- 사업개요 관련: '건설사업관리보고서 제1장' > '준공검사 결과 보고' > '기본설계보고서'
"""

SUMMARY_SYSTEM_PROMPT = """당신은 건설공사 사후평가서 작성 전문가입니다.

[문체] 공공기관 보고서 형식: 개조식, ~함/~됨/~임 체
[분량 지시] 요청된 글자 수를 준수하세요.
[품질]
- 원본 데이터에 없는 내용은 절대 생성하지 마세요
- 구체적인 수치, 날짜, 금액을 포함하세요
- 출처 문서를 명시하세요
- 3~5개 문단으로 구성하세요
"""


# ═══════════════════════════════════════════
# 필드 매핑 — 별지 제3호 + 제4호
# ═══════════════════════════════════════════

FIELD_QUERY_MAP = {
    # ════════════════════════════════════════
    # 별지 제3호: 1. 건설공사 개요
    # ════════════════════════════════════════
    "form3_org_name": {
        "form": "별지3호", "section": "1_overview",
        "category": "1. 건설공사 개요 | 발주기관",
        "label": "발주기관 기관명",
        "query": "이 건설공사의 발주기관(발주청) 기관명은?",
        "target_docs": ["건설사업관리보고서", "준공검사보고서"],
        "output_schema": {"발주기관명": "string"},
        "extraction_type": "structured",
    },
    "form3_project_type": {
        "form": "별지3호", "section": "1_overview",
        "category": "1. 건설공사 개요 | 공사개요",
        "label": "사업유형",
        "query": "이 건설공사의 '사업유형'을 판별하세요. 분류: ①도로 ②철도 ③수자원(다목적댐) ④수자원(치수사업) ⑤수자원(광역상수도) ⑥항만 ⑦공항 ⑧택지개발 ⑨에너지공급시설 ⑩문화및집회시설 ⑪환경시설 ⑫기타. [필수판별기준]: 문서 내용이 매립, 간척, 부지조성 공사라 할지라도, 상위 사업명이나 최종 목적이 '수변도시', '신도시', '단지', '택지' 조성이라면 반드시 '택지개발'로 판별해야 합니다. '간척·매립공사'는 위 분류에 없으므로 선택하지 마세요. 문서에 명시된 사업 목적을 기준으로 12개 중 가장 적합한 1개를 고르세요.",
        "target_docs": ["건설사업관리보고서", "준공검사보고서", "예비타당성조사", "타당성조사", "기본설계보고서"],
        "output_schema": {"사업유형": "string (12개 분류 중 하나)", "선택근거": "string"},
        "extraction_type": "structured",
    },
    "form3_project_name": {
        "form": "별지3호", "section": "1_overview",
        "category": "1. 건설공사 개요 | 공사개요",
        "label": "사업명",
        "query": "이 건설공사의 '사업명(사업 명칭)'을 찾으세요. 핵심 규칙: ①문서에서 '사업명'과 '공사명'이 구별되어 있다면, '사업명'에 해당하는 텍스트만 추출하세요. ②에시로 문서상 '사업명: 새만금 스마트 수변도시 조성사업', '공사명: 새만금 스마트 수변도시 매립공사' 라고 되어 있다면, 공사명 부분은 무시하고 '새만금 스마트 수변도시 조성사업'만 사업명으로 추출해야 합니다.",
        "target_docs": ["건설사업관리보고서", "준공검사보고서", "기본설계보고서", "예비타당성조사", "타당성조사"],
        "output_schema": {"사업명": "string", "사업코드": "string (있는 경우)"},
        "extraction_type": "structured",
    },
    "form3_construction_name": {
        "form": "별지3호", "section": "1_overview",
        "category": "1. 건설공사 개요 | 공사개요",
        "label": "공사명",
        "query": "이 건설공사의 공사명은?",
        "target_docs": ["준공검사보고서", "건설사업관리보고서"],
        "output_schema": {"공사명": "string"},
        "extraction_type": "structured",
    },
    "form3_location": {
        "form": "별지3호", "section": "1_overview",
        "category": "1. 건설공사 개요 | 공사개요",
        "label": "위치",
        "query": "이 건설공사의 위치(소재지, 구간)는 어디인가?",
        "target_docs": ["건설사업관리보고서", "준공검사보고서"],
        "output_schema": {"위치": "string", "구간": "string (시점~종점)"},
        "extraction_type": "structured",
    },
    "form3_history": {
        "form": "별지3호", "section": "1_overview",
        "category": "1. 건설공사 개요 | 공사개요",
        "label": "사업추진경위",
        "query": "이 건설사업의 사업추진경위를 시간순으로 정리해주세요. 예비타당성조사, 타당성조사, 설계, 착공, 준공 등 주요 일정을 포함하세요.",
        "target_docs": ["예비타당성조사", "타당성조사", "기본설계보고서", "건설사업관리보고서"],
        "output_schema": {},
        "extraction_type": "narrative",
        "target_length": 1500,
    },
    "form3_construction_type": {
        "form": "별지3호", "section": "1_overview",
        "category": "1. 건설공사 개요 | 공사개요",
        "label": "공사성격",
        "query": "이 건설공사의 '공사성격'을 판별하세요. ①신규 ②개보수·현대화 ③확장·증설 ④기타 중 하나. 판별 기준: 기존에 없던 시설을 새로 건설하는 공사(신축, 신설, 조성, 매립 등)면 '신규'입니다. 기존 시설을 고치거나 현대화하면 '개보수·현대화', 기존 시설을 확장하면 '확장·증설'입니다. 문서에 명시적인 단어가 없더라도 전체 공사 내용을 바탕으로 위 4가지 중 가장 적합한 하나를 무조건 선택하세요. 절대 null을 반환하지 마세요.",
        "target_docs": ["준공검사보고서", "건설사업관리보고서", "기본설계보고서", "예비타당성조사"],
        "output_schema": {"공사성격": "string (신규/개보수·현대화/확장·증설/기타)", "판별근거": "string"},
        "extraction_type": "structured",
    },
    "form3_bid_method": {
        "form": "별지3호", "section": "1_overview",
        "category": "1. 건설공사 개요 | 입찰·계약",
        "label": "도급방법",
        "query": "이 공사의 도급방법은? ①단독 ②공동도급(공동이행방식) ③공동도급(분담이행방식) ④공동도급(주계약자관리방식) 중 하나를 무조건 선택해야 합니다. 정보가 부족하더라도 도리어 유사한 표현을 찾아 유추하세요. 또한 입찰방식(종합심사/턴키/기술제안/대안 등)과 계약방식(제한경쟁/일반경쟁/지명경쟁/수의 등)도 컨텍스트에 명시되지 않았더라도 '경쟁', '종합' 등의 단어로 적극적으로 유추하여 채워넣으세요. 절대 null을 반환하지 말고, 도저히 알 수 없으면 '단독' 및 가장 일반적인 방식으로 가정한 뒤 판별근거에 기재하세요.",
        "target_docs": ["건설사업관리보고서", "준공검사보고서"],
        "output_schema": {"도급방법": "string", "입찰방식": "string", "계약방식": "string"},
        "extraction_type": "structured",
    },
    "form3_contract_type": {
        "form": "별지3호", "section": "1_overview",
        "category": "1. 건설공사 개요 | 입찰·계약",
        "label": "계약성질",
        "query": "이 공사의 계약성질은? ①장기계속공사 ②계속비 ③장기계속공사→계속비 전환공사 ④기타 중 해당하는 것을 선택하세요.",
        "target_docs": ["건설사업관리보고서", "준공검사보고서"],
        "output_schema": {"계약성질": "string (장기계속공사/계속비/전환공사/기타)"},
        "extraction_type": "structured",
    },
    "form3_participants": {
        "form": "별지3호", "section": "1_overview",
        "category": "1. 건설공사 개요 | 사업 참여자",
        "label": "사업 참여자",
        "query": "이 건설공사의 사업 참여자 정보를 정리해주세요: 예비타당성조사 업체, 타당성조사 업체, 기본설계 업체, 실시설계 업체, 시공 업체, 건설사업관리(감리) 업체의 업체명과 대표를 포함하세요.",
        "target_docs": ["건설사업관리보고서", "예비타당성조사", "타당성조사", "기본설계보고서", "실시설계보고서", "준공검사보고서"],
        "output_schema": {
            "예비타당성조사": {"업체명": "string", "대표": "string"},
            "타당성조사": {"업체명": "string", "대표": "string"},
            "기본설계": {"업체명": "string", "대표": "string"},
            "실시설계": {"업체명": "string", "대표": "string"},
            "시공": {"업체명": "string", "대표": "string"},
            "건설사업관리": {"업체명": "string", "대표": "string"},
        },
        "extraction_type": "structured",
    },

    # ════════════════════════════════════════
    # 별지 제3호: 2. 사업유형별 세부내용
    # ════════════════════════════════════════
    "form3_area_scale": {
        "form": "별지3호", "section": "2_details",
        "category": "2. 사업유형별 세부내용",
        "label": "공사면적 및 규모",
        "query": "이 건설공사의 공사면적(㎡)과 규모(연장, 면적 등)를 정리해주세요.",
        "target_docs": ["준공검사보고서", "건설사업관리보고서", "기본설계보고서"],
        "output_schema": {"공사면적": "string", "규모": "string", "주요시설": "string"},
        "extraction_type": "structured",
    },
    "form3_complaints_yn": {
        "form": "별지3호", "section": "2_details",
        "category": "2. 사업유형별 세부내용",
        "label": "시공중 민원 발생여부",
        "query": "시공 중 민원이 발생하였는가? 여기서 '민원'이란 반복민원, 집단민원, 국민권익위원회를 통해 들어온 민원 등 공사비 또는 공사기간 증가에 큰 영향을 끼친 민원을 의미합니다. 단순한 소음 민원이나 일상적 민원은 포함하지 않습니다. 이러한 민원이 발생하였으면 '발생', 아니면 '미발생'을 선택하세요.",
        "target_docs": ["건설사업관리보고서", "준공검사보고서"],
        "output_schema": {"민원발생여부": "string (발생/미발생)", "민원건수": "number", "주요민원내용": "string"},
        "extraction_type": "structured",
    },
    "form3_uniqueness_yn": {
        "form": "별지3호", "section": "2_details",
        "category": "2. 사업유형별 세부내용",
        "label": "사업 특이성 유무",
        "query": "이 사업의 특이성이 있는가? (특수공법, 난이도 높은 공사, 환경적 제약 등)",
        "target_docs": ["건설사업관리보고서", "준공검사보고서"],
        "output_schema": {"특이성유무": "string (유/무)", "특이성개요": "string"},
        "extraction_type": "structured",
    },

    # ════════════════════════════════════════
    # 별지 제3호: 3. 수행성과평가 — 공사비
    # ════════════════════════════════════════
    "form3_cost_estimated": {
        "form": "별지3호", "section": "3_performance",
        "category": "3. 수행성과평가 | 공사비",
        "label": "추정 공사비",
        "query": "이 건설사업의 각 단계별 추정 '공사비'를 찾으세요. 단계: ①예비타당성조사 ②타당성조사 ③기본설계 ④실시설계. 주의사항: 각 단계별 '총사업비'(예: 790,047 백만원 등)가 아니라 그 안의 '공사비' 단일 항목 금액(예: 수백~수천억원대)만을 추출하세요. 각 공사비를 백만원 단위 숫자로 산출하세요.",
        "target_docs": ["예비타당성조사", "타당성조사", "기본설계보고서", "실시설계보고서", "건설사업관리보고서"],
        "output_schema": {
            "예비타당성조사": "number (백만원)",
            "타당성조사": "number (백만원)",
            "기본설계": "number (백만원)",
            "실시설계": "number (백만원)",
            "단위": "string"
        },
        "extraction_type": "structured",
    },
    "form3_cost_contract": {
        "form": "별지3호", "section": "3_performance",
        "category": "3. 수행성과평가 | 공사비",
        "label": "계약 공사비",
        "query": "시공 공사의 '최초(당초) 계약 공사비'를 백만원 단위 숫자로만 추출하세요. 필수 주의: ①'전체공사 증감 대비표' 혹은 '준공정산 및 변경계약 검토보고'에서 '최초(당초) 계약 공사비 총액'을 찾으세요. ②부분이나 개별 공종의 금액이 아니라 본 공사 전체(1~N차 도급분 + 관급분 전체)의 당초 계약액 총합계여야 합니다. (예: 122,534 백만원 등)",
        "target_docs": ["준공검사보고서", "건설사업관리보고서", "시공내역서", "기타"],
        "output_schema": {"계약공사비": "number (백만원)", "단위": "string", "계약일자": "string"},
        "extraction_type": "structured",
    },
    "form3_cost_actual": {
        "form": "별지3호", "section": "3_performance",
        "category": "3. 수행성과평가 | 공사비",
        "label": "실제 공사비(준공시점)",
        "query": "시공 공사의 전체 '실제 공사비(준공정산 및 변경계약 등 모든 것이 반영된 최종 준공금액)'를 백만원 단위 숫자로 추출하세요. 필수 주의: ①설계변경·물가변동 반영 후 전체 공사 최종액(예: 141,984 백만원 등)을 도출해야 합니다. ②단일 공종이나 특정 관급 금액만 일부 추출하면 안 되며, 반드시 '총 준공금액 합계'를 찾으세요.",
        "target_docs": ["준공검사보고서", "건설사업관리보고서", "기타"],
        "output_schema": {"실제공사비": "number (백만원)", "단위": "string", "정산근거": "string"},
        "extraction_type": "structured",
    },
    "form3_cost_compensation_est": {
        "form": "별지3호", "section": "3_performance",
        "category": "3. 수행성과평가 | 보상비",
        "label": "보상 추정 금액",
        "query": "이 사업의 '보상비(토지보상, 용지보상, 지장물 보상 등)' 추정 금액을 백만원 단위로 추출하세요. 예비타당성조사나 타당성조사, 설계보고서에서 산정한 보상비 추정치를 찾으세요. 보상비가 영('0')이거나 해당사항이 없으면 0으로 기재하세요.",
        "target_docs": ["예비타당성조사", "타당성조사", "기본설계보고서", "실시설계보고서"],
        "output_schema": {"보상추정금액": "number (백만원)", "단위": "string", "산정근거": "string"},
        "extraction_type": "structured",
    },
    "form3_cost_compensation_actual": {
        "form": "별지3호", "section": "3_performance",
        "category": "3. 수행성과평가 | 보상비",
        "label": "실집행 보상비",
        "query": "이 사업에서 실제 집행된 '보상비(토지보상, 용지보상)'는 얼마인가? 백만원 단위로 추출하세요. 보상비가 영('0')이거나 해당사항이 없으면 0으로 기재하세요.",
        "target_docs": ["건설사업관리보고서", "준공검사보고서", "기타"],
        "output_schema": {"실집행보상비": "number (백만원)", "단위": "string"},
        "extraction_type": "structured",
    },
    "form3_cost_feasibility": {
        "form": "별지3호", "section": "3_performance",
        "category": "3. 수행성과평가 | 타당성조사비",
        "label": "타당성조사비",
        "query": "'타당성조사' 용역의 계약금액과 준공금액은 각각 얼마인가? 백만원 단위로 답변하세요. 주의: '예비타당성조사'가 아닌 '타당성조사(타당성 평가)' 용역비입니다.",
        "target_docs": ["타당성조사", "건설사업관리보고서", "준공검사보고서"],
        "output_schema": {"계약금액": "number (백만원)", "준공금액": "number (백만원)", "단위": "string"},
        "extraction_type": "structured",
    },
    "form3_cost_basic_design": {
        "form": "별지3호", "section": "3_performance",
        "category": "3. 수행성과평가 | 설계비",
        "label": "기본설계비",
        "query": "'기본설계' 설계 용역의 계약금액과 준공금액을 각각 찾고 백만원 단위 숫자로 산출하세요. 주의사항: ①기본설계 용역비용만 추출하며(예: 714 백만원 수준), 실시설계나 타 용역과 혼동하지 마세요. 통상 수억~십몇억 원 선입니다.",
        "target_docs": ["기본설계보고서", "건설사업관리보고서", "준공검사보고서"],
        "output_schema": {"계약금액": "number (백만원)", "준공금액": "number (백만원)", "단위": "string"},
        "extraction_type": "structured",
    },
    "form3_cost_detail_design": {
        "form": "별지3호", "section": "3_performance",
        "category": "3. 수행성과평가 | 설계비",
        "label": "실시설계비",
        "query": "'실시설계' 용역의 계약금액과 준공금액은 각각 얼마인가? 백만원 단위로 답변하세요. 주의: ①'기본설계'가 아닌 '실시설계' 설계비입니다. ②'건설사업관리비(감리비)'와 혼동하지 마세요.",
        "target_docs": ["실시설계보고서", "건설사업관리보고서", "준공검사보고서"],
        "output_schema": {"계약금액": "number (백만원)", "준공금액": "number (백만원)", "단위": "string"},
        "extraction_type": "structured",
    },
    "form3_cost_cm": {
        "form": "별지3호", "section": "3_performance",
        "category": "3. 수행성과평가 | 건설사업관리비",
        "label": "건설사업관리비",
        "query": "'건설사업관리(CM, 감리)' 용역의 계약금액과 준공금액은 각각 얼마인가? 백만원 단위로 답변하세요. 주의: 시공 공사비가 아닌 건설사업관리(감리) 용역비입니다.",
        "target_docs": ["건설사업관리보고서", "준공검사보고서"],
        "output_schema": {"계약금액": "number (백만원)", "준공금액": "number (백만원)", "단위": "string"},
        "extraction_type": "structured",
    },

    # ── 공사기간 ──
    "form3_period_estimated": {
        "form": "별지3호", "section": "3_performance",
        "category": "3. 수행성과평가 | 공사기간",
        "label": "추정 공사기간",
        "query": "예비타당성조사 또는 타당성조사에서 추정한 '이 공사의 공사기간'은 몇 개월인가? 가능하면 추정 착공일~준공일도 함께 추출하세요.",
        "target_docs": ["예비타당성조사", "타당성조사", "기본설계보고서", "실시설계보고서"],
        "output_schema": {"추정공사기간": "string", "개월수": "number", "추정근거": "string"},
        "extraction_type": "structured",
    },
    "form3_period_contract": {
        "form": "별지3호", "section": "3_performance",
        "category": "3. 수행성과평가 | 공사기간",
        "label": "계약 공사기간",
        "query": "시공 공사의 '최초(당초) 계약 공사기간'을 추출하세요. ①착공일(YYYY.MM.DD)~준공예정일(YYYY.MM.DD) 형식으로 찾으세요. ②총 개월 수도 기재하세요. ③연장된 기간이 아닌 최초 계약 시점의 기간입니다. ④이 공사는 다수 차수로 구성된 공사일 수 있습니다. 전체 공사의 착공일~준공예정일을 기재하세요.",
        "target_docs": ["준공검사보고서", "건설사업관리보고서"],
        "output_schema": {"착공일": "string (YYYY.MM.DD)", "준공예정일": "string (YYYY.MM.DD)", "공사기간_개월": "number"},
        "extraction_type": "structured",
    },
    "form3_period_actual": {
        "form": "별지3호", "section": "3_performance",
        "category": "3. 수행성과평가 | 공사기간",
        "label": "실제 공사기간",
        "query": "시공 공사의 '실제 공사기간'을 추출하세요. ①착공일(YYYY.MM.DD)~실제준공일(YYYY.MM.DD) 형식으로 찾으세요. ②총 개월 수도 기재하세요. ③공기연장, 설계변경 등으로 확장된 실제 기간입니다. ④준공검사 보고서에서 '준공일'을 찾으세요.",
        "target_docs": ["준공검사보고서", "건설사업관리보고서"],
        "output_schema": {"착공일": "string (YYYY.MM.DD)", "실제준공일": "string (YYYY.MM.DD)", "실제공사기간_개월": "number"},
        "extraction_type": "structured",
    },

    # ── 설계변경/기타성과 ──
    "form3_design_change": {
        "form": "별지3호", "section": "3_performance",
        "category": "3. 수행성과평가 | 설계변경",
        "label": "시공 중 설계변경",
        "query": "시공 중 설계변경이 몇 건이었으며, 총 증감액은 얼마인가? '전체공사 증감 대비표'나 '설계변경 검토 보고', '건설사업관리보고서' 내 설계변경 현황을 참조하세요. 백만원 단위로 답변하세요.",
        "target_docs": ["설계변경보고서", "건설사업관리보고서", "준공검사보고서", "기타"],
        "output_schema": {"설계변경_건수": "number", "증감액_합계": "number (백만원)", "주요변경사유": "string"},
        "extraction_type": "structured",
    },
    "form3_smart_tech": {
        "form": "별지3호", "section": "3_performance",
        "category": "3. 수행성과평가 | 기타 성과",
        "label": "스마트 건설기술 적용",
        "query": "이 공사에서 적용한 스마트 건설기술을 다음 중에서 복수 선택하세요: ①BIM ②드론 ③IoT·센서 ④AI ⑤로봇 ⑥원격(CCTV 등) ⑦기타. 적용 사실이 없으면 '무'로 답변하세요.",
        "target_docs": ["건설사업관리보고서", "준공검사보고서"],
        "output_schema": {"적용기술목록": "string[]", "적용여부": "string (유/무)"},
        "extraction_type": "structured",
    },
    "form3_complaint_count": {
        "form": "별지3호", "section": "3_performance",
        "category": "3. 수행성과평가 | 기타 성과",
        "label": "시공 중 민원 건수",
        "query": "시공 중 발생한 민원 건수는? 여기서 민원이란 공사비/공기 증가에 영향을 미친 반복·집단·국민권익위 민원을 의미합니다. 해당이 없으면 0건입니다.",
        "target_docs": ["건설사업관리보고서", "준공검사보고서"],
        "output_schema": {"민원건수": "number", "주요민원유형": "string"},
        "extraction_type": "structured",
    },
    "form3_accident_count": {
        "form": "별지3호", "section": "3_performance",
        "category": "3. 수행성과평가 | 기타 성과",
        "label": "안전사고(재해) 건수",
        "query": "시공 중 발생한 안전사고(재해) 건수는?",
        "target_docs": ["건설사업관리보고서"],
        "output_schema": {"안전사고건수": "number", "재해유형": "string"},
        "extraction_type": "structured",
    },
    "form3_rework_count": {
        "form": "별지3호", "section": "3_performance",
        "category": "3. 수행성과평가 | 기타 성과",
        "label": "재시공 건수",
        "query": "시공 중 재시공 건수는?",
        "target_docs": ["건설사업관리보고서"],
        "output_schema": {"재시공건수": "number", "주요원인": "string"},
        "extraction_type": "structured",
    },
    "form3_uniqueness_detail": {
        "form": "별지3호", "section": "3_performance",
        "category": "3. 수행성과평가 | 기타 성과",
        "label": "사업 특이성 상세내용",
        "query": "이 사업의 특이성 상세 내용을 서술하세요.",
        "target_docs": ["건설사업관리보고서"],
        "output_schema": {},
        "extraction_type": "narrative",
        "target_length": 1000,
    },

    # ════════════════════════════════════════
    # 별지 제4호: 사업수행성과 평가 결과보고서
    # ════════════════════════════════════════
    "form4_cost_analysis": {
        "form": "별지4호", "section": "4_1_cost",
        "category": "1. 공사비 및 공사기간 분석",
        "label": "공사비·공사기간 증감 원인",
        "query": "공사비와 공사기간의 증감 원인을 분석하세요. 다음 6가지 원인별로 구분하여 작성: ①계획관련(예비타당성/타당성조사 단계 추정 부정확 등) ②보상관련(용지보상 지연/추가보상 등) ③설계관련(설계변경, 설계오류, 지질조건 변경 등) ④시공관련(공법변경, 물가변동, 자재가격 상승 등) ⑤외부요인(기상악화, 코로나, 민원, 관련기관 협의 지연 등) ⑥기타. 각 원인별로 증감 금액(백만원)과 증감 기간(개월)을 구체적으로 기술하세요. '전체공사 증감 대비표', '설계변경 검토 보고', '건설사업관리보고서 공사비 변경 현황' 등을 참조하세요.",
        "target_docs": ["건설사업관리보고서", "설계변경보고서", "준공검사보고서", "기타"],
        "output_schema": {},
        "extraction_type": "narrative",
        "target_length": 2000,
    },
    "form4_similar_caution": {
        "form": "별지4호", "section": "4_1_cost",
        "category": "1. 공사비 및 공사기간 분석",
        "label": "유사사업 수행 시 주의사항",
        "query": "공사비·공사기간 증감 원인 분석을 바탕으로, 향후 유사사업(매립·택지조성 등) 수행 시 주의사항을 작성하세요. 이 공사에서 경험한 ①설계변경 발생 원인과 예방대책 ②공사비 증가 요인과 절감 방안 ③공기 지연 원인과 대응 방안 ④현장 여건(해상공사, 연약지반 등)에 따른 유의점 등을 포함하세요.",
        "target_docs": ["건설사업관리보고서", "준공검사보고서"],
        "output_schema": {},
        "extraction_type": "narrative",
        "target_length": 1000,
    },
    "form4_design_change_detail": {
        "form": "별지4호", "section": "4_2_design",
        "category": "2. 공사 중 설계변경 내용",
        "label": "설계변경별 증감액 및 내용",
        "query": "공사 중 진행된 설계변경을 각 회차별로 정리하세요. 각 설계변경에 대해: ①회차(1회, 2회...) ②변경 사유(~에 따른 설계변경) ③증감액(백만원) ④주요 변경 내용(공종, 수량 변경 등)을 표 형식으로 작성하세요. '설계변경 검토 보고', '전체공사 증감 대비표', '건설사업관리보고서 설계변경 현황'을 참조하세요.",
        "target_docs": ["설계변경보고서", "건설사업관리보고서", "기타"],
        "output_schema": {},
        "extraction_type": "narrative",
        "target_length": 2000,
    },
    "form4_design_change_analysis": {
        "form": "별지4호", "section": "4_2_design",
        "category": "2. 공사 중 설계변경 내용",
        "label": "설계변경 상세 (원인/조치/결과)",
        "query": "주요 설계변경 건의 상세 내용을 서술하세요. 각 주요 설계변경에 대해: ①원인(왜 변경이 필요했는가? 현장여건 변경, 발주처 요구, 관련법규 변경 등) ②조치사항(어떤 설계를 어떻게 변경했는가? 공법, 구조, 수량 등) ③결과(변경 후 공사비/공기 영향, 품질 변화 등)를 서술하세요. 가능하면 사진이나 도면 참조 위치도 기재하세요.",
        "target_docs": ["설계변경보고서", "건설사업관리보고서", "기타"],
        "output_schema": {},
        "extraction_type": "narrative",
        "target_length": 2000,
    },
    "form4_uniqueness_overview": {
        "form": "별지4호", "section": "4_3_unique",
        "category": "3. 사업의 특이성",
        "label": "사업의 특이성 개요",
        "query": "이 사업의 특이성을 개요 형태로 서술하세요. 다음 관점에서 분석: ①현장여건(해상공사, 간척지, 연약지반, 조위 영향 등) ②시공난이도(대규모 매립, 제방축조, 해상작업 등) ③환경적 제약(해양환경 보전, 오탁방지, 수질관리 등) ④기타 특수사항. 구체적인 공종명과 수량을 포함하여 서술하세요.",
        "target_docs": ["건설사업관리보고서", "기본설계보고서", "준공검사보고서"],
        "output_schema": {},
        "extraction_type": "narrative",
        "target_length": 1500,
    },
    "form4_uniqueness_effort": {
        "form": "별지4호", "section": "4_3_unique",
        "category": "3. 사업의 특이성",
        "label": "특이성 해결을 위한 노력",
        "query": "사업의 특이성을 해결하기 위해 어떤 노력을 했는지 서술하세요. ①특수공법 적용(PBD공법, 사석투하, 오탁방지막 등) ②품질관리 강화(검측, 시험, 모니터링 등) ③안전관리(해상작업 안전, 기상 대응 등) ④환경관리(수질모니터링, 비산먼지 관리 등) ⑤공정관리(기상 영향 최소화, 야간작업 등) 관점에서 구체적으로 서술하세요.",
        "target_docs": ["건설사업관리보고서", "준공검사보고서"],
        "output_schema": {},
        "extraction_type": "narrative",
        "target_length": 1500,
    },
    "form4_smart_tech": {
        "form": "별지4호", "section": "4_4_smart",
        "category": "4. 스마트 건설기술 적용",
        "label": "스마트 건설기술 적용 상세",
        "query": "적용한 스마트 건설기술을 상세히 서술하세요. 각 기술별로: ①기술명 ②적용목적(왜 적용했는가) ③적용방법(어디에 어떻게 적용했는가) ④적용결과(효과, 성과)를 기술하세요. 스마트 건설기술 예시: BIM, 드론 측량, IoT 센서, CCTV 원격감시, AI 기반 품질관리 등. 적용 사실이 없으면 '해당없음'으로 작성하세요.",
        "target_docs": ["건설사업관리보고서", "준공검사보고서"],
        "output_schema": {},
        "extraction_type": "narrative",
        "target_length": 1500,
    },
    "form4_complaint_detail": {
        "form": "별지4호", "section": "4_5_complaint",
        "category": "5. 시공 중 민원",
        "label": "민원 상세 내용 및 처리 결과",
        "query": """시공 중 발생한 주요 민원의 상세 내용과 처리 결과를 다음 문서 구조에 맞추어 명확하고 정갈하게 작성하세요. (표 형태를 대신하여 구분이 명확한 텍스트 기호 사용)
[주의사항] 발주처-시공사 간의 안전지시 문서, 단순 실정보고, 협조요청, 검토보고서 등 내부 공문 수발신 내역은 "민원"이 아닙니다. 실제 외부(지역주민, 환경단체, 관련기관 등)로부터 제기된 민원 사실만을 민원으로 판단하세요. 만약 실제 외부 민원이 발생하지 않았다고 판단되면 억지로 생성하지 말고 "민원 미발생"이라고 작성하세요.

[가. 민원 상세 내용 및 처리 결과]
■ 민원 내용
- (실제 발생한 외부 민원 요약 서술, 없으면 "시공 중 접수 및 처리된 주요 외부 민원 내역 없음" 기재)

■ 민원 상세 및 발생 원인
- 발생원인 : (민원이 없는 경우 해당없음 기재)
- 상세현황 : (민원이 없는 경우 해당없음 기재)
(※ 문서 원본에 현장 사진이나 조감도 등 관련 이미지가 존재할 경우 [사진: OO 관련 사진] 형태로 캡션을 묘사하여 기재할 것)

■ 민원 대응 노력 및 결과
- (해결을 위해 노력한 조치사항, 보상 협의, 처리 결과 등을 개조식으로 작성, 없으면 해당없음 기재)""",
        "target_docs": ["건설사업관리보고서"],
        "output_schema": {},
        "extraction_type": "narrative",
        "target_length": 1500,
    },
    "form4_complaint_caution": {
        "form": "별지4호", "section": "4_5_complaint",
        "category": "5. 시공 중 민원",
        "label": "민원 관련 유사사업 주의사항",
        "query": """민원 발생 원인 및 해결 과정에서 얻은 교훈을 바탕으로, 향후 유사사업 수행 시 주의해야 하는 사항을 구체적으로 도출하여 서술하세요.

[나. 민원 관련 유사사업 수행 시 주의사항]
○ (유의사항 내용 1 - 발생 가능한 민원 사전 예방관점)
○ (유의사항 내용 2)
○ (유의사항 내용 3)""",
        "target_docs": ["건설사업관리보고서"],
        "output_schema": {},
        "extraction_type": "narrative",
        "target_length": 1000,
    },
    "form4_accident_detail": {
        "form": "별지4호", "section": "4_6_accident",
        "category": "6. 안전사고(재해)",
        "label": "안전사고 상세 내용 및 처리 결과",
        "query": """시공 중 발생한 주요 안전사고의 상세 내용과 처리 결과를 다음의 구조에 맞추어 명확하게 작성하세요. 

[가. 안전사고(재해) 상세 내용 및 처리 결과]
■ 안전사고(재해) 내용
- (예: 굴삭기 장비 전도 사고로 인한 사망사고 등 사고 핵심 요약)

■ 안전사고(재해) 상세 및 발생 원인
- 주원인 : (직접적/간접적 사고 발생 원인)
- 발생정황 : (언제 어디서 어떤 작업 중 발생했는지 상세 서술)
(※ 문서 원본에 사고 현장 사진이 있다면 [사진: OO사고 현장 전경] 등 사진 삽입 위치를 묘사할 것)

■ 안전사고(재해) 대응 노력 및 결과
- (사고발생에 대한 현장 조사 내용)
- (공사중지 지시, 종합정보망 신고, 특별안전교육 실시 등 후속 대응 조치사항 개조식 서술)""",
        "target_docs": ["건설사업관리보고서"],
        "output_schema": {},
        "extraction_type": "narrative",
        "target_length": 1500,
    },
    "form4_accident_caution": {
        "form": "별지4호", "section": "4_6_accident",
        "category": "6. 안전사고(재해)",
        "label": "안전사고 관련 유사사업 주의사항",
        "query": """안전사고 원인 조사 및 재발방지 조치 결과를 바탕으로, 향후 유사 사업 수행 시 주의해야 하는 사항을 구체적으로 도출하여 서술하세요.

[나. 안전사고(재해) 관련 유사사업 수행 시 주의사항]
○ (예방 대책 1 - 장비 사용, 안전수칙 관련)
○ (예방 대책 2)
○ (예방 대책 3)""",
        "target_docs": ["건설사업관리보고서"],
        "output_schema": {},
        "extraction_type": "narrative",
        "target_length": 1000,
    },
    "form4_rework_detail": {
        "form": "별지4호", "section": "4_7_rework",
        "category": "7. 재시공",
        "label": "재시공 상세 내용 및 처리 결과",
        "query": """시공 중 발생한 주요 재시공(부실시공 보완 등)의 상세 내용과 처리 결과를 다음의 구조에 맞추어 작성하세요.

[가. 재시공 상세 내용 및 처리 결과]
■ 재시공 대상 및 내용
- (재시공이 발생한 주요 구간, 수량, 공종 요약)

■ 재시공 상세 및 발생 원인
- 주원인 : (설계 시공 지질 등 핵심 원인)
- 추진경위 : (발생 및 발견 정황 서술)
(※ 문서 내 관련 현장 조치 전/후 사진이 존재하면 [사진: 조치 전후 전경] 형태로 묘사)

■ 재시공 대응 노력 및 결과
- (재시공 방안 협의 및 조치 내역)
- (조치 후 품질검사 결과 등)""",
        "target_docs": ["건설사업관리보고서"],
        "output_schema": {},
        "extraction_type": "narrative",
        "target_length": 1500,
    },
    "form4_rework_caution": {
        "form": "별지4호", "section": "4_7_rework",
        "category": "7. 재시공",
        "label": "재시공 관련 유사사업 주의사항",
        "query": """재시공 발생 원인 및 처리 결과를 바탕으로, 향후 유사사업 수행 시 부실시공 및 재시공을 막기위한 주의사항을 개조식으로 서술하세요.

[나. 재시공 관련 유사사업 수행 시 주의사항]
○ (유의사항 내용 1 - 시방서 철저, 품질 검증 등)
○ (유의사항 내용 2)
○ (유의사항 내용 3)""",
        "target_docs": ["건설사업관리보고서"],
        "output_schema": {},
        "extraction_type": "narrative",
        "target_length": 1000,
    },
    "form4_conclusion": {
        "form": "별지4호", "section": "4_8_conclusion",
        "category": "8. 결론",
        "label": "종합 결론",
        "query": "이 건설공사의 사후평가 종합 결론을 작성하세요. 다음 항목별 자체평가를 포함: ①공사비 변동 평가(계약 대비 준공 금액 증감률 및 원인) ②공사기간 변동 평가(계약 대비 실제 기간 증감 및 원인) ③설계변경 평가(설계변경 건수, 주요 원인, 개선방안) ④민원 평가(민원 발생 여부 및 처리) ⑤안전사고 평가(재해 건수 및 예방 대책) ⑥재시공 평가(재시공 건수 및 원인). 각 항목에 구체적인 수치를 포함하여 개조식으로 작성하세요.",
        "target_docs": ["건설사업관리보고서", "준공검사보고서", "기타"],
        "output_schema": {},
        "extraction_type": "narrative",
        "target_length": 2000,
    },
    "form4_feedback_plan": {
        "form": "별지4호", "section": "4_8_conclusion",
        "category": "8. 결론",
        "label": "사후평가 환류 계획",
        "query": "추후 사후평가 환류 계획을 작성하세요. ①이 사업에서 도출된 교훈(Lessons Learned) ②향후 유사사업에 반영할 개선사항 ③사후평가 결과의 환류 방법(DB화, 매뉴얼 반영, 교육 등) ④후속 조치 계획을 포함하여 작성하세요.",
        "target_docs": ["건설사업관리보고서", "준공검사보고서"],
        "output_schema": {},
        "extraction_type": "narrative",
        "target_length": 1000,
    },
}


class ParsingEngine:
    """벡터검색 + LLM 기반 데이터 추출 엔진"""

    def __init__(self):
        self.settings = get_settings()
        genai.configure(api_key=self.settings.gemini_api_key)

    async def extract_field(self, session, project_id: int, field_id: str) -> dict:
        if field_id not in FIELD_QUERY_MAP:
            return {"error": f"알 수 없는 필드: {field_id}"}
        template = FIELD_QUERY_MAP[field_id]

        # ── 쿼리 임베딩 ──
        query_embed = genai.embed_content(
            model=self.settings.embedding_model,
            content=template["query"],
            task_type="retrieval_query",
        )

        # ── 벡터 검색 ──
        n = 20 if template["extraction_type"] == "narrative" else 15
        search_results = await vector_store.search(
            session=session, project_id=project_id,
            query_embedding=query_embed["embedding"],
            n_results=n, doc_type_filter=template.get("target_docs"),
        )
        if not search_results:
            return {
                "field_id": field_id, "label": template["label"],
                "value": None, "confidence": 0.0,
                "error": "관련 컨텍스트를 찾을 수 없습니다", "source_refs": [],
            }

        context_text = self._build_context(search_results)

        # ── LLM 추출 ──
        if template["extraction_type"] == "narrative":
            result = await self._extract_narrative(template, context_text)
        else:
            result = await self._extract_structured(template, context_text)

        return {
            "field_id": field_id,
            "form": template["form"],
            "section": template.get("section", ""),
            "category": template["category"],
            "label": template["label"],
            "extraction_type": template["extraction_type"],
            "value": result,
            "confidence": self._calc_confidence(result, search_results),
            "source_refs": [
                {
                    "source_file": r["metadata"]["source_file"],
                    "page_num": r["metadata"]["page_num"],
                    "doc_type": r["metadata"]["doc_type"],
                    "score": round(r["score"], 4),
                    "text_preview": r["text"][:120],
                }
                for r in search_results
            ],
            "context_chunks_used": len(search_results),
        }

    async def extract_all_fields(self, session, project_id: int, field_ids: list[str] | None = None) -> list[dict]:
        targets = field_ids or list(FIELD_QUERY_MAP.keys())
        results = []
        for field_id in targets:
            result = await self.extract_field(session, project_id, field_id)
            results.append(result)
        return results

    async def _extract_structured(self, template: dict, context: str) -> dict:
        schema_str = json.dumps(template["output_schema"], ensure_ascii=False, indent=2)
        prompt = f"""아래 컨텍스트를 분석하여 질문에 답하세요.

## 추출 대상: **{template["label"]}**
## 질문: {template["query"]}

## 출력 JSON 스키마
```json
{schema_str}
```
**추가 필수 필드:** "출처문서", "출처페이지", "신뢰도" (high/medium/low), "not_found_reason" (없으면 null)

## 컨텍스트
{context}
"""
        model = genai.GenerativeModel(self.settings.gemini_model, system_instruction=EXTRACTION_SYSTEM_PROMPT)
        response = model.generate_content(prompt, generation_config=genai.GenerationConfig(
            response_mime_type="application/json", temperature=0.1))
        try:
            return json.loads(response.text)
        except json.JSONDecodeError:
            return {"raw_response": response.text, "parse_error": True}

    async def _extract_narrative(self, template: dict, context: str) -> dict:
        target_len = template.get("target_length", 1500)
        prompt = f"""아래 컨텍스트를 분석하여 다음 항목을 작성하세요.

## 작성 항목: **{template["label"]}**
## 작성 지시: {template["query"]}
## 목표 분량: {target_len}자 내외

## 컨텍스트
{context}

## 출력 형식 (JSON)
{{
  "content": "작성된 서술 내용 ({target_len}자 내외)",
  "char_count": 실제 글자 수,
  "key_facts": ["핵심 사실 1", "핵심 사실 2", ...],
  "출처문서": ["참조한 문서명1", "참조한 문서명2"],
  "신뢰도": "high/medium/low"
}}
"""
        model = genai.GenerativeModel(self.settings.gemini_model, system_instruction=SUMMARY_SYSTEM_PROMPT)
        response = model.generate_content(prompt, generation_config=genai.GenerationConfig(
            response_mime_type="application/json", temperature=0.3))
        try:
            return json.loads(response.text)
        except json.JSONDecodeError:
            return {"raw_response": response.text, "parse_error": True}

    def _build_context(self, search_results: list[dict]) -> str:
        parts = []
        for i, r in enumerate(search_results):
            meta = r["metadata"]
            parts.append(f"[출처 {i+1}] {meta['source_file']} / p.{meta['page_num']} / {meta['doc_type']}\n{r['text']}")
        return "\n\n---\n\n".join(parts)

    def _calc_confidence(self, extracted: dict, search_results: list[dict]) -> float:
        llm_conf = extracted.get("신뢰도", "medium") if isinstance(extracted, dict) else "medium"
        base = {"high": 0.9, "medium": 0.7, "low": 0.4}.get(llm_conf, 0.5)
        top_scores = [r["score"] for r in search_results[:3]]
        avg_score = sum(top_scores) / len(top_scores) if top_scores else 0
        if isinstance(extracted, dict) and extracted.get("not_found_reason"):
            return 0.1
        return round(min(base * 0.6 + avg_score * 0.4, 1.0), 3)
