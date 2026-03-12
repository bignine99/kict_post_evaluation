"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProject } from "../contexts/ProjectContext";
import { ClipboardList, FileText, Loader2, FolderOpen, RefreshCw, BarChart2, TrendingUp } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ... [rest of file interfaces/constants unchanged until component start]
interface FieldResult {
    field_id: string;
    form: string;
    section: string;
    category: string;
    label: string;
    extraction_type: string;
    value: any;
    confidence: number;
    source_refs: any[];
    context_chunks_used: number;
}

interface ProjectInfo { id: number; name: string; status: string; total_documents: number; total_chunks: number; }

const SECTIONS = [
    { key: "1_overview", title: "1. 건설공사 개요", icon: <ClipboardList size={18} /> },
    { key: "2_details", title: "2. 사업유형별 세부내용", icon: <BarChart2 size={18} /> },
    { key: "3_performance", title: "3. 수행성과평가", icon: <TrendingUp size={18} /> },
];

export default function Form3Page() {
    const { selectedProject } = useProject();
    const router = useRouter();
    const [fields, setFields] = useState<FieldResult[]>([]);
    const [extracting, setExtracting] = useState(false);
    const [currentField, setCurrentField] = useState("");
    const [extractedCount, setExtractedCount] = useState(0);
    const [totalFields, setTotalFields] = useState(0);
    const [expandedField, setExpandedField] = useState<string | null>(null);

    // 프로젝트 미선택 시 프로젝트 선택 페이지로 리다이렉트
    useEffect(() => {
        if (!selectedProject) {
            router.push("/projects");
            return;
        }
        // 프로젝트 선택 시 자동으로 기존 결과 로드
        loadExistingResults(selectedProject.id);
    }, [selectedProject]);

    const loadExistingResults = async (projectId: number) => {
        setFields([]);
        try {
            // 필드 목록 가져오기
            const listRes = await fetch(`${API_URL}/api/v1/projects/${projectId}/evaluate/fields`);
            const listData = await listRes.json();
            const form3FieldsBase = listData.fields.filter((f: any) => f.form === "별지3호");
            setTotalFields(form3FieldsBase.length);

            // 기존 결과 가져오기
            const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/evaluate/results`);
            const data = await res.json();
            
            let savedMap: Record<string, any> = {};
            if (data.results) {
                data.results.forEach((r: any) => { savedMap[r.field_id] = r; });
            }

            // 병합
            const merged = form3FieldsBase.map((base: any) => {
                const saved = savedMap[base.field_id];
                if (saved) return saved;
                return { ...base, value: null, confidence: 0, source_refs: [], context_chunks_used: 0 };
            });
            
            setFields(merged);
            setExtractedCount(Object.keys(savedMap).filter(k => form3FieldsBase.some((b: any) => b.field_id === k)).length);
        } catch (err) { console.error("기존 데이터 로드 실패:", err); }
    };

    // ── 전체 필드 추출 (SSE-like 순차 호출) ──
    const extractAll = async () => {
        if (!selectedProject || fields.length === 0) return;
        setExtracting(true);
        setExtractedCount(0);

        try {
            // 순차적으로 각 필드 추출
            for (let i = 0; i < fields.length; i++) {
                setCurrentField(fields[i].label);
                setExtractedCount(i);

                const res = await fetch(
                    `${API_URL}/api/v1/projects/${selectedProject.id}/evaluate/${fields[i].field_id}`,
                    { method: "POST" }
                );
                const result = await res.json();
                
                setFields(prev => {
                    const idx = prev.findIndex(f => f.field_id === fields[i].field_id);
                    if (idx >= 0) {
                        const updated = [...prev];
                        updated[idx] = result;
                        return updated;
                    }
                    return prev;
                });
            }
            setExtractedCount(fields.length);
        } catch (err) {
            console.error("추출 오류:", err);
        } finally {
            setExtracting(false);
            setCurrentField("");
        }
    };

    // ── 단일 필드 추출 ──
    const extractSingle = async (fieldId: string) => {
        if (!selectedProject) return;
        setCurrentField(fieldId);
        const res = await fetch(
            `${API_URL}/api/v1/projects/${selectedProject.id}/evaluate/${fieldId}`,
            { method: "POST" }
        );
        const result = await res.json();
        setFields(prev => {
            const existing = prev.findIndex(f => f.field_id === fieldId);
            if (existing >= 0) {
                const updated = [...prev];
                updated[existing] = result;
                return updated;
            }
            return [...prev, result];
        });
        setCurrentField("");
    };

    const getFieldBySection = (sectionKey: string) => fields.filter(f => f.section === sectionKey);

    const getConfidenceColor = (c: number) => {
        if (c >= 0.8) return "var(--success)";
        if (c >= 0.6) return "var(--warning)";
        return "var(--accent-danger)";
    };

    const getConfidenceLabel = (c: number) => {
        if (c >= 0.8) return "높음";
        if (c >= 0.6) return "보통";
        return "낮음";
    };

    const formatValue = (value: any): string => {
        if (!value) return "-";
        if (typeof value === "string") return value;
        if (typeof value === "number") return value.toLocaleString("ko-KR");
        if (value.content) return value.content; // narrative
        // structured: find first meaningful value
        const skip = ["출처문서", "출처페이지", "신뢰도", "not_found_reason", "parse_error", "raw_response"];
        const entries = Object.entries(value).filter(([k]) => !skip.includes(k));
        return entries.map(([k, v]) => `${k}: ${typeof v === "number" ? v.toLocaleString("ko-KR") : v}`).join(" | ");
    };

    if (!selectedProject) return null;

    return (
        <>
            <div className="page-header">
                <h1 className="page-title"><ClipboardList style={{ display: "inline", verticalAlign: "middle" }} size={28} /> 별지 제3호 — 사업수행성과 평가표</h1>
                <p className="page-subtitle">건설공사 사후평가 시행지침에 따른 평가표 자동 작성</p>
            </div>

            {/* 프로젝트 헤더 + 추출 버튼 */}
            <div className="card animate-fade-in" style={{ marginBottom: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                        <h2 style={{ fontSize: "18px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}><FolderOpen size={20} color="var(--accent-primary)" /> {selectedProject.name}</h2>
                        <p style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: "4px" }}>
                            문서 {selectedProject.total_documents}개 · 청크 {selectedProject.total_chunks.toLocaleString()}개
                        </p>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                        <button className="btn btn-primary" onClick={extractAll} disabled={extracting}
                            style={{ fontSize: "14px", padding: "8px 20px" }}>
                            {extracting ? <><Loader2 className="spin" size={16} /> 추출 중... ({extractedCount}/{totalFields})</> : <><RefreshCw size={16} /> 전체 필드 추출</>}
                        </button>
                    </div>
                </div>

                            {/* 추출 진행률 */}
                            {extracting && (
                                <div style={{ marginTop: "16px" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "13px" }}>
                                        <span style={{ color: "var(--text-muted)" }}>현재: <strong>{currentField}</strong></span>
                                        <span>{extractedCount}/{totalFields}</span>
                                    </div>
                                    <div style={{ width: "100%", height: "6px", background: "var(--bg-secondary)", borderRadius: "3px", overflow: "hidden" }}>
                                        <div style={{
                                            width: `${totalFields > 0 ? (extractedCount / totalFields) * 100 : 0}%`, height: "100%",
                                            background: "linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899)",
                                            borderRadius: "3px", transition: "width 0.5s ease",
                                            boxShadow: "0 0 8px rgba(139, 92, 246, 0.4)",
                                        }} />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 섹션별 결과 표시 */}
                        {SECTIONS.map(section => {
                            const sectionFields = getFieldBySection(section.key);
                            if (sectionFields.length === 0 && !extracting) return null;

                            return (
                                <div key={section.key} className="card animate-fade-in" style={{ marginBottom: "16px" }}>
                                    <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                                        <span>{section.icon}</span>{section.title}
                                        <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 400 }}>({sectionFields.length}개 추출됨)</span>
                                    </h2>

                                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                        {sectionFields.map(field => (
                                            <div key={field.field_id} style={{
                                                background: "var(--bg-secondary)", borderRadius: "8px",
                                                border: expandedField === field.field_id ? "1px solid var(--accent-primary)" : "1px solid var(--border-color)",
                                                overflow: "hidden", transition: "all 0.2s",
                                            }}>
                                                {/* 필드 헤더 */}
                                                <div
                                                    onClick={() => setExpandedField(expandedField === field.field_id ? null : field.field_id)}
                                                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", cursor: "pointer" }}
                                                >
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "2px" }}>{field.category}</div>
                                                        <div style={{ fontWeight: 600, fontSize: "14px" }}>{field.label}</div>
                                                    </div>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                        <div style={{ textAlign: "right", maxWidth: "300px" }}>
                                                            <div style={{ fontSize: "13px", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                                {formatValue(field.value)}
                                                            </div>
                                                        </div>
                                                        <div style={{
                                                            padding: "3px 8px", borderRadius: "12px", fontSize: "10px", fontWeight: 600,
                                                            background: `${getConfidenceColor(field.confidence)}20`,
                                                            color: getConfidenceColor(field.confidence),
                                                            whiteSpace: "nowrap",
                                                        }}>
                                                            {getConfidenceLabel(field.confidence)} {Math.round(field.confidence * 100)}%
                                                        </div>
                                                        <span style={{ fontSize: "12px", transition: "transform 0.2s", transform: expandedField === field.field_id ? "rotate(180deg)" : "none" }}>▼</span>
                                                    </div>
                                                </div>

                                                {/* 필드 상세 (펼침) */}
                                                {expandedField === field.field_id && (
                                                    <div style={{ padding: "0 16px 16px", borderTop: "1px solid var(--border-color)" }}>
                                                        {/* 추출값 전체 */}
                                                        <div style={{ marginTop: "12px" }}>
                                                            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: 600 }}>추출 데이터</div>
                                                            {field.value === null ? (
                                                                <div style={{ fontSize: "13px", color: "rgba(255,100,100,0.8)", background: "rgba(255,100,100,0.05)", padding: "12px", borderRadius: "6px" }}>
                                                                    아직 AI가 데이터를 추출하지 않았습니다. 하단의 [재추출] 버튼을 눌러주세요.
                                                                </div>
                                                            ) : field.extraction_type === "narrative" && field.value?.content ? (
                                                                <div style={{ fontSize: "13px", lineHeight: 1.7, whiteSpace: "pre-wrap", background: "var(--bg-primary)", padding: "12px", borderRadius: "6px" }}>
                                                                    {field.value.content}
                                                                    <div style={{ marginTop: "8px", fontSize: "11px", color: "var(--text-muted)" }}>
                                                                        글자 수: {field.value.char_count || field.value.content.length}자
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <pre style={{ fontSize: "12px", background: "var(--bg-primary)", padding: "10px", borderRadius: "6px", overflow: "auto", maxHeight: "200px" }}>
                                                                    {JSON.stringify(field.value, null, 2)}
                                                                </pre>
                                                            )}
                                                        </div>

                                                        {/* 출처 */}
                                                        {field.source_refs?.length > 0 && (
                                                            <div style={{ marginTop: "12px" }}>
                                                                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: 600 }}>출처 ({field.context_chunks_used}개 청크 참조)</div>
                                                                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                                                    {field.source_refs.slice(0, 3).map((ref: any, i: number) => (
                                                                        <div key={i} style={{ fontSize: "11px", color: "var(--text-muted)", padding: "6px 8px", background: "var(--bg-primary)", borderRadius: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                                                                            <FileText size={12} /> {ref.source_file} · p.{ref.page_num} · 유사도 {Math.round(ref.score * 100)}%
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* 재추출 버튼 */}
                                                        <button className="btn btn-secondary" onClick={() => extractSingle(field.field_id)}
                                                            disabled={currentField === field.field_id}
                                                            style={{ marginTop: "12px", fontSize: "12px", padding: "6px 14px", display: "flex", alignItems: "center", gap: "6px" }}>
                                                            {currentField === field.field_id ? <><Loader2 className="spin" size={14}/> 추출 중...</> : <><RefreshCw size={14} /> 재추출</>}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
        </>
    );
}
