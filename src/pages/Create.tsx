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
  const [extraImageFiles, setExtraImageFiles] = useState<File[]>([]);
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
  const [audience, setAudience] = useState<"public" | "followers" | "private">("public");
  const [allowComments, setAllowComments] = useState(true);
  const [locationName, setLocationName] = useState("");
  const [altText, setAltText] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [tagQuery, setTagQuery] = useState("");
  const [tagResults, setTagResults] = useState<{ user_id: string; username: string | null; display_name: string | null }[]>([]);
  const [taggedUsers, setTaggedUsers] = useState<{ user_id: string; username: string | null; display_name: string | null }[]>([]);
  const [drafts, setDrafts] = useState<{ id: string; caption: string; updated_at: string; media_paths: string[]; editor_state: import("@/integrations/supabase/types").Json }[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
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
    setExtraImageFiles([]);
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

  useEffect(() => {
    if (!user) return;
    supabase.from("post_drafts").select("id,caption,updated_at,media_paths,editor_state").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(10)
      .then(({ data }) => setDrafts(data || []));
  }, [user]);

  const searchPeople = async (value: string) => {
    setTagQuery(value);
    if (!value.trim()) { setTagResults([]); return; }
    const term = value.trim().replace(/^@/, "");
    const { data } = await supabase.from("profiles").select("user_id,username,display_name")
      .or("username.ilike.%"+term+"%,display_name.ilike.%"+term+"%").limit(8);
    setTagResults((data || []).filter((person) => person.user_id !== user?.id && !taggedUsers.some((tag) => tag.user_id === person.user_id)));
  };

  const addTaggedUser = (person: { user_id: string; username: string | null; display_name: string | null }) => {
    setTaggedUsers((current) => [...current, person]);
    setTagQuery("");
    setTagResults([]);
  };

  const saveDraft = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const mediaPaths: string[] = [];
      let primaryMediaPath: string | null = null;
      const extraImagePaths: string[] = [];
      if (file) {
        primaryMediaPath = user.id + "/" + crypto.randomUUID() + "-" + file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const { error } = await supabase.storage.from("post-drafts").upload(primaryMediaPath, file);
        if (error) throw error;
        mediaPaths.push(primaryMediaPath);
      }
      for (const extraFile of extraImageFiles) {
        const path = user.id + "/" + crypto.randomUUID() + "-" + extraFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const { error } = await supabase.storage.from("post-drafts").upload(path, extraFile);
        if (error) throw error;
        extraImagePaths.push(path);
        mediaPaths.push(path);
      }
      let musicPath: string | null = null;
      if (musicFile) {
        musicPath = user.id + "/" + crypto.randomUUID() + "-audio-" + musicFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const { error } = await supabase.storage.from("post-drafts").upload(musicPath, musicFile);
        if (error) throw error;
        mediaPaths.push(musicPath);
      }
      const editorState = {
        filter, overlay, rotation, brightness, contrast, saturation, aspectRatio, sticker,
        audience, allowComments, locationName, altText, scheduledAt,
        taggedUsers, mediaType: isVideo ? "video" : isImage ? "image" : "text", musicPath, primaryMediaPath, extraImagePaths,
      };
      const { error } = await supabase.from("post_drafts").insert({ user_id: user.id, caption, editor_state: editorState, media_paths: mediaPaths });
      if (error) throw error;
      const { data } = await supabase.from("post_drafts").select("id,caption,updated_at,media_paths,editor_state").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(10);
      setDrafts(data || []);
      toast({ title: "Draft saved", description: "Your post and private media are saved safely." });
    } catch (error) {
      toast({ title: "Could not save draft", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const restoreDraft = async (draft: typeof drafts[number]) => {
    try {
      const state = draft.editor_state as Record<string, unknown>;
      setCaption(draft.caption);
      setFilter(typeof state.filter === "string" ? state.filter : "none");
      setOverlay(typeof state.overlay === "string" ? state.overlay : "");
      setRotation(Number(state.rotation || 0));
      setBrightness(Number(state.brightness || 100));
      setContrast(Number(state.contrast || 100));
      setSaturation(Number(state.saturation || 100));
      setAspectRatio(typeof state.aspectRatio === "string" ? state.aspectRatio : "original");
      setSticker(typeof state.sticker === "string" ? state.sticker : "");
      setAudience(state.audience === "followers" || state.audience === "private" ? state.audience : "public");
      setAllowComments(state.allowComments !== false);
      setLocationName(typeof state.locationName === "string" ? state.locationName : "");
      setAltText(typeof state.altText === "string" ? state.altText : "");
      setScheduledAt(typeof state.scheduledAt === "string" ? state.scheduledAt : "");
      setTaggedUsers(Array.isArray(state.taggedUsers) ? state.taggedUsers as typeof taggedUsers : []);
      const mediaPath = typeof state.primaryMediaPath === "string" ? state.primaryMediaPath : null;
      if (mediaPath) {
        const { data, error } = await supabase.storage.from("post-drafts").createSignedUrl(mediaPath, 300);
        if (error) throw error;
        const response = await fetch(data.signedUrl);
        const blob = await response.blob();
        const restored = new File([blob], mediaPath.split("/").pop() || "draft-media", { type: blob.type });
        onFile(restored);
      } else onFile(null);
      const restoredExtraPaths = Array.isArray(state.extraImagePaths) ? state.extraImagePaths.filter((path): path is string => typeof path === "string") : [];
      const restoredExtras = await Promise.all(restoredExtraPaths.map(async (path) => {
        const { data, error } = await supabase.storage.from("post-drafts").createSignedUrl(path, 300);
        if (error) throw error;
        const response = await fetch(data.signedUrl);
        const blob = await response.blob();
        return new File([blob], path.split("/").pop() || "draft-photo", { type: blob.type });
      }));
      setExtraImageFiles(restoredExtras);
      setCaption(draft.caption);
      setFilter(typeof state.filter === "string" ? state.filter : "none");
      setOverlay(typeof state.overlay === "string" ? state.overlay : "");
      setRotation(Number(state.rotation || 0));
      setBrightness(Number(state.brightness || 100));
      setContrast(Number(state.contrast || 100));
      setSaturation(Number(state.saturation || 100));
      setAspectRatio(typeof state.aspectRatio === "string" ? state.aspectRatio : "original");
      setSticker(typeof state.sticker === "string" ? state.sticker : "");
      setAudience(state.audience === "followers" || state.audience === "private" ? state.audience : "public");
      setAllowComments(state.allowComments !== false);
      setLocationName(typeof state.locationName === "string" ? state.locationName : "");
      setAltText(typeof state.altText === "string" ? state.altText : "");
      setScheduledAt(typeof state.scheduledAt === "string" ? state.scheduledAt : "");
      setTaggedUsers(Array.isArray(state.taggedUsers) ? state.taggedUsers as typeof taggedUsers : []);
      const musicPath = typeof state.musicPath === "string" ? state.musicPath : null;
      if (musicPath) {
        const { data, error } = await supabase.storage.from("post-drafts").createSignedUrl(musicPath, 300);
        if (error) throw error;
        const response = await fetch(data.signedUrl);
        const blob = await response.blob();
        setMusicFile(new File([blob], musicPath.split("/").pop() || "draft-audio", { type: blob.type }));
      } else setMusicFile(null);
      setActiveDraftId(draft.id);
      toast({ title: "Draft restored" });
    } catch (error) {
      toast({ title: "Could not restore draft", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    }
  };

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

      const mediaItems: { url: string; type: string; alt_text: string | null }[] = [];
      if (mediaUrl) mediaItems.push({ url: mediaUrl, type: mediaType, alt_text: altText.trim() || null });
      for (const [index, extraFile] of extraImageFiles.entries()) {
        const edited = await renderEditedImage(extraFile);
        const path = user.id + "/" + Date.now() + "-carousel-" + index + ".jpg";
        const { error: extraUploadError } = await supabase.storage.from("post-media").upload(path, edited);
        if (extraUploadError) throw extraUploadError;
        const url = supabase.storage.from("post-media").getPublicUrl(path).data.publicUrl;
        mediaItems.push({ url, type: "image", alt_text: altText.trim() || null });
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
        post_audio_url: publishedMusicUrl,
        post_audio_title: musicFile?.name || null,
        audience,
        allow_comments: allowComments,
        location_name: locationName.trim() || null,
        tagged_user_ids: taggedUsers.map((person) => person.user_id),
        alt_text: altText.trim() || null,
        is_draft: false,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        media_items: mediaItems,
      });
      if (error) throw error;
      if (activeDraftId) await supabase.from("post_drafts").delete().eq("id", activeDraftId);
      toast({ title: scheduledAt ? "Post scheduled" : "Posted! 🎉" });
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
        {drafts.length > 0 && <section className="rounded-xl border border-border p-3 space-y-2"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Saved post drafts</h2><span className="text-xs text-muted-foreground">{drafts.length}</span></div><div className="flex gap-2 overflow-x-auto">{drafts.map((draft) => <button key={draft.id} type="button" onClick={() => restoreDraft(draft)} className={cn("shrink-0 max-w-48 rounded-lg border px-3 py-2 text-left", activeDraftId === draft.id ? "border-primary bg-primary/10" : "border-border")}><span className="block truncate text-xs font-medium">{draft.caption || "Untitled post"}</span><span className="block text-[10px] text-muted-foreground">{new Date(draft.updated_at).toLocaleDateString()}</span></button>)}</div></section>}
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

        <section className="space-y-3 rounded-xl border border-border p-3">
          <h2 className="text-sm font-semibold">Post details</h2>
          <label className="block space-y-1 text-xs text-muted-foreground">Who can see this post?
            <select value={audience} onChange={(event) => setAudience(event.target.value as typeof audience)} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"><option value="public">Public</option><option value="followers">Followers</option><option value="private">Only me</option></select>
          </label>
          <label className="flex items-center justify-between text-sm"><span>Allow comments</span><input type="checkbox" checked={allowComments} onChange={(event) => setAllowComments(event.target.checked)} /></label>
          <label className="block space-y-1 text-xs text-muted-foreground">Add location
            <input value={locationName} onChange={(event) => setLocationName(event.target.value)} placeholder="City, place or venue" className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground" maxLength={120} />
          </label>
          <div className="space-y-1"><label className="text-xs text-muted-foreground">Tag people by username</label><input value={tagQuery} onChange={(event) => searchPeople(event.target.value)} placeholder="@username" className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground" />{tagResults.length > 0 && <div className="rounded-lg border border-border divide-y divide-border">{tagResults.map((person) => <button key={person.user_id} type="button" onClick={() => addTaggedUser(person)} className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-hover">{person.display_name || person.username || "User"} <span className="text-xs text-muted-foreground">@{person.username}</span></button>)}</div>}{taggedUsers.length > 0 && <div className="flex flex-wrap gap-1">{taggedUsers.map((person) => <button key={person.user_id} type="button" onClick={() => setTaggedUsers((current) => current.filter((tag) => tag.user_id !== person.user_id))} className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">@{person.username || person.display_name} ×</button>)}</div>}</div>
          {isImage && <label className="block space-y-1 text-xs text-muted-foreground">Image description (accessibility)
            <input value={altText} onChange={(event) => setAltText(event.target.value)} placeholder="Describe what is in the image" className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground" maxLength={500} />
          </label>}
          <label className="block space-y-1 text-xs text-muted-foreground">Schedule post (optional)
            <input type="datetime-local" value={scheduledAt} min={(() => { const local = new Date(Date.now() + 60000); local.setMinutes(local.getMinutes() - local.getTimezoneOffset()); return local.toISOString().slice(0,16); })()} onChange={(event) => setScheduledAt(event.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground" />
          </label>
        </section>
        {isImage && <section className="space-y-2 rounded-xl border border-border p-3"><h2 className="text-sm font-semibold">Carousel photos</h2><input type="file" accept="image/*" multiple onChange={(event) => setExtraImageFiles(Array.from(event.target.files || []).slice(0, 9))} className="block w-full text-xs" /><p className="text-[11px] text-muted-foreground">Add up to 9 extra images after the cover photo. Total: {1 + extraImageFiles.length} / 10</p>{extraImageFiles.length > 0 && <button type="button" onClick={() => setExtraImageFiles([])} className="text-xs text-destructive">Remove extra photos</button>}</section>}

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
          <button type="button" onClick={saveDraft} disabled={loading} className="flex-1 rounded-xl border border-border py-3 text-sm font-medium text-foreground disabled:opacity-50">Save draft</button>
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
