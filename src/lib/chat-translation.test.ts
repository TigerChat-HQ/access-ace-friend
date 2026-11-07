import { describe, expect, it } from "vitest";
import { canTranslate, translationLanguage } from "./chat-translation";

describe("automatic chat translation", () => {
  it("translates incoming text for foreign-language readers", () => {
    expect(canTranslate({ senderId: "other-user", type: "text", text: "Habari rafiki" })).toBe(true);
    expect(translationLanguage("en")).toBe("en");
    expect(translationLanguage("sw")).toBe("sw");
  });
  it("keeps outgoing messages and non-text media unchanged", () => {
    expect(canTranslate({ senderId: "me", type: "text", text: "Hello" })).toBe(false);
    expect(canTranslate({ senderId: "other-user", type: "voice", text: "0:20" })).toBe(false);
    expect(canTranslate({ senderId: "other-user", type: "file", text: "passport.pdf" })).toBe(false);
    expect(canTranslate({ senderId: "other-user", type: "image", text: "Habari" })).toBe(true);
  });
});