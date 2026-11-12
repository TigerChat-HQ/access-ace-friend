export type ReelTimelineClip = { file: File; start?: number; end?: number | null };
export type ReelCaption = { start: number; end: number; text: string };
export type ReelTimelineOptions = {
  clips: ReelTimelineClip[];
  duetFile?: File | null;
  filter?: string;
  speed?: number;
  musicFile?: File | null;
  musicStartSeconds?: number;
  originalVolume?: number;
  musicVolume?: number;
  captions?: ReelCaption[];
  onProgress?: (progress: number) => void;
};

const waitFor = (target: HTMLMediaElement, event: string) => new Promise<void>((resolve, reject) => {
  const cleanup = () => {
    target.removeEventListener(event, ready);
    target.removeEventListener("error", failed);
  };
  const ready = () => { cleanup(); resolve(); };
  const failed = () => { cleanup(); reject(new Error("Could not decode one of the selected video clips.")); };
  target.addEventListener(event, ready, { once: true });
  target.addEventListener("error", failed, { once: true });
});

const loadVideo = async (file: File) => {
  const video = document.createElement("video");
  const url = URL.createObjectURL(file);
  video.src = url;
  video.preload = "auto";
  video.playsInline = true;
  await waitFor(video, "loadedmetadata");
  return { video, url };
};

