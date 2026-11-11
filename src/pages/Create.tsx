import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Image as ImageIcon, X, Loader2, Type, RotateCw, Music2, Sparkles } from "lucide-react";
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
  const [rotation, setRotation] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [aspectRatio, setAspectRatio] = useState("original");
  const [sticker, setSticker] = useState("");
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [originalVolume, setOriginalVolume] = useState(100);
  const [musicVolume, setMusicVolume] = useState(35);

  const [renderedVideo, setRenderedVideo] = useState<File | null>(null);
  const [renderedPreview, setRenderedPreview] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewRequestRef = useRef(0);
  const isImage = file?.type.startsWith("image/");
  const isVideo = file?.type.startsWith("video/");
  const hasVideoEdits = trimStart > 0 || trimEnd < videoDuration || originalVolume !== 100 || Boolean(musicFile);

  const clearRenderedPreview = () => {
    previewRequestRef.current += 1;
    setPreviewLoading(false);
    setRenderedVideo(null);
    setRenderedPreview(null);
  };

  const onFile = (f: File | null) => {
    clearRenderedPreview();
    setFile(f);
    setFilter("none");
    setOverlay("");
    setRotation(0);
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setAspectRatio("original");
    setSticker("");
    setMusicFile(null);
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
    if (!renderedPreview) return;
    return () => URL.revokeObjectURL(renderedPreview);
  }, [renderedPreview]);

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
    const requestId = ++previewRequestRef.current;
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
      if (requestId !== previewRequestRef.current) return;
      setRenderedVideo(output);
      setRenderedPreview(URL.createObjectURL(output));
    } catch (error) {
      if (requestId === previewRequestRef.current) {
        toast({
          title: "Could not prepare video preview",
          description: error instanceof Error ? error.message : "Please try another video or browser.",
          variant: "destructive",
        });
      }
    } finally {
      if (requestId === previewRequestRef.current) setPreviewLoading(false);
    }
  };

  const renderEditedImage = async (src: File): Promise<File> => {
    if (filter === "none" && !overlay.trim() && rotation === 0 && brightness === 100 && contrast === 100 && saturation === 100 && aspectRatio === "original" && !sticker) return src;
    const css = FILTERS.find((f) => f.key === filter)?.css || "";
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.crossOrigin = "anonymous";
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = URL.createObjectURL(src);
    });
    const canvas = document.createElement("canvas");
    const rotated = rotation % 180 !== 0;
    const sourceWidth = rotated ? img.naturalHeight : img.naturalWidth;
    const sourceHeight = rotated ? img.naturalWidth : img.naturalHeight;
    let targetWidth = sourceWidth;
    let targetHeight = sourceHeight;
    const ratios: Record<string, number> = { square: 1, portrait: 4 / 5, landscape: 16 / 9 };
    const ratio = ratios[aspectRatio];
    if (ratio) {
      if (targetWidth / targetHeight > ratio) targetWidth = targetHeight * ratio;
      else targetHeight = targetWidth / ratio;
    }
    canvas.width = Math.max(1, Math.round(targetWidth));
    canvas.height = Math.max(1, Math.round(targetHeight));
    const ctx = canvas.getContext("2d")!;
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.filter = [css, "brightness(" + brightness + "%)", "contrast(" + contrast + "%)", "saturate(" + saturation + "%)"].filter(Boolean).join(" ");
    const cropScale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
    ctx.drawImage(img, -img.naturalWidth * cropScale / 2, -img.naturalHeight * cropScale / 2, img.naturalWidth * cropScale, img.naturalHeight * cropScale);
    ctx.restore();
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
    if (sticker) { ctx.font = Math.round(canvas.width / 7) + "px sans-serif"; ctx.textAlign = "center"; ctx.fillText(sticker, canvas.width * 0.82, canvas.height * 0.18); }
    const blob: Blob = await new Promise((res, reject) => canvas.toBlob((b) => b ? res(b) : reject(new Error("Could not export edited image.")), "image/jpeg", 0.92));
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

      let publishedMusicUrl: string | null = null;
      if (musicFile && isImage) {
        const musicPath = user.id + "/post-audio/" + Date.now() + "-" + musicFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const { error: musicUploadError } = await supabase.storage.from("post-media").upload(musicPath, musicFile);
        if (musicUploadError) throw musicUploadError;
        publishedMusicUrl = supabase.storage.from("post-media").getPublicUrl(musicPath).data.publicUrl;
      }

      const { error } = await supabase.from("posts").insert({
        user_id: user.id,
        caption: caption.trim() || null,
        media_url: mediaUrl,
        media_type: mediaType,
        hashtags: extractHashtags(caption),
        reel_audio_url: publishedMusicUrl,
        reel_audio_title: musicFile?.name || null,
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
                  style={{ filter: filterCss + " brightness(" + brightness + "%) contrast(" + contrast + "%) saturate(" + saturation + "%)", transform: "rotate(" + rotation + "deg)", aspectRatio: aspectRatio === "original" ? undefined : aspectRatio === "square" ? "1 / 1" : aspectRatio === "portrait" ? "4 / 5" : "16 / 9", objectFit: "cover" }}
                />
                {sticker && <span className="absolute right-5 top-5 text-5xl drop-shadow-lg pointer-events-none">{sticker}</span>}
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
            <section className="space-y-3 rounded-xl border border-border p-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground"><Sparkles className="h-4 w-4 text-primary" /> Advanced photo editor</h2>
              <div className="grid grid-cols-4 gap-2">
                {["original", "square", "portrait", "landscape"].map((ratio) => <button key={ratio} type="button" onClick={() => setAspectRatio(ratio)} className={cn("rounded-lg border px-2 py-2 text-xs capitalize", aspectRatio === ratio ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}>{ratio}</button>)}
              </div>
              <button type="button" onClick={() => setRotation((value) => (value + 90) % 360)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-border py-2 text-sm"><RotateCw className="h-4 w-4" /> Rotate 90° · {rotation}°</button>
              {([{label:"Brightness",value:brightness,set:setBrightness},{label:"Contrast",value:contrast,set:setContrast},{label:"Saturation",value:saturation,set:setSaturation}] as const).map((item) => <label key={item.label} className="block text-xs text-muted-foreground">{item.label} · {item.value}%<input type="range" min={0} max={200} value={item.value} onChange={(event) => item.set(Number(event.target.value))} className="w-full" /></label>)}
              <div className="flex flex-wrap gap-2">{["❤️","🔥","😂","😍","🐯","✨","🎉","🌟","📍","💯"].map((emoji) => <button key={emoji} type="button" onClick={() => setSticker(sticker === emoji ? "" : emoji)} aria-pressed={sticker === emoji} className={cn("rounded-lg border px-2 py-1 text-xl", sticker === emoji ? "border-primary bg-primary/10" : "border-border")}>{emoji}</button>)}</div>
            </section>
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

        {isImage && <section className="space-y-2 rounded-xl border border-border p-3"><h2 className="flex items-center gap-2 text-sm font-semibold"><Music2 className="h-4 w-4 text-primary" /> Background music</h2><input type="file" accept="audio/*" onChange={(event) => setMusicFile(event.target.files?.[0] || null)} className="block w-full text-xs" />{musicFile && <div className="flex items-center justify-between gap-2 text-xs"><span className="truncate">{musicFile.name}</span><button type="button" onClick={() => setMusicFile(null)} className="text-destructive">Remove</button></div>}<p className="text-[11px] text-muted-foreground">Music is attached to the published photo post.</p></section>}

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
