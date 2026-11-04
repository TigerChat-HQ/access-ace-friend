import { expect, it } from "vitest";
import { authReturnPath } from "./auth-return";
it("preserves Dama invitation through sign in", () => expect(authReturnPath("/draughts?match=abc#board")).toBe("/draughts?match=abc#board"));
it("rejects external login destinations", () => { expect(authReturnPath("//evil.test")).toBe("/"); expect(authReturnPath("/\\evil.test")).toBe("/"); });