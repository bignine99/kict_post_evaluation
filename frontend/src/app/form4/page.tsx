"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProject } from "../contexts/ProjectContext";
import { FileText, Loader2, FolderOpen, RefreshCw, Coins, Zap, Bot, Megaphone, AlertTriangle, Wrench, ChevronUp, ChevronDown, Save, Edit3, Pin } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface FieldResult {
    field_id: string; form: string; section: string; category: string;
    label: string; extraction_type: string; value: any;
    confidence: number; source_refs: any[]; context_chunks_used: number;
}
interface ProjectInfo { id: number; name: string; status: string; total_documents: number; total_chunks: number; }

const SECTIONS = [
    { key: "4_1_cost", title: "1. 공사비 및 공사기간 분석", icon: <Coins size={18} /> },
    { key: "4_2_design", title: "2. 공사 중 설계변경 내용", icon: <RefreshCw size={18} /> },
    { key: "4_3_unique", title: "3. 사업의 특이성", icon: <Zap size={18} /> },
    { key: "4_4_smart", title: "4. 스마트 건설기술 적용", icon: <Bot size={18} /> },
    { key: "4_5_complaint", title: "5. 시공 중 민원", icon: <Megaphone size={18} /> },
    { key: "4_6_accident", title: "6. 안전사고(재해)", icon: <AlertTriangle size={18} /> },
    { key: "4_7_rework", title: "7. 재시공", icon: <Wrench size={18} /> },
    { key: "4_8_conclusion", title: "8. 결론", icon: <FileText size={18} /> },
];

