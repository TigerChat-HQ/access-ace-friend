import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Image as ImageIcon, X, Loader2, Type } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const extractHashtags = (text: string): string[] =>
  [...new Set((text.match(/#(\w+)/g) || []).map((t) => t.slice(1).toLowerCase()))];

const FILTERS: { key: string; label: string; css: string }[] = [
  { key: "none", label: "Original", css: "" },
  { key: "warm", label: "Warm", css: "saturate(1.2) hue-rotate(-10deg) brightness(1.05)" },
  { key: "cool", label: "Cool", css: "saturate(1.1) hue-rotate(15deg) brightness(0.98)" },
  { key: "mono", label: "Mono", css: "grayscale(1) contrast(1.1)" },
  { key: "vivid", label: "Vivid", css: "saturate(1.6) contrast(1.1)" },
  { key: "fade", label: "Fade", css: "saturate(0.8) brightness(1.1) contrast(0.9)" },
];

const Create = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [filter, setFilter] = useState("none");
  const [overlay, setOverlay] = useState("");
  const [loading, setLoading] = useState(false);
  const isImage = file?.type.startsWith("image/");
  const isVideo = file?.type.startsWith("video/");

  const onFile = (f: File | null) => {
    setFile(f);
    setFilter("none");
    setOverlay("");
    if (f) setPreview(URL.createObjectURL(f));
    else setPreview(null);
  };

  // Apply CSS filter + overlay to image via canvas before upload
  const renderEditedImage = async (src: File): Promise<File> => {
    if (filter === "none" && !overlay.trim()) return src;
    const css = FILTERS.find((f) => f.key === filter)?.css || "";
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.crossOrigin = "anonymous";
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = URL.createObjectURL(src);
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    if (css) ctx.filter = css;
    ctx.drawImage(img, 0, 0);
    if (overlay.trim()) {
      ctx.filter = "none";
      const fontSize = Math.round(canvas.width / 14);
      ctx.font = `bold ${fontSize}px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      const padding = fontSize * 0.4;
      const metrics = ctx.measureText(overlay);
      const w = metrics.width + padding * 2;
      const h = fontSize * 1.4;
      const x = canvas.width / 2;
      const y = canvas.height * 0.85;
      ctx.fillRect(x - w / 2, y - h * 0.85, w, h);
      ctx.fillStyle = "white";
      ctx.fillText(overlay, x, y);
    }
    const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.92));
    return new File([blob], `edited-${Date.now()}.jpg`, { type: "image/jpeg" });
  };

  const submit = async () => {
    if (!user) return;
    if (!caption.trim() && !file) {
      toast({ title: "Empty post", description: "Add a caption or media.", variant: "destructive" });
      return;
    }
    setLoading(true);
    let mediaUrl: string | null = null;
    let mediaType: "text" | "image" | "video" = "text";
    if (file) {
      const upload = isImage ? await renderEditedImage(file) : file;
      const ext = isImage ? "jpg" : file.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("post-media").upload(path, upload);
      if (upErr) {
        toast({ title: "Upload failed", description: upErr.message, variant: "destructive" });
        setLoading(false);
        return;
      }
      const { data: { publicUrl } } = supabase.storage.from("post-media").getPublicUrl(path);
      mediaUrl = publicUrl;
      mediaType = isVideo ? "video" : "image";
    }

    const { error } = await supabase.from("posts").insert({
      user_id: user.id,
      caption: caption.trim() || null,
      media_url: mediaUrl,
      media_type: mediaType,
      hashtags: extractHashtags(caption),
    });
    setLoading(false);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Posted! 🎉" });
      navigate("/");
    }
  };

  const filterCss = FILTERS.find((f) => f.key === filter)?.css || "";

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
          Cancel
        </button>
        <h1 className="text-base font-semibold text-foreground">New Post</h1>
        <button
          onClick={submit}
          disabled={loading}
          className="text-primary font-semibold text-sm disabled:opacity-50 flex items-center gap-1.5"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Share
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {preview && (
          <div className="relative rounded-xl overflow-hidden bg-muted">
            {isVideo ? (
              <video src={preview} controls className="w-full max-h-[400px]" />
            ) : (
              <div className="relative">
                <img
                  src={preview}
                  alt=""
                  className="w-full max-h-[400px] object-contain"
                  style={{ filter: filterCss }}
                />
                {overlay && (
                  <div className="absolute inset-x-0 bottom-[12%] text-center px-4 pointer-events-none">
                    <span className="inline-block bg-black/60 text-white text-lg font-bold px-3 py-1 rounded">
                      {overlay}
                    </span>
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => onFile(null)}
              className="absolute top-2 right-2 bg-black/60 text-white p-1.5 rounded-full"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {isImage && (
          <>
            <div className="flex gap-2 overflow-x-auto scrollbar-thin -mx-1 px-1">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                    filter === f.key
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-surface-hover"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Type className="w-4 h-4 text-primary shrink-0" />
              <input
                value={overlay}
                onChange={(e) => setOverlay(e.target.value)}
                placeholder="Add text overlay..."
                className="flex-1 bg-surface rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none"
              />
            </div>
          </>
        )}

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="What's happening? Use #hashtags to be discovered."
          className="w-full bg-surface rounded-xl p-3 text-sm text-foreground placeholder:text-muted-foreground outline-none min-h-[120px] resize-none"
          maxLength={2000}
        />
        <p className="text-xs text-muted-foreground text-right">{caption.length}/2000</p>

        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          onChange={(e) => onFile(e.target.files?.[0] || null)}
          className="hidden"
        />
        <div className="flex gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-2 bg-surface hover:bg-surface-hover py-3 rounded-xl text-sm text-foreground"
          >
            <ImageIcon className="w-4 h-4" />
            Photo / Video
          </button>
        </div>
      </div>
    </div>
  );
};

export default Create;
