import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  insert: vi.fn(), rpc: vi.fn(), handlers: [] as Array<(payload: unknown) => void>,
  media: vi.fn(), stop: vi.fn(), profile: vi.fn(), invoke: vi.fn(),
  nativeAvailable: false,
  nativeListener: null as null | ((event: { type: string; state?: string }) => void),
  nativeStart: vi.fn(),
  nativeDescription: vi.fn(),
  nativeRemote: vi.fn(),
  nativeRestart: vi.fn(),
}));
vi.mock("@/lib/nativeWebRtc", () => ({
  addNativeIceCandidate: vi.fn(),
  closeNativeWebRtc: vi.fn(),
  createNativeWebRtcDescription: mocks.nativeDescription,
  isNativeWebRtcAvailable: () => mocks.nativeAvailable,
  setNativeRemoteDescription: mocks.nativeRemote,
  setNativeWebRtcMuted: vi.fn(),
  setNativeWebRtcVideoEnabled: vi.fn(),
  setNativeWebRtcVideoLayout: vi.fn(),
  restartNativeWebRtcIce: mocks.nativeRestart,
  switchNativeWebRtcCamera: vi.fn(),
  startNativeWebRtc: mocks.nativeStart,
  subscribeNativeWebRtc: (listener: (event: { type: string; state?: string }) => void) => {
    mocks.nativeListener = listener;
    return () => { if (mocks.nativeListener === listener) mocks.nativeListener = null; };
  },
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "receiver" } }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getSession: async () => ({ data: { session: { user: { id: "receiver" } } }, error: null }) },
  rpc: mocks.rpc,
  from: () => ({ insert: mocks.insert, select: () => ({ eq: () => ({ maybeSingle: mocks.profile }) }) }),
  channel: () => {
    let presence: Record<string, unknown[]> = {};
    let presenceSync: ((payload: unknown) => void) | null = null;
    const channel = {
      on: (event: string, _filter: unknown, cb: (p: unknown) => void) => {
        if (event === "presence") presenceSync = cb;
        else mocks.handlers.push(cb);
        return channel;
      },
      subscribe: (cb?: (status: string) => void) => {
        if (presenceSync) {
          cb?.("SUBSCRIBED");
          queueMicrotask(() => presenceSync?.({}));
        }
        return channel;
      },
      presenceState: () => presence,
      track: async (payload: unknown) => {
        presence = { client: [payload] };
        queueMicrotask(() => presenceSync?.({}));
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
    mocks.rpc.mockReset().mockResolvedValue({ data: "signal-id", error: null });
    mocks.stop.mockClear();
    mocks.profile.mockReset().mockResolvedValue({ data: { display_name: "Caller" } });
    mocks.invoke.mockReset().mockResolvedValue({ data: null, error: new Error("TURN not configured in unit test") });
    mocks.nativeAvailable = false;
    mocks.nativeListener = null;
    mocks.nativeStart.mockReset().mockResolvedValue({ type: "ready" });
    mocks.nativeDescription.mockReset().mockResolvedValue({ type: "offer", sdp: "native-offer-sdp" });
    mocks.nativeRemote.mockReset().mockResolvedValue(undefined);
    mocks.nativeRestart.mockReset();
    mocks.media.mockReset().mockResolvedValue(new FakeStream());
    vi.stubGlobal("MediaStream", FakeStream);
    vi.stubGlobal("RTCPeerConnection", FakePeer);
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: mocks.media } });
    vi.spyOn(window, "alert").mockImplementation(() => {});
  });
  it("cleans up camera and returns idle when sending an offer fails", async () => {
    mocks.rpc.mockResolvedValue({ error: new Error("Network unavailable") });
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
    expect(mocks.rpc).toHaveBeenCalledWith("create_call_signal", expect.objectContaining({ p_signal_type: "hangup", p_signal_data: expect.objectContaining({ reason: "missed", callId: "call" }) }));
    expect(result.current.callStatus).toBe("ended");
    unmount();
  });
  it("keeps an outgoing native call alive when ICE fails before the callee answers", async () => {
    mocks.nativeAvailable = true;
    const { result, unmount } = renderHook(() => useWebRTC());
    await act(async () => {
      await result.current.startCall("callee", "chat", "voice", "Callee", "CA");
    });
    expect(result.current.callStatus).toBe("outgoing");
    expect(mocks.nativeListener).toBeTypeOf("function");

    act(() => { mocks.nativeListener?.({ type: "ice-state", state: "FAILED" }); });

    expect(result.current.callStatus).toBe("outgoing");
    expect(mocks.rpc.mock.calls.filter(([name, args]) => name === "create_call_signal" && args?.p_signal_type === "offer")).toHaveLength(1);
    expect(mocks.rpc).toHaveBeenCalledWith("create_call_signal", expect.objectContaining({ p_signal_type: "offer" }));
    expect(mocks.rpc).not.toHaveBeenCalledWith("create_call_signal", expect.objectContaining({ p_signal_type: "hangup" }));
    unmount();
  });
  it("moves native answered calls to connecting and restarts ICE after remote SDP", async () => {
    mocks.nativeAvailable = true;
    const { result, unmount } = renderHook(() => useWebRTC());
    await act(async () => {
      await result.current.startCall("callee", "chat", "voice", "Callee", "CA");
    });
    const callId = result.current.activeCall?.callId;
    expect(callId).toBeTruthy();

    const answerSignal = { new: {
      caller_id: "receiver",
      callee_id: "callee",
      conversation_id: "chat",
      call_type: "voice",
      signal_type: "answer",
      signal_data: { from: "callee", callId, type: "answer", sdp: "remote-answer-sdp" },
    } };
    await act(async () => {
      mocks.handlers.forEach((handler) => handler(answerSignal));
    });
    await waitFor(() => expect(result.current.callStatus).toBe("connecting"));

    act(() => { mocks.nativeListener?.({ type: "ice-state", state: "FAILED" }); });

    expect(mocks.nativeRestart).toHaveBeenCalledTimes(1);
    expect(mocks.insert).not.toHaveBeenCalledWith(expect.objectContaining({ signal_type: "hangup" }));
    unmount();
  });
  it("processes a second native offer for ICE renegotiation in the same call", async () => {
    mocks.nativeAvailable = true;
    const { result, unmount } = renderHook(() => useWebRTC());
    const callId = "incoming-native-renegotiation";

    const initialOffer = { new: {
      id: "offer-row-initial",
      caller_id: "caller",
      callee_id: "receiver",
      conversation_id: "chat",
      call_type: "voice",
      signal_type: "offer",
      signal_data: { from: "caller", callId, type: "offer", sdp: "initial-offer-sdp" },
    } };
    await act(async () => { mocks.handlers.forEach((handler) => handler(initialOffer)); });
    await waitFor(() => expect(result.current.callStatus).toBe("incoming"));

    await act(async () => { await result.current.acceptIncomingCall(); });
    expect(result.current.callStatus).toBe("connecting");
    expect(mocks.nativeRemote).toHaveBeenCalledTimes(1);

    const restartOffer = { new: {
      id: "offer-row-restart",
      caller_id: "caller",
      callee_id: "receiver",
      conversation_id: "chat",
      call_type: "voice",
      signal_type: "offer",
      signal_data: { from: "caller", callId, type: "offer", sdp: "restart-offer-sdp", renegotiate: true },
    } };
    await act(async () => { mocks.handlers.forEach((handler) => handler(restartOffer)); });
    await waitFor(() => expect(mocks.nativeRemote).toHaveBeenCalledTimes(2));
    expect(mocks.rpc.mock.calls.filter(([name, args]) => name === "create_call_signal" && args?.p_signal_type === "answer")).toHaveLength(2);
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