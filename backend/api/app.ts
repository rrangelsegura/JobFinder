import express, { Express } from "express";
import cors from "cors";
import { uploadsRouter } from "./routes/uploads";
import { uploadStatusRouter } from "./routes/uploadStatus";

// `frontend/` (candidate-workspace) is the first browser-based client this
// API has ever had, so cross-origin requests from the Vite dev server were
// never handled before. `credentials: true` is required ahead of US-003's
// cookie-based session (frontend's apiClient sends `withCredentials: true`
// already, per design.md Decision 1).
const ALLOWED_ORIGINS = (
  process.env.CORS_ALLOWED_ORIGINS ?? "http://localhost:5173"
).split(",");

export function createApp(): Express {
  const app = express();
  app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use(uploadsRouter);
  app.use(uploadStatusRouter);

  return app;
}
