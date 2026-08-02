import { prisma } from "../prisma";
import { cvExtractionQueue } from "../queue/cvExtractionQueue";

/**
 * work-experience-detail: one-off backfill, not an API/admin action (design.md
 * Decision 5) — only a handful of candidates have extracted data today. Runs
 * every existing Resume back through the normal extraction job path, so the
 * new responsibilities/projects/achievements/stack fields get filled in via
 * processCvExtractionJob's existing replace-semantics persistence, exactly
 * as if each resume were being uploaded for the first time.
 */
export async function reprocessExistingResumes(): Promise<number> {
  const resumes = await prisma.resume.findMany();

  for (const resume of resumes) {
    await cvExtractionQueue.add("extract", {
      resumeId: resume.id,
      candidateId: resume.candidateId,
      filePath: resume.filePath,
    });
  }

  return resumes.length;
}

if (require.main === module) {
  reprocessExistingResumes()
    .then((count) => {
      // eslint-disable-next-line no-console
      console.log(`Re-enqueued extraction for ${count} existing resume(s).`);
      process.exit(0);
    })
    .catch((err: unknown) => {
      // eslint-disable-next-line no-console
      console.error("Failed to reprocess existing resumes:", err);
      process.exit(1);
    });
}
