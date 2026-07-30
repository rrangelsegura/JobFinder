const mockIncr = jest.fn();
const mockExpire = jest.fn();

jest.mock("ioredis", () => ({
  Redis: jest.fn().mockImplementation(() => ({
    incr: mockIncr,
    expire: mockExpire,
  })),
}));

import { checkLoginRateLimit } from "./rateLimiter";

describe("checkLoginRateLimit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("allows attempts under the threshold and sets the window TTL on the first attempt", async () => {
    mockIncr.mockResolvedValue(1);

    const allowed = await checkLoginRateLimit("1.2.3.4");

    expect(allowed).toBe(true);
    expect(mockExpire).toHaveBeenCalledWith("login-attempts:1.2.3.4", 60);
  });

  it("does not reset the TTL on subsequent attempts within the window", async () => {
    mockIncr.mockResolvedValue(2);

    await checkLoginRateLimit("1.2.3.4");

    expect(mockExpire).not.toHaveBeenCalled();
  });

  it("rejects once the threshold is exceeded", async () => {
    mockIncr.mockResolvedValue(6);

    const allowed = await checkLoginRateLimit("1.2.3.4");

    expect(allowed).toBe(false);
  });
});
