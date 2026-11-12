import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, AudioLines, Camera, Clapperboard, Loader2, Plus, Save, Trash2, Upload, Video } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

type TimedCaption = { start: number; end: number; text: string };
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechWindow = Window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };

type DraftRow = {
  id: string;
  caption: string;
  source_media_path: string | null;
  cover_path: string | null;
  audio_path: string | null;
  audio_title: string | null;
  audio_start_seconds: number;
  trim_start_seconds: number;
  trim_end_seconds: number | null;
  captions: TimedCaption[];
  updated_at: string;
};
const db = supabase as unknown as SupabaseClient;
const hashtags = (value: string) => [...new Set((value.match(/#(\w+)/g) || []).map((tag) => tag.slice(1).toLowerCase()))];

const ReelsStudio = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const voiceRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState<number | null>(null);
  const [coverPath, setCoverPath] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPath, setAudioPath] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioTitle, setAudioTitle] = useState("");
  const [audioStart, setAudioStart] = useState(0);
  const [captions, setCaptions] = useState<TimedCaption[]>([]);
  const [captionText, setCaptionText] = useState("");
  const [captionStart, setCaptionStart] = useState(0);
  const [captionEnd, setCaptionEnd] = useState(3);
  const [busy, setBusy] = useState(false);
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [listeningCaptions, setListeningCaptions] = useState(false);

  const refreshDrafts = useCallback(async () => {
    if (!user) return;
    const { data, error } = await db.from("reel_drafts").select("*").eq("user_id", user.id).order("updated_at", { ascending: false });
    if (!error) setDrafts((data || []) as DraftRow[]);
  }, [user]);

  useEffect(() => { void refreshDrafts(); }, [refreshDrafts]);

  useEffect(() => () => {
    if (voiceRecorderRef.current?.state === "recording") voiceRecorderRef.current.stop();
    voiceStreamRef.current?.getTracks().forEach((track) => track.stop());
    speechRecognitionRef.current?.stop();
  }, []);

  const uploadAsset = async (file: File, folder: string) => {
    if (!user) throw new Error("Sign in required");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${user.id}/reels/${folder}-${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from("reel-drafts").upload(path, file, { upsert: false });
    if (error) throw error;
    const { data: signed, error: signedError } = await supabase.storage.from("reel-drafts").createSignedUrl(path, 3600);
    if (signedError || !signed?.signedUrl) throw signedError || new Error("Could not create a private preview URL");
    return { path, url: signed.signedUrl };
  };

  const chooseVideo = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      toast({ title: "Choose a video file", variant: "destructive" });
      return;
    }
    if (file.size > 150 * 1024 * 1024) {
      toast({ title: "Video is too large", description: "Choose a video under 150 MB.", variant: "destructive" });
      return;
    }
    setVideoFile(file);
    setVideoPath(null);
    setCoverPath(null);
    setCoverUrl(null);
    setTrimStart(0);
    setTrimEnd(null);
    setVideoUrl(URL.createObjectURL(file));
  };

  const captureCover = async () => {
    const video = videoRef.current;
    if (!video || !user) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx || !canvas.width || !canvas.height) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) return;
    setBusy(true);
    try {
      const asset = await uploadAsset(new File([blob], "reel-cover.jpg", { type: "image/jpeg" }), "cover");
      setCoverPath(asset.path);
      setCoverUrl(asset.url);
      toast({ title: "Cover frame saved" });
    } catch (error) {
      toast({ title: "Cover upload failed", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" });
    } finally { setBusy(false); }
  };

  const ensureUploaded = async () => {
    let nextVideoPath = videoPath;
    let nextVideoUrl = videoUrl;
    if (videoFile && !nextVideoPath) {
      const asset = await uploadAsset(videoFile, "video");
      nextVideoPath = asset.path;
      nextVideoUrl = asset.url;
      setVideoPath(asset.path);
      setVideoUrl(asset.url);
    }
    let nextAudioPath = audioPath;
    let nextAudioUrl = audioUrl;
    if (audioFile && !nextAudioPath) {
      const asset = await uploadAsset(audioFile, "audio");
      nextAudioPath = asset.path;
      nextAudioUrl = asset.url;
      setAudioPath(asset.path);
      setAudioUrl(asset.url);
    }
    return { nextVideoPath, nextVideoUrl, nextAudioPath, nextAudioUrl };
  };

  const privateUrl = async (path: string | null) => {
    if (!path) return null;
    const { data, error } = await supabase.storage.from("reel-drafts").createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) throw error || new Error("Could not open private draft media");
    return data.signedUrl;
  };

  const uploadPublishedFile = async (file: File, kind: string) => {
    if (!user) throw new Error("Sign in required");
    const extension = file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || (kind === "video" ? "mp4" : "bin");
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      // A fresh key per attempt avoids a duplicate-object conflict if the
      // previous request reached Storage but its response was interrupted.
      const publicPath = `${user.id}/reels/published-${kind}-${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage.from("post-media").upload(publicPath, file, {
        contentType: file.type || undefined,
        cacheControl: "3600",
        upsert: false,
      });
      if (!error) return { url: supabase.storage.from("post-media").getPublicUrl(publicPath).data.publicUrl, path: publicPath };
      lastError = new Error(error.message || `Could not upload ${kind} (attempt ${attempt}/3)`);
      if (attempt < 3) await new Promise((resolve) => window.setTimeout(resolve, attempt * 900));
    }
    throw lastError || new Error(`Could not upload ${kind}`);
  };

  // Draft assets are private. This fallback is only used when publishing an
  // already-saved draft; fresh selections are uploaded directly from File to
  // the public media bucket to avoid fetch -> Blob -> re-upload on mobile.
  const promoteDraftAsset = async (path: string | null, kind: string) => {
    if (!path || !user) return null;
    const signedUrl = await privateUrl(path);
    if (!signedUrl) return null;
    const response = await fetch(signedUrl);
    if (!response.ok) throw new Error(`Could not read private ${kind} asset (HTTP ${response.status})`);
    const blob = await response.blob();
    if (!blob.size) throw new Error(`The saved ${kind} file is empty. Re-select it and try again.`);
    const extension = path.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "bin";
    const publicPath = `${user.id}/reels/published-${kind}-${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from("post-media").upload(publicPath, blob, { contentType: blob.type || undefined, upsert: false });
    if (error) throw new Error(`Could not publish saved ${kind}: ${error.message}`);
    return { url: supabase.storage.from("post-media").getPublicUrl(publicPath).data.publicUrl, path: publicPath };
  };

  const saveDraft = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const assets = await ensureUploaded();
      if (!assets.nextVideoPath) throw new Error("Choose a video before saving a draft.");
      const values = {
        user_id: user.id,
        caption,
        source_media_path: assets.nextVideoPath,
        cover_path: coverPath,
        audio_path: assets.nextAudioPath,
        audio_title: audioTitle || (audioFile?.name ?? null),
        audio_start_seconds: audioStart,
        trim_start_seconds: trimStart,
        trim_end_seconds: trimEnd,
        captions,
        editor_state: { version: 1 },
        updated_at: new Date().toISOString(),
      };
      const result = draftId
        ? await db.from("reel_drafts").update(values).eq("id", draftId).eq("user_id", user.id).select("id").single()
        : await db.from("reel_drafts").insert(values).select("id").single();
      if (result.error) throw result.error;
      setDraftId(result.data.id);
      await refreshDrafts();
      toast({ title: "Draft saved" });
    } catch (error) {
      toast({ title: "Could not save draft", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" });
    } finally { setBusy(false); }
  };

  const openDraft = async (draft: DraftRow) => {
    setDraftId(draft.id);
    setCaption(draft.caption || "");
    setVideoPath(draft.source_media_path);
    setVideoUrl(await privateUrl(draft.source_media_path));
    setVideoFile(null);
    setCoverPath(draft.cover_path);
    setCoverUrl(await privateUrl(draft.cover_path));
    setAudioPath(draft.audio_path);
    setAudioUrl(await privateUrl(draft.audio_path));
    setAudioFile(null);
    setAudioTitle(draft.audio_title || "");
    setAudioStart(Number(draft.audio_start_seconds || 0));
    setTrimStart(Number(draft.trim_start_seconds || 0));
    setTrimEnd(draft.trim_end_seconds === null ? null : Number(draft.trim_end_seconds));
    setCaptions(Array.isArray(draft.captions) ? draft.captions : []);
  };

  const toggleVoiceover = async () => {
    if (recordingVoice) {
      voiceRecorderRef.current?.stop();
      setRecordingVoice(false);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast({ title: "Voiceover is not supported", description: "Use a browser that supports microphone recording.", variant: "destructive" });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceStreamRef.current = stream;
      voiceChunksRef.current = [];
      const preferredType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, preferredType ? { mimeType: preferredType } : undefined);
      voiceRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size) voiceChunksRef.current.push(event.data); };
      recorder.onerror = () => {
        setRecordingVoice(false);
        stream.getTracks().forEach((track) => track.stop());
        toast({ title: "Voiceover recording failed", description: "Check microphone permission and try again.", variant: "destructive" });
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || "audio/webm";
        const blob = new Blob(voiceChunksRef.current, { type });
        stream.getTracks().forEach((track) => track.stop());
        voiceStreamRef.current = null;
        if (blob.size) {
          const extension = type.includes("mp4") ? "m4a" : "webm";
          const file = new File([blob], `tiger-voiceover-${Date.now()}.${extension}`, { type });
          setAudioFile(file);
          setAudioPath(null);
          setAudioUrl(URL.createObjectURL(file));
          setAudioTitle("My voiceover");
          setAudioStart(0);
          toast({ title: "Voiceover ready", description: "Your recording is selected as the Reel audio track." });
        }
      };
      recorder.start(500);
      setRecordingVoice(true);
    } catch (error) {
      toast({ title: "Microphone unavailable", description: error instanceof Error ? error.message : "Allow microphone access and try again.", variant: "destructive" });
    }
  };


  const toggleAutoCaptions = () => {
    if (listeningCaptions) {
      speechRecognitionRef.current?.stop();
      setListeningCaptions(false);
      return;
    }
    const speechApi = window as SpeechWindow;
    const SpeechRecognitionCtor = speechApi.SpeechRecognition || speechApi.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      toast({ title: "Automatic captions are unavailable", description: "This browser does not support speech recognition. You can still add timed captions manually.", variant: "destructive" });
      return;
    }
    if (recordingVoice) {
      toast({ title: "Stop voiceover first", description: "Use automatic captions or voiceover recording one at a time." });
      return;
    }
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = navigator.language || "en-US";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const videoTime = videoRef.current?.currentTime ?? 0;
      const additions: TimedCaption[] = [];
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result?.[0]?.transcript?.trim();
        if (result?.isFinal && transcript) additions.push({ start: videoTime, end: Math.min(duration || videoTime + 4, videoTime + 4), text: transcript });
      }
      if (additions.length) setCaptions((items) => [...items, ...additions].sort((a, b) => a.start - b.start));
    };
    recognition.onerror = () => {
      setListeningCaptions(false);
      toast({ title: "Caption recognition stopped", description: "Check microphone permission or continue with timed captions manually.", variant: "destructive" });
    };
    recognition.onend = () => setListeningCaptions(false);
    speechRecognitionRef.current = recognition;
    try {
      recognition.start();
      setListeningCaptions(true);
      toast({ title: "Listening for speech", description: "Play the video near your microphone. Captions will be added with approximate timestamps." });
    } catch (error) {
      setListeningCaptions(false);
      toast({ title: "Could not start captions", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" });
    }
  };

  const addCaption = () => {
    if (!captionText.trim() || captionEnd <= captionStart) return;
    setCaptions((items) => [...items, { start: captionStart, end: captionEnd, text: captionText.trim() }].sort((a, b) => a.start - b.start));
    setCaptionText("");
  };

  const publish = async () => {
    if (!user) return;
    setBusy(true);
    try {
      if (!videoFile && !videoPath) throw new Error("Choose a video first.");
      if (videoFile && videoFile.size > 150 * 1024 * 1024) throw new Error("Video exceeds the 150 MB upload limit.");
      const uploadedPaths: string[] = [];
      let publishedVideo: { url: string; path: string } | null = null;
      let publishedAudio: { url: string; path: string } | null = null;
      let publishedCover: { url: string; path: string } | null = null;
      try {
        // Upload newly selected media directly; do not first upload it to the
        // private drafts bucket and then download/re-upload the same large file.
        publishedVideo = videoFile
          ? await uploadPublishedFile(videoFile, "video")
          : await promoteDraftAsset(videoPath, "video");
        if (!publishedVideo?.url) throw new Error("Video upload did not return a public URL.");
        if (publishedVideo.path) uploadedPaths.push(publishedVideo.path);

        if (coverPath) {
          publishedCover = await promoteDraftAsset(coverPath, "cover");
          if (publishedCover?.path) uploadedPaths.push(publishedCover.path);
        }
        if (audioFile) {
          publishedAudio = await uploadPublishedFile(audioFile, "audio");
          if (publishedAudio.path) uploadedPaths.push(publishedAudio.path);
        } else if (audioPath) {
          publishedAudio = await promoteDraftAsset(audioPath, "audio");
          if (publishedAudio?.path) uploadedPaths.push(publishedAudio.path);
        }

        const { error } = await db.from("posts").insert({
          user_id: user.id,
          caption: caption.trim() || null,
          media_url: publishedVideo.url,
          media_type: "video",
          hashtags: hashtags(caption),
          reel_cover_url: publishedCover?.url || null,
          reel_audio_url: publishedAudio?.url || null,
          reel_audio_title: audioTitle || (audioFile?.name ?? null),
          reel_audio_start_seconds: audioStart,
          reel_trim_start_seconds: trimStart,
          reel_trim_end_seconds: trimEnd,
          reel_captions: captions,
        });
        if (error) throw new Error(`The media uploaded, but saving the Reel post failed: ${error.message} (code ${error.code || "unknown"})`);
      } catch (publishError) {
        if (uploadedPaths.length) await supabase.storage.from("post-media").remove(uploadedPaths);
        throw publishError;
      }
      const privatePaths = [videoPath, coverPath, audioPath].filter((path): path is string => Boolean(path));
      if (privatePaths.length) await supabase.storage.from("reel-drafts").remove(privatePaths);
      if (draftId) await db.from("reel_drafts").delete().eq("id", draftId).eq("user_id", user.id);
      toast({ title: "Your Reel is published" });
      navigate("/reels");
    } catch (error) {
      toast({ title: "Could not publish Reel", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" });
    } finally { setBusy(false); }
  };

  const removeDraft = async (id: string) => {
    if (!user) return;
    const { error } = await db.from("reel_drafts").delete().eq("id", id).eq("user_id", user.id);
    if (!error) {
      setDrafts((items) => items.filter((item) => item.id !== id));
      if (draftId === id) setDraftId(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border/50 bg-card/95 px-4 py-3 backdrop-blur">
        <Link to="/reels" aria-label="Back to Reels" className="rounded-full p-2 text-muted-foreground"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="flex items-center gap-2"><Clapperboard className="h-5 w-5 text-primary" /><h1 className="font-bold text-foreground">Reels Studio</h1></div>
        <button onClick={saveDraft} disabled={busy || !videoUrl || recordingVoice} className="flex items-center gap-1 rounded-full px-3 py-2 text-sm text-primary disabled:opacity-50"><Save className="h-4 w-4" /> Draft</button>
      </header>

      <main className="mx-auto grid max-w-5xl gap-5 p-4 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-4">
          <div className="rounded-2xl border border-border/60 bg-card p-4">
            {videoUrl ? (
              <div className="space-y-3">
                <video ref={videoRef} src={videoUrl} controls playsInline className="max-h-[55dvh] w-full rounded-xl bg-black" onLoadedMetadata={(e) => { const videoDuration = e.currentTarget.duration; setDuration(videoDuration); setTrimEnd((v) => v ?? videoDuration); }} />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Video length: {duration.toFixed(1)}s</span>
                  <button onClick={captureCover} disabled={busy} className="flex items-center gap-1 rounded-lg bg-secondary px-3 py-2 text-xs text-secondary-foreground"><Camera className="h-4 w-4" /> Use current frame as cover</button>
                </div>
                {coverUrl && <img src={coverUrl} alt="Selected Reel cover" className="h-24 w-16 rounded-lg object-cover" />}
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs text-muted-foreground">Trim start (seconds)<input type="number" min={0} max={duration} step={0.1} value={trimStart} onChange={(e) => setTrimStart(Math.max(0, Number(e.target.value)))} className="mt-1 w-full rounded-lg bg-background p-2 text-sm text-foreground" /></label>
                  <label className="text-xs text-muted-foreground">Trim end (seconds)<input type="number" min={trimStart + 0.1} max={duration} step={0.1} value={trimEnd ?? duration} onChange={(e) => setTrimEnd(Math.min(duration || Infinity, Number(e.target.value)))} className="mt-1 w-full rounded-lg bg-background p-2 text-sm text-foreground" /></label>
                </div>
                <p className="text-[11px] text-muted-foreground">Trim points are saved as playback metadata. Exporting a physically shortened video file is a separate processing step and is not enabled in this release.</p>
              </div>
            ) : (
              <label className="flex min-h-56 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-background p-6 text-center">
                <Video className="h-10 w-10 text-primary" /><span className="font-semibold text-foreground">Record with camera or choose a video</span><span className="text-xs text-muted-foreground">Camera capture or gallery · MP4, WebM · max 150 MB</span>
                <input type="file" accept="video/*" capture="user" className="hidden" onChange={(e) => chooseVideo(e.target.files?.[0])} />
              </label>
            )}
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <label className="mb-2 block text-sm font-semibold text-foreground">Caption</label>
            <textarea value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={2200} placeholder="Write a caption and add #hashtags…" className="min-h-28 w-full rounded-xl bg-background p-3 text-sm text-foreground outline-none" />
            <div className="mt-1 text-right text-[11px] text-muted-foreground">{caption.length}/2200</div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <div className="mb-3 flex items-center gap-2"><AudioLines className="h-4 w-4 text-primary" /><h2 className="text-sm font-semibold text-foreground">Audio track</h2></div>
            <input value={audioTitle} onChange={(e) => setAudioTitle(e.target.value)} placeholder="Track title (optional)" className="mb-2 w-full rounded-lg bg-background p-2 text-sm text-foreground" />
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground"><Upload className="h-4 w-4" /> Upload your original or licensed audio<input type="file" accept="audio/*" className="hidden" onChange={(e) => { setAudioFile(e.target.files?.[0] || null); setAudioPath(null); setAudioUrl(null); if (e.target.files?.[0] && !audioTitle) setAudioTitle(e.target.files[0].name); }} /></label>
            <button type="button" disabled={busy} onClick={() => void toggleVoiceover()} className={`mt-2 flex w-full items-center justify-center gap-2 rounded-xl p-3 text-sm font-semibold ${recordingVoice ? "bg-destructive text-destructive-foreground" : "bg-secondary text-secondary-foreground"}`}>
              <span className={recordingVoice ? "h-2 w-2 animate-pulse rounded-full bg-current" : "h-2 w-2 rounded-full bg-primary"} />
              {recordingVoice ? "Stop voiceover recording" : "Record voiceover"}
            </button>
            {audioFile && <p className="mt-2 text-xs text-muted-foreground">{audioFile.name}</p>}
            <label className="mt-3 block text-xs text-muted-foreground">Audio start offset (seconds)<input type="number" min={0} step={0.1} value={audioStart} onChange={(e) => setAudioStart(Math.max(0, Number(e.target.value)))} className="mt-1 w-full rounded-lg bg-background p-2 text-sm text-foreground" /></label>
            <p className="mt-2 text-[11px] text-muted-foreground">Use original or licensed audio only. Voiceover recordings are saved as the Reel audio track. A commercial music catalogue still requires a licensed provider.</p>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-foreground">Timed captions</h2>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-muted-foreground">Start (s)<input type="number" min={0} step={0.1} value={captionStart} onChange={(e) => setCaptionStart(Number(e.target.value))} className="mt-1 w-full rounded-lg bg-background p-2 text-sm text-foreground" /></label>
              <label className="text-xs text-muted-foreground">End (s)<input type="number" min={0.1} step={0.1} value={captionEnd} onChange={(e) => setCaptionEnd(Number(e.target.value))} className="mt-1 w-full rounded-lg bg-background p-2 text-sm text-foreground" /></label>
            </div>
            <input value={captionText} onChange={(e) => setCaptionText(e.target.value)} placeholder="Caption text for this time range" className="mt-2 w-full rounded-lg bg-background p-2 text-sm text-foreground" />
            <button type="button" disabled={busy || recordingVoice} onClick={toggleAutoCaptions} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-border p-2 text-sm text-foreground disabled:opacity-50">
              {listeningCaptions ? "Stop automatic captions" : "Generate captions from speech"}
            </button>
            <button onClick={addCaption} disabled={!captionText.trim() || captionEnd <= captionStart} className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg bg-secondary p-2 text-sm text-secondary-foreground disabled:opacity-40"><Plus className="h-4 w-4" /> Add timed caption</button>
            <div className="mt-3 space-y-2">
              {captions.map((item, index) => <div key={index} className="flex items-center gap-2 rounded-lg bg-background p-2 text-xs"><span className="shrink-0 text-muted-foreground">{item.start}s–{item.end}s</span><span className="min-w-0 flex-1 truncate text-foreground">{item.text}</span><button onClick={() => setCaptions((all) => all.filter((_, i) => i !== index))} aria-label="Remove caption" className="text-destructive"><Trash2 className="h-4 w-4" /></button></div>)}
              {!captions.length && <p className="py-4 text-center text-xs text-muted-foreground">No timed captions added yet.</p>}
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-foreground">Saved drafts</h2>
            {drafts.length ? drafts.map((draft) => <div key={draft.id} className="mb-2 flex items-center gap-2 rounded-xl bg-background p-2"><button onClick={() => void openDraft(draft).catch((error) => toast({ title: "Could not open draft", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" }))} className="min-w-0 flex-1 text-left"><span className="block truncate text-sm text-foreground">{draft.caption || "Untitled Reel"}</span><span className="text-[11px] text-muted-foreground">Updated {new Date(draft.updated_at).toLocaleString()}</span></button><button onClick={() => void removeDraft(draft.id)} aria-label="Delete draft" className="p-2 text-destructive"><Trash2 className="h-4 w-4" /></button></div>) : <p className="py-4 text-center text-xs text-muted-foreground">Your saved drafts will appear here.</p>}
          </div>

          <button onClick={publish} disabled={busy || !videoUrl} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clapperboard className="h-4 w-4" />} Publish Reel
          </button>
        </section>
      </main>
    </div>
  );
};

export default ReelsStudio;
