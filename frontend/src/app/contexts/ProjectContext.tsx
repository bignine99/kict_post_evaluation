"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface ProjectInfo {
  id: number;
  name: string;
  status: string;
  total_documents: number;
  total_chunks: number;
}

interface ProjectContextType {
  projects: ProjectInfo[];
  selectedProject: ProjectInfo | null;
  selectProject: (p: ProjectInfo | null) => void;
  refreshProjects: () => Promise<void>;
  loading: boolean;
}

const ProjectContext = createContext<ProjectContextType>({
  projects: [],
  selectedProject: null,
  selectProject: () => {},
  refreshProjects: async () => {},
  loading: true,
});

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProjects = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/v1/projects`);
      const data = await res.json();
      setProjects(data.projects || []);
    } catch (e) {
      console.error("프로젝트 목록 로드 실패:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshProjects();
  }, []);

  const selectProject = (p: ProjectInfo | null) => {
    setSelectedProject(p);
  };

  return (
    <ProjectContext.Provider value={{ projects, selectedProject, selectProject, refreshProjects, loading }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  return useContext(ProjectContext);
}
