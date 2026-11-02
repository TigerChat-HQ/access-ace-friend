import { describe, expect, it } from "vitest";
import { contactSchema, reportReplySchema } from "./contact";

describe("Contact and report replies", () => {
  it("accepts a user's contact message", () => {
    expect(contactSchema.parse({ subject: "Game", message: "Please improve draughts" }).message).toBe("Please improve draughts");
  });
  it("rejects empty contact messages", () => {
    expect(contactSchema.safeParse({ subject: "Game", message: "   " }).success).toBe(false);
  });
  it("requires a real report identifier for replies", () => {
    expect(reportReplySchema.safeParse({ reportId: "invalid", reply: "Resolved", mediaUrl: null }).success).toBe(false);
  });
});