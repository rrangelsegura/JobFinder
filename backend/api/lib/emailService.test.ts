const mockSendMail = jest.fn();

jest.mock("nodemailer", () => ({
  createTransport: jest.fn().mockReturnValue({ sendMail: mockSendMail }),
}));

import { sendCvUploadReminderEmail, sendExtractionFailureEmail } from "./emailService";

describe("sendCvUploadReminderEmail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends exactly one email to the candidate prompting a CV upload", async () => {
    mockSendMail.mockResolvedValue({ messageId: "abc" });

    await sendCvUploadReminderEmail("candidate@example.com");

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const [message] = mockSendMail.mock.calls[0];
    expect(message.to).toBe("candidate@example.com");
    expect(message.subject).toMatch(/cv/i);
    expect(message.text).toMatch(/upload/i);
  });
});

describe("sendExtractionFailureEmail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends exactly one acknowledgment email, framed as JobFinder's issue", async () => {
    mockSendMail.mockResolvedValue({ messageId: "abc" });

    await sendExtractionFailureEmail("candidate@example.com");

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const [message] = mockSendMail.mock.calls[0];
    expect(message.to).toBe("candidate@example.com");
    // it must not sound like the candidate's fault or something to just retry
    expect(message.text.toLowerCase()).not.toMatch(/try again/);
    expect(message.text.toLowerCase()).toMatch(/on our (end|side)|our (bug|issue|mistake)/);
    expect(message.text.toLowerCase()).toMatch(/notify|let you know|email you/);
  });
});
