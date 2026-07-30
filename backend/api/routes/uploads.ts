import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "path";
import { promises as fs } from "fs";
import { randomUUID } from "crypto";
import { prisma } from "../prisma";
import { cvExtractionQueue } from "../queue/cvExtractionQueue";
import { requireAuth } from "../middleware/requireAuth";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB, per specs/cv-upload/spec.md
const PDF_MAGIC_BYTES = Buffer.from("%PDF-");
const UPLOAD_DIR = process.env.CV_UPLOAD_DIR ?? path.join(process.cwd(), "uploads", "cv");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});

function isCorruptedPdf(buffer: Buffer): boolean {
  return !buffer.subarray(0, PDF_MAGIC_BYTES.length).equals(PDF_MAGIC_BYTES);
}

export const uploadsRouter = Router();

uploadsRouter.post(
  "/uploads/cv",
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    upload.single("file")(req, res, (err: unknown) => {
      if (!err) {
        next();
        return;
      }

      // multer aborts the busboy stream on limit rejection — drain any
      // remaining request bytes first or Node resets the socket before the
      // error response reaches the client (ECONNRESET).
      req.resume();

      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({
          status: "error",
          data: { error: "File exceeds the maximum allowed size of 10MB." },
        });
        return;
      }
      next(err);
    });
  },
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({
          status: "error",
          data: { error: "No file was provided." },
        });
        return;
      }

      if (file.mimetype !== "application/pdf") {
        res.status(400).json({
          status: "error",
          data: { error: "Unsupported file type. Only PDF is accepted." },
        });
        return;
      }

      if (isCorruptedPdf(file.buffer)) {
        res.status(400).json({
          status: "error",
          data: { error: "The uploaded file is unreadable or corrupted." },
        });
        return;
      }

      // Derived from the authenticated session (requireAuth), never the
      // request body — closes the client-trust gap flagged during
      // candidate-workspace's enrichment (cv-upload delta spec).
      const candidateId = req.candidateId as number;
      const fileName = `${randomUUID()}.pdf`;
      const filePath = path.join(UPLOAD_DIR, fileName);

      await fs.mkdir(UPLOAD_DIR, { recursive: true });
      await fs.writeFile(filePath, file.buffer);

      const resume = await prisma.resume.create({
        data: {
          filePath,
          fileType: file.mimetype,
          uploadDate: new Date(),
          candidateId,
        },
      });

      const job = await cvExtractionQueue.add("extract", {
        resumeId: resume.id,
        candidateId,
        filePath,
      });

      res.status(202).json({
        status: "success",
        data: { resumeId: resume.id, jobId: job.id, status: "processing" },
        agent_trace_id: randomUUID(),
        model_used: null,
      });
    } catch (err) {
      next(err);
    }
  }
);
