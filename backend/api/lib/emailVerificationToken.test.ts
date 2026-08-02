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

import { createVerificationToken, consumeVerificationToken } from "./emailVerificationToken";

describe("email verification token storage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // candidate-email-verification design.md Decision 1: mirrors session.ts's
  // Redis-backed opaque token pattern exactly, not a new Postgres table.
  it("creates a token with a TTL and returns its value", async () => {
    mockSet.mockResolvedValue("OK");

    const token = await createVerificationToken(42);

    expect(token).toEqual(expect.any(String));
    expect(mockSet).toHaveBeenCalledWith(
      `email-verify:${token}`,
      JSON.stringify({ candidateId: 42 }),
      "EX",
      expect.any(Number),
    );
  });

  it("consuming a valid token returns its candidateId", async () => {
    mockGet.mockResolvedValue(JSON.stringify({ candidateId: 42 }));
    mockDel.mockResolvedValue(1);

    const data = await consumeVerificationToken("token-abc");

    expect(mockGet).toHaveBeenCalledWith("email-verify:token-abc");
    expect(data).toEqual({ candidateId: 42 });
  });

  // one-time use: consuming deletes the token, so a second consume misses.
  it("consuming a token deletes it, so a second consume fails", async () => {
    mockGet.mockResolvedValue(JSON.stringify({ candidateId: 42 }));
    mockDel.mockResolvedValue(1);

    await consumeVerificationToken("token-abc");

    expect(mockDel).toHaveBeenCalledWith("email-verify:token-abc");

    mockGet.mockResolvedValue(null);
    const secondAttempt = await consumeVerificationToken("token-abc");

    expect(secondAttempt).toBeNull();
  });

  it("consuming an expired or unknown token returns null without deleting anything", async () => {
    mockGet.mockResolvedValue(null);

    const data = await consumeVerificationToken("missing-token");

    expect(data).toBeNull();
    expect(mockDel).not.toHaveBeenCalled();
  });

  // Spec: "Resend issues a new token for an unverified, registered email" —
  // "invalidating any prior one". A candidate-keyed secondary index tracks
  // the current token so a second create() can find and delete the old one.
  it("creating a second token for the same candidate invalidates the first", async () => {
    mockSet.mockResolvedValue("OK");
    mockGet.mockResolvedValue("first-token-value");
    mockDel.mockResolvedValue(1);

    await createVerificationToken(42);

    expect(mockGet).toHaveBeenCalledWith("email-verify-candidate:42");
    expect(mockDel).toHaveBeenCalledWith("email-verify:first-token-value");
  });

  it("creating a token when the candidate has no prior token does not attempt to delete anything", async () => {
    mockSet.mockResolvedValue("OK");
    mockGet.mockResolvedValue(null);

    await createVerificationToken(42);

    expect(mockDel).not.toHaveBeenCalled();
  });
});
