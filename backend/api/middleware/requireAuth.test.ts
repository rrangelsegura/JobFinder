import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";

jest.mock("../lib/session", () => ({
  getSession: jest.fn(),
  SESSION_COOKIE_NAME: "jobfinder_session",
}));

import { getSession, SESSION_COOKIE_NAME } from "../lib/session";
import { requireAuth } from "./requireAuth";

function buildApp() {
  const app = express();
  app.use(cookieParser());
  app.get("/protected", requireAuth, (req, res) => {
    res.status(200).json({ candidateId: req.candidateId });
  });
  return app;
}

describe("requireAuth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("attaches req.candidateId and calls next() for a valid session", async () => {
    (getSession as jest.Mock).mockResolvedValue({ candidateId: 7 });

    const res = await request(buildApp())
      .get("/protected")
      .set("Cookie", `${SESSION_COOKIE_NAME}=session-abc`);

    expect(getSession).toHaveBeenCalledWith("session-abc");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ candidateId: 7 });
  });

  it("responds 401 and never reaches the handler when no cookie is present", async () => {
    const res = await request(buildApp()).get("/protected");

    expect(res.status).toBe(401);
    expect(getSession).not.toHaveBeenCalled();
  });

  it("responds 401 when the session is invalid or expired", async () => {
    (getSession as jest.Mock).mockResolvedValue(null);

    const res = await request(buildApp())
      .get("/protected")
      .set("Cookie", `${SESSION_COOKIE_NAME}=expired-session`);

    expect(res.status).toBe(401);
  });
});
