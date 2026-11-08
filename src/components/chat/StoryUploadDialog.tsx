import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, X, Upload, Type, Globe, Lock, Music } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MusicPicker } from "./MusicPicker";

interface StoryUploadDialogProps {
  onUploaded: () => void;
}

const db = supabase as unknown as SupabaseClient;
const MAX_VIDEO_SECONDS = 120;
const MAX_AUDIO_BYTES = 15 * 1024 * 1024;
const BACKGROUNDS = ["#6D28D9", "#0F766E", "#BE123C", "#1D4ED8", "#B45309", "#111827"];

export const StoryUploadDialog = ({ onUploaded }: StoryUploadDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [music, setMusic] = useState<{ url: string; title: string; start: number; end: number } | null>(null);
  const [localMusicFile, setLocalMusicFile] = useState<File | null>(null);
  const [localMusicPreview, setLocalMusicPreview] = useState<string | null>(null);
  const [localMusicDuration, setLocalMusicDuration] = useState(15);
  const [imageFilter, setImageFilter] = useState("none");
  const [caption, setCaption] = useState("");
  const [textOverlay, setTextOverlay] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [audience, setAudience] = useState<"everyone" | "only_me">("everyone");
  const [backgroundColor, setBackgroundColor] = useState(BACKGROUNDS[0]);

  useEffect(() => () => {
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
  }, [preview]);

  useEffect(() => () => {
    if (localMusicPreview?.startsWith("blob:")) URL.revokeObjectURL(localMusicPreview);
  }, [localMusicPreview]);

  const clearLocalMusic = () => {
    if (localMusicPreview?.startsWith("blob:")) URL.revokeObjectURL(localMusicPreview);
    setLocalMusicFile(null);
    setLocalMusicPreview(null);
    setLocalMusicDuration(15);
  };

  const handleLocalMusicSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      toast({ title: "Unsupported audio", description: "Choose an audio file such as MP3, M4A or WAV.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_AUDIO_BYTES) {
      toast({ title: "Audio too large", description: "Choose an audio file under 15 MB.", variant: "destructive" });
      return;
    }
    clearLocalMusic();
    const url = URL.createObjectURL(file);
    setLocalMusicFile(file);
    setLocalMusicPreview(url);
    setMusic(null);
    const audio = new Audio(url);
    audio.onloadedmetadata = () => {
      setLocalMusicDuration(Number.isFinite(audio.duration) ? Math.min(15, audio.duration) : 15);
      audio.src = "";
    };
  };

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      toast({ title: "Unsupported file", description: "Choose an image or video.", variant: "destructive" });
      return;
    }
    const isVideo = file.type.startsWith("video/");
    if (isVideo) {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        if (!Number.isFinite(video.duration) || video.duration > MAX_VIDEO_SECONDS) {
          toast({ title: "Video too long", description: "Stories support videos up to 2 minutes.", variant: "destructive" });
          URL.revokeObjectURL(video.src);
          return;
        }
        setDuration(Math.round(video.duration));
        setMediaFile(file);
        setMediaType("video");
        setPreview(URL.createObjectURL(file));
        URL.revokeObjectURL(video.src);
      };
      video.onerror = () => toast({ title: "Cannot read video", description: "Choose another video file.", variant: "destructive" });
      video.src = URL.createObjectURL(file);
    } else {
      setMediaFile(file);
      setMediaType("image");
      setDuration(null);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleUpload = async () => {
    if (!user || loading) return;
    if (!mediaFile && !caption.trim() && !textOverlay.trim()) {
      toast({ title: "Add something to your status", description: "Choose media or write a text status.", variant: "destructive" });
      return;
    }
    setLoading(true);
    let mediaUrl: string | null = null;
    try {
      if (mediaFile) {
        const ext = mediaFile.name.split(".").pop()?.toLowerCase() || (mediaType === "video" ? "mp4" : "jpg");
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("stories").upload(path, mediaFile, {
          contentType: mediaFile.type,
          upsert: false,
        });
        if (uploadError) throw uploadError;
        mediaUrl = supabase.storage.from("stories").getPublicUrl(path).data.publicUrl;
      }

      let musicUrl = music?.url || null;
      if (localMusicFile) {
        const ext = localMusicFile.name.split(".").pop()?.toLowerCase() || "mp3";
        const audioPath = `${user.id}/audio-${crypto.randomUUID()}.${ext}`;
        const { error: audioError } = await supabase.storage.from("stories").upload(audioPath, localMusicFile, {
          contentType: localMusicFile.type,
          upsert: false,
        });
        if (audioError) throw audioError;
        musicUrl = supabase.storage.from("stories").getPublicUrl(audioPath).data.publicUrl;
      }

      const overlayMetadata = {
        ...(textOverlay.trim() ? { text: textOverlay.trim() } : {}),
        ...(musicUrl ? { music_start: music?.start ?? 0, music_end: music?.end ?? localMusicDuration } : {}),
        ...(imageFilter !== "none" ? { image_filter: imageFilter } : {}),
      };
      const { error } = await db.from("stories").insert({
        user_id: user.id,
        image_url: mediaUrl,
        caption: caption.trim() || null,
        music_url: musicUrl,
        media_type: mediaFile ? mediaType : "text",
        duration,
        text_overlay: Object.keys(overlayMetadata).length ? overlayMetadata : null,
        audience,
        background_color: backgroundColor,
      });
      if (error) throw error;

      toast({ title: "Status posted successfully" });
      setOpen(false);
      setMediaFile(null);
      setMusic(null);
      clearLocalMusic();
      setImageFilter("none");
      setCaption("");
      setTextOverlay("");
      setPreview(null);
      setDuration(null);
      setAudience("everyone");
      setBackgroundColor(BACKGROUNDS[0]);
      onUploaded();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please try again.";
      toast({ title: "Could not post status", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const clearMedia = () => {
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    setMediaFile(null);
    setPreview(null);
    setDuration(null);
    setMediaType("image");
    setImageFilter("none");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="p-2 rounded-full hover:bg-surface-hover transition-colors text-muted-foreground hover:text-primary cursor-pointer" aria-label="Add status">
          <Camera className="w-5 h-5" />
        </button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border/50 max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="text-foreground">Create Status</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {preview ? (
            <div className="relative">
              {mediaType === "video" ? <video src={preview} controls className="w-full h-48 object-cover rounded-lg" style={{ filter: imageFilter }} /> : <img src={preview} alt="Status preview" className="w-full h-48 object-cover rounded-lg" style={{ filter: imageFilter }} />}
              {textOverlay && <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center px-4 pointer-events-none"><span className="inline-block bg-black/60 text-white text-lg font-bold px-3 py-1 rounded">{textOverlay}</span></div>}
              <button type="button" onClick={clearMedia} aria-label="Remove media" className="absolute top-2 right-2 p-1 bg-black/60 rounded-full"><X className="w-4 h-4 text-white" /></button>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="flex flex-col items-center justify-center gap-2 h-28 border-2 border-dashed border-border/50 rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                <Upload className="w-7 h-7 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Add photo or video (max 2 min)</span>
                <input type="file" accept="image/*,video/*" onChange={handleMediaSelect} className="hidden" />
              </label>
              <p className="text-center text-xs text-muted-foreground">Or publish a text-only status below</p>
            </div>
          )}

          {mediaFile && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Photo/video filter</label>
              <select value={imageFilter} onChange={(e) => setImageFilter(e.target.value)} className="w-full h-10 rounded-md border border-border bg-surface px-3 text-sm text-foreground">
                <option value="none">Original</option>
                <option value="sepia(0.22) saturate(1.2)">Warm</option>
                <option value="grayscale(1)">Black & white</option>
                <option value="sepia(0.45) contrast(1.08)">Vintage</option>
                <option value="brightness(1.15) saturate(1.15)">Bright</option>
                <option value="hue-rotate(18deg) saturate(1.1)">Cool</option>
              </select>
            </div>
          )}

          {!mediaFile && (
            <div className="rounded-xl p-4 min-h-28 flex items-center justify-center" style={{ backgroundColor }}>
              <textarea value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={700} placeholder="What's on your mind?" className="w-full bg-transparent text-white text-center text-lg font-semibold placeholder:text-white/70 resize-none outline-none" rows={3} />
            </div>
          )}
          {mediaFile && <Input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={700} placeholder="Add a caption..." className="bg-surface border-border/50" />}

          {!mediaFile && (
            <div className="flex items-center justify-center gap-2">
              {BACKGROUNDS.map((color) => <button key={color} type="button" aria-label={`Choose background ${color}`} aria-pressed={backgroundColor === color} onClick={() => setBackgroundColor(color)} className={`w-7 h-7 rounded-full border-2 ${backgroundColor === color ? "border-foreground scale-110" : "border-transparent"}`} style={{ backgroundColor: color }} />)}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Type className="w-4 h-4 text-primary shrink-0" />
            <Input value={textOverlay} onChange={(e) => setTextOverlay(e.target.value)} maxLength={120} placeholder="Text overlay (optional)" className="bg-surface border-border/50" />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Who can see this status?</p>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={audience === "everyone" ? "default" : "outline"} onClick={() => setAudience("everyone")} className="gap-2"><Globe className="w-4 h-4" /> Everyone</Button>
              <Button type="button" variant={audience === "only_me" ? "default" : "outline"} onClick={() => setAudience("only_me")} className="gap-2"><Lock className="w-4 h-4" /> Only me</Button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Background music</p>
            <MusicPicker value={music} onChange={(value) => { setMusic(value); if (value) clearLocalMusic(); }} maxClip={15} />
            <label className="flex items-center gap-2 rounded-lg border border-border/60 p-3 cursor-pointer hover:bg-surface">
              <Music className="w-4 h-4 text-primary" />
              <span className="text-sm text-foreground flex-1 truncate">{localMusicFile ? localMusicFile.name : "Choose audio from this phone"}</span>
              <input type="file" accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg" onChange={handleLocalMusicSelect} className="hidden" />
            </label>
            {localMusicPreview && (
              <div className="flex items-center gap-2">
                <audio src={localMusicPreview} controls className="w-full h-9" />
                <button type="button" onClick={clearLocalMusic} aria-label="Remove phone audio" className="p-2 text-muted-foreground hover:text-destructive"><X className="w-4 h-4" /></button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">Phone audio is uploaded with the status. The first 15 seconds play in the story.</p>
          </div>
          <Button onClick={handleUpload} disabled={loading || (!mediaFile && !caption.trim() && !textOverlay.trim())} className="w-full neon-glow">
            {loading ? "Posting..." : "Post Status"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