/** Renders a multi-clip Reel to one playable file using browser canvas + MediaRecorder. */
export async function renderReelTimeline(options: ReelTimelineOptions): Promise<File> {
  if (!options.clips.length) throw new Error("Add at least one video clip.");
  if (typeof MediaRecorder === "undefined" || !HTMLCanvasElement.prototype.captureStream) {
    throw new Error("Video export is not supported in this browser. Update Chrome or use a supported browser.");
  }
  const clips = options.clips;
  const loaded: Array<{ video: HTMLVideoElement; url: string; start: number; end: number }> = [];
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not initialize the video editor.");
  let audioContext: AudioContext | null = null;
  let musicElement: HTMLAudioElement | null = null;
  let musicUrl: string | null = null;
  let duetVideo: HTMLVideoElement | null = null;
  let duetUrl: string | null = null;
  let recorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let raf = 0;
  let stopped = false;
  try {
    for (const clip of clips) {
      const item = await loadVideo(clip.file);
      const start = Math.max(0, Math.min(clip.start ?? 0, item.video.duration));
      const end = Math.max(start + 0.2, Math.min(clip.end ?? item.video.duration, item.video.duration));
      loaded.push({ ...item, start, end });
    }
    const first = loaded[0].video;
    if (options.duetFile) {
      const duet = await loadVideo(options.duetFile);
      duetVideo = duet.video;
      duetUrl = duet.url;
      duetVideo.muted = true;
      duetVideo.loop = true;
    }
    const ratio = first.videoWidth / Math.max(1, first.videoHeight);
    const height = ratio < 0.8 ? 1280 : Math.round(1280 / Math.max(0.5, ratio));
    canvas.width = Math.min(1920, Math.max(480, Math.round(height * ratio)));
    canvas.height = Math.min(1920, Math.max(480, height));
    const canvasStream = canvas.captureStream(30);
    audioContext = new AudioContext();
    const audioDestination = audioContext.createMediaStreamDestination();
    const originalGain = audioContext.createGain();
    originalGain.gain.value = Math.max(0, Math.min(options.originalVolume ?? 1, 1));
    originalGain.connect(audioDestination);
    for (const item of loaded) {
      const source = audioContext.createMediaElementSource(item.video);
      source.connect(originalGain);
    }
    if (options.musicFile) {
      musicElement = document.createElement("audio");
      musicUrl = URL.createObjectURL(options.musicFile);
      musicElement.src = musicUrl;
      musicElement.loop = true;
      musicElement.preload = "auto";
      await waitFor(musicElement, "loadedmetadata");
      musicElement.currentTime = Math.max(0, Math.min(options.musicStartSeconds ?? 0, Math.max(0, musicElement.duration - 0.1)));
      const musicSource = audioContext.createMediaElementSource(musicElement);
      const musicGain = audioContext.createGain();
      musicGain.gain.value = Math.max(0, Math.min(options.musicVolume ?? 0.7, 1));
      musicSource.connect(musicGain).connect(audioDestination);
    }
    stream = new MediaStream([...canvasStream.getVideoTracks(), ...audioDestination.stream.getAudioTracks()]);
    const mimeType = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const recorded = new Promise<Blob>((resolve, reject) => {
      const chunks: BlobPart[] = [];
      recorder!.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder!.onerror = () => reject(new Error("Video rendering failed. Try fewer clips or a smaller video."));
      recorder!.onstop = () => resolve(new Blob(chunks, { type: recorder!.mimeType || "video/webm" }));
    });
    await audioContext.resume();
    if (musicElement) await musicElement.play();
    recorder.start(300);
    const totalDuration = loaded.reduce((sum, item) => sum + (item.end - item.start) / Math.max(0.25, Math.min(2, options.speed ?? 1)), 0);
    let elapsed = 0;
    const speed = Math.max(0.25, Math.min(2, options.speed ?? 1));
    const filter = options.filter || "none";
    for (const item of loaded) {
      const video = item.video;
      video.playbackRate = speed;
      video.currentTime = item.start;
      await new Promise<void>((resolve, reject) => {
        const onSeeked = () => { video.removeEventListener("error", onError); resolve(); };
        const onError = () => { video.removeEventListener("seeked", onSeeked); reject(new Error("Could not seek to a clip's trim point.")); };
        video.addEventListener("seeked", onSeeked, { once: true });
        video.addEventListener("error", onError, { once: true });
        if (Math.abs(video.currentTime - item.start) < 0.03) onSeeked();
      });
      if (duetVideo && !duetVideo.paused) duetVideo.currentTime = 0;
      if (duetVideo && duetVideo.paused) await duetVideo.play();
      await video.play();
      await new Promise<void>((resolve) => {
        const draw = () => {
          if (stopped || video.currentTime >= item.end || video.ended) { resolve(); return; }
          context.fillStyle = "#000";
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.filter = filter;
          const scale = Math.max(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
          const width = video.videoWidth * scale;
          const height = video.videoHeight * scale;
          if (duetVideo) {
            const halfWidth = canvas.width / 2;
            const duetScale = Math.max(halfWidth / duetVideo.videoWidth, canvas.height / duetVideo.videoHeight);
            const duetWidth = duetVideo.videoWidth * duetScale;
            const duetHeight = duetVideo.videoHeight * duetScale;
            context.save();
            context.beginPath(); context.rect(0, 0, halfWidth, canvas.height); context.clip();
            context.drawImage(duetVideo, (halfWidth - duetWidth) / 2, (canvas.height - duetHeight) / 2, duetWidth, duetHeight);
            context.restore();
            context.save();
            context.beginPath(); context.rect(halfWidth, 0, halfWidth, canvas.height); context.clip();
            const ownScale = Math.max(halfWidth / video.videoWidth, canvas.height / video.videoHeight);
            const ownWidth = video.videoWidth * ownScale;
            const ownHeight = video.videoHeight * ownScale;
            context.drawImage(video, halfWidth + (halfWidth - ownWidth) / 2, (canvas.height - ownHeight) / 2, ownWidth, ownHeight);
            context.restore();
          } else {
            context.drawImage(video, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
          }
          context.filter = "none";
          const globalTime = elapsed + (video.currentTime - item.start) / speed;
          const activeCaption = options.captions?.find((caption) => globalTime >= caption.start && globalTime <= caption.end);
          if (activeCaption?.text) {
            context.font = "bold 38px sans-serif";
            context.textAlign = "center";
            context.textBaseline = "bottom";
            context.lineWidth = 7;
            context.strokeStyle = "rgba(0,0,0,.85)";
            context.fillStyle = "#fff";
            context.strokeText(activeCaption.text, canvas.width / 2, canvas.height - 90, canvas.width - 60);
            context.fillText(activeCaption.text, canvas.width / 2, canvas.height - 90, canvas.width - 60);
          }
          options.onProgress?.(Math.min(99, Math.round((globalTime / Math.max(0.1, totalDuration)) * 100)));
          raf = requestAnimationFrame(draw);
        };
        raf = requestAnimationFrame(draw);
        const finish = () => { cancelAnimationFrame(raf); resolve(); };
        video.addEventListener("ended", finish, { once: true });
      });
      video.pause();
      elapsed += (item.end - item.start) / speed;
    }
    musicElement?.pause();
    if (recorder.state !== "inactive") recorder.stop();
    const blob = await recorded;
    if (!blob.size) throw new Error("The rendered video is empty. Try again.");
    options.onProgress?.(100);
    const extension = blob.type.includes("mp4") ? "mp4" : "webm";
    return new File([blob], `tigerchat-reel-${Date.now()}.${extension}`, { type: blob.type });
  } catch (error) {
    stopped = true;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    throw error;
  } finally {
    cancelAnimationFrame(raf);
    loaded.forEach((item) => { item.video.pause(); URL.revokeObjectURL(item.url); });
    duetVideo?.pause();
    if (duetUrl) URL.revokeObjectURL(duetUrl);
    musicElement?.pause();
    if (musicUrl) URL.revokeObjectURL(musicUrl);
    stream?.getTracks().forEach((track) => track.stop());
    await audioContext?.close();
  }
}
