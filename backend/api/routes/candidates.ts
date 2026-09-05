import { Router, Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/requireAuth";

export const candidatesRouter = Router();

candidatesRouter.get(
  "/candidates/me",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const candidateId = req.candidateId as number;

      // candidate-analysis-results design.md Decision 3: personal info comes
      // from the most recent resume that actually completed extraction, not
      // necessarily the most recently uploaded one (which may still be
      // processing or have failed).
      const latestResumeWithData = await prisma.resume.findFirst({
        where: { candidateId, extractedFirstName: { not: null } },
        orderBy: { uploadDate: "desc" },
      });

      if (!latestResumeWithData) {
        res.status(200).json({
          status: "success",
          data: { hasAnalysis: false },
          agent_trace_id: randomUUID(),
          model_used: null,
        });
        return;
      }

      const candidate = await prisma.candidate.findUnique({
        where: { id: candidateId },
        include: {
          educations: true,
          workExperiences: {
            include: {
              responsibilities: true,
              projects: { include: { achievements: true, stack: true } },
            },
          },
          skills: true,
          languages: true,
          certifications: true,
        },
      });

      res.status(200).json({
        status: "success",
        data: {
          hasAnalysis: true,
          personalInfo: {
            firstName: latestResumeWithData.extractedFirstName,
            lastName: latestResumeWithData.extractedLastName,
            email: latestResumeWithData.extractedEmail,
            phone: latestResumeWithData.extractedPhone,
            address: latestResumeWithData.extractedAddress,
          },
          education: candidate?.educations ?? [],
          workExperience: candidate?.workExperiences ?? [],
          skills: candidate?.skills ?? [],
          languages: candidate?.languages ?? [],
          certifications: candidate?.certifications ?? [],
        },
        agent_trace_id: randomUUID(),
        model_used: null,
      });
    } catch (err) {
      next(err);
    }
  }
);
