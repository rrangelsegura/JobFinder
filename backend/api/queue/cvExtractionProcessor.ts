import { Job } from "bullmq";
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
  start_date?: string | null;
  end_date?: string | null;
}

interface ProjectEntry {
  name: string;
  description?: string | null;
  achievements: string[];
  stack: string[];
}

interface WorkExperienceEntry {
  company: string;
  position: string;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  responsibilities: string[];
  projects: ProjectEntry[];
}

interface SkillEntry {
  name: string;
  type: "technical" | "soft";
  proficiency?: string | null;
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
 *
 * work-experience-detail: uses Prisma's interactive transaction form, not the
 * old sequential-array form — WorkExperience and Project rows must be
 * created individually (not via createMany) so their generated ids can be
 * used by their own children (Project needs its parent WorkExperience's id;
 * ProjectAchievement/ProjectStackItem need their parent Project's id).
 *
 * The delete-then-insert below runs unconditionally, inside this same
 * transaction, for every job — not just re-processing runs. A first-time
 * extraction has nothing to delete (deleteMany on a candidateId with no rows
 * is a no-op), so one code path correctly handles both "new candidate" and
 * "re-processing an already-extracted candidate" without branching. Because
 * it's inside the transaction, a failed extraction never leaves a candidate
 * with prior data deleted and nothing to replace it — the delete only takes
 * effect if the whole transaction (including every insert below) succeeds.
 */
export async function processCvExtractionJob(job: Job<CvExtractionJobData>): Promise<CvExtractionResult> {
  const { candidateId, resumeId } = job.data;

  // cv-extraction-progress-phases: these are the only two real steps this
  // worker goes through — callAgent() is one opaque HTTP call covering OCR,
  // LLM extraction, and embedding inside the Python service, so "extracting"
  // is intentionally coarse rather than a false claim of finer visibility.
  await job.updateProgress({ phase: "extracting" });
  const result = await callAgent(job.data);

  await job.updateProgress({ phase: "saving" });
  await prisma.$transaction(async (tx) => {
    // Personal info goes on the Resume, not the Candidate — Candidate.email
    // is the login credential and must never be silently rewritten by resume
    // content (candidates may hold several resumes reporting different or no
    // contact info).
    await tx.resume.update({
      where: { id: resumeId },
      data: {
        extractedFirstName: result.personal_info.first_name,
        extractedLastName: result.personal_info.last_name,
        extractedEmail: result.personal_info.email,
        extractedPhone: result.personal_info.phone ?? null,
        extractedAddress: result.personal_info.address ?? null,
      },
    });

    // Replace, don't accumulate: WorkExperience/Education/Skill/Language/
    // Certification are keyed to candidateId, not resumeId, so re-running
    // extraction without this would duplicate everything. Deleting
    // WorkExperience cascades (DB-level onDelete: Cascade) to its
    // WorkExperienceResponsibility/Project rows, and Project cascades to its
    // ProjectAchievement/ProjectStackItem rows.
    await tx.workExperience.deleteMany({ where: { candidateId } });
    await tx.education.deleteMany({ where: { candidateId } });
    await tx.skill.deleteMany({ where: { candidateId } });
    await tx.language.deleteMany({ where: { candidateId } });
    await tx.certification.deleteMany({ where: { candidateId } });

    if (result.education.length > 0) {
      await tx.education.createMany({
        data: result.education.map((e) => ({
          institution: e.institution,
          title: e.title,
          startDate: e.start_date ? new Date(e.start_date) : null,
          endDate: e.end_date ? new Date(e.end_date) : null,
          candidateId,
        })),
      });
    }

    for (const w of result.work_experience) {
      const workExperience = await tx.workExperience.create({
        data: {
          company: w.company,
          position: w.position,
          description: w.description ?? null,
          startDate: w.start_date ? new Date(w.start_date) : null,
          endDate: w.end_date ? new Date(w.end_date) : null,
          candidateId,
        },
      });

      if (w.responsibilities.length > 0) {
        await tx.workExperienceResponsibility.createMany({
          data: w.responsibilities.map((text) => ({ text, workExperienceId: workExperience.id })),
        });
      }

      for (const p of w.projects) {
        const project = await tx.project.create({
          data: {
            name: p.name,
            description: p.description ?? null,
            workExperienceId: workExperience.id,
          },
        });

        if (p.achievements.length > 0) {
          await tx.projectAchievement.createMany({
            data: p.achievements.map((text) => ({ text, projectId: project.id })),
          });
        }

        if (p.stack.length > 0) {
          await tx.projectStackItem.createMany({
            data: p.stack.map((name) => ({ name, projectId: project.id })),
          });
        }
      }
    }

    if (result.skills.length > 0) {
      await tx.skill.createMany({
        data: result.skills.map((s) => ({
          name: s.name,
          type: s.type,
          proficiency: s.proficiency ?? null,
          candidateId,
        })),
      });
    }

    if (result.languages.length > 0) {
      await tx.language.createMany({
        data: result.languages.map((l) => ({
          name: l.name,
          proficiency: l.proficiency ?? null,
          candidateId,
        })),
      });
    }

    if (result.certifications.length > 0) {
      await tx.certification.createMany({
        data: result.certifications.map((c) => ({
          name: c.name,
          issuer: c.issuer ?? null,
          issueDate: c.issue_date ? new Date(c.issue_date) : null,
          candidateId,
        })),
      });
    }
  });

  return result;
}
