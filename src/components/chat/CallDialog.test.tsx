import { createRef } from "react";
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CallDialog } from "./CallDialog";

describe("call media playback", () => {
  it("attaches voice tracks to audio and video tracks when connected", async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    const remoteStream = { getTracks: () => [{ kind: "audio" }] } as unknown as MediaStream;
    const remoteVideoRef = createRef<HTMLVideoElement>();
    const localVideoRef = createRef<HTMLVideoElement>();
    const localStream = { getTracks: () => [] } as unknown as MediaStream;
    const props = { callInfo: { callId: "call", callerId: "a", calleeId: "b", conversationId: "chat", callType: "voice" as const }, callStatus: "connecting" as const,
      isMuted: false, isVideoOn: true, duration: 0, remoteStream, localStream, remoteVideoRef, localVideoRef,
      onAccept: vi.fn(), onReject: vi.fn(), onEnd: vi.fn(), onToggleMute: vi.fn(), onToggleVideo: vi.fn(), onSwitchCamera: vi.fn() };
    const { container, rerender } = render(<CallDialog {...props} />);
    await waitFor(() => expect(play).toHaveBeenCalled());
    expect(document.body.querySelector("audio")?.srcObject).toBe(remoteStream);
    rerender(<CallDialog {...props} callInfo={{ ...props.callInfo, callType: "video" }} callStatus="connected" />);
    expect(document.body.querySelector("video")?.srcObject).toBe(remoteStream);
    expect(localVideoRef.current?.srcObject).toBe(localStream);
    play.mockRestore();
  });
});