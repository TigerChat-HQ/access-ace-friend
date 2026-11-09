import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AnalyticsEvent = "impression" | "play" | "watch" | "retention_25" | "retention_50" | "retention_75" | "retention_100";
type TimedCaption = { start: number; end: number; text: string };
type Props = {
  postId: string;
  creatorId: string;
  viewerId: string;
  src: string;
  coverUrl?: string | null;
  audioUrl?: string | null;
  audioStart?: number;
  trimStart?: number;
  trimEnd?: number | null;
  captions?: TimedCaption[] | null;
  className?: string;
};

const db = supabase as unknown as SupabaseClient;

export const ReelAnalyticsVideo = ({
  postId, creatorId, viewerId, src, coverUrl, audioUrl,
  audioStart = 0, trimStart = 0, trimEnd, captions, className,
}: Props) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const sessionId = useRef(typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
  const lastSample = useRef(0);
  const pendingWatch = useRef(0);
  const recorded = useRef(new Set<AnalyticsEvent>());
  const [currentTime, setCurrentTime] = useState(0);

  const record = useCallback(async (eventType: AnalyticsEvent, watchSeconds = 0) => {
    try {
      await db.from("post_analytics_events").insert({
        post_id: postId, creator_id: creatorId, viewer_id: viewerId,
        session_id: sessionId.current, event_type: eventType, watch_seconds: watchSeconds,
      });
    } catch {
      // Analytics must never interrupt playback.
    }
  }, [postId, creatorId, viewerId]);

  useEffect(() => {
    const target = rootRef.current;
    if (!target) return;
    let observer: IntersectionObserver | undefined;
    const onVisible = (visible: boolean) => {
      if (visible && !recorded.current.has("impression")) {
        recorded.current.add("impression");
        void record("impression");
      }
    };
    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(([entry]) => onVisible(entry.isIntersecting && entry.intersectionRatio >= 0.5), { threshold: [0.5] });
      observer.observe(target);
    } else onVisible(true);
    return () => observer?.disconnect();
  }, [record]);

  useEffect(() => {
    const video = videoRef.current;
    if (video && trimStart > 0 && video.currentTime < trimStart) video.currentTime = trimStart;
  }, [trimStart, src]);

  const flushWatch = useCallback(() => {
    const seconds = pendingWatch.current;
    pendingWatch.current = 0;
    if (seconds > 0) void record("watch", Math.min(seconds, 15));
  }, [record]);

  const syncAudio = () => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video || !audio || !audioUrl) return;
    const targetTime = Math.max(0, audioStart + video.currentTime - trimStart);
    if (Number.isFinite(audio.duration) && targetTime >= audio.duration) {
      audio.pause();
      return;
    }
    if (Math.abs(audio.currentTime - targetTime) > 0.45) audio.currentTime = targetTime;
    void audio.play().catch(() => undefined);
  };

  const onPlay = () => {
    if (!recorded.current.has("play")) {
      recorded.current.add("play");
      void record("play");
    }
    lastSample.current = videoRef.current?.currentTime ?? 0;
    syncAudio();
  };

  const onTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    const now = video.currentTime;
    if (trimEnd !== null && trimEnd !== undefined && now >= trimEnd) {
      video.pause();
      video.currentTime = trimEnd;
      audioRef.current?.pause();
      flushWatch();
      return;
    }
    setCurrentTime(now);
    if (!video.paused && document.visibilityState === "visible") {
      const delta = now - lastSample.current;
      if (delta > 0 && delta <= 3) {
        pendingWatch.current += delta;
        if (pendingWatch.current >= 10) flushWatch();
      }
      if (audioUrl && audioRef.current && !audioRef.current.paused) {
        const expected = Math.max(0, audioStart + now - trimStart);
        if (Math.abs(audioRef.current.currentTime - expected) > 0.8) audioRef.current.currentTime = expected;
      }
    }
    lastSample.current = now;

    const segmentDuration = Math.max(0.1, (trimEnd ?? video.duration) - trimStart);
    const progress = Math.max(0, (now - trimStart) / segmentDuration);
    for (const [threshold, event] of [[0.25, "retention_25"], [0.5, "retention_50"], [0.75, "retention_75"], [0.99, "retention_100"]] as const) {
      if (progress >= threshold && !recorded.current.has(event)) {
        recorded.current.add(event);
        void record(event);
      }
    }
  };

  const activeCaption = captions?.find((caption) => currentTime >= caption.start && currentTime < caption.end);

  return (
    <div ref={rootRef} className={className || "relative w-full bg-black"}>
      <video
        ref={videoRef} src={src} poster={coverUrl || undefined} controls playsInline preload="metadata"
        className="w-full max-h-[75dvh] bg-black object-contain"
        onLoadedMetadata={() => { if (videoRef.current && trimStart > 0) videoRef.current.currentTime = trimStart; }}
        onPlay={onPlay} onTimeUpdate={onTimeUpdate}
        onPause={() => { audioRef.current?.pause(); flushWatch(); }}
        onEnded={() => { audioRef.current?.pause(); flushWatch(); }}
      />
      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="metadata" />}
      {activeCaption?.text && (
        <div aria-live="off" className="pointer-events-none absolute inset-x-4 bottom-16 mx-auto max-w-[90%] text-center">
          <span className="inline-block rounded-lg bg-black/75 px-3 py-2 text-base font-semibold text-white shadow-lg">{activeCaption.text}</span>
        </div>
      )}
    </div>
  );
};
