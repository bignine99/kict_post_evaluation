"use client";
import { usePathname } from "next/navigation";
import { ProjectProvider } from "../contexts/ProjectContext";
import Sidebar from "./Sidebar";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // 랜딩페이지는 사이드바 없이 전체 화면으로 표시
  if (pathname === "/landing") {
    return <>{children}</>;
  }

  return (
    <ProjectProvider>
      <div className="app-container">
        <Sidebar />
        <main className="main-content">
          {/* RAG 상태 뱃지 — 모든 페이지 우측 상단 고정 */}
          <div style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: "-8px",
            pointerEvents: "none",
          }}>
            <div className="rag-status-badge" style={{ pointerEvents: "auto" }}>
              <span className="rag-status-dot"></span>
              RAG AI CONNECTED
            </div>
          </div>
          {children}
        </main>
      </div>
    </ProjectProvider>
  );
}
