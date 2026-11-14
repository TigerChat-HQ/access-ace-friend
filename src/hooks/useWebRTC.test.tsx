import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  insert: vi.fn(), handlers: [] as Array<(payload: unknown) => void>,
  media: vi.fn(), stop: vi.fn(), profile: vi.fn(), invoke: vi.fn(),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "receiver" } }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getSession: async () => ({ data: { session: { user: { id: "receiver" } } }, error: null }) },
  from: () => ({ insert: mocks.insert, select: () => ({ eq: () => ({ maybeSingle: mocks.profile }) }) }),
  channel: () => {
    let presence: Record<string, unknown[]> = {};
    let presenceSync: (() => void) | null = null;
    const channel = {
      on: (event: string, _filter: unknown, cb: (p: unknown) => void) => {
        if (event === "presence") presenceSync = cb;
        else mocks.handlers.push(cb);
        return channel;
      },
      subscribe: (cb?: (status: string) => void) => {
        if (presenceSync) {
          cb?.("SUBSCRIBED");
          queueMicrotask(() => presenceSync?.());
        }
        return channel;
      },
      presenceState: () => presence,
      track: async (payload: unknown) => {
        presence = { client: [payload] };
        queueMicrotask(() => presenceSync?.());
        return "ok";
      },
      untrack: async () => { presence = {}; },
    };
    return channel;
  }, removeChannel: vi.fn(),
  functions: { invoke: mocks.invoke },
} }));
import { useWebRTC } from "./useWebRTC";
import { CallProvider, useCall } from "@/contexts/CallContext";

class FakeStream {
  getTracks() { return [{ stop: mocks.stop, kind: "video", enabled: true }]; }
}
class FakePeer {
  close = vi.fn(); addTrack = vi.fn();
  createOffer = async () => ({ type: "offer", sdp: "offer-sdp" });
  setLocalDescription = vi.fn();
}

describe("call signaling reliability", () => {
  beforeEach(() => {
    mocks.handlers.length = 0;
    mocks.insert.mockReset().mockResolvedValue({ error: null });
    mocks.stop.mockClear();
    mocks.profile.mockReset().mockResolvedValue({ data: { display_name: "Caller" } });
    mocks.invoke.mockReset().mockResolvedValue({ data: null, error: new Error("TURN not configured in unit test") });
    mocks.media.mockReset().mockResolvedValue(new FakeStream());
    vi.stubGlobal("MediaStream", FakeStream);
    vi.stubGlobal("RTCPeerConnection", FakePeer);
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: mocks.media } });
    vi.spyOn(window, "alert").mockImplementation(() => {});
  });
  it("cleans up camera and returns idle when sending an offer fails", async () => {
    mocks.insert.mockResolvedValue({ error: new Error("Network unavailable") });
    const { result, unmount } = renderHook(() => useWebRTC());
    await act(async () => { await result.current.startCall("other", "chat", "video", "Other", "OT"); });
    expect(result.current.callStatus).toBe("idle");
    expect(result.current.activeCall).toBeNull();
    expect(mocks.stop).toHaveBeenCalled();
    unmount();
  });
  it("rings before profile lookup finishes and sends supported hangup on end", async () => {
    mocks.profile.mockReturnValue(new Promise(() => {}));
    const { result, unmount } = renderHook(() => useWebRTC());
    act(() => { mocks.handlers[0]({ new: { caller_id: "other", callee_id: "receiver", conversation_id: "chat", call_type: "video", signal_type: "offer", signal_data: { from: "other", callId: "call", type: "offer", sdp: "sdp" } } }); });
    await waitFor(() => expect(result.current.callStatus).toBe("incoming"));
    await act(async () => { await result.current.endCall(); });
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ signal_type: "hangup", signal_data: expect.objectContaining({ reason: "missed", callId: "call" }) }));
    expect(result.current.callStatus).toBe("ended");
    unmount();
  });
  it("keeps the provider hook order stable across rerenders and call transitions", async () => {
    const { result, rerender, unmount } = renderHook(() => useCall(), { wrapper: CallProvider });
    expect(result.current.callStatus).toBe("idle");
    rerender();
    await act(async () => { await result.current.startCall("other", "chat", "video", "Other", "OT"); });
    expect(result.current.callStatus).toBe("outgoing");
    rerender();
    await act(async () => { await result.current.endCall(); });
    expect(result.current.callStatus).toBe("ended");
    rerender();
    unmount();
  });
});