export default function Form4Page() {
    const { selectedProject } = useProject();
    const router = useRouter();
    const [fields, setFields] = useState<FieldResult[]>([]);
    const [extracting, setExtracting] = useState(false);
    const [currentField, setCurrentField] = useState("");
    const [extractedCount, setExtractedCount] = useState(0);
    const [totalFields, setTotalFields] = useState(0);
    const [editingField, setEditingField] = useState<string | null>(null);
    const [editContent, setEditContent] = useState("");
    const [expandedFields, setExpandedFields] = useState<Record<string, boolean>>({});

    const toggleField = (fieldId: string) => {
        setExpandedFields(prev => ({ ...prev, [fieldId]: !prev[fieldId] }));
    };

    useEffect(() => {
        if (!selectedProject) {
            router.push("/projects");
            return;
        }
        loadExistingResults(selectedProject.id);
    }, [selectedProject]);

    const loadExistingResults = async (projectId: number) => {
        setFields([]);
        try {
            const listRes = await fetch(`${API_URL}/api/v1/projects/${projectId}/evaluate/fields`);
            const listData = await listRes.json();
            const form4FieldsBase = listData.fields.filter((f: any) => f.form === "별지4호");
            setTotalFields(form4FieldsBase.length);

            const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/evaluate/results`);
            const data = await res.json();

            let savedMap: Record<string, any> = {};
            if (data.results) {
                data.results.forEach((r: any) => { savedMap[r.field_id] = r; });
            }

            const merged = form4FieldsBase.map((base: any) => {
                const saved = savedMap[base.field_id];
                if (saved) return saved;
                return { ...base, value: null, confidence: 0, source_refs: [], context_chunks_used: 0 };
            });

            setFields(merged);
            setExtractedCount(Object.keys(savedMap).filter(k => form4FieldsBase.some((b: any) => b.field_id === k)).length);
        } catch (err) { console.error("기존 데이터 로드 실패:", err); }
    };

    const extractAll = async () => {
        if (!selectedProject || fields.length === 0) return;
        setExtracting(true); setExtractedCount(0);
        try {
            for (let i = 0; i < fields.length; i++) {
                setCurrentField(fields[i].label);
                setExtractedCount(i);
                const res = await fetch(`${API_URL}/api/v1/projects/${selectedProject.id}/evaluate/${fields[i].field_id}`, { method: "POST" });
                const result = await res.json();
                setFields(prev => { 
                    const idx = prev.findIndex(f => f.field_id === fields[i].field_id); 
                    if (idx >= 0) { const updated = [...prev]; updated[idx] = result; return updated; } 
                    return prev; 
                });
            }
            setExtractedCount(fields.length);
        } catch (err) { console.error(err); }
        finally { setExtracting(false); setCurrentField(""); }
    };

    const extractSingle = async (fieldId: string) => {
        if (!selectedProject) return;
        setCurrentField(fieldId);
        const res = await fetch(`${API_URL}/api/v1/projects/${selectedProject.id}/evaluate/${fieldId}`, { method: "POST" });
        const result = await res.json();
        setFields(prev => { const i = prev.findIndex(f => f.field_id === fieldId); if (i >= 0) { const u = [...prev]; u[i] = result; return u; } return [...prev, result]; });
        setCurrentField("");
    };

    const startEdit = (field: FieldResult) => {
        setEditingField(field.field_id);
        setEditContent(field.value?.content || JSON.stringify(field.value, null, 2));
    };

    const saveEdit = (fieldId: string) => {
        setFields(prev => prev.map(f => {
            if (f.field_id !== fieldId) return f;
            if (f.extraction_type === "narrative") return { ...f, value: { ...f.value, content: editContent, char_count: editContent.length } };
            return f;
        }));
        setEditingField(null);
    };

    const getFieldBySection = (key: string) => fields.filter(f => f.section === key);
    const getConfidenceColor = (c: number) => c >= 0.8 ? "var(--success)" : c >= 0.6 ? "var(--warning)" : "var(--accent-danger)";

    if (!selectedProject) return null;

    return (
        <>
            <div className="page-header">
                <h1 className="page-title"><FileText style={{ display: "inline", verticalAlign: "middle" }} size={28} /> 별지 제4호 — 사업수행성과 평가 결과보고서</h1>
                <p className="page-subtitle">건설공사 사후평가 시행지침에 따른 결과보고서 자동 작성</p>
            </div>

            {/* 프로젝트 헤더 */}
            <div className="card animate-fade-in" style={{ marginBottom: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                        <h2 style={{ fontSize: "18px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}><FolderOpen size={20} color="var(--accent-primary)" /> {selectedProject.name}</h2>
                        <p style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: "4px" }}>
                            문서 {selectedProject.total_documents}개 · 청크 {selectedProject.total_chunks.toLocaleString()}개
                        </p>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                        <button className="btn btn-primary" onClick={extractAll} disabled={extracting} style={{ fontSize: "14px", padding: "8px 20px" }}>
                            {extracting ? <><Loader2 className="spin" size={16} /> 추출 중... ({extractedCount}/{totalFields})</> : <><RefreshCw size={16} /> 전체 항목 생성</>}
                        </button>
                    </div>
                </div>
                            {extracting && (
                                <div style={{ marginTop: "16px" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "13px" }}>
                                        <span style={{ color: "var(--text-muted)" }}>현재: <strong>{currentField}</strong></span>
                                        <span>{extractedCount}/{totalFields}</span>
                                    </div>
                                    <div style={{ width: "100%", height: "6px", background: "var(--bg-secondary)", borderRadius: "3px", overflow: "hidden" }}>
                                        <div style={{ width: `${totalFields > 0 ? (extractedCount / totalFields) * 100 : 0}%`, height: "100%", background: "linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899)", borderRadius: "3px", transition: "width 0.5s", boxShadow: "0 0 8px rgba(139,92,246,0.4)" }} />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 섹션별 서술 항목 */}
                        {SECTIONS.map(section => {
                            const sectionFields = getFieldBySection(section.key);
                            if (sectionFields.length === 0 && !extracting) return null;

                            return (
                                <div key={section.key} className="card animate-fade-in" style={{ marginBottom: "16px" }}>
                                    <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                                        <span style={{ color: "var(--accent-primary)" }}>{section.icon}</span>{section.title}
                                    </h2>

                                    {sectionFields.map(field => (
                                        <div key={field.field_id} style={{ marginBottom: "16px", background: "var(--bg-secondary)", borderRadius: "10px", border: "1px solid var(--border-color)", overflow: "hidden" }}>
                                            {/* 항목 헤더 */}
                                            <div style={{ padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: expandedFields[field.field_id] ? "1px solid var(--border-color)" : "none", transition: "border-color 0.2s" }}>
                                                <div 
                                                    style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer", flex: 1 }} 
                                                    onClick={() => toggleField(field.field_id)}
                                                    title="클릭하여 세부내용 펼치기/접기"
                                                >
                                                    <span style={{ 
                                                        transform: expandedFields[field.field_id] ? "rotate(0deg)" : "rotate(-90deg)", 
                                                        transition: "transform 0.2s",
                                                        fontSize: "12px",
                                                        marginTop: "4px",
                                                        color: "var(--text-muted)"
                                                    }}>
                                                        ▼
                                                    </span>
                                                    <div>
                                                        <div style={{ fontWeight: 600, fontSize: "15px" }}>{field.label}</div>
                                                        <div style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "2px" }}>{field.category}</div>
                                                    </div>
                                                </div>
                                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                    <span style={{
                                                        padding: "3px 8px", borderRadius: "12px", fontSize: "10px", fontWeight: 600,
                                                        background: `${getConfidenceColor(field.confidence)}20`,
                                                        color: getConfidenceColor(field.confidence),
                                                    }}>
                                                        {Math.round(field.confidence * 100)}%
                                                    </span>
                                                    {field.value?.char_count && (
                                                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{field.value.char_count}자</span>
                                                    )}
                                                    <button className="btn btn-secondary" onClick={() => {
                                                        if (editingField !== field.field_id && !expandedFields[field.field_id]) {
                                                            toggleField(field.field_id);
                                                        }
                                                        editingField === field.field_id ? saveEdit(field.field_id) : startEdit(field);
                                                    }}
                                                        style={{ fontSize: "11px", padding: "4px 10px", display: "flex", alignItems: "center", gap: "4px" }}>
                                                        {editingField === field.field_id ? <><Save size={14} /> 저장</> : <><Edit3 size={14} /> 편집</>}
                                                    </button>
                                                    <button className="btn btn-secondary" onClick={() => extractSingle(field.field_id)}
                                                        disabled={currentField === field.field_id}
                                                        style={{ fontSize: "11px", padding: "4px 10px", display: "flex", alignItems: "center", gap: "4px" }}
                                                        title="재추출">
                                                        {currentField === field.field_id ? <Loader2 className="spin" size={14} /> : <RefreshCw size={14} />}
                                                    </button>
                                                    <button className="btn btn-secondary" onClick={() => toggleField(field.field_id)}
                                                        style={{ fontSize: "11px", padding: "4px 10px", display: "flex", alignItems: "center", gap: "4px" }}>
                                                        {expandedFields[field.field_id] ? <><ChevronUp size={14} /> 접기</> : <><ChevronDown size={14} /> 펴기</>}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* 서술 내용 */}
                                            {expandedFields[field.field_id] && (
                                            <div style={{ padding: "16px 18px" }}>
                                                {editingField === field.field_id ? (
                                                    <textarea
                                                        value={editContent}
                                                        onChange={e => setEditContent(e.target.value)}
                                                        style={{
                                                            width: "100%", minHeight: "200px", padding: "12px", fontSize: "13px",
                                                            lineHeight: 1.8, borderRadius: "8px", border: "1px solid var(--accent-primary)",
                                                            background: "var(--bg-primary)", color: "var(--text-primary)",
                                                            resize: "vertical", outline: "none", fontFamily: "inherit",
                                                        }}
                                                    />
                                                ) : (
                                                    <div style={{ fontSize: "13px", lineHeight: 1.8, whiteSpace: "pre-wrap", color: "var(--text-secondary)", background: field.value === null ? "rgba(255,100,100,0.05)" : "transparent", padding: field.value === null ? "12px" : "0", borderRadius: "8px" }}>
                                                        {field.value === null 
                                                            ? "아직 AI가 데이터를 추출하지 않았습니다. [재추출] 또는 [편집] 버튼을 눌러주세요." 
                                                            : (field.value?.content || JSON.stringify(field.value, null, 2))}
                                                    </div>
                                                )}

                                                {/* 핵심 사실 & 출처 */}
                                                {field.value !== null && field.value?.key_facts?.length > 0 && (
                                                    <div style={{ marginTop: "12px", padding: "10px", background: "rgba(99,102,241,0.08)", borderRadius: "8px" }}>
                                                        <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--accent-primary)", marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}><Pin size={12} /> 핵심 사실</div>
                                                        <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "12px", color: "var(--text-secondary)" }}>
                                                            {field.value.key_facts.map((f: string, i: number) => <li key={i} style={{ marginBottom: "4px" }}>{f}</li>)}
                                                        </ul>
                                                    </div>
                                                )}

                                                {field.source_refs?.length > 0 && (
                                                    <div style={{ marginTop: "8px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                                        {field.source_refs.slice(0, 3).map((ref: any, i: number) => (
                                                            <span key={i} style={{ fontSize: "10px", padding: "3px 8px", background: "var(--bg-primary)", borderRadius: "4px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                                                                <FileText size={10} /> {ref.source_file} p.{ref.page_num}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            );
                        })}
        </>
    );
}
