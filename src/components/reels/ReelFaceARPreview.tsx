import { useEffect, useRef, useState } from "react";
import { drawFaceEffect, loadFaceLandmarker, type FaceEffect } from "@/lib/reelFaceTracking";

type Props = { stream: MediaStream; effect: FaceEffect; onStatus?: (status: string) => void };

export function ReelFaceARPreview({ stream, effect, onStatus }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!video || !canvas || !context) return;
    let active = true;
    let frame = 0;
    let landmarker: Awaited<ReturnType<typeof loadFaceLandmarker>> | null = null;
    video.srcObject = stream;
    void video.play().catch(() => undefined);
    if (effect === "none") {
      onStatus?.("Face effect off");
      return () => { active = false; };
    }
    onStatus?.("Loading face tracking…");
    void loadFaceLandmarker().then((tracker) => {
      if (!active) { tracker.close(); return; }
      landmarker = tracker;
      setSupported(true);
      onStatus?.("Face tracking active");
      const draw = () => {
        if (!active || !video.videoWidth || !video.videoHeight) {
          frame = requestAnimationFrame(draw);
          return;
        }
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        context.clearRect(0, 0, canvas.width, canvas.height);
        try {
          const result = tracker.detectForVideo(video, performance.now());
          drawFaceEffect(context, result.faceLandmarks?.[0], canvas.width, canvas.height, effect);
        } catch {
          // Skip a frame rather than interrupt camera recording.
        }
        frame = requestAnimationFrame(draw);
      };
      frame = requestAnimationFrame(draw);
    }).catch((error) => {
      if (!active) return;
      setSupported(false);
      onStatus?.("Face tracking unavailable. Check internet and reload.");
      console.warn("Tiger Reels face tracking failed", error);
    });
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      landmarker?.close();
      context.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [stream, effect, onStatus]);

  return <div className="relative overflow-hidden rounded-xl bg-black">
    <video ref={videoRef} autoPlay playsInline muted className="max-h-[55dvh] w-full object-contain" />
    <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full object-contain" />
    {!supported && <p className="absolute bottom-2 left-2 right-2 rounded bg-black/70 p-2 text-center text-xs text-white">AR tracking needs a supported browser and internet connection.</p>}
  </div>;
}
