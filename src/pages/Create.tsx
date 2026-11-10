import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Image as ImageIcon, X, Loader2, Type } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { renderVideoEdit } from "@/lib/postMediaEditor";

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
  const [videoDuration, setVideoDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [originalVolume, setOriginalVolume] = useState(100);
  const [musicVolume, setMusicVolume] = useState(35);
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [renderedVideo, setRenderedVideo] = useState<File | null>(null);
  const [renderedPreview, setRenderedPreview] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const isImage = file?.type.startsWith("image/");
  const isVideo = file?.type.startsWith("video/");
  const hasVideoEdits = trimStart > 0 || trimEnd < videoDuration || originalVolume !== 100 || Boolean(musicFile);

  const clearRenderedPreview = () => {
    setRenderedVideo(null);
    setRenderedPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  };

  const onFile = (f: File | null) => {
    clearRenderedPreview();
    setFile(f);
    setFilter("none");
    setOverlay("");
    setVideoDuration(0);
    setTrimStart(0);
    setTrimEnd(0);
    setOriginalVolume(100);
    setMusicVolume(35);
    setMusicFile(null);
    if (f) setPreview(URL.createObjectURL(f));
    else {
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  useEffect(() => {
    if (!preview || !isVideo) return;
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.src = preview;
    probe.onloadedmetadata = () => {
      const duration = Number.isFinite(probe.duration) ? probe.duration : 0;
      setVideoDuration(duration);
      setTrimEnd(duration);
    };
    return () => { probe.src = ""; };
  }, [preview, isVideo]);

  const handlePreviewVideo = async () => {
    if (!file || !isVideo) return;
    clearRenderedPreview();
    setPreviewLoading(true);
    try {
      const output = hasVideoEdits
        ? await renderVideoEdit(file, {
            start: trimStart,
            end: trimEnd || videoDuration,
            originalVolume: originalVolume / 100,
            musicFile,
            musicVolume: musicVolume / 100,
          })
        : file;
      setRenderedVideo(output);
      setRenderedPreview(URL.createObjectURL(output));
    } catch (error) {
      toast({
        title: "Could not prepare video preview",
        description: error instanceof Error ? error.message : "Please try another video or browser.",
        variant: "destructive",
      });
    } finally {
      setPreviewLoading(false);
    }
  };

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
    if (isVideo && !renderedVideo) {
      toast({
        title: "Preview your video first",
        description: "Create and review the final video preview before sharing.",
        variant: "destructive",
      });
      return;
    }
    if (!caption.trim() && !file) {
      toast({ title: "Empty post", description: "Add a caption or media.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      let mediaUrl: string | null = null;
      let mediaType: "text" | "image" | "video" = "text";
      if (file) {
        const upload = isImage
          ? await renderEditedImage(file)
          : isVideo
            ? renderedVideo!
            : file;
        const ext = isImage ? "jpg" : upload.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("post-media").upload(path, upload);
        if (upErr) throw upErr;
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
      if (error) throw error;
      toast({ title: "Posted! 🎉" });
      navigate("/");
    } catch (error) {
      toast({
        title: "Could not publish post",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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
          disabled={loading || previewLoading || (isVideo && !renderedVideo)}
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

        {isVideo && (
          <section className="space-y-3 rounded-xl border border-border p-3">
            <h2 className="text-sm font-semibold text-foreground">Video & audio editor</h2>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Trim start · {trimStart.toFixed(1)}s</label>
              <input aria-label="Video trim start" type="range" min={0} max={Math.max(0, videoDuration - 0.2)} step={0.1} value={trimStart} onChange={(e) => { clearRenderedPreview(); const value = Number(e.target.value); setTrimStart(Math.min(value, trimEnd - 0.2)); }} className="w-full" />
              <label className="text-xs text-muted-foreground">Trim end · {trimEnd.toFixed(1)}s / {videoDuration.toFixed(1)}s</label>
              <input aria-label="Video trim end" type="range" min={Math.min(videoDuration, trimStart + 0.2)} max={videoDuration || 0.2} step={0.1} value={trimEnd} onChange={(e) => { clearRenderedPreview(); setTrimEnd(Number(e.target.value)); }} className="w-full" />
            </div>
            <label className="block text-xs text-muted-foreground">Original video volume · {originalVolume}%
              <input type="range" min={0} max={100} value={originalVolume} onChange={(e) => { clearRenderedPreview(); setOriginalVolume(Number(e.target.value)); }} className="w-full" />
            </label>
            <button type="button" onClick={() => { clearRenderedPreview(); setOriginalVolume(0); }} className="text-xs text-primary underline">Remove original video sound</button>
            <label className="block text-xs text-muted-foreground">Background music
              <input type="file" accept="audio/*" onChange={(e) => { clearRenderedPreview(); setMusicFile(e.target.files?.[0] || null); }} className="mt-1 block w-full text-xs" />
            </label>
            {musicFile && <div className="flex items-center justify-between gap-2 text-xs"><span className="truncate">{musicFile.name}</span><button type="button" onClick={() => { clearRenderedPreview(); setMusicFile(null); }} className="text-destructive">Remove</button></div>}
            {musicFile && <label className="block text-xs text-muted-foreground">Music volume · {musicVolume}%
              <input type="range" min={0} max={100} value={musicVolume} onChange={(e) => { clearRenderedPreview(); setMusicVolume(Number(e.target.value)); }} className="w-full" />
            </label>}
            <button
              type="button"
              onClick={handlePreviewVideo}
              disabled={previewLoading || loading || videoDuration <= 0}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {previewLoading ? "Preparing preview..." : renderedVideo ? "Refresh final preview" : "Preview edited video"}
            </button>
            <p className="text-[11px] text-muted-foreground">
              Hakiki video ya mwisho kabla ya kushare. Ukibadilisha trim au sauti, tengeneza preview mpya.
            </p>
            {renderedPreview && (
              <div className="space-y-2 rounded-lg bg-muted/50 p-2">
                <p className="text-xs font-semibold text-foreground">Final video preview</p>
                <video
                  key={renderedPreview}
                  src={renderedPreview}
                  controls
                  playsInline
                  className="w-full max-h-[400px] rounded-lg bg-black"
                />
                <p className="text-[11px] text-muted-foreground">Hii ndiyo video itakayopakiwa kwenye post yako.</p>
              </div>
            )}
          </section>
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
