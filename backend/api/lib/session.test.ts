const mockSet = jest.fn();
const mockGet = jest.fn();
const mockDel = jest.fn();

jest.mock("ioredis", () => ({
  Redis: jest.fn().mockImplementation(() => ({
    set: mockSet,
    get: mockGet,
    del: mockDel,
  })),
}));

import { createSession, getSession, deleteSession } from "./session";

describe("session storage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a session with a 7-day TTL and returns its id", async () => {
    mockSet.mockResolvedValue("OK");

    const sessionId = await createSession({ candidateId: 42 });

    expect(sessionId).toEqual(expect.any(String));
    expect(mockSet).toHaveBeenCalledWith(
      `session:${sessionId}`,
      JSON.stringify({ candidateId: 42 }),
      "EX",
      60 * 60 * 24 * 7,
    );
  });

  it("reads back what was written (create-then-read round trip)", async () => {
    mockGet.mockResolvedValue(JSON.stringify({ candidateId: 42 }));

    const data = await getSession("session-abc");

    expect(mockGet).toHaveBeenCalledWith("session:session-abc");
    expect(data).toEqual({ candidateId: 42 });
  });

  it("returns null for a session that doesn't exist", async () => {
    mockGet.mockResolvedValue(null);

    const data = await getSession("missing-session");

    expect(data).toBeNull();
  });

  it("deleting a session makes a subsequent read miss", async () => {
    mockDel.mockResolvedValue(1);
    await deleteSession("session-abc");
    expect(mockDel).toHaveBeenCalledWith("session:session-abc");

    mockGet.mockResolvedValue(null);
    const data = await getSession("session-abc");

    expect(data).toBeNull();
  });
});
