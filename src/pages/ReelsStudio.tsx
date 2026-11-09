import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, AudioLines, Camera, Clapperboard, Loader2, Plus, Save, Trash2, Upload, Video } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

type TimedCaption = { start: number; end: number; text: string };
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

  const refreshDrafts = useCallback(async () => {
    if (!user) return;
    const { data, error } = await db.from("reel_drafts").select("*").eq("user_id", user.id).order("updated_at", { ascending: false });
    if (!error) setDrafts((data || []) as DraftRow[]);
  }, [user]);

  useEffect(() => { void refreshDrafts(); }, [refreshDrafts]);

  const uploadAsset = async (file: File, folder: string) => {
    if (!user) throw new Error("Sign in required");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${user.id}/reels/${folder}-${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from("post-media").upload(path, file, { upsert: false });
    if (error) throw error;
    return { path, url: supabase.storage.from("post-media").getPublicUrl(path).data.publicUrl };
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

  const openDraft = (draft: DraftRow) => {
    setDraftId(draft.id);
    setCaption(draft.caption || "");
    setVideoPath(draft.source_media_path);
    setVideoUrl(draft.source_media_path ? supabase.storage.from("post-media").getPublicUrl(draft.source_media_path).data.publicUrl : null);
    setVideoFile(null);
    setCoverPath(draft.cover_path);
    setCoverUrl(draft.cover_path ? supabase.storage.from("post-media").getPublicUrl(draft.cover_path).data.publicUrl : null);
    setAudioPath(draft.audio_path);
    setAudioUrl(draft.audio_path ? supabase.storage.from("post-media").getPublicUrl(draft.audio_path).data.publicUrl : null);
    setAudioFile(null);
    setAudioTitle(draft.audio_title || "");
    setAudioStart(Number(draft.audio_start_seconds || 0));
    setTrimStart(Number(draft.trim_start_seconds || 0));
    setTrimEnd(draft.trim_end_seconds === null ? null : Number(draft.trim_end_seconds));
    setCaptions(Array.isArray(draft.captions) ? draft.captions : []);
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
      const assets = await ensureUploaded();
      if (!assets.nextVideoUrl) throw new Error("Choose a video first.");
      const { error } = await db.from("posts").insert({
        user_id: user.id,
        caption: caption.trim() || null,
        media_url: assets.nextVideoUrl,
        media_type: "video",
        hashtags: hashtags(caption),
        reel_cover_url: coverUrl,
        reel_audio_url: assets.nextAudioUrl,
        reel_audio_title: audioTitle || (audioFile?.name ?? null),
        reel_audio_start_seconds: audioStart,
        reel_trim_start_seconds: trimStart,
        reel_trim_end_seconds: trimEnd,
        reel_captions: captions,
      });
      if (error) throw error;
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
        <button onClick={saveDraft} disabled={busy || !videoUrl} className="flex items-center gap-1 rounded-full px-3 py-2 text-sm text-primary disabled:opacity-50"><Save className="h-4 w-4" /> Draft</button>
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
                <Video className="h-10 w-10 text-primary" /><span className="font-semibold text-foreground">Choose a video for your Reel</span><span className="text-xs text-muted-foreground">MP4, WebM or another browser-supported video · max 150 MB</span>
                <input type="file" accept="video/*" className="hidden" onChange={(e) => chooseVideo(e.target.files?.[0])} />
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
            {audioFile && <p className="mt-2 text-xs text-muted-foreground">{audioFile.name}</p>}
            <label className="mt-3 block text-xs text-muted-foreground">Audio start offset (seconds)<input type="number" min={0} step={0.1} value={audioStart} onChange={(e) => setAudioStart(Math.max(0, Number(e.target.value)))} className="mt-1 w-full rounded-lg bg-background p-2 text-sm text-foreground" /></label>
            <p className="mt-2 text-[11px] text-muted-foreground">Only upload audio you own or have permission to use. A licensed commercial music catalogue is not connected yet.</p>
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
            <button onClick={addCaption} disabled={!captionText.trim() || captionEnd <= captionStart} className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg bg-secondary p-2 text-sm text-secondary-foreground disabled:opacity-40"><Plus className="h-4 w-4" /> Add timed caption</button>
            <div className="mt-3 space-y-2">
              {captions.map((item, index) => <div key={index} className="flex items-center gap-2 rounded-lg bg-background p-2 text-xs"><span className="shrink-0 text-muted-foreground">{item.start}s–{item.end}s</span><span className="min-w-0 flex-1 truncate text-foreground">{item.text}</span><button onClick={() => setCaptions((all) => all.filter((_, i) => i !== index))} aria-label="Remove caption" className="text-destructive"><Trash2 className="h-4 w-4" /></button></div>)}
              {!captions.length && <p className="py-4 text-center text-xs text-muted-foreground">No timed captions added yet.</p>}
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-foreground">Saved drafts</h2>
            {drafts.length ? drafts.map((draft) => <div key={draft.id} className="mb-2 flex items-center gap-2 rounded-xl bg-background p-2"><button onClick={() => openDraft(draft)} className="min-w-0 flex-1 text-left"><span className="block truncate text-sm text-foreground">{draft.caption || "Untitled Reel"}</span><span className="text-[11px] text-muted-foreground">Updated {new Date(draft.updated_at).toLocaleString()}</span></button><button onClick={() => void removeDraft(draft.id)} aria-label="Delete draft" className="p-2 text-destructive"><Trash2 className="h-4 w-4" /></button></div>) : <p className="py-4 text-center text-xs text-muted-foreground">Your saved drafts will appear here.</p>}
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
