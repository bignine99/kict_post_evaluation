"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useProject } from "../contexts/ProjectContext";
import {
  LayoutDashboard,
  FolderOpen,
  ClipboardList,
  FileText,
  Search,
  Download,
  Settings,
  ArrowLeft,
  Database,
  ExternalLink,
  BarChart3,
  PieChart,
  TrendingUp,
  History,
  HelpCircle,
  Shield,
} from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();
  const { selectedProject, selectProject } = useProject();

  const isActive = (path: string) => pathname === path;

  return (
    <aside className="sidebar">
      {/* Header / Logo */}
      <div className="sidebar-header">
        <div className="sidebar-logo" style={{ flexDirection: "column", gap: "0px" }}>
          {/* KICT 로고 */}
          <span className="sidebar-logo-text" style={{
            fontSize: "28px",
            fontWeight: 800,
            letterSpacing: "0.15em",
          }}>
            KICT
          </span>
          <span className="sidebar-logo-text">건설사업 사후평가 AI</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {/* ── 프로젝트가 선택되지 않은 상태 ── */}
        {!selectedProject ? (
          <>
            <div className="nav-section-title">메인</div>
            <Link className={`nav-item ${isActive("/") ? "active" : ""}`} href="/">
              <LayoutDashboard size={18} /><span>대시보드</span>
            </Link>
            <Link className={`nav-item ${isActive("/projects") ? "active" : ""}`} href="/projects">
              <FolderOpen size={18} /><span>프로젝트</span>
            </Link>

            <div className="nav-section-title">시스템</div>
            <Link className={`nav-item ${isActive("/upload") ? "active" : ""}`} href="/upload">
              <Database size={18} /><span>데이터 관리</span>
            </Link>
            <Link className="nav-item" href="#">
              <BarChart3 size={18} /><span>데이터 분석</span>
            </Link>
            <Link className="nav-item" href="#">
              <PieChart size={18} /><span>데이터 통계</span>
            </Link>
            <Link className="nav-item" href="#">
              <TrendingUp size={18} /><span>성과 추이</span>
            </Link>

            <div className="nav-section-title">기타</div>
            <Link className="nav-item" href="#">
              <History size={18} /><span>작업 이력</span>
            </Link>
            <Link className="nav-item" href="#">
              <Shield size={18} /><span>감사 로그</span>
            </Link>
            <Link className="nav-item" href="#">
              <HelpCircle size={18} /><span>도움말</span>
            </Link>
            <Link className="nav-item" href="#">
              <Settings size={18} /><span>설정</span>
            </Link>
            <Link className={`nav-item ${isActive("/landing") ? "active" : ""}`} href="/landing">
              <ExternalLink size={18} /><span>랜딩페이지</span>
            </Link>
          </>
        ) : (
          /* ── 프로젝트가 선택된 상태 ── */
          <>
            {/* 뒤로가기 */}
            <div
              className="nav-item"
              onClick={() => selectProject(null)}
              style={{ cursor: "pointer", marginBottom: "8px", color: "var(--text-tertiary)", fontSize: "12px" }}
            >
              <ArrowLeft size={16} /><span>프로젝트 목록으로</span>
            </div>

            {/* 선택된 프로젝트 정보 */}
            <div style={{
              padding: "14px 16px",
              margin: "0 4px 16px",
              background: "rgba(96, 165, 250, 0.06)",
              border: "1px solid rgba(96, 165, 250, 0.15)",
              borderRadius: "var(--radius-lg)",
            }}>
              <div style={{
                fontWeight: 700,
                fontSize: "14px",
                color: "var(--text-primary)",
                marginBottom: "6px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}>
                <FolderOpen size={16} color="var(--accent-primary)" />
                {selectedProject.name}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
                문서 {selectedProject.total_documents}개 · 청크 {selectedProject.total_chunks.toLocaleString()}개
              </div>
            </div>

            {/* 프로젝트별 메뉴 */}
            <div className="nav-section-title">사업수행성과 평가</div>
            <Link className={`nav-item ${isActive("/form3") ? "active" : ""}`} href="/form3">
              <ClipboardList size={18} /><span>별지 제3호</span>
            </Link>
            <Link className={`nav-item ${isActive("/form4") ? "active" : ""}`} href="/form4">
              <FileText size={18} /><span>별지 제4호</span>
            </Link>

            <div className="nav-section-title">도구</div>
            <Link className="nav-item" href="#">
              <Search size={18} /><span>RAG 검색</span>
            </Link>
            <Link className="nav-item" href="#">
              <Download size={18} /><span>PDF 다운로드</span>
            </Link>

            <div className="nav-section-title">분석</div>
            <Link className="nav-item" href="#">
              <BarChart3 size={18} /><span>데이터 분석</span>
            </Link>
            <Link className="nav-item" href="#">
              <PieChart size={18} /><span>데이터 통계</span>
            </Link>
            <Link className="nav-item" href="#">
              <TrendingUp size={18} /><span>성과 추이</span>
            </Link>
          </>
        )}
      </nav>


      {/* 하단 버전 정보 */}
      <div style={{
        padding: "12px 16px",
        borderTop: "1px solid var(--border-muted)",
        fontSize: "10px",
        color: "var(--text-disabled)",
        textAlign: "center",
        letterSpacing: "0.05em",
      }}>
        PostEval AI v0.1.0
      </div>
    </aside>
  );
}
