import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: vi.fn() },
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}));
import {
  acquireMicrophone,
  getActiveMicrophoneOwner,
  isMicrophoneOwned,
} from "./audioCapture";


describe("Tiger Audio Engine microphone ownership", () => {
  it("allows only one capture owner at a time", () => {
    const release = acquireMicrophone("voice-note");
    expect(getActiveMicrophoneOwner()).toBe("voice-note");
    expect(() => acquireMicrophone("voice-call")).toThrow(/Simamisha Voice Note/);
    release();
    expect(getActiveMicrophoneOwner()).toBeNull();
  });

  it("blocks a voice note while a call owns the microphone", () => {
    const release = acquireMicrophone("video-call");
    expect(() => acquireMicrophone("voice-note")).toThrow(/Microphone tayari/);
    release();
    expect(getActiveMicrophoneOwner()).toBeNull();
  });

  it("makes release idempotent", () => {
    const release = acquireMicrophone("voice-call");
    release();
    release();
    expect(isMicrophoneOwned()).toBe(false);
  });

  it("does not let a stale release clear a later lease", () => {
    const releaseFirst = acquireMicrophone("voice-note");
    releaseFirst();
    const releaseSecond = acquireMicrophone("voice-note");
    releaseFirst();
    expect(getActiveMicrophoneOwner()).toBe("voice-note");
    releaseSecond();
    expect(getActiveMicrophoneOwner()).toBeNull();
  });
});
