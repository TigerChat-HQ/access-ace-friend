export type FaceEffect = "none" | "glasses" | "crown" | "moustache" | "tiger-mask";
export type FacePoint = { x: number; y: number; z?: number };
export type FaceLandmarkerLike = {
  detectForVideo: (source: HTMLVideoElement, timestamp: number) => { faceLandmarks?: FacePoint[][] };
  close: () => void;
};

type VisionModule = {
  FilesetResolver: { forVisionTasks: (path: string) => Promise<unknown> };
  FaceLandmarker: { createFromOptions: (fileset: unknown, options: Record<string, unknown>) => Promise<FaceLandmarkerLike> };
};

let trackerPromise: Promise<FaceLandmarkerLike> | null = null;

/** Lazy-load MediaPipe only when a creator enables a face effect. */
export function loadFaceLandmarker(): Promise<FaceLandmarkerLike> {
  if (!trackerPromise) {
    trackerPromise = (async () => {
      const moduleUrl = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/vision_bundle.mjs";
      const vision = await import(/* @vite-ignore */ moduleUrl) as VisionModule;
      const wasmPath = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm";
      const modelPath = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
      const fileset = await vision.FilesetResolver.forVisionTasks(wasmPath);
      try {
        return await vision.FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: modelPath, delegate: "GPU" },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: false,
        });
      } catch {
        return vision.FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: modelPath, delegate: "CPU" },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: false,
        });
      }
    })().catch((error) => {
      trackerPromise = null;
      throw error;
    });
  }
  return trackerPromise;
}

export function drawFaceEffect(
  context: CanvasRenderingContext2D,
  landmarks: FacePoint[] | undefined,
  width: number,
  height: number,
  effect: FaceEffect,
) {
  if (!landmarks?.length || effect === "none") return;
  const point = (index: number) => ({
    x: landmarks[index].x * width,
    y: landmarks[index].y * height,
  });
  const leftEye = point(33);
  const rightEye = point(263);
  const nose = point(1);
  const forehead = point(10);
  const chin = point(152);
  const eyeDistance = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
  if (!Number.isFinite(eyeDistance) || eyeDistance < 8) return;
  const centerX = (leftEye.x + rightEye.x) / 2;
  const centerY = (leftEye.y + rightEye.y) / 2;
  const angle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
  context.save();
  context.translate(centerX, centerY);
  context.rotate(angle);
  context.lineCap = "round";
  context.lineJoin = "round";

  if (effect === "glasses") {
    const lensWidth = eyeDistance * 0.43;
    const lensHeight = lensWidth * 0.62;
    context.strokeStyle = "#111827";
    context.lineWidth = Math.max(3, eyeDistance * 0.035);
    context.fillStyle = "rgba(70,190,255,.18)";
    for (const x of [-eyeDistance * 0.25, eyeDistance * 0.25]) {
      context.beginPath();
      context.roundRect(x - lensWidth / 2, -lensHeight / 2, lensWidth, lensHeight, lensHeight * 0.22);
      context.fill();
      context.stroke();
    }
    context.beginPath();
    context.moveTo(-eyeDistance * 0.035, 0);
    context.lineTo(eyeDistance * 0.035, 0);
    context.stroke();
  } else if (effect === "crown") {
    const crownWidth = eyeDistance * 1.35;
    const top = (forehead.y - centerY) - eyeDistance * 0.25;
    context.fillStyle = "#facc15";
    context.strokeStyle = "#92400e";
    context.lineWidth = Math.max(2, eyeDistance * 0.025);
    context.beginPath();
    context.moveTo(-crownWidth / 2, top + eyeDistance * 0.38);
    context.lineTo(-crownWidth / 2, top);
    context.lineTo(-crownWidth * 0.22, top + eyeDistance * 0.2);
    context.lineTo(0, top - eyeDistance * 0.16);
    context.lineTo(crownWidth * 0.22, top + eyeDistance * 0.2);
    context.lineTo(crownWidth / 2, top);
    context.lineTo(crownWidth / 2, top + eyeDistance * 0.38);
    context.closePath();
    context.fill();
    context.stroke();
  } else if (effect === "moustache") {
    const y = nose.y - centerY + eyeDistance * 0.28;
    context.fillStyle = "#21160f";
    context.beginPath();
    context.moveTo(0, y);
    context.bezierCurveTo(-eyeDistance * 0.18, y - eyeDistance * 0.2, -eyeDistance * 0.42, y - eyeDistance * 0.12, -eyeDistance * 0.5, y + eyeDistance * 0.05);
    context.bezierCurveTo(-eyeDistance * 0.32, y + eyeDistance * 0.28, -eyeDistance * 0.12, y + eyeDistance * 0.17, 0, y + eyeDistance * 0.08);
    context.bezierCurveTo(eyeDistance * 0.12, y + eyeDistance * 0.17, eyeDistance * 0.32, y + eyeDistance * 0.28, eyeDistance * 0.5, y + eyeDistance * 0.05);
    context.bezierCurveTo(eyeDistance * 0.42, y - eyeDistance * 0.12, eyeDistance * 0.18, y - eyeDistance * 0.2, 0, y);
    context.fill();
  } else if (effect === "tiger-mask") {
    context.restore();
    context.save();
    context.strokeStyle = "#f97316";
    context.fillStyle = "rgba(249,115,22,.22)";
    context.lineWidth = Math.max(3, eyeDistance * 0.045);
    context.beginPath();
    context.moveTo(leftEye.x - eyeDistance * 0.2, leftEye.y);
    context.lineTo(point(234).x, point(234).y);
    context.lineTo(forehead.x, forehead.y - eyeDistance * 0.18);
    context.lineTo(point(454).x, point(454).y);
    context.lineTo(rightEye.x + eyeDistance * 0.2, rightEye.y);
    context.lineTo(point(152).x, chin.y);
    context.lineTo(point(172).x, point(172).y);
    context.closePath();
    context.fill();
    context.stroke();
    context.strokeStyle = "#7c2d12";
    context.lineWidth = Math.max(2, eyeDistance * 0.025);
    for (const side of [-1, 1]) {
      context.beginPath();
      context.moveTo(centerX + side * eyeDistance * 0.15, centerY + eyeDistance * 0.18);
      context.lineTo(centerX + side * eyeDistance * 0.48, centerY + eyeDistance * 0.42);
      context.stroke();
    }
  }
  context.restore();
}
