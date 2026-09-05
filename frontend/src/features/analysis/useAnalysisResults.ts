import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/apiClient"

export interface PersonalInfo {
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  address: string | null
}

export interface EducationItem {
  id: number
  institution: string
  title: string
  startDate: string | null
  endDate: string | null
}

export interface ProjectAchievement {
  id: number
  text: string
}

export interface ProjectStackItem {
  id: number
  name: string
}

export interface ProjectItem {
  id: number
  name: string
  description: string | null
  achievements: ProjectAchievement[]
  stack: ProjectStackItem[]
}

export interface WorkExperienceResponsibility {
  id: number
  text: string
}

export interface WorkExperienceItem {
  id: number
  company: string
  position: string
  description: string | null
  startDate: string | null
  endDate: string | null
  responsibilities: WorkExperienceResponsibility[]
  projects: ProjectItem[]
}

export interface SkillItem {
  id: number
  name: string
  type: "technical" | "soft"
  proficiency: string | null
}

export interface LanguageItem {
  id: number
  name: string
  proficiency: string | null
}

export interface CertificationItem {
  id: number
  name: string
  issuer: string | null
  issueDate: string | null
}

export type AnalysisResultsData =
  | { hasAnalysis: false }
  | {
      hasAnalysis: true
      personalInfo: PersonalInfo
      education: EducationItem[]
      workExperience: WorkExperienceItem[]
      skills: SkillItem[]
      languages: LanguageItem[]
      certifications: CertificationItem[]
    }

interface AnalysisResultsResponse {
  status: "success"
  data: AnalysisResultsData
  agent_trace_id: string
  model_used: string | null
}

async function fetchAnalysisResults(): Promise<AnalysisResultsData> {
  const { data } =
    await apiClient.get<AnalysisResultsResponse>("/candidates/me")
  return data.data
}

// Unlike useCvExtractionStatus, this isn't watching an in-flight job — no
// polling. The candidate navigates here to see what's already persisted.
export function useAnalysisResults() {
  return useQuery({
    queryKey: ["analysis-results"],
    queryFn: fetchAnalysisResults,
  })
}
