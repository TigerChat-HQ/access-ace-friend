import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, Music, X, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface StoryUploadDialogProps {
  onUploaded: () => void;
}

export const StoryUploadDialog = ({ onUploaded }: StoryUploadDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleMusicSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setMusicFile(file);
  };

  const handleUpload = async () => {
    if (!imageFile || !user) return;
    setLoading(true);

    // Upload image
    const imgPath = `${user.id}/${Date.now()}.${imageFile.name.split(".").pop()}`;
    const { error: imgErr } = await supabase.storage.from("stories").upload(imgPath, imageFile);
    if (imgErr) {
      toast({ title: "Upload failed", description: imgErr.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    const { data: { publicUrl: imageUrl } } = supabase.storage.from("stories").getPublicUrl(imgPath);

    // Upload music if provided
    let musicUrl: string | null = null;
    if (musicFile) {
      const musicPath = `${user.id}/${Date.now()}_music.${musicFile.name.split(".").pop()}`;
      const { error: musicErr } = await supabase.storage.from("stories").upload(musicPath, musicFile);
      if (!musicErr) {
        const { data: { publicUrl } } = supabase.storage.from("stories").getPublicUrl(musicPath);
        musicUrl = publicUrl;
      }
    }

    await supabase.from("stories").insert({
      user_id: user.id,
      image_url: imageUrl,
      caption: caption || null,
      music_url: musicUrl,
    } as any);

    toast({ title: "Story posted! 📸" });
    setOpen(false);
    setImageFile(null);
    setMusicFile(null);
    setCaption("");
    setImagePreview(null);
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
          {/* Image */}
          {imagePreview ? (
            <div className="relative">
              <img src={imagePreview} alt="Preview" className="w-full h-48 object-cover rounded-lg" />
              <button
                onClick={() => { setImageFile(null); setImagePreview(null); }}
                className="absolute top-2 right-2 p-1 bg-black/50 rounded-full"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-2 h-36 border-2 border-dashed border-border/50 rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
              <Upload className="w-8 h-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Select Image</span>
              <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
            </label>
          )}

          {/* Caption */}
          <Input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add a caption..."
            className="bg-surface border-border/50"
          />

          {/* Music */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 px-3 py-2 bg-surface rounded-lg cursor-pointer hover:bg-surface-hover transition-colors flex-1">
              <Music className="w-4 h-4 text-primary" />
              <span className="text-sm text-foreground truncate">
                {musicFile ? musicFile.name : "Add background music"}
              </span>
              <input type="file" accept="audio/*" onChange={handleMusicSelect} className="hidden" />
            </label>
            {musicFile && (
              <button onClick={() => setMusicFile(null)} className="p-1 text-muted-foreground hover:text-destructive">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <Button
            onClick={handleUpload}
            disabled={loading || !imageFile}
            className="w-full neon-glow"
          >
            {loading ? "Posting..." : "Post Story"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
