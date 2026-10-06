import { Job } from "bullmq";

jest.mock("../prisma", () => ({
  prisma: { jobInvitation: { updateMany: jest.fn() } },
}));

import { prisma } from "../prisma";
import { handleInvitationReplyJobFailure } from "./handleInvitationReplyFailure";
import { InvitationReplyJobData } from "./invitationReplyQueue";

describe("handleInvitationReplyJobFailure", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("marks the invitation record as failed", async () => {
    const job = { id: "9", data: { invitationId: 11, candidateId: 42 } } as unknown as Job<InvitationReplyJobData>;

    await handleInvitationReplyJobFailure(job, new Error("boom"));

    expect(prisma.jobInvitation.updateMany).toHaveBeenCalledWith({
      where: { id: 11, status: "processing" },
      data: { status: "failed" },
    });
  });

  it("does nothing when BullMQ gives no job", async () => {
    await handleInvitationReplyJobFailure(undefined, new Error("boom"));

    expect(prisma.jobInvitation.updateMany).not.toHaveBeenCalled();
  });
});
