import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, X, Upload, Type, Globe, Lock, Music, Mic, Square } from "lucide-react";
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
  const [localMusicStart, setLocalMusicStart] = useState(0);
  const [localMusicEnd, setLocalMusicEnd] = useState(15);
  const [imageFilter, setImageFilter] = useState("none");
  const [caption, setCaption] = useState("");
  const [textOverlay, setTextOverlay] = useState("");
  const [textColor, setTextColor] = useState("#FFFFFF");
  const [textBackground, setTextBackground] = useState("rgba(0,0,0,0.65)");
  const [textFont, setTextFont] = useState("sans-serif");
  const [textSize, setTextSize] = useState(24);
  const [sticker, setSticker] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [audience, setAudience] = useState<"everyone" | "contacts" | "contacts_except" | "selected" | "only_me">("everyone");
  const [contactOptions, setContactOptions] = useState<{ user_id: string; display_name: string }[]>([]);
  const [selectedAudienceIds, setSelectedAudienceIds] = useState<string[]>([]);
  const [excludedAudienceIds, setExcludedAudienceIds] = useState<string[]>([]);
  const [drawColor, setDrawColor] = useState("#FF3B30");
  const [drawMode, setDrawMode] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [backgroundColor, setBackgroundColor] = useState(BACKGROUNDS[0]);
  const [recordingVoice, setRecordingVoice] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => () => {
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
  }, [preview]);
  
  useEffect(() => () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
  }, []);

  useEffect(() => () => {
    if (localMusicPreview?.startsWith("blob:")) URL.revokeObjectURL(localMusicPreview);
  }, [localMusicPreview]);


  useEffect(() => {
    if (!open || !user) return;
    let active = true;
    const loadContacts = async () => {
      const [outgoingResult, incomingResult] = await Promise.all([supabase.from("follows").select("following_id").eq("follower_id", user.id), supabase.from("follows").select("follower_id").eq("following_id", user.id)]);
      const outgoingIds = new Set((outgoingResult.data || []).map(row => row.following_id));
      const mutualIds = [...new Set((incomingResult.data || []).map(row => row.follower_id).filter(id => outgoingIds.has(id)))];
      if (!mutualIds.length) { if (active) setContactOptions([]); return; }
      const { data } = await supabase.from("profiles").select("user_id, display_name").in("user_id", mutualIds);
      if (active) setContactOptions((data || []).map(profile => ({ user_id: profile.user_id, display_name: profile.display_name || "User" })));
    };
    void loadContacts();
    return () => { active = false; };
  }, [open, user?.id]);
  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawMode) return;
    const canvas = canvasRef.current; const ctx = canvas?.getContext("2d"); if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect(); drawingRef.current = true; canvas.setPointerCapture(event.pointerId);
    ctx.beginPath(); ctx.moveTo((event.clientX - rect.left) * canvas.width / rect.width, (event.clientY - rect.top) * canvas.height / rect.height); ctx.strokeStyle = drawColor; ctx.lineWidth = 7; ctx.lineCap = "round"; ctx.lineJoin = "round";
  };
  const continueDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return; const canvas = canvasRef.current; const ctx = canvas?.getContext("2d"); if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect(); ctx.lineTo((event.clientX - rect.left) * canvas.width / rect.width, (event.clientY - rect.top) * canvas.height / rect.height); ctx.stroke();
  };
  const clearDrawing = () => { const canvas = canvasRef.current; const ctx = canvas?.getContext("2d"); if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height); };

  const clearLocalMusic = () => {
    if (localMusicPreview?.startsWith("blob:")) URL.revokeObjectURL(localMusicPreview);
    setLocalMusicFile(null);
    setLocalMusicPreview(null);
    setLocalMusicDuration(15);
    setLocalMusicStart(0);
    setLocalMusicEnd(15);
  };

  const toggleVoiceRecording = async () => {
    if (recordingVoice) {
      recorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => {
        setRecordingVoice(false);
        const mime = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunks, { type: mime });
        const extension = mime.includes("mp4") ? "m4a" : "webm";
        const file = new File([blob], "tigerchat-voiceover-" + Date.now() + "." + extension, { type: mime });
        if (file.size > 0 && file.size <= MAX_AUDIO_BYTES) {
          clearLocalMusic();
          const url = URL.createObjectURL(file);
          setLocalMusicFile(file);
          setLocalMusicPreview(url);
          setMusic(null);
          const audio = new Audio(url);
          audio.onloadedmetadata = () => {
            const fullDuration = Number.isFinite(audio.duration) ? audio.duration : 15;
            setLocalMusicDuration(fullDuration);
            setLocalMusicStart(0);
            setLocalMusicEnd(Math.min(15, fullDuration));
            audio.src = "";
          };
        } else {
          toast({ title: "Voice recording too large", description: "Please record a shorter voiceover.", variant: "destructive" });
        }
        stream.getTracks().forEach((track) => track.stop());
        recorderRef.current = null;
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecordingVoice(true);
    } catch (error) {
      toast({ title: "Microphone unavailable", description: error instanceof Error ? error.message : "Allow microphone access and try again.", variant: "destructive" });
    }
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
      const fullDuration = Number.isFinite(audio.duration) ? audio.duration : 15;
      setLocalMusicDuration(fullDuration);
      setLocalMusicStart(0);
      setLocalMusicEnd(Math.min(15, fullDuration));
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

      let drawingUrl: string | null = null;
      if (canvasRef.current && mediaFile) {
        const drawingBlob = await new Promise<Blob | null>(resolve => canvasRef.current?.toBlob(resolve, 'image/png'));
        if (drawingBlob && drawingBlob.size > 0) {
          const drawingPath = user.id + '/drawing-' + crypto.randomUUID() + '.png';
          const { error: drawingError } = await supabase.storage.from('stories').upload(drawingPath, drawingBlob, { contentType: 'image/png', upsert: false });
          if (drawingError) throw drawingError;
          drawingUrl = supabase.storage.from('stories').getPublicUrl(drawingPath).data.publicUrl;
        }
      }
      const overlayMetadata = {
        ...(drawingUrl ? { drawing_url: drawingUrl } : {}),
        ...(textOverlay.trim() ? { text: textOverlay.trim(), text_color: textColor, text_background: textBackground, text_font: textFont, text_size: textSize } : {}),
        ...(sticker ? { sticker } : {}),
        ...(musicUrl ? { music_start: music?.start ?? localMusicStart, music_end: music?.end ?? localMusicEnd, music_title: music?.title || localMusicFile?.name || "Background music" } : {}),
        ...(imageFilter !== "none" ? { image_filter: imageFilter } : {}),
      };
      const { data: createdStory, error } = await db.from("stories").insert({
        user_id: user.id,
        image_url: mediaUrl,
        caption: caption.trim() || null,
        music_url: musicUrl,
        media_type: mediaFile ? mediaType : "text",
        duration,
        text_overlay: Object.keys(overlayMetadata).length ? overlayMetadata : null,
        audience,
        background_color: backgroundColor,
      }).select("id").single();
      if (error) throw error;
      if (audience === "selected" && selectedAudienceIds.length) {
        const { error: audienceError } = await db.from("story_audience_members").insert(selectedAudienceIds.map(member_id => ({ story_id: createdStory.id, member_id, audience_type: "include" })));
        if (audienceError) throw audienceError;
      }
      if (audience === "contacts_except" && excludedAudienceIds.length) {
        const { error: audienceError } = await db.from("story_audience_members").insert(excludedAudienceIds.map(member_id => ({ story_id: createdStory.id, member_id, audience_type: "exclude" })));
        if (audienceError) throw audienceError;
      }

      toast({ title: "Status posted successfully" });
      setOpen(false);
      setMediaFile(null);
      setMusic(null);
      clearLocalMusic();
      setImageFilter("none");
      setCaption("");
      setTextOverlay("");
      setTextColor("#FFFFFF");
      setTextBackground("rgba(0,0,0,0.65)");
      setTextFont("sans-serif");
      setTextSize(24);
      setSticker("");
      setPreview(null);
      setDuration(null);
      setAudience("everyone"); setSelectedAudienceIds([]); setExcludedAudienceIds([]); clearDrawing(); setDrawMode(false);
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
              {textOverlay && <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center px-4 pointer-events-none"><span className="inline-block text-lg font-bold px-3 py-1 rounded" style={{ color: textColor, backgroundColor: textBackground, fontFamily: textFont, fontSize: textSize }}>{textOverlay}</span></div>}
              {sticker && <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-6xl">{sticker}</div>}
              <canvas ref={canvasRef} width={600} height={400} className={"absolute inset-0 w-full h-48 touch-none " + (drawMode ? "cursor-crosshair" : "pointer-events-none")} onPointerDown={startDrawing} onPointerMove={continueDrawing} onPointerUp={() => { drawingRef.current = false; }} onPointerCancel={() => { drawingRef.current = false; }} />
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
            <div className="space-y-2">
              <div className="flex items-center gap-2"><Button type="button" size="sm" variant={drawMode ? "default" : "outline"} onClick={() => setDrawMode(value => !value)}>{drawMode ? "Finish drawing" : "Draw on photo"}</Button><input aria-label="Drawing colour" type="color" value={drawColor} onChange={event => setDrawColor(event.target.value)} className="w-9 h-9 rounded border border-border" /><Button type="button" size="sm" variant="ghost" onClick={clearDrawing}>Clear drawing</Button></div>
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
            <div className="relative rounded-xl p-4 min-h-28 flex items-center justify-center" style={{ backgroundColor }}>
              <textarea value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={700} placeholder="What's on your mind?" className="w-full bg-transparent text-white text-center text-lg font-semibold placeholder:text-white/70 resize-none outline-none" rows={3} />
              {textOverlay && <span className="absolute top-2 inset-x-3 text-center text-sm font-bold px-2 py-1 rounded pointer-events-none" style={{ color: textColor, backgroundColor: textBackground }}>{textOverlay}</span>}
              {sticker && <span className="absolute bottom-2 right-3 text-4xl pointer-events-none">{sticker}</span>}
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
          {textOverlay.trim() && (
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-muted-foreground">Text colour
                <select value={textColor} onChange={(e) => setTextColor(e.target.value)} className="mt-1 w-full h-9 rounded-md border border-border bg-surface px-2 text-foreground">
                  <option value="#FFFFFF">White</option><option value="#FDE047">Yellow</option><option value="#FB7185">Pink</option><option value="#86EFAC">Green</option><option value="#93C5FD">Blue</option><option value="#111827">Black</option>
                </select>
              </label>
              <label className="text-xs text-muted-foreground">Text background
                <select value={textBackground} onChange={(e) => setTextBackground(e.target.value)} className="mt-1 w-full h-9 rounded-md border border-border bg-surface px-2 text-foreground">
                  <option value="rgba(0,0,0,0.65)">Dark</option><option value="rgba(255,255,255,0.85)">Light</option><option value="rgba(109,40,217,0.8)">Purple</option><option value="transparent">None</option>
                </select>
              </label>
              <label className="text-xs text-muted-foreground">Font
                <select value={textFont} onChange={(e) => setTextFont(e.target.value)} className="mt-1 w-full h-9 rounded-md border border-border bg-surface px-2 text-foreground">
                  <option value="sans-serif">Modern</option><option value="serif">Classic</option><option value="monospace">Mono</option><option value="cursive">Handwritten</option>
                </select>
              </label>
              <label className="text-xs text-muted-foreground">Text size · {textSize}px
                <input type="range" min={16} max={40} step={2} value={textSize} onChange={(e) => setTextSize(Number(e.target.value))} className="mt-2 w-full" />
              </label>
            </div>
          )}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Sticker</label>
            <div className="flex flex-wrap gap-2">
              {["", "❤️", "🔥", "😂", "😍", "🎉", "🌟", "🐯", "👏", "🥳", "💯", "✨", "💔", "🙏", "💪", "🥰", "😎", "🤩", "🎂", "🏆", "🌈", "☀️", "🌹", "💐", "🦋", "🚀", "📍", "🎵", "👑", "🤝"].map((item) => (
                <button key={item || "none"} type="button" onClick={() => setSticker(item)} aria-pressed={sticker === item} className={"rounded-lg border px-2 py-1 text-xl " + (sticker === item ? "border-primary bg-primary/15" : "border-border")}>{item || "✕"}</button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Who can see this status?</p>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" size="sm" variant={audience === "everyone" ? "default" : "outline"} onClick={() => setAudience("everyone")}>Everyone</Button>
              <Button type="button" size="sm" variant={audience === "contacts" ? "default" : "outline"} onClick={() => setAudience("contacts")}>👥 Contacts</Button>
              <Button type="button" size="sm" variant={audience === "contacts_except" ? "default" : "outline"} onClick={() => setAudience("contacts_except")}>Contacts except…</Button>
              <Button type="button" size="sm" variant={audience === "selected" ? "default" : "outline"} onClick={() => setAudience("selected")}>Share with selected</Button>
              <Button type="button" size="sm" variant={audience === "only_me" ? "default" : "outline"} onClick={() => setAudience("only_me")} className="col-span-2"><Lock className="w-3.5 h-3.5" /> Only me</Button>
            </div>
            {(audience === "contacts_except" || audience === "selected") && <div className="max-h-36 overflow-y-auto rounded-lg border border-border p-2 space-y-2">
              {contactOptions.length === 0 ? <p className="text-xs text-muted-foreground">No mutual contacts found yet.</p> : contactOptions.map(contact => {
                const ids = audience === "selected" ? selectedAudienceIds : excludedAudienceIds;
                const setIds = audience === "selected" ? setSelectedAudienceIds : setExcludedAudienceIds;
                return <label key={contact.user_id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ids.includes(contact.user_id)} onChange={event => setIds(old => event.target.checked ? [...old, contact.user_id] : old.filter(id => id !== contact.user_id))} />{contact.display_name}</label>;
              })}
            </div>}
            <p className="text-xs text-muted-foreground">Contacts are mutual follows. Blocked accounts are excluded.</p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Background music</p>
            <MusicPicker value={music} onChange={(value) => { setMusic(value); if (value) clearLocalMusic(); }} maxClip={15} />
            <label className="flex items-center gap-2 rounded-lg border border-border/60 p-3 cursor-pointer hover:bg-surface">
              <Music className="w-4 h-4 text-primary" />
              <span className="text-sm text-foreground flex-1 truncate">{localMusicFile ? localMusicFile.name : "Choose song, vocals or narration from this phone"}</span>
              <input type="file" accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg" onChange={handleLocalMusicSelect} className="hidden" />
            </label>
            <Button type="button" variant="outline" size="sm" className="w-full gap-2" onClick={() => void toggleVoiceRecording()}>
              {recordingVoice ? <><Square className="w-4 h-4" /> Stop voice recording</> : <><Mic className="w-4 h-4" /> Record voice narration</>}
            </Button>
            {localMusicPreview && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <audio src={localMusicPreview} controls className="w-full h-9" />
                  <button type="button" onClick={clearLocalMusic} aria-label="Remove phone audio" className="p-2 text-muted-foreground hover:text-destructive"><X className="w-4 h-4" /></button>
                </div>
                <label className="block text-xs text-muted-foreground">
                  Choose 15-second section · {localMusicStart.toFixed(1)}s–{localMusicEnd.toFixed(1)}s
                  <input type="range" min={0} max={Math.max(0, localMusicDuration - 15)} step={0.5} value={localMusicStart} onChange={(event) => { const start = Number(event.target.value); setLocalMusicStart(start); setLocalMusicEnd(Math.min(localMusicDuration, start + 15)); }} className="w-full mt-1" />
                </label>
              </div>
            )}
            <p className="text-xs text-muted-foreground">The built-in 20 tracks are instrumental. For vocals or spoken narration, choose an audio file or record your voice. A 15-second section is used in the story.</p>
          </div>
          <Button onClick={handleUpload} disabled={loading || recordingVoice || (!mediaFile && !caption.trim() && !textOverlay.trim())} className="w-full neon-glow">
            {loading ? "Posting..." : "Post Status"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
