describe("CI pipeline red/green verification (scratch, will be removed)", () => {
  it("fails on purpose to prove the pipeline detects failures", () => {
    expect(true).toBe(false);
  });
});
