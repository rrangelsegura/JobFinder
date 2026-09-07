import { vi } from "vitest"
import { getStoredJobId, setStoredJobId } from "./cvUploadJobStorage"

describe("cvUploadJobStorage", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  // Spec: "Returning to the Upload page resumes tracking an in-flight job"
  it("round-trips a stored job id for a given candidate", () => {
    setStoredJobId(1, "job-42")
    expect(getStoredJobId(1)).toBe("job-42")
  })

  it("returns null when nothing is stored for that candidate", () => {
    expect(getStoredJobId(999)).toBeNull()
  })

  // Spec: "A different candidate on the same browser never sees another
  // candidate's tracked job"
  it("scopes storage per candidate id", () => {
    setStoredJobId(1, "job-for-candidate-1")
    setStoredJobId(2, "job-for-candidate-2")

    expect(getStoredJobId(1)).toBe("job-for-candidate-1")
    expect(getStoredJobId(2)).toBe("job-for-candidate-2")
  })

  it("swallows a localStorage.getItem failure and returns null", () => {
    const spy = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("storage disabled")
      })

    expect(getStoredJobId(1)).toBeNull()

    spy.mockRestore()
  })

  it("swallows a localStorage.setItem failure without throwing", () => {
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("storage disabled")
      })

    expect(() => setStoredJobId(1, "job-42")).not.toThrow()

    spy.mockRestore()
  })
})
