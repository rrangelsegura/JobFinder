import { Job } from "bullmq";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { CvExtractionJobData } from "./cvExtractionQueue";

const AGENT_CORE_URL = process.env.AGENT_CORE_URL ?? "http://localhost:8000";

interface PersonalInfo {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
}

interface EducationEntry {
  institution: string;
  title: string;
  start_date: string;
  end_date?: string | null;
}

interface WorkExperienceEntry {
  company: string;
  position: string;
  description?: string | null;
  start_date: string;
  end_date?: string | null;
}

interface SkillEntry {
  name: string;
  type: "technical" | "soft";
}

interface LanguageEntry {
  name: string;
  proficiency?: string | null;
}

interface CertificationEntry {
  name: string;
  issuer?: string | null;
  issue_date?: string | null;
}

export interface CvExtractionResult {
  personal_info: PersonalInfo;
  education: EducationEntry[];
  work_experience: WorkExperienceEntry[];
  skills: SkillEntry[];
  languages: LanguageEntry[];
  certifications: CertificationEntry[];
}

async function callAgent(data: CvExtractionJobData): Promise<CvExtractionResult> {
  const response = await fetch(`${AGENT_CORE_URL}/cv-analyst/extract`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      resume_id: data.resumeId,
      candidate_id: data.candidateId,
      file_path: data.filePath,
    }),
  });

  if (!response.ok) {
    let message = `CV extraction agent responded with status ${response.status}`;
    try {
      const body = (await response.json()) as { detail?: { error?: string } };
      if (body?.detail?.error) {
        message = body.detail.error;
      }
    } catch {
      // response body wasn't valid JSON — fall back to the generic status message
    }
    throw new Error(message);
  }

  return (await response.json()) as CvExtractionResult;
}

/**
 * Per design.md Decision 0: the Python agent never touches Postgres — it only
 * returns structured, validated data over REST. This worker is the only piece
 * that persists it, via a single transaction so a partial failure never
 * leaves the candidate with some-but-not-all extracted records.
 */
export async function processCvExtractionJob(job: Job<CvExtractionJobData>): Promise<CvExtractionResult> {
  const { candidateId } = job.data;
  const result = await callAgent(job.data);

  const operations: Prisma.PrismaPromise<unknown>[] = [
    prisma.candidate.update({
      where: { id: candidateId },
      data: {
        firstName: result.personal_info.first_name,
        lastName: result.personal_info.last_name,
        email: result.personal_info.email,
        phone: result.personal_info.phone ?? null,
        address: result.personal_info.address ?? null,
      },
    }),
  ];

  if (result.education.length > 0) {
    operations.push(
      prisma.education.createMany({
        data: result.education.map((e) => ({
          institution: e.institution,
          title: e.title,
          startDate: new Date(e.start_date),
          endDate: e.end_date ? new Date(e.end_date) : null,
          candidateId,
        })),
      })
    );
  }

  if (result.work_experience.length > 0) {
    operations.push(
      prisma.workExperience.createMany({
        data: result.work_experience.map((w) => ({
          company: w.company,
          position: w.position,
          description: w.description ?? null,
          startDate: new Date(w.start_date),
          endDate: w.end_date ? new Date(w.end_date) : null,
          candidateId,
        })),
      })
    );
  }

  if (result.skills.length > 0) {
    operations.push(
      prisma.skill.createMany({
        data: result.skills.map((s) => ({ name: s.name, type: s.type, candidateId })),
      })
    );
  }

  if (result.languages.length > 0) {
    operations.push(
      prisma.language.createMany({
        data: result.languages.map((l) => ({
          name: l.name,
          proficiency: l.proficiency ?? null,
          candidateId,
        })),
      })
    );
  }

  if (result.certifications.length > 0) {
    operations.push(
      prisma.certification.createMany({
        data: result.certifications.map((c) => ({
          name: c.name,
          issuer: c.issuer ?? null,
          issueDate: c.issue_date ? new Date(c.issue_date) : null,
          candidateId,
        })),
      })
    );
  }

  await prisma.$transaction(operations);

  return result;
}
