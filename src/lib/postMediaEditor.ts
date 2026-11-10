export interface VideoEditOptions {
  start: number;
  end: number;
  originalVolume: number;
  musicFile?: File | null;
  musicVolume: number;
}

function waitForMediaEvent(
  target: HTMLMediaElement,
  eventName: string,
  timeoutMs = 15000,
): Promise<void> {
  if (eventName === "loadedmetadata" && target.readyState >= HTMLMediaElement.HAVE_METADATA) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      target.removeEventListener(eventName, onReady);
      target.removeEventListener("error", onError);
      window.clearTimeout(timeout);
    };
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Could not read the selected media."));
    };
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Media loading took too long. Please try another file."));
    }, timeoutMs);

    target.addEventListener(eventName, onReady, { once: true });
    target.addEventListener("error", onError, { once: true });
  });
}

function waitUntilVideoTime(video: HTMLVideoElement, end: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let frame = 0;
    const cleanup = () => {
      window.cancelAnimationFrame(frame);
      video.removeEventListener("error", onError);
    };
    const onError = () => {
      cleanup();
      reject(new Error("Video playback stopped before the edited clip was ready."));
    };
    const check = () => {
      if (video.currentTime >= end || video.ended) {
        cleanup();
        resolve();
        return;
      }
      frame = window.requestAnimationFrame(check);
    };

    video.addEventListener("error", onError, { once: true });
    frame = window.requestAnimationFrame(check);
  });
}

export async function renderVideoEdit(file: File, options: VideoEditOptions): Promise<File> {
  if (typeof MediaRecorder === "undefined") {
    throw new Error("Video export is not supported by this browser. Try an updated Chrome browser.");
  }

  const video = document.createElement("video") as HTMLVideoElement & {
    captureStream?: () => MediaStream;
    mozCaptureStream?: () => MediaStream;
  };
  const sourceUrl = URL.createObjectURL(file);
  video.src = sourceUrl;
  video.playsInline = true;
  video.preload = "auto";

  let audioContext: AudioContext | null = null;
  let musicElement: HTMLAudioElement | null = null;
  let musicUrl: string | null = null;
  let recorder: MediaRecorder | null = null;
  let combinedStream: MediaStream | null = null;

  try {
    await waitForMediaEvent(video, "loadedmetadata");
    const capture = video.captureStream?.bind(video) || video.mozCaptureStream?.bind(video);
    if (!capture) {
      throw new Error("This browser cannot export edited video. Please use the latest Chrome browser.");
    }

    const duration = video.duration;
    const start = Math.max(0, Math.min(options.start, duration));
    const end = Math.max(0, Math.min(options.end, duration));
    if (!Number.isFinite(duration) || end - start < 0.2) {
      throw new Error("Choose a valid video section of at least 0.2 seconds.");
    }

    const AudioContextConstructor = window.AudioContext;
    if (!AudioContextConstructor) {
      throw new Error("Audio editing is not supported by this browser.");
    }

    audioContext = new AudioContextConstructor();
    const destination = audioContext.createMediaStreamDestination();
    const originalSource = audioContext.createMediaElementSource(video);
    const originalGain = audioContext.createGain();
    originalGain.gain.value = Math.max(0, Math.min(options.originalVolume, 1));
    originalSource.connect(originalGain).connect(destination);

    if (options.musicFile) {
      musicElement = document.createElement("audio");
      musicUrl = URL.createObjectURL(options.musicFile);
      musicElement.src = musicUrl;
      musicElement.loop = true;
      musicElement.preload = "auto";
      await waitForMediaEvent(musicElement, "loadedmetadata");
      const musicSource = audioContext.createMediaElementSource(musicElement);
      const musicGain = audioContext.createGain();
      musicGain.gain.value = Math.max(0, Math.min(options.musicVolume, 1));
      musicSource.connect(musicGain).connect(destination);
    }

    const captured = capture();
    const videoTracks = captured.getVideoTracks();
    if (videoTracks.length === 0) {
      throw new Error("The browser could not capture this video's picture track.");
    }

    combinedStream = new MediaStream([
      ...videoTracks,
      ...destination.stream.getAudioTracks(),
    ]);

    const supportedMimeType = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4",
    ].find((type) => MediaRecorder.isTypeSupported(type));
    recorder = new MediaRecorder(
      combinedStream,
      supportedMimeType ? { mimeType: supportedMimeType } : undefined,
    );

    const recordedBlob = new Promise<Blob>((resolve, reject) => {
      const chunks: BlobPart[] = [];
      recorder!.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder!.onerror = () => reject(new Error("Video export failed. Please try again."));
      recorder!.onstop = () => {
        resolve(new Blob(chunks, { type: recorder!.mimeType || "video/webm" }));
      };
    });

    await audioContext.resume();

    if (Math.abs(video.currentTime - start) > 0.05) {
      const seeked = waitForMediaEvent(video, "seeked", 10000);
      video.currentTime = start;
      await seeked;
    }

    if (musicElement) {
      musicElement.currentTime = 0;
      await musicElement.play();
    }

    await video.play();
    recorder.start(250);
    await waitUntilVideoTime(video, end);
    video.pause();
    if (musicElement) musicElement.pause();

    if (recorder.state !== "inactive") recorder.stop();
    const blob = await recordedBlob;
    if (blob.size === 0) {
      throw new Error("The edited video is empty. Please try again.");
    }

    const isMp4 = blob.type.includes("mp4");
    const extension = isMp4 ? "mp4" : "webm";
    return new File([blob], `tigerchat-edited-${Date.now()}.${extension}`, { type: blob.type });
  } catch (error) {
    if (recorder && recorder.state !== "inactive") recorder.stop();
    throw error;
  } finally {
    video.pause();
    musicElement?.pause();
    combinedStream?.getTracks().forEach((track) => track.stop());
    audioContext?.close();
    URL.revokeObjectURL(sourceUrl);
    if (musicUrl) URL.revokeObjectURL(musicUrl);
  }
}
