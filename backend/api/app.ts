import express, { Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { uploadsRouter } from "./routes/uploads";
import { uploadStatusRouter } from "./routes/uploadStatus";
import { authRouter } from "./routes/auth";
import { candidatesRouter } from "./routes/candidates";

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
  app.use(cookieParser());

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use(authRouter);
  app.use(uploadsRouter);
  app.use(uploadStatusRouter);
  app.use(candidatesRouter);

  return app;
}
