export interface VideoEditOptions {
  start: number;
  end: number;
  originalVolume: number;
  musicFile?: File | null;
  musicVolume: number;
}

const waitFor = (target: HTMLMediaElement, event: string) =>
  new Promise<void>((resolve, reject) => {
    target.addEventListener(event, () => resolve(), { once: true });
    target.addEventListener("error", () => reject(new Error("Could not read the selected media.")), { once: true });
  });

export async function renderVideoEdit(file: File, options: VideoEditOptions): Promise<File> {
  if (!("MediaRecorder" in window)) throw new Error("Video editing is not supported by this browser.");
  const video = document.createElement("video") as HTMLVideoElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream };
  const sourceUrl = URL.createObjectURL(file);
  video.src = sourceUrl;
  video.muted = false;
  video.playsInline = true;
  video.preload = "auto";

  let audioContext: AudioContext | null = null;
  let musicElement: HTMLAudioElement | null = null;
  let musicUrl: string | null = null;
  try {
    await waitFor(video, "loadedmetadata");
    const capture = video.captureStream?.bind(video) || video.mozCaptureStream?.bind(video);
    if (!capture) throw new Error("This browser cannot export trimmed video. Please try a recent Chrome browser.");
    const duration = Number.isFinite(video.duration) ? video.duration : options.end;
    const start = Math.max(0, Math.min(options.start, duration));
    const end = Math.max(start + 0.1, Math.min(options.end, duration));
    if (end <= start) throw new Error("Choose a valid video section.");

    audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();
    const originalSource = audioContext.createMediaElementSource(video);
    const originalGain = audioContext.createGain();
    originalGain.gain.value = options.originalVolume;
    originalSource.connect(originalGain).connect(destination);

    if (options.musicFile) {
      musicElement = document.createElement("audio");
      musicUrl = URL.createObjectURL(options.musicFile);
      musicElement.src = musicUrl;
      musicElement.loop = true;
      await waitFor(musicElement, "loadedmetadata");
      const musicSource = audioContext.createMediaElementSource(musicElement);
      const musicGain = audioContext.createGain();
      musicGain.gain.value = options.musicVolume;
      musicSource.connect(musicGain).connect(destination);
    }

    const stream = capture();
    const combined = new MediaStream([
      ...stream.getVideoTracks(),
      ...destination.stream.getAudioTracks(),
    ]);
    const mimeType = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/mp4"]
      .find((type) => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(combined, mimeType ? { mimeType } : undefined);
    const chunks: BlobPart[] = [];
    const stopped = new Promise<Blob>((resolve, reject) => {
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => reject(new Error("Video export failed. Please try again."));
      recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || "video/webm" }));
    });

    await audioContext.resume();
    video.currentTime = start;
    await waitFor(video, "seeked");
    if (musicElement) { musicElement.currentTime = 0; await musicElement.play(); }
    recorder.start(250);
    await video.play();
    await new Promise<void>((resolve) => {
      const finish = () => { video.removeEventListener("timeupdate", check); resolve(); };
      const check = () => { if (video.currentTime >= end) { video.pause(); finish(); } };
      video.addEventListener("timeupdate", check);
      check();
    });
    recorder.stop();
    const blob = await stopped;
    if (!blob.size) throw new Error("The edited video is empty. Please try again.");
    const extension = blob.type.includes("mp4") ? "mp4" : "webm";
    return new File([blob], `tigerchat-edited-${Date.now()}.${extension}`, { type: blob.type });
  } finally {
    video.pause();
    musicElement?.pause();
    audioContext?.close();
    URL.revokeObjectURL(sourceUrl);
    if (musicUrl) URL.revokeObjectURL(musicUrl);
  }
}
