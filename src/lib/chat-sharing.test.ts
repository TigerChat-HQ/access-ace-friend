import { describe, it, expect } from "vitest";
import { contactMessage, locationMessage } from "./chat-sharing";
describe("Chat sharing", () => {
  it("shares a usable location link", () => expect(locationMessage(-6.8, 39.2)).toContain("https://www.google.com/maps?q=-6.8,39.2"));
  it("rejects coordinates outside the earth", () => expect(() => locationMessage(91, 39)).toThrow());
  it("shares a named contact and dialable phone", () => expect(contactMessage("Martha", "+255 712 345 678")).toBe("👤 Contact: Martha\n+255712345678"));
});