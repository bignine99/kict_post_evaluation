"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { LayoutDashboard, FolderUp, ClipboardList, FileText, Search, Download, Settings, CheckCircle2, XCircle, AlertCircle, Wrench, Rocket, RefreshCw, Database, Scissors, BrainCircuit, FolderOpen } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface HealthStatus {
  app: string;
  version: string;
  status: string;
  services: {
    mysql?: { status: string; host?: string; database?: string; error?: string };
    gemini?: { status: string; model: string; embedding_model: string };
  };
}

interface RagStats {
  categories: { label: string; value: number; max: number; color: string }[];
  chunks: { size: string; count: number; height: string }[];
  progress: {
    percent: number;
    total_chunks: number;
  };
}

export default function Home() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [ragStats, setRagStats] = useState<RagStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [healthRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/health`),
        fetch(`${API_URL}/api/v1/dashboard/rag-stats`).catch(() => null)
      ]);
      
      setHealth(await healthRes.json());
      
      if (statsRes && statsRes.ok) {
        setRagStats(await statsRes.json());
      }
      
      setError(null);
    } catch {
      setError("백엔드 서버에 연결할 수 없습니다");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">대시보드</h1>
          <p className="page-subtitle">
            건설공사 사후평가서 자동작성 시스템 현황
          </p>
        </div>
      </div>

        {/* KPI Cards */}
        <div className="card-grid">
          <div className="kpi-card blue animate-fade-in">
            <div className="kpi-label">시스템 상태</div>
            <div className="kpi-value" style={{ fontSize: "24px", display: "flex", alignItems: "center", gap: "8px" }}>
              {loading ? "확인 중..." : health ? <><CheckCircle2 size={24} color="var(--success)" /> 정상</> : <><XCircle size={24} color="var(--accent-danger)" /> 오프라인</>}
            </div>
            <div className="kpi-change">
              {health?.version ? `v${health.version}` : "서버 연결 대기"}
            </div>
          </div>

          <div className="kpi-card green animate-fade-in" style={{ animationDelay: "0.1s" }}>
            <div className="kpi-label">MySQL DB</div>
            <div className="kpi-value" style={{ fontSize: "24px", display: "flex", alignItems: "center", gap: "8px" }}>
              {loading
                ? "..."
                : health?.services?.mysql?.status === "connected"
                  ? <><CheckCircle2 size={24} color="var(--success)" /> 연결됨</>
                  : <><XCircle size={24} color="var(--accent-danger)" /> 미연결</>}
            </div>
            <div className="kpi-change">NCP Cloud DB</div>
          </div>

          <div className="kpi-card purple animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <div className="kpi-label">Gemini AI</div>
            <div className="kpi-value" style={{ fontSize: "24px", display: "flex", alignItems: "center", gap: "8px" }}>
              {loading
                ? "..."
                : health?.services?.gemini?.status === "configured"
                  ? <><CheckCircle2 size={24} color="var(--success)" /> 구성됨</>
                  : <><AlertCircle size={24} color="var(--accent-warning)" /> 미설정</>}
            </div>
            <div className="kpi-change">
              {health?.services?.gemini?.model || "gemini-2.5-flash-lite"}
            </div>
          </div>

          <div className="kpi-card amber animate-fade-in" style={{ animationDelay: "0.3s" }}>
            <div className="kpi-label">업로드 문서</div>
            <div className="kpi-value">0</div>
            <div className="kpi-change">Phase 2에서 활성화</div>
          </div>
        </div>

        {/* RAG Diagnostics Charts */}
        <div className="card-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", marginTop: "24px" }}>
          {/* Chart 1: Document Processing Status */}
          <div className="card animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <h2 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px", color: "var(--accent-primary)" }}>
              <Database size={18} /> 벡터 문서 현황 분포 (임베딩 됨)
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {(ragStats ? ragStats.categories : [
                { label: "보고서 데이터 로드 중", value: 0, max: 100, color: "var(--accent-primary)" }
              ]).map((item, i) => (
                <div key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "13px", fontWeight: 500 }}>
                    <span style={{ color: "var(--text-secondary)" }}>{item.label}</span>
                    <span style={{ color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{item.value}건</span>
                  </div>
                  <div style={{ width: "100%", height: "6px", background: "rgba(255,255,255,0.05)", borderRadius: "3px", overflow: "hidden" }}>
                    <div style={{ 
                      width: `${item.max > 0 ? (item.value / item.max) * 100 : 0}%`, 
                      height: "100%", 
                      background: item.color, 
                      borderRadius: "3px",
                      boxShadow: `0 0 10px ${item.color}80`,
                      transition: "width 1s var(--ease-spring)"
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Chart 2: Chunk Size Distribution */}
          <div className="card animate-fade-in" style={{ animationDelay: "0.3s", display: "flex", flexDirection: "column" }}>
            <h2 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px", color: "var(--success)" }}>
              <Scissors size={18} /> 토큰(Chunk) 분할 사이즈 분포
            </h2>
            <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: "12px", paddingBottom: "10px", marginTop: "10px" }}>
              {(ragStats ? ragStats.chunks : [
                { size: "0", count: 0, height: "0%" }
              ]).map((bar, i) => (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", height: "100%", justifyContent: "flex-end" }}>
                  <span style={{ fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600 }}>{bar.count}</span>
                  <div style={{ 
                    width: "100%", 
                    height: bar.height, 
                    background: "linear-gradient(180deg, rgba(52, 211, 153, 0.8) 0%, rgba(52, 211, 153, 0.1) 100%)",
                    borderTop: "2px solid var(--success)",
                    borderRadius: "4px 4px 0 0",
                    transition: "height 1s var(--ease-spring)"
                  }} />
                  <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{bar.size}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Chart 3: Embedding Realtime Progress */}
          <div className="card animate-fade-in" style={{ animationDelay: "0.4s", display: "flex", flexDirection: "column" }}>
            <h2 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px", color: "#A855F7" }}>
              <BrainCircuit size={18} /> RAG 파이프라인 학습률
            </h2>
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
               <div style={{ position: "relative", width: "130px", height: "130px" }}>
                  <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
                    <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#A855F7" strokeWidth="8" strokeDasharray="251.2" 
                      strokeDashoffset={ragStats ? 251.2 - (251.2 * ragStats.progress.percent) / 100 : 251.2} 
                      strokeLinecap="round" style={{ filter: "drop-shadow(0 0 8px rgba(168,85,247,0.5))", transition: "stroke-dashoffset 1.5s var(--ease-spring)" }} />
                  </svg>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: "32px", fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>{ragStats ? ragStats.progress.percent : 0}<span style={{ fontSize: "16px" }}>%</span></span>
                    <span style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "4px" }}>전체 임베딩 달성</span>
                  </div>
               </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-secondary)", marginTop: "16px", padding: "12px 16px", background: "rgba(0,0,0,0.2)", borderRadius: "8px" }}>
               <span>생성된 청크 블록: {(ragStats ? ragStats.progress.total_chunks : 0).toLocaleString()}개</span>
               <span style={{ color: "var(--success)" }}>ChromaDB 저장됨</span>
            </div>
          </div>
        </div>

        {/* System Info Card */}
        <div className="card animate-fade-in" style={{ animationDelay: "0.4s" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Wrench size={20} color="var(--accent-primary)" /> 시스템 정보
          </h2>

          {loading ? (
            <p style={{ color: "var(--text-secondary)" }}>서버 상태를 확인하는 중...</p>
          ) : error ? (
            <div style={{ padding: "16px", background: "var(--error-subtle)", borderRadius: "8px", border: "1px solid rgba(248,113,113,0.2)" }}>
              <p style={{ color: "var(--accent-danger)", fontWeight: 500, display: "flex", alignItems: "center", gap: "8px" }}>
                <AlertCircle size={18} />
                {error}
              </p>
              <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "8px" }}>
                백엔드 서버를 시작해주세요: <code>uvicorn app.main:app --reload --port 8000</code>
              </p>
            <button className="btn btn-secondary" style={{ marginTop: "12px" }} onClick={fetchData}>
              <RefreshCw size={14} /> 다시 시도
            </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <div style={{ color: "var(--text-tertiary)", fontSize: "12px", marginBottom: "4px" }}>앱 이름</div>
                <div style={{ fontWeight: 500, color: "var(--text-primary)" }}>{health?.app}</div>
              </div>
              <div>
                <div style={{ color: "var(--text-tertiary)", fontSize: "12px", marginBottom: "4px" }}>버전</div>
                <div style={{ fontWeight: 500, color: "var(--text-primary)" }}>{health?.version}</div>
              </div>
              <div>
                <div style={{ color: "var(--text-tertiary)", fontSize: "12px", marginBottom: "4px" }}>LLM 모델</div>
                <div style={{ fontWeight: 500, color: "var(--text-primary)" }}>{health?.services?.gemini?.model}</div>
              </div>
              <div>
                <div style={{ color: "var(--text-tertiary)", fontSize: "12px", marginBottom: "4px" }}>임베딩 모델</div>
                <div style={{ fontWeight: 500, color: "var(--text-primary)" }}>{health?.services?.gemini?.embedding_model}</div>
              </div>
              <div>
                <div style={{ color: "var(--text-tertiary)", fontSize: "12px", marginBottom: "4px" }}>MySQL 호스트</div>
                <div style={{ fontWeight: 500, color: "var(--text-primary)" }}>{health?.services?.mysql?.host || "-"}</div>
              </div>
              <div>
                <div style={{ color: "var(--text-tertiary)", fontSize: "12px", marginBottom: "4px" }}>MySQL 데이터베이스</div>
                <div style={{ fontWeight: 500, color: "var(--text-primary)" }}>{health?.services?.mysql?.database || "-"}</div>
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card animate-fade-in" style={{ marginTop: "20px", animationDelay: "0.5s" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Rocket size={20} color="var(--accent-primary)" /> 빠른 시작
          </h2>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <Link className="btn btn-primary" href="/upload"><FolderUp size={16} /> 문서 업로드</Link>
            <button className="btn btn-secondary"><RefreshCw size={16} /> RAG 파이프라인 실행</button>
            <button className="btn btn-secondary"><LayoutDashboard size={16} /> 평가서 생성</button>
            <button className="btn btn-secondary"><Download size={16} /> PDF 다운로드</button>
          </div>
        </div>
    </>
  );
}
