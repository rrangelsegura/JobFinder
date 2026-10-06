import { Job } from "bullmq";
import { prisma } from "../prisma";
import { InvitationReplyJobData } from "./invitationReplyQueue";

const AGENT_CORE_URL = process.env.AGENT_CORE_URL ?? "http://localhost:8000";

// Bounded summary sent to the agent (design.md Decision 3): enough to ground
// a reply, small enough to protect the local model's 8192-token context.
const MAX_PREVIOUS_COMPANIES = 3;
const MAX_TOP_SKILLS = 8;
const MAX_EXPERIENCES_READ = 5;

// Snake_case: this is the Python agent's REST contract.
interface AgentInvitationExtraction {
  recruiter_name: string | null;
  recruiter_title: string | null;
  company: string | null;
  role_title: string | null;
  location: string | null;
  language: string;
  call_to_action: string | null;
}

interface AgentCandidateSummary {
  full_name: string;
  current_title: string | null;
  current_company: string | null;
  previous_companies: string[];
  top_skills: string[];
}

export interface ParsedInvitation {
  recruiterName: string | null;
  recruiterTitle: string | null;
  company: string | null;
  roleTitle: string | null;
  location: string | null;
  language: string;
  callToAction: string | null;
}

export interface InvitationReplyResult {
  invitation: ParsedInvitation;
  draftReply: string;
}

async function callAgent<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${AGENT_CORE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let message = `Invitation responder agent responded with status ${response.status}`;
    try {
      const errorBody = (await response.json()) as { detail?: { error?: string } };
      if (errorBody?.detail?.error) {
        message = errorBody.detail.error;
      }
    } catch {
      // response body wasn't valid JSON — fall back to the generic status message
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

async function buildCandidateSummary(candidateId: number): Promise<AgentCandidateSummary> {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: {
      // Most recent first; entries without a start date sort last.
      workExperiences: {
        orderBy: { startDate: { sort: "desc", nulls: "last" } },
        take: MAX_EXPERIENCES_READ,
      },
      skills: true,
    },
  });
  if (!candidate) {
    throw new Error(`Candidate ${candidateId} was not found.`);
  }

  const [latest, ...earlier] = candidate.workExperiences;
  const previousCompanies = [
    ...new Set(earlier.map((w) => w.company).filter((company) => company !== latest?.company)),
  ].slice(0, MAX_PREVIOUS_COMPANIES);

  // Technical skills first: they are the ones a recruiter's role cares about.
  const topSkills = [...candidate.skills]
    .sort((a, b) => Number(b.type === "technical") - Number(a.type === "technical"))
    .slice(0, MAX_TOP_SKILLS)
    .map((s) => s.name);

  return {
    full_name: `${candidate.firstName} ${candidate.lastName}`.trim(),
    current_title: latest?.position ?? null,
    current_company: latest?.company ?? null,
    previous_companies: previousCompanies,
    top_skills: topSkills,
  };
}

function toParsedInvitation(extraction: AgentInvitationExtraction): ParsedInvitation {
  return {
    recruiterName: extraction.recruiter_name ?? null,
    recruiterTitle: extraction.recruiter_title ?? null,
    company: extraction.company ?? null,
    roleTitle: extraction.role_title ?? null,
    location: extraction.location ?? null,
    language: extraction.language,
    callToAction: extraction.call_to_action ?? null,
  };
}

/**
 * Same boundary as cvExtractionProcessor (design.md Decision 0 of the CV
 * change): the Python agent only returns validated data over REST; this worker
 * is the only piece that persists it. The three phases are the real steps —
 * two LLM calls and the save — so the status endpoint reports truthfully.
 *
 * The draft is persisted but never sent anywhere (design.md Decision 7).
 */
export async function processInvitationReplyJob(
  job: Job<InvitationReplyJobData>,
): Promise<InvitationReplyResult> {
  const { invitationId, candidateId, invitationText, intent } = job.data;

  await job.updateProgress({ phase: "parsing" });
  const extraction = await callAgent<AgentInvitationExtraction>("/invitation-responder/extract", {
    invitation_text: invitationText,
  });

  await job.updateProgress({ phase: "drafting" });
  const candidate = await buildCandidateSummary(candidateId);
  const { draft_reply: draftReply } = await callAgent<{ draft_reply: string }>(
    "/invitation-responder/draft",
    { invitation_text: invitationText, invitation: extraction, intent, candidate },
  );

  await job.updateProgress({ phase: "saving" });
  const invitation = toParsedInvitation(extraction);
  await prisma.jobInvitation.update({
    where: { id: invitationId },
    data: { ...invitation, draftReply, status: "completed" },
  });

  return { invitation, draftReply };
}
