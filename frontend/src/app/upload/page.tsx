"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { 
    Building2, LayoutDashboard, FolderUp, ClipboardList, FileText, Search, Download, Settings,
    FolderOpen, Plus, AlertTriangle, UploadCloud, File, RefreshCw, X, Loader2, CheckCircle2,
    BarChart2, TrendingUp, Scissors, BrainCircuit, Database, XCircle, Trash2
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface UploadedFile {
    id: number;
    filename: string;
    doc_type: string;
    size_mb: number;
    page_count: number | null;
    status: string;
}

interface ProjectInfo {
    id: number;
    name: string;
    description?: string;
    status: string;
    total_documents: number;
    total_chunks: number;
    created_at?: string;
}

interface ProcessStep {
    step: string;
    label: string;
}

const PIPELINE_STEPS: ProcessStep[] = [
    { step: "extracting", label: "PDF 텍스트 추출" },
    { step: "chunking", label: "시맨틱 청킹" },
    { step: "embedding", label: "Gemini 임베딩" },
    { step: "saving", label: "MySQL 저장" },
];

export default function UploadPage() {
    // ── 프로젝트 관리 ──
    const [projectName, setProjectName] = useState("");
    const [project, setProject] = useState<ProjectInfo | null>(null);
    const [existingProjects, setExistingProjects] = useState<ProjectInfo[]>([]);
    const [showProjectList, setShowProjectList] = useState(true);

    // ── 파일 업로드 ──
    const [files, setFiles] = useState<File[]>([]);
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [dragOver, setDragOver] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── RAG 파이프라인 ──
    const [processing, setProcessing] = useState(false);
    const [currentStep, setCurrentStep] = useState("");
    const [currentDoc, setCurrentDoc] = useState("");
    const [currentDocIndex, setCurrentDocIndex] = useState(0);
    const [totalDocs, setTotalDocs] = useState(0);
    const [overallPercent, setOverallPercent] = useState(0);
    const [embeddingProgress, setEmbeddingProgress] = useState({ done: 0, total: 0 });
    const [completedDocs, setCompletedDocs] = useState<any[]>([]);
    const [failedDocs, setFailedDocs] = useState<any[]>([]);
    const [processResult, setProcessResult] = useState<any>(null);
    const [processError, setProcessError] = useState<string | null>(null);

    // ── 기존 프로젝트 로드 ──
    useEffect(() => {
        loadProjects();
    }, []);

    const loadProjects = async () => {
        try {
            const res = await fetch(`${API_URL}/api/v1/projects`);
            const data = await res.json();
            setExistingProjects(data.projects || []);
        } catch {
            // ignore
        }
    };

    // ── 프로젝트 선택 ──
    const selectProject = async (p: ProjectInfo) => {
        setProject(p);
        setShowProjectList(false);

        // 기존 문서 로드
        try {
            const res = await fetch(`${API_URL}/api/v1/projects/${p.id}/documents`);
            const data = await res.json();
            if (data.documents?.length > 0) {
                setUploadedFiles(
                    data.documents.map((d: any) => ({
                        id: d.id,
                        filename: d.filename,
                        doc_type: d.doc_type,
                        size_mb: d.size_mb || 0,
                        page_count: d.page_count,
                        status: d.extraction_status,
                    }))
                );
            }
        } catch {
            // ignore
        }
    };

    // ── 프로젝트 생성 ──
    const createProject = async () => {
        if (!projectName.trim()) {
            setError("프로젝트명을 입력해주세요");
            return;
        }
        try {
            const res = await fetch(
                `${API_URL}/api/v1/projects?name=${encodeURIComponent(projectName)}`,
                { method: "POST" }
            );
            const data = await res.json();
            setProject(data.project);
            setShowProjectList(false);
            setError(null);
            loadProjects();
        } catch {
            setError("프로젝트 생성에 실패했습니다");
        }
    };

    // ── 프로젝트 삭제 ──
    const deleteProject = async (p: ProjectInfo, e: React.MouseEvent) => {
        e.stopPropagation(); // 카드 클릭 이벤트 전파 방지
        if (!confirm(`정말 "${p.name}" 프로젝트를 삭제하시겠습니까?\n\n관련 문서, 청크, 평가결과가 모두 삭제됩니다.`)) {
            return;
        }
        try {
            const res = await fetch(`${API_URL}/api/v1/projects/${p.id}`, { method: "DELETE" });
            const data = await res.json();
            if (data.status === "success") {
                loadProjects();
            } else {
                alert("삭제 실패: " + (data.detail || "알 수 없는 오류"));
            }
        } catch {
            alert("프로젝트 삭제 중 오류가 발생했습니다.");
        }
    };

    // ── 드래그 앤 드롭 ──
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(true);
    }, []);
    const handleDragLeave = useCallback(() => setDragOver(false), []);
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const droppedFiles = Array.from(e.dataTransfer.files).filter(
            (f) => f.name.endsWith(".pdf") || f.name.endsWith(".hwp") || f.name.endsWith(".xlsx")
        );
        setFiles((prev) => [...prev, ...droppedFiles]);
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    };
    const removeFile = (i: number) => setFiles((prev) => prev.filter((_, idx) => idx !== i));

    // ── 파일 업로드 ──
    const uploadFiles = async () => {
        if (!project || files.length === 0) return;
        setUploading(true);
        setUploadProgress(0);
        setError(null);
        try {
            const formData = new FormData();
            files.forEach((file) => formData.append("files", file));
            const xhr = new XMLHttpRequest();
            xhr.upload.addEventListener("progress", (e) => {
                if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
            });
            const response = await new Promise<string>((resolve, reject) => {
                xhr.onload = () => resolve(xhr.responseText);
                xhr.onerror = () => reject(new Error("업로드 실패"));
                xhr.open("POST", `${API_URL}/api/v1/projects/${project.id}/upload`);
                xhr.send(formData);
            });
            const data = JSON.parse(response);
            setUploadedFiles((prev) => [...prev, ...data.files]);
            setFiles([]);
            setProject((prev) =>
                prev ? { ...prev, total_documents: prev.total_documents + data.uploaded_count } : prev
            );
        } catch {
            setError("파일 업로드 중 오류가 발생했습니다");
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    };

    // ── RAG 파이프라인 (SSE 스트리밍) ──
    const runPipeline = async () => {
        if (!project) return;
        setProcessing(true);
        setProcessError(null);
        setProcessResult(null);
        setCompletedDocs([]);
        setFailedDocs([]);
        setEmbeddingProgress({ done: 0, total: 0 });

        try {
            const res = await fetch(`${API_URL}/api/v1/projects/${project.id}/process`, {
                method: "POST",
            });

            const reader = res.body?.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            if (!reader) throw new Error("스트림을 열 수 없습니다");

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        try {
                            const event = JSON.parse(line.slice(6));
                            handleSSEEvent(event);
                        } catch {
                            // ignore parse errors
                        }
                    }
                }
            }
        } catch (err: any) {
            setProcessError(err.message || "RAG 파이프라인 실행 중 오류가 발생했습니다");
        } finally {
            setProcessing(false);
        }
    };

    const handleSSEEvent = (event: any) => {
        switch (event.type) {
            case "start":
                setTotalDocs(event.total_documents);
                break;
            case "progress":
                setCurrentDoc(event.filename);
                setCurrentDocIndex(event.doc_index);
                setCurrentStep(event.step);
                setOverallPercent(event.percent || 0);
                if (event.step !== "embedding") {
                    setEmbeddingProgress({ done: 0, total: 0 });
                }
                break;
            case "embedding_progress":
                setEmbeddingProgress({ done: event.embedded, total: event.total_chunks });
                setOverallPercent(event.percent || 0);
                break;
            case "doc_complete":
                setCompletedDocs((prev) => [...prev, event]);
                break;
            case "doc_error":
                setFailedDocs((prev) => [...prev, event]);
                break;
            case "complete":
                setProcessResult(event);
                setOverallPercent(100);
                break;
            case "error":
                setProcessError(event.message);
                break;
        }
    };

    // ── 유틸 ──
    const formatSize = (bytes: number) => {
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };
    const getDocIcon = (type: string) => {
        const icons: Record<string, any> = {
            "예비타당성조사": <BarChart2 size={18} />, "타당성조사": <TrendingUp size={18} />, "기본설계보고서": <FileText size={18} />,
            "실시설계보고서": <FileText size={18} />, "준공검사보고서": <CheckCircle2 size={18} />, "감리보고서": <Search size={18} />,
            "건설사업관리보고서": <ClipboardList size={18} />, "설계변경보고서": <RefreshCw size={18} />, "시공내역서": <Building2 size={18} />, "기타": <File size={18} />,
        };
        return icons[type] || <File size={18} />;
    };

    return (
        <>
            {/* ── Main Content ── */}
            <div className="page-header">
                <h1 className="page-title">데이터 업로드</h1>
                <p className="page-subtitle">건설공사 사후평가를 위한 원본 문서를 업로드하세요</p>
            </div>

                {/* ══════════ 프로젝트 선택/생성 ══════════ */}
                {showProjectList && !project ? (
                    <div className="animate-fade-in">
                        {/* 기존 프로젝트 목록 */}
                        {existingProjects.length > 0 && (
                            <div className="card" style={{ marginBottom: "20px" }}>
                                <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                                    <FolderOpen size={20} color="var(--accent-primary)" /> 기존 프로젝트 선택
                                </h2>
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                    {existingProjects.map((p) => (
                                        <div
                                            key={p.id}
                                            onClick={() => selectProject(p)}
                                            style={{
                                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                                padding: "14px 18px", background: "var(--bg-secondary)", borderRadius: "10px",
                                                border: "1px solid var(--border-color)", cursor: "pointer",
                                                transition: "all 0.2s ease",
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.borderColor = "var(--accent-primary)";
                                                e.currentTarget.style.transform = "translateX(4px)";
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.borderColor = "var(--border-color)";
                                                e.currentTarget.style.transform = "translateX(0)";
                                            }}
                                        >
                                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                                <FolderOpen size={28} color="var(--accent-secondary)" />
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: "15px" }}>{p.name}</div>
                                                    <div style={{ color: "var(--text-muted)", fontSize: "12px", marginTop: "2px" }}>
                                                        문서 {p.total_documents}개 · 청크 {p.total_chunks}개
                                                        {p.created_at && ` · ${new Date(p.created_at).toLocaleDateString("ko-KR")}`}
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                <span style={{
                                                    padding: "4px 12px", borderRadius: "20px", fontSize: "11px", fontWeight: 500,
                                                    background: p.status === "ready" ? "rgba(16,185,129,0.15)" : "rgba(99,102,241,0.15)",
                                                    color: p.status === "ready" ? "var(--success)" : "var(--accent-primary)",
                                                }}>
                                                    {p.status === "ready" ? <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><CheckCircle2 size={14} /> 완료</span> : p.status === "processing" ? <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><RefreshCw size={14} className="spin" /> 처리중</span> : <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><UploadCloud size={14} /> 업로드중</span>}
                                                </span>
                                                <button
                                                    onClick={(e) => deleteProject(p, e)}
                                                    title="프로젝트 삭제"
                                                    style={{
                                                        background: "rgba(239, 68, 68, 0.1)",
                                                        border: "1px solid rgba(239, 68, 68, 0.2)",
                                                        borderRadius: "6px",
                                                        padding: "5px 8px",
                                                        cursor: "pointer",
                                                        color: "#ef4444",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: "4px",
                                                        fontSize: "11px",
                                                        fontWeight: 600,
                                                        transition: "all 0.2s",
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.background = "rgba(239, 68, 68, 0.25)";
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
                                                    }}
                                                >
                                                    <Trash2 size={13} /> 삭제
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 새 프로젝트 생성 */}
                        <div className="card">
                            <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
                                <Plus size={20} color="var(--accent-primary)" /> 새 프로젝트 생성
                            </h2>
                            <div style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: "block", fontSize: "13px", color: "var(--text-muted)", marginBottom: "6px" }}>
                                        프로젝트명
                                    </label>
                                    <input
                                        type="text" value={projectName}
                                        onChange={(e) => setProjectName(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && createProject()}
                                        placeholder="예: 새만금개간사업"
                                        style={{
                                            width: "100%", padding: "10px 14px", borderRadius: "8px",
                                            border: "1px solid var(--border-color)", background: "var(--bg-secondary)",
                                            color: "var(--text-primary)", fontSize: "14px", outline: "none",
                                        }}
                                    />
                                </div>
                                <button className="btn btn-primary" onClick={createProject}>프로젝트 생성</button>
                            </div>
                            {error && <p style={{ color: "var(--accent-danger)", marginTop: "12px", fontSize: "13px", display: "flex", alignItems: "center", gap: "4px" }}><AlertTriangle size={14} /> {error}</p>}
                        </div>
                    </div>
                ) : project ? (
                    <>
                        {/* 프로젝트 헤더 */}
                        <div className="card animate-fade-in" style={{ marginBottom: "20px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <h2 style={{ fontSize: "18px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}><FolderOpen size={20} color="var(--accent-primary)" /> {project.name}</h2>
                                    <p style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: "4px" }}>
                                        프로젝트 ID: {project.id} · 문서 {project.total_documents}개
                                        {project.total_chunks > 0 && ` · ${project.total_chunks}개 청크`}
                                    </p>
                                </div>
                                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                    <span style={{
                                        padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: 500,
                                        background: "rgba(99,102,241,0.15)", color: "var(--accent-primary)",
                                    }}>{project.status}</span>
                                    <button className="btn btn-secondary" onClick={() => { setProject(null); setShowProjectList(true); setUploadedFiles([]); setProcessResult(null); }}
                                        style={{ fontSize: "12px", padding: "6px 12px" }}>
                                        프로젝트 변경
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* ══════════ Step 2: 파일 업로드 ══════════ */}
                        <div className="card animate-fade-in" style={{ animationDelay: "0.1s" }}>
                            <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}><UploadCloud size={20} color="var(--accent-primary)" /> Step 2: 파일 업로드</h2>
                            <div
                                onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                style={{
                                    border: `2px dashed ${dragOver ? "var(--accent-primary)" : "var(--border-color)"}`,
                                    borderRadius: "12px", padding: "40px 24px", textAlign: "center", cursor: "pointer",
                                    transition: "all 0.3s ease", background: dragOver ? "rgba(99,102,241,0.05)" : "transparent",
                                }}
                            >
                                <div style={{ marginBottom: "12px", display: "flex", justifyContent: "center" }}>
                                    {dragOver ? <Download size={40} color="var(--accent-primary)" /> : <FolderUp size={40} color="var(--text-muted)" />}
                                </div>
                                <p style={{ fontWeight: 500 }}>파일을 드래그하여 놓거나 클릭하여 선택</p>
                                <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "6px" }}>PDF, HWP, XLSX · 최대 500MB</p>
                                <input ref={fileInputRef} type="file" multiple accept=".pdf,.hwp,.xlsx,.xls" onChange={handleFileSelect} style={{ display: "none" }} />
                            </div>

                            {files.length > 0 && (
                                <div style={{ marginTop: "16px" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                                        <h3 style={{ fontSize: "14px", fontWeight: 600 }}>선택된 파일 ({files.length}개)</h3>
                                        <div style={{ display: "flex", gap: "8px" }}>
                                            <button className="btn btn-secondary" onClick={() => setFiles([])} style={{ fontSize: "12px", padding: "6px 12px" }}>전체 취소</button>
                                            <button className="btn btn-primary" onClick={uploadFiles} disabled={uploading} style={{ fontSize: "12px", padding: "6px 16px", display: "flex", alignItems: "center", gap: "6px" }}>
                                                {uploading ? <><Loader2 size={14} className="spin" /> 업로드 중... {uploadProgress}%</> : <><UploadCloud size={14} /> 업로드 시작</>}
                                            </button>
                                        </div>
                                    </div>
                                    {uploading && (
                                        <div style={{ width: "100%", height: "6px", background: "var(--bg-secondary)", borderRadius: "3px", marginBottom: "10px", overflow: "hidden" }}>
                                            <div style={{ width: `${uploadProgress}%`, height: "100%", background: "linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))", borderRadius: "3px", transition: "width 0.3s ease" }} />
                                        </div>
                                    )}
                                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                        {files.map((file, i) => (
                                            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "var(--bg-secondary)", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                    <File size={16} color="var(--text-muted)" />
                                                    <div>
                                                        <div style={{ fontSize: "13px", fontWeight: 500 }}>{file.name}</div>
                                                        <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{formatSize(file.size)}</div>
                                                    </div>
                                                </div>
                                                <button onClick={() => removeFile(i)} style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "4px" }}><X size={14} /></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {error && <p style={{ color: "var(--accent-danger)", marginTop: "12px", fontSize: "13px", display: "flex", alignItems: "center", gap: "4px" }}><AlertTriangle size={14} /> {error}</p>}
                        </div>

                        {/* ══════════ 업로드 완료 문서 ══════════ */}
                        {uploadedFiles.length > 0 && (
                            <div className="card animate-fade-in" style={{ marginTop: "20px", animationDelay: "0.2s" }}>
                                <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                                    <CheckCircle2 size={20} color="var(--success)" /> 업로드 완료 ({uploadedFiles.length}개 문서)
                                </h2>
                                <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "300px", overflowY: "auto" }}>
                                    {uploadedFiles.map((file) => (
                                        <div key={file.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "var(--bg-secondary)", borderRadius: "8px" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                <div style={{ color: "var(--accent-primary)" }}>{getDocIcon(file.doc_type)}</div>
                                                <div>
                                                    <div style={{ fontSize: "13px", fontWeight: 500 }}>{file.filename}</div>
                                                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                                                        {file.doc_type} · {file.size_mb} MB{file.page_count ? ` · ${file.page_count}p` : ""}
                                                    </div>
                                                </div>
                                            </div>
                                            <span style={{
                                                padding: "3px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: 500,
                                                background: file.status === "embedded" ? "rgba(34,197,94,0.15)" : "rgba(99,102,241,0.15)",
                                                color: file.status === "embedded" ? "var(--success)" : "var(--accent-primary)",
                                            }}>
                                                {file.status === "embedded" ? <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><CheckCircle2 size={12} /> 처리완료</span> : "대기중"}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ══════════════════════════════════════════════════ */}
                        {/* ═══  Step 3: RAG 파이프라인  ═══ */}
                        {/* ══════════════════════════════════════════════════ */}
                        {uploadedFiles.length > 0 && (
                            <div className="card animate-fade-in" style={{ marginTop: "20px", animationDelay: "0.3s" }}>
                                <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
                                    <RefreshCw size={20} color="var(--accent-primary)" /> Step 3: RAG 파이프라인
                                </h2>
                                <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginBottom: "20px" }}>
                                    PDF 텍스트 추출 → 시맨틱 청킹 → Gemini 임베딩 생성 → MySQL 저장
                                </p>

                                {/* ── 시작 대기 ── */}
                                {!processResult && !processing && !processError && (
                                    <button className="btn btn-primary" onClick={runPipeline}
                                        style={{ fontSize: "15px", padding: "12px 28px", display: "flex", alignItems: "center", gap: "8px" }}>
                                        <Database size={16} /> RAG 파이프라인 실행
                                    </button>
                                )}

                                {/* ══════ 처리 중 애니메이션 ══════ */}
                                {processing && (
                                    <div style={{ position: "relative" }}>
                                        {/* 전체 진행률 바 */}
                                        <div style={{
                                            width: "100%", height: "8px", background: "var(--bg-secondary)",
                                            borderRadius: "4px", marginBottom: "24px", overflow: "hidden",
                                        }}>
                                            <div style={{
                                                width: `${overallPercent}%`, height: "100%",
                                                background: "linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899)",
                                                borderRadius: "4px", transition: "width 0.5s ease",
                                                boxShadow: "0 0 12px rgba(139, 92, 246, 0.5)",
                                            }} />
                                        </div>

                                        {/* 파이프라인 단계 인디케이터 */}
                                        <div style={{
                                            display: "flex", justifyContent: "space-between", alignItems: "center",
                                            marginBottom: "28px", padding: "0 8px",
                                        }}>
                                            {PIPELINE_STEPS.map((s, i) => {
                                                const stepIdx = PIPELINE_STEPS.findIndex((ps) => ps.step === currentStep);
                                                const isActive = s.step === currentStep;
                                                const isDone = i < stepIdx;

                                                return (
                                                    <div key={s.step} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", flex: 1 }}>
                                                        <div style={{
                                                            width: "48px", height: "48px", borderRadius: "50%",
                                                            display: "flex", alignItems: "center", justifyContent: "center",
                                                            fontSize: "20px", fontWeight: 700,
                                                            background: isDone ? "var(--accent-success)" : isActive ? "var(--accent-primary)" : "var(--bg-secondary)",
                                                            color: isDone || isActive ? "white" : "var(--text-muted)",
                                                            border: isActive ? "3px solid rgba(99,102,241,0.5)" : "2px solid var(--border-color)",
                                                            boxShadow: isActive ? "var(--glow-primary)" : "none",
                                                            animation: isActive ? "pulse-glow 1.5s ease-in-out infinite" : "none",
                                                            transition: "all 0.4s ease",
                                                        }}>
                                                            {isDone ? <CheckCircle2 size={24} /> : i === 0 ? <FileText size={20} /> : i === 1 ? <Scissors size={20} /> : i === 2 ? <BrainCircuit size={20} /> : <Database size={20} />}
                                                        </div>
                                                        <span style={{
                                                            fontSize: "11px", fontWeight: isActive ? 600 : 400,
                                                            color: isActive ? "var(--accent-primary)" : isDone ? "var(--accent-success)" : "var(--text-muted)",
                                                        }}>{s.label}</span>
                                                        {/* 연결선 */}
                                                        {i < PIPELINE_STEPS.length - 1 && (
                                                            <div style={{
                                                                position: "absolute", top: "56px",
                                                                left: `calc(${(i + 0.5) / PIPELINE_STEPS.length * 100}% + 24px)`,
                                                                width: `calc(${1 / PIPELINE_STEPS.length * 100}% - 48px)`,
                                                                height: "2px",
                                                                background: i < stepIdx ? "var(--accent-success)" : "var(--border-color)",
                                                            }} />
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* 현재 처리 중인 문서 */}
                                        <div style={{
                                            padding: "20px", background: "rgba(99,102,241,0.08)", borderRadius: "12px",
                                            border: "1px solid rgba(99,102,241,0.2)", marginBottom: "16px",
                                        }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
                                                <div style={{
                                                    width: "32px", height: "32px", borderRadius: "50%",
                                                    background: "var(--accent-primary)", display: "flex",
                                                    alignItems: "center", justifyContent: "center", color: "white"
                                                }}>
                                                    <Loader2 size={16} className="spin" />
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: "14px" }}>
                                                        문서 {currentDocIndex + 1}/{totalDocs} 처리 중
                                                    </div>
                                                    <div style={{ color: "var(--text-muted)", fontSize: "12px", marginTop: "2px" }}>
                                                        {currentDoc}
                                                    </div>
                                                </div>
                                                <div style={{ marginLeft: "auto", fontSize: "20px", fontWeight: 700, color: "var(--accent-primary)" }}>
                                                    {overallPercent}%
                                                </div>
                                            </div>

                                            {/* 임베딩 서브 프로그레스 */}
                                            {currentStep === "embedding" && embeddingProgress.total > 0 && (
                                                <div style={{ marginTop: "8px" }}>
                                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>
                                                        <span>임베딩: {embeddingProgress.done}/{embeddingProgress.total} 청크</span>
                                                        <span>{Math.round((embeddingProgress.done / embeddingProgress.total) * 100)}%</span>
                                                    </div>
                                                    <div style={{ width: "100%", height: "4px", background: "var(--bg-secondary)", borderRadius: "2px", overflow: "hidden" }}>
                                                        <div style={{
                                                            width: `${(embeddingProgress.done / embeddingProgress.total) * 100}%`,
                                                            height: "100%", background: "var(--accent-secondary)",
                                                            borderRadius: "2px", transition: "width 0.3s ease",
                                                        }} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* 완료된 문서 목록 (실시간) */}
                                        {completedDocs.length > 0 && (
                                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                                {completedDocs.map((doc, i) => (
                                                    <div key={i} style={{
                                                        display: "flex", alignItems: "center", justifyContent: "space-between",
                                                        padding: "8px 12px", background: "rgba(16,185,129,0.08)", borderRadius: "6px",
                                                        animation: "fadeIn 0.3s ease-out",
                                                    }}>
                                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                            <CheckCircle2 size={14} color="var(--success)" />
                                                            <span style={{ fontSize: "12px" }}>{doc.filename}</span>
                                                        </div>
                                                        <span style={{ fontSize: "11px", color: "var(--accent-success)" }}>
                                                            {doc.pages}p · {doc.chunks}청크
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <style>{`
                      @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                      @keyframes pulse-glow {
                        0%, 100% { box-shadow: 0 0 12px rgba(99,102,241,0.3); }
                        50% { box-shadow: 0 0 24px rgba(99,102,241,0.6), 0 0 48px rgba(99,102,241,0.3); }
                      }
                    `}</style>
                                    </div>
                                )}

                                {/* ══════ 에러 ══════ */}
                                {processError && (
                                    <div style={{ padding: "16px", background: "rgba(239,68,68,0.1)", borderRadius: "8px", marginTop: "12px" }}>
                                        <p style={{ color: "var(--accent-danger)", fontWeight: 500, display: "flex", alignItems: "center", gap: "6px" }}><XCircle size={16} /> {processError}</p>
                                        <button className="btn btn-secondary" onClick={runPipeline} style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "6px" }}><RefreshCw size={14} /> 다시 시도</button>
                                    </div>
                                )}

                                {/* ══════ 완료 결과 ══════ */}
                                {processResult && (
                                    <div className="animate-fade-in">
                                        <div style={{
                                            display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px"
                                        }}>
                                            {[
                                                { label: "전체 문서", value: processResult.summary?.total_documents, color: "var(--text-primary)" },
                                                { label: "처리 완료", value: processResult.summary?.processed, color: "var(--accent-success)" },
                                                { label: "실패", value: processResult.summary?.failed, color: processResult.summary?.failed > 0 ? "var(--accent-danger)" : "var(--text-primary)" },
                                                { label: "총 청크", value: processResult.summary?.total_chunks, color: "var(--accent-primary)" },
                                            ].map((item, i) => (
                                                <div key={i} style={{ padding: "16px", background: "var(--bg-secondary)", borderRadius: "8px", textAlign: "center" }}>
                                                    <div style={{ color: "var(--text-muted)", fontSize: "11px", marginBottom: "4px" }}>{item.label}</div>
                                                    <div style={{ fontSize: "24px", fontWeight: 700, color: item.color }}>{item.value}</div>
                                                </div>
                                            ))}
                                        </div>

                                        {processResult.processed?.length > 0 && (
                                            <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "250px", overflowY: "auto" }}>
                                                {processResult.processed.map((doc: any) => (
                                                    <div key={doc.id} style={{
                                                        display: "flex", alignItems: "center", justifyContent: "space-between",
                                                        padding: "8px 12px", background: "var(--bg-secondary)", borderRadius: "6px",
                                                    }}>
                                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                            <CheckCircle2 size={14} color="var(--success)" /><span style={{ fontSize: "12px" }}>{doc.filename}</span>
                                                        </div>
                                                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{doc.pages}p · {doc.chunks}청크</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {processResult.failed?.length > 0 && (
                                            <div style={{ marginTop: "12px" }}>
                                                <h3 style={{ fontSize: "14px", color: "var(--accent-danger)", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}><XCircle size={16} /> 실패한 문서</h3>
                                                {processResult.failed.map((doc: any) => (
                                                    <div key={doc.id} style={{ padding: "8px 12px", background: "rgba(239,68,68,0.1)", borderRadius: "6px", marginBottom: "4px", fontSize: "12px" }}>
                                                        {doc.filename} — <span style={{ color: "var(--text-muted)" }}>{doc.error}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                ) : null}
        </>
    );
}
