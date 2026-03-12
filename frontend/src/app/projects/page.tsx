"use client";
import { useRouter } from "next/navigation";
import { useProject } from "../contexts/ProjectContext";
import { FolderOpen, FileText, Database, Layers, ArrowRight, RefreshCw } from "lucide-react";

export default function ProjectsPage() {
  const { projects, selectProject, refreshProjects, loading } = useProject();
  const router = useRouter();

  const readyProjects = projects.filter(p => p.status === "ready" && p.total_chunks > 0);
  const pendingProjects = projects.filter(p => p.status !== "ready" || p.total_chunks === 0);

  const handleSelect = (p: any) => {
    selectProject(p);
    router.push("/form3");
  };

  return (
    <>
      <div className="page-header">
        <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <FolderOpen size={30} color="var(--accent-primary)" />
          프로젝트 관리
        </h1>
        <p className="page-subtitle">프로젝트를 선택하여 사후평가서 작성을 시작하세요</p>
      </div>

      {/* 상단 KPI */}
      <div className="card-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginBottom: "28px" }}>
        <div className="kpi-card blue">
          <div className="kpi-label">전체 프로젝트</div>
          <div className="kpi-value">{projects.length}</div>
        </div>
        <div className="kpi-card green">
          <div className="kpi-label">준비 완료</div>
          <div className="kpi-value">{readyProjects.length}</div>
        </div>
        <div className="kpi-card purple">
          <div className="kpi-label">총 문서 수</div>
          <div className="kpi-value">{projects.reduce((s, p) => s + p.total_documents, 0)}</div>
        </div>
      </div>

      {/* 프로젝트 카드들 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h2 style={{ fontSize: "17px", fontWeight: 700, color: "var(--text-primary)" }}>
          RAG 준비 완료 프로젝트
        </h2>
        <button className="btn btn-secondary" onClick={refreshProjects} style={{ fontSize: "12px", padding: "6px 14px" }}>
          <RefreshCw size={14} /> 새로고침
        </button>
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: "center", padding: "60px", color: "var(--text-tertiary)" }}>
          데이터를 불러오는 중입니다...
        </div>
      ) : readyProjects.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "60px" }}>
          <FolderOpen size={48} color="var(--text-disabled)" style={{ marginBottom: "16px" }} />
          <p style={{ color: "var(--text-tertiary)", fontSize: "14px" }}>
            RAG 처리가 완료된 프로젝트가 아직 없습니다.
          </p>
          <p style={{ color: "var(--text-disabled)", fontSize: "12px", marginTop: "6px" }}>
            먼저 <a href="/upload" style={{ color: "var(--accent-primary)" }}>데이터 업로드</a>를 진행해 주세요.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
          {readyProjects.map(p => (
            <div
              key={p.id}
              className="card"
              onClick={() => handleSelect(p)}
              style={{ cursor: "pointer", position: "relative", overflow: "hidden" }}
            >
              {/* 상단 액센트 바 */}
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: "3px",
                background: "linear-gradient(90deg, #3b82f6, #8b5cf6)",
              }} />

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", gap: "14px", alignItems: "flex-start", flex: 1 }}>
                  <div style={{
                    width: "44px", height: "44px", borderRadius: "var(--radius-md)",
                    background: "rgba(96, 165, 250, 0.1)", display: "flex",
                    alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <FolderOpen size={22} color="var(--accent-primary)" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "6px" }}>
                      {p.name}
                    </h3>
                    <div style={{ display: "flex", gap: "16px", fontSize: "12px", color: "var(--text-tertiary)" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <FileText size={12} /> 문서 {p.total_documents}개
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <Layers size={12} /> 청크 {p.total_chunks.toLocaleString()}개
                      </span>
                    </div>
                  </div>
                </div>

                {/* 상태 뱃지 */}
                <span style={{
                  padding: "4px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 600,
                  background: "var(--success-subtle)", color: "var(--success)",
                }}>
                  준비완료
                </span>
              </div>

              {/* 하단 액션 힌트 */}
              <div style={{
                marginTop: "16px", paddingTop: "12px",
                borderTop: "1px solid var(--border-muted)",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span style={{ fontSize: "12px", color: "var(--text-disabled)" }}>클릭하여 평가서 작성 시작</span>
                <ArrowRight size={16} color="var(--text-disabled)" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 대기 중 프로젝트 */}
      {pendingProjects.length > 0 && (
        <>
          <h2 style={{ fontSize: "17px", fontWeight: 700, color: "var(--text-primary)", marginTop: "32px", marginBottom: "16px" }}>
            처리 대기 중
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
            {pendingProjects.map(p => (
              <div key={p.id} className="card" style={{ opacity: 0.5 }}>
                <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
                  <div style={{
                    width: "44px", height: "44px", borderRadius: "var(--radius-md)",
                    background: "rgba(255,255,255,0.04)", display: "flex",
                    alignItems: "center", justifyContent: "center",
                  }}>
                    <Database size={22} color="var(--text-disabled)" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-secondary)" }}>{p.name}</h3>
                    <span style={{ fontSize: "12px", color: "var(--text-disabled)" }}>
                      {p.status === "processing" ? "RAG 처리 중..." : "데이터 업로드 필요"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
