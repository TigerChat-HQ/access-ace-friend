import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, Music, X, Upload, Type } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface StoryUploadDialogProps {
  onUploaded: () => void;
}

const MAX_VIDEO_SECONDS = 120; // 2 minutes

export const StoryUploadDialog = ({ onUploaded }: StoryUploadDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [textOverlay, setTextOverlay] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith("video/");
    if (isVideo) {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        if (video.duration > MAX_VIDEO_SECONDS) {
          toast({
            title: "Video too long",
            description: "Stories support videos up to 2 minutes.",
            variant: "destructive",
          });
          return;
        }
        setDuration(Math.round(video.duration));
        setMediaFile(file);
        setMediaType("video");
        setPreview(URL.createObjectURL(file));
      };
      video.src = URL.createObjectURL(file);
    } else {
      setMediaFile(file);
      setMediaType("image");
      setDuration(null);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleUpload = async () => {
    if (!mediaFile || !user) return;
    setLoading(true);

    const ext = mediaFile.name.split(".").pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("stories").upload(path, mediaFile);
    if (upErr) {
      toast({ title: "Upload failed", description: upErr.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    const { data: { publicUrl: mediaUrl } } = supabase.storage.from("stories").getPublicUrl(path);

    let musicUrl: string | null = null;
    if (musicFile) {
      const mp = `${user.id}/${Date.now()}_music.${musicFile.name.split(".").pop()}`;
      const { error: mErr } = await supabase.storage.from("stories").upload(mp, musicFile);
      if (!mErr) {
        const { data: { publicUrl } } = supabase.storage.from("stories").getPublicUrl(mp);
        musicUrl = publicUrl;
      }
    }

    await supabase.from("stories").insert({
      user_id: user.id,
      image_url: mediaUrl,
      caption: caption || null,
      music_url: musicUrl,
      media_type: mediaType,
      duration: duration,
      text_overlay: textOverlay ? { text: textOverlay } : null,
    } as any);

    toast({ title: "Story posted! 📸" });
    setOpen(false);
    setMediaFile(null);
    setMusicFile(null);
    setCaption("");
    setTextOverlay("");
    setPreview(null);
    setDuration(null);
    setLoading(false);
    onUploaded();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <label className="p-2 rounded-full hover:bg-surface-hover transition-colors text-muted-foreground hover:text-primary cursor-pointer" aria-label="Add story">
          <Camera className="w-5 h-5" />
        </label>
      </DialogTrigger>
      <DialogContent className="bg-card border-border/50 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-foreground">New Story</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {preview ? (
            <div className="relative">
              {mediaType === "video" ? (
                <video src={preview} controls className="w-full h-48 object-cover rounded-lg" />
              ) : (
                <img src={preview} alt="Preview" className="w-full h-48 object-cover rounded-lg" />
              )}
              {textOverlay && (
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center px-4 pointer-events-none">
                  <span className="inline-block bg-black/50 text-white text-lg font-bold px-3 py-1 rounded">
                    {textOverlay}
                  </span>
                </div>
              )}
              <button
                onClick={() => { setMediaFile(null); setPreview(null); }}
                className="absolute top-2 right-2 p-1 bg-black/50 rounded-full"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-2 h-36 border-2 border-dashed border-border/50 rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
              <Upload className="w-8 h-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Select image or video (max 2 min)</span>
              <input type="file" accept="image/*,video/*" onChange={handleMediaSelect} className="hidden" />
            </label>
          )}

          <Input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add a caption..."
            className="bg-surface border-border/50"
          />

          <div className="flex items-center gap-2">
            <Type className="w-4 h-4 text-primary shrink-0" />
            <Input
              value={textOverlay}
              onChange={(e) => setTextOverlay(e.target.value)}
              placeholder="Text overlay (optional)"
              className="bg-surface border-border/50"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 px-3 py-2 bg-surface rounded-lg cursor-pointer hover:bg-surface-hover transition-colors flex-1">
              <Music className="w-4 h-4 text-primary" />
              <span className="text-sm text-foreground truncate">
                {musicFile ? musicFile.name : "Add background music"}
              </span>
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => setMusicFile(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
            {musicFile && (
              <button onClick={() => setMusicFile(null)} className="p-1 text-muted-foreground hover:text-destructive">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <Button onClick={handleUpload} disabled={loading || !mediaFile} className="w-full neon-glow">
            {loading ? "Posting..." : "Post Story"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
