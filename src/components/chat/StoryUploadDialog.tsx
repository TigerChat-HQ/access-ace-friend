import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, X, Upload, Type, Globe, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MusicPicker } from "./MusicPicker";

interface StoryUploadDialogProps {
  onUploaded: () => void;
}

const db = supabase as unknown as SupabaseClient;
const MAX_VIDEO_SECONDS = 120;
const BACKGROUNDS = ["#6D28D9", "#0F766E", "#BE123C", "#1D4ED8", "#B45309", "#111827"];

export const StoryUploadDialog = ({ onUploaded }: StoryUploadDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [music, setMusic] = useState<{ url: string; title: string; start: number; end: number } | null>(null);
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

      const { error } = await db.from("stories").insert({
        user_id: user.id,
        image_url: mediaUrl,
        caption: caption.trim() || null,
        music_url: music?.url || null,
        media_type: mediaFile ? mediaType : "text",
        duration,
        text_overlay: textOverlay.trim() ? { text: textOverlay.trim() } : null,
        audience,
        background_color: backgroundColor,
      });
      if (error) throw error;

      toast({ title: "Status posted successfully" });
      setOpen(false);
      setMediaFile(null);
      setMusic(null);
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
              {mediaType === "video" ? <video src={preview} controls className="w-full h-48 object-cover rounded-lg" /> : <img src={preview} alt="Status preview" className="w-full h-48 object-cover rounded-lg" />}
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

          <MusicPicker value={music} onChange={setMusic} maxClip={15} />
          <Button onClick={handleUpload} disabled={loading || (!mediaFile && !caption.trim() && !textOverlay.trim())} className="w-full neon-glow">
            {loading ? "Posting..." : "Post Status"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
