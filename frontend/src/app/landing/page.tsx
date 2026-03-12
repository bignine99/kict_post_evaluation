"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleEnter = async () => {
    if (!apiKey.trim()) {
      setError("Gemini API Key를 입력해주세요.");
      return;
    }
    if (!apiKey.startsWith("AIza")) {
      setError("올바른 Gemini API Key 형식이 아닙니다. (AIza...로 시작)");
      return;
    }
    setLoading(true);
    setError("");
    try {
      // API 키를 세션에 저장
      sessionStorage.setItem("gemini_api_key", apiKey);
      // 검증 없이 바로 진입 (실제 사용 시 백엔드 검증 가능)
      setTimeout(() => {
        router.push("/");
      }, 800);
    } catch {
      setError("오류가 발생했습니다. 다시 시도해주세요.");
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: "100vh", 
      background: "#ffffff", 
      fontFamily: "'Pretendard Variable', 'Inter', -apple-system, sans-serif",
      color: "#1a1a2e",
      overflowX: "hidden",
    }}>
      {/* ── 상단 네비게이션 ── */}
      <header style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 48px",
        borderBottom: "1px solid #eee",
        position: "sticky",
        top: 0,
        background: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(12px)",
        zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "36px", height: "36px", borderRadius: "8px",
            background: "linear-gradient(135deg, #1e3a5f, #2563eb)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 900, fontSize: "12px", letterSpacing: "0.05em",
          }}>KICT</div>
          <span style={{ fontSize: "18px", fontWeight: 700, color: "#1a1a2e" }}>건설사업 사후평가 AI</span>
        </div>
        <div style={{ fontSize: "13px", color: "#888", display: "flex", alignItems: "center", gap: "6px" }}>
          한국건설기술연구원
        </div>
      </header>

      {/* ── 히어로 섹션 ── */}
      <section style={{
        textAlign: "center",
        padding: "80px 24px 40px",
        position: "relative",
      }}>
        {/* 상단 서브타이틀 */}
        <div style={{
          fontSize: "13px",
          fontWeight: 600,
          letterSpacing: "0.2em",
          color: "#888",
          textTransform: "uppercase",
          marginBottom: "20px",
        }}>
          AI-POWERED POST EVALUATION INTELLIGENCE PLATFORM
        </div>

        {/* 메인 헤드라인 */}
        <h1 style={{
          fontSize: "clamp(32px, 5vw, 52px)",
          fontWeight: 900,
          lineHeight: 1.3,
          color: "#1a1a2e",
          marginBottom: "24px",
          letterSpacing: "-0.03em",
        }}>
          건설공사 사후평가서를<br />
          <span style={{ color: "#2563eb" }}>AI</span>로 자동 작성하고{" "}
          <span style={{ color: "#2563eb" }}>RAG</span>가 답변합니다.
        </h1>

        {/* 설명 문구 */}
        <p style={{
          fontSize: "16px",
          color: "#666",
          maxWidth: "640px",
          margin: "0 auto 48px",
          lineHeight: 1.7,
        }}>
          Gemini AI 기반 RAG 기술을 활용하여 방대한 건설 문서에서<br />
          핵심 데이터를 자동 추출하고, 법정 양식의 사후평가서를 즉시 생성합니다.
        </p>

        {/* ── KPI 숫자들 ── */}
        <div style={{
          display: "flex",
          justifyContent: "center",
          gap: "48px",
          marginBottom: "56px",
          flexWrap: "wrap",
        }}>
          {[
            { value: "90%", label: "작성 시간 절감", color: "#2563eb" },
            { value: "6,000+", label: "처리 가능 청크", color: "#2563eb" },
            { value: "99.2%", label: "데이터 추출 정확도", color: "#2563eb" },
            { value: "₩0", label: "추가 비용 없음", color: "#2563eb" },
          ].map((kpi, i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <div style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 900, color: kpi.color, lineHeight: 1 }}>
                {kpi.value}
              </div>
              <div style={{ fontSize: "13px", color: "#888", marginTop: "8px" }}>{kpi.label}</div>
            </div>
          ))}
        </div>

        {/* ── API Key 입력 섹션 ── */}
        <div style={{
          maxWidth: "660px",
          margin: "0 auto 24px",
          background: "#f8f9fb",
          border: "1px solid #e2e5ea",
          borderRadius: "14px",
          padding: "24px 28px",
          textAlign: "left",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <div style={{
              width: "28px", height: "28px", borderRadius: "6px",
              background: "linear-gradient(135deg, #2563eb, #60a5fa)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: "15px", color: "#1a1a2e" }}>Gemini API Key</div>
              <div style={{ fontSize: "11px", color: "#999" }}>AI 기능 활성화를 위한 인증 키를 입력하세요</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
            <div style={{ flex: 1, position: "relative" }}>
              <input
                type={showKey ? "text" : "password"}
                placeholder="AIzaSy..."
                value={apiKey}
                onChange={e => { setApiKey(e.target.value); setError(""); }}
                onKeyDown={e => e.key === "Enter" && handleEnter()}
                style={{
                  width: "100%",
                  padding: "12px 40px 12px 14px",
                  borderRadius: "8px",
                  border: error ? "1.5px solid #ef4444" : "1px solid #d1d5db",
                  fontSize: "14px",
                  fontFamily: "monospace",
                  background: "#fff",
                  outline: "none",
                  color: "#333",
                  transition: "border 0.2s",
                }}
              />
              <button
                onClick={() => setShowKey(!showKey)}
                style={{
                  position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", fontSize: "12px", color: "#999",
                  padding: "4px",
                }}
                title={showKey ? "숨기기" : "보기"}
              >
                {showKey ? "🙈" : "👁️"}
              </button>
            </div>
            <button
              onClick={handleEnter}
              disabled={loading}
              style={{
                padding: "12px 24px",
                borderRadius: "8px",
                border: "none",
                background: loading ? "#93c5fd" : "linear-gradient(135deg, #2563eb, #1d4ed8)",
                color: "#fff",
                fontSize: "14px",
                fontWeight: 700,
                cursor: loading ? "default" : "pointer",
                whiteSpace: "nowrap",
                display: "flex", alignItems: "center", gap: "6px",
                transition: "all 0.2s",
              }}
            >
              {loading ? "인증 중..." : "메인 페이지 바로가기 →"}
            </button>
          </div>
          {error && <div style={{ color: "#ef4444", fontSize: "12px", marginTop: "8px" }}>{error}</div>}
        </div>
      </section>

      {/* ── How it Works ── */}
      <section style={{
        padding: "60px 24px 72px",
        textAlign: "center",
      }}>
        <h2 style={{ fontSize: "28px", fontWeight: 800, color: "#1a1a2e", marginBottom: "8px" }}>How it Works</h2>
        <p style={{ color: "#888", fontSize: "14px", marginBottom: "48px" }}>단 4단계로 시작하는 AI 건설 사후평가 인텔리전스</p>

        <div style={{
          display: "flex",
          justifyContent: "center",
          gap: "24px",
          flexWrap: "wrap",
          maxWidth: "960px",
          margin: "0 auto",
        }}>
          {[
            { step: "STEP 1", icon: "📄", title: "데이터 수집", desc: "설계·감리·시공보고서 등\n비정형 PDF 문서를 업로드" },
            { step: "STEP 2", icon: "🤖", title: "AI 분석 및 정제", desc: "Gemini AI가 텍스트 추출 및\n항목별 자동 분류" },
            { step: "STEP 3", icon: "🧩", title: "데이터 구조화", desc: "원인별·항목별 분류 후\n법정 표준 양식에 매핑" },
            { step: "STEP 4", icon: "📊", title: "보고서 자동 생성", desc: "수치, 표, 그래프 포함\n사후평가서 초안 완성" },
          ].map((s, i) => (
            <div key={i} style={{ position: "relative", display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{
                width: "200px",
                padding: "28px 20px",
                background: "#fff",
                border: "1px solid #e8eaed",
                borderRadius: "16px",
                textAlign: "center",
                transition: "all 0.3s",
              }}>
                <div style={{
                  width: "56px", height: "56px", borderRadius: "14px",
                  background: "linear-gradient(135deg, #2563eb, #60a5fa)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 14px", fontSize: "26px",
                }}>
                  {s.icon}
                </div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#2563eb", marginBottom: "8px", letterSpacing: "0.05em" }}>
                  {s.step}
                </div>
                <div style={{ fontSize: "15px", fontWeight: 700, color: "#1a1a2e", marginBottom: "6px" }}>
                  {s.title}
                </div>
                <div style={{ fontSize: "12px", color: "#888", lineHeight: 1.5, whiteSpace: "pre-line" }}>
                  {s.desc}
                </div>
              </div>
              {i < 3 && (
                <div style={{ color: "#ccc", fontSize: "20px", flexShrink: 0 }}>›</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── 제도 소개 섹션 ── */}
      <section style={{
        padding: "64px 24px",
        background: "#f8f9fb",
      }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <h2 style={{ fontSize: "26px", fontWeight: 800, color: "#1a1a2e", marginBottom: "8px", textAlign: "center" }}>
            건설공사 사후평가 제도란?
          </h2>
          <p style={{ textAlign: "center", color: "#888", fontSize: "14px", marginBottom: "40px" }}>
            건설공사 완료 후 성과를 체계적으로 분석하여 향후 유사 사업의 효율성을 제고하는 법정 제도
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "20px" }}>
            {[
              {
                title: "사업수행성과 평가",
                emoji: "📋",
                items: ["공사비·공사기간 증감 분석", "설계변경 내역 검토", "스마트 건설기술 적용 현황", "안전사고·민원·재시공 분석"],
                note: "준공 후 120일 이내 실시",
              },
              {
                title: "사업효율 평가",
                emoji: "📈",
                items: ["수요 예측 vs 실측 비교", "경제성(B/C) 오차 원인 분석", "비용 대비 효과 산출"],
                note: "준공 후 5년 이내 평가",
              },
              {
                title: "파급효과 평가",
                emoji: "🌍",
                items: ["운영 중 민원·하자·환경 영향", "지역 사회경제적 파급지표", "사용자 만족도 평가"],
                note: "준공 후 5년 이내 평가",
              },
            ].map((cat, i) => (
              <div key={i} style={{
                background: "#fff",
                borderRadius: "14px",
                padding: "28px 24px",
                border: "1px solid #e8eaed",
              }}>
                <div style={{ fontSize: "28px", marginBottom: "12px" }}>{cat.emoji}</div>
                <h3 style={{ fontSize: "17px", fontWeight: 700, color: "#1a1a2e", marginBottom: "14px" }}>
                  {cat.title}
                </h3>
                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 14px" }}>
                  {cat.items.map((item, j) => (
                    <li key={j} style={{
                      fontSize: "13px", color: "#555", padding: "5px 0",
                      display: "flex", alignItems: "center", gap: "8px",
                    }}>
                      <span style={{ color: "#2563eb", fontSize: "10px" }}>●</span>{item}
                    </li>
                  ))}
                </ul>
                <div style={{
                  fontSize: "11px", color: "#2563eb", fontWeight: 600,
                  padding: "6px 12px", background: "rgba(37, 99, 235, 0.06)",
                  borderRadius: "6px", display: "inline-block",
                }}>
                  {cat.note}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 기존 문제점 vs AI 개선 비교 ── */}
      <section style={{ padding: "64px 24px", textAlign: "center" }}>
        <h2 style={{ fontSize: "26px", fontWeight: 800, color: "#1a1a2e", marginBottom: "8px" }}>
          왜 AI 기반 시스템이 필요한가?
        </h2>
        <p style={{ color: "#888", fontSize: "14px", marginBottom: "40px" }}>
          현행 수작업 방식의 한계를 AI가 해소합니다
        </p>

        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          maxWidth: "760px",
          margin: "0 auto",
          gap: "20px",
        }}>
          {/* 기존 방식 */}
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "14px", padding: "28px 24px", textAlign: "left" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#dc2626", marginBottom: "16px" }}>🔴 기존 수작업 방식</h3>
            {["방대한 자료 일일이 검색 → 장시간 소요", "평가자별 추출 방식 비표준화", "결과물 일관성·전문성 편차 발생", "과업 초기 이해 부족 → 지연 빈번"].map((t, i) => (
              <div key={i} style={{ fontSize: "13px", color: "#7f1d1d", padding: "6px 0", display: "flex", gap: "8px" }}>
                <span>✕</span>{t}
              </div>
            ))}
          </div>
          {/* AI 방식 */}
          <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "14px", padding: "28px 24px", textAlign: "left" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#2563eb", marginBottom: "16px" }}>🔵 AI 자동화 시스템</h3>
            {["RAG 기반 즉시 데이터 추출", "표준화된 추출 로직으로 일관성 확보", "법정 양식 자동 매핑 → 전문성 보장", "문서 인텔리전스로 사전 점검 가능"].map((t, i) => (
              <div key={i} style={{ fontSize: "13px", color: "#1e40af", padding: "6px 0", display: "flex", gap: "8px" }}>
                <span>✓</span>{t}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 기대효과 ── */}
      <section style={{ padding: "48px 24px 64px", background: "#f8f9fb", textAlign: "center" }}>
        <h2 style={{ fontSize: "26px", fontWeight: 800, color: "#1a1a2e", marginBottom: "32px" }}>기대 효과</h2>
        <div style={{ display: "flex", justifyContent: "center", gap: "24px", flexWrap: "wrap" }}>
          {[
            { icon: "⚡", title: "90% 시간 절감", desc: "수작업 대비 작성 시간을 획기적으로 단축합니다" },
            { icon: "🎯", title: "높은 정확도", desc: "AI 기반 표준화된 추출로 일관된 결과를 보장합니다" },
            { icon: "🔄", title: "유사사업 환류", desc: "기존 평가 데이터를 학습하여 주의사항을 자동 추출합니다" },
            { icon: "📑", title: "문서 인텔리전스", desc: "자료 유무 및 작성 수준을 사전에 자동 점검합니다" },
          ].map((e, i) => (
            <div key={i} style={{
              width: "200px", padding: "24px 16px", background: "#fff",
              borderRadius: "14px", border: "1px solid #e8eaed",
            }}>
              <div style={{ fontSize: "32px", marginBottom: "12px" }}>{e.icon}</div>
              <div style={{ fontSize: "15px", fontWeight: 700, color: "#1a1a2e", marginBottom: "8px" }}>{e.title}</div>
              <div style={{ fontSize: "12px", color: "#888", lineHeight: 1.5 }}>{e.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 하단 CTA ── */}
      <section style={{ padding: "56px 24px", textAlign: "center" }}>
        <h2 style={{ fontSize: "24px", fontWeight: 800, color: "#1a1a2e", marginBottom: "16px" }}>
          지금 바로 시작하세요
        </h2>
        <p style={{ color: "#888", fontSize: "14px", marginBottom: "24px" }}>
          Gemini API Key만 있으면 즉시 사후평가서 자동 작성을 경험할 수 있습니다.
        </p>
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          style={{
            padding: "14px 40px", borderRadius: "10px", border: "none",
            background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
            color: "#fff", fontSize: "16px", fontWeight: 700, cursor: "pointer",
          }}
        >
          ↑ API Key 입력하러 가기
        </button>
      </section>

      {/* ── 푸터 ── */}
      <footer style={{
        padding: "24px 48px",
        borderTop: "1px solid #eee",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: "12px",
        color: "#aaa",
      }}>
        <span>© 2026 KICT 한국건설기술연구원. All rights reserved.</span>
        <span>PostEval AI v0.1.0</span>
      </footer>
    </div>
  );
}
