const mockSendMail = jest.fn();

jest.mock("nodemailer", () => ({
  createTransport: jest.fn().mockReturnValue({ sendMail: mockSendMail }),
}));

import { sendCvUploadReminderEmail } from "./emailService";

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
