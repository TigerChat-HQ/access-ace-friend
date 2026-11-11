/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase generated types do not yet include the pending PR migrations; any casts are isolated to the database boundary. */
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ArrowDown, ArrowUp, ImagePlus, Trash2, Upload } from "lucide-react";

type MediaItem = { url: string; type: string; alt_text?: string | null };
type Props = { postId: string; initialItems: MediaItem[]; initialAudioUrl?: string | null; initialAudioTitle?: string | null; initialCoverUrl?: string | null; open: boolean; onOpenChange: (open: boolean) => void; onSaved?: () => void };
const MAX_MEDIA = 10;
export const PostMediaEditorDialog = ({ postId, initialItems, initialAudioUrl, initialAudioTitle, initialCoverUrl, open, onOpenChange, onSaved }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<MediaItem[]>(initialItems);
  const [files, setFiles] = useState<(File | null)[]>(initialItems.map(() => null));
  const [busy, setBusy] = useState(false);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [removeAudio, setRemoveAudio] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const total = items.length + newFiles.length;
  const previews = useMemo(() => newFiles.map(file => ({ file, url: URL.createObjectURL(file) })), [newFiles]);
  const replacementPreviews = useMemo(() => files.map(file => file ? URL.createObjectURL(file) : null), [files]);
  useEffect(() => () => { previews.forEach(item => URL.revokeObjectURL(item.url)); replacementPreviews.forEach(url => { if (url) URL.revokeObjectURL(url); }); }, [previews, replacementPreviews]);
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    setItems(current => { const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next; });
    setFiles(current => { const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next; });
  };
  const replace = (index: number, file: File | null) => {
    setFiles(current => current.map((value, i) => i === index ? file : value));
  };
  const remove = (index: number) => {
    setItems(current => current.filter((_, i) => i !== index));
    setFiles(current => current.filter((_, i) => i !== index));
  };
  const upload = async (file: File) => {
    if (!user) throw new Error("Sign in to edit this post.");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${user.id}/edited-${crypto.randomUUID()}-${safeName}`;
    const { error } = await supabase.storage.from("post-media").upload(path, file);
    if (error) throw error;
    return supabase.storage.from("post-media").getPublicUrl(path).data.publicUrl;
  };
  const save = async () => {
    if (!user || busy) return;
    if (total < 1) { toast({ title: "A post must contain at least one media item", variant: "destructive" }); return; }
    if (total > MAX_MEDIA) { toast({ title: "Maximum 10 media items", variant: "destructive" }); return; }
    setBusy(true);
    try {
      const updated: MediaItem[] = [];
      for (let index = 0; index < items.length; index++) {
        const file = files[index];
        if (file) {
          const url = await upload(file);
          updated.push({ url, type: file.type.startsWith("video/") ? "video" : "image", alt_text: items[index].alt_text || null });
        } else updated.push(items[index]);
      }
      for (const file of newFiles) {
        const url = await upload(file);
        updated.push({ url, type: file.type.startsWith("video/") ? "video" : "image", alt_text: null });
      }
      let audioUrl = initialAudioUrl || null;
      let audioTitle = initialAudioTitle || null;
      if (removeAudio) { audioUrl = null; audioTitle = null; }
      else if (audioFile) { audioUrl = await upload(audioFile); audioTitle = audioFile.name; }
      let coverUrl = initialCoverUrl || null;
      if (removeCover) coverUrl = null;
      else if (coverFile) coverUrl = await upload(coverFile);
      const first = updated[0];
      const { error } = await (supabase as any).from("posts").update({
        media_items: updated,
        media_url: first.url,
        media_type: first.type,
        alt_text: first.alt_text || null,
        post_audio_url: audioUrl,
        post_audio_title: audioTitle,
        post_cover_url: coverUrl,
      }).eq("id", postId).eq("user_id", user.id);
      if (error) throw error;
      toast({ title: "Post media updated" });
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      toast({ title: "Could not update post media", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally { setBusy(false); }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[85dvh] max-w-lg overflow-y-auto"><DialogHeader><DialogTitle>Edit post media</DialogTitle></DialogHeader><p className="text-xs text-muted-foreground">Replace, remove, add, or reorder photos and videos. The first item becomes the post cover. Up to 10 items.</p><div className="space-y-3">{items.map((item,index)=>{const preview=replacementPreviews[index] || item.url;const type=files[index] ? (files[index]!.type.startsWith("video/")?"video":"image") : item.type;return <div key={index} className="flex items-center gap-3 rounded-xl border border-border p-2"><div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">{type==="video"?<video src={preview} className="h-full w-full object-cover"/>:<img src={preview} alt={item.alt_text||""} className="h-full w-full object-cover"/>}</div><div className="min-w-0 flex-1 space-y-1"><p className="text-xs font-medium">Item {index+1} · {type}</p><Input value={item.alt_text||""} maxLength={500} placeholder="Alt text" onChange={e=>setItems(current=>current.map((value,i)=>i===index?{...value,alt_text:e.target.value}:value))}/><label className="inline-flex cursor-pointer items-center gap-1 text-xs text-primary"><Upload className="h-3 w-3"/> Replace<input type="file" accept="image/*,video/*" className="hidden" onChange={e=>replace(index,e.target.files?.[0]||null)}/></label></div><div className="flex flex-col gap-1"><button type="button" onClick={()=>move(index,-1)} disabled={index===0} aria-label="Move media up" className="rounded p-1 disabled:opacity-30"><ArrowUp className="h-4 w-4"/></button><button type="button" onClick={()=>move(index,1)} disabled={index===items.length-1} aria-label="Move media down" className="rounded p-1 disabled:opacity-30"><ArrowDown className="h-4 w-4"/></button><button type="button" onClick={()=>remove(index)} aria-label="Remove media" className="rounded p-1 text-destructive"><Trash2 className="h-4 w-4"/></button></div></div>})}{previews.map(({file,url},index)=><div key={url} className="flex items-center gap-3 rounded-xl border border-dashed border-border p-2"><div className="h-16 w-16 overflow-hidden rounded-lg bg-muted">{file.type.startsWith("video/")?<video src={url} className="h-full w-full object-cover"/>:<img src={url} alt="" className="h-full w-full object-cover"/>}</div><p className="min-w-0 flex-1 truncate text-xs">{file.name}</p><button type="button" onClick={()=>setNewFiles(current=>current.filter((_,i)=>i!==index))} className="p-2 text-destructive" aria-label="Remove added media"><Trash2 className="h-4 w-4"/></button></div>)}</div><label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border px-3 py-4 text-sm text-primary hover:bg-muted/50"><ImagePlus className="h-4 w-4"/> Add photos or videos<input type="file" accept="image/*,video/*" multiple className="hidden" onChange={e=>{const selected=Array.from(e.target.files||[]);setNewFiles(current=>[...current,...selected].slice(0,Math.max(0,MAX_MEDIA-items.length-current.length)));e.target.value="";}}/></label><p className="text-right text-[11px] text-muted-foreground">{total}/10 media items</p><section className="space-y-2 rounded-xl border border-border p-3"><p className="text-xs font-semibold">Post soundtrack</p>{initialAudioUrl && !removeAudio && !audioFile && <audio src={initialAudioUrl} controls className="h-8 w-full"/>}<label className="block text-xs text-primary">Replace soundtrack<input type="file" accept="audio/*" className="mt-1 block w-full text-xs text-foreground" onChange={e=>{setAudioFile(e.target.files?.[0]||null);setRemoveAudio(false);}}/></label>{(initialAudioUrl||audioFile)&&<button type="button" onClick={()=>{setRemoveAudio(true);setAudioFile(null);}} className="text-xs text-destructive">Remove soundtrack</button>}</section><section className="space-y-2 rounded-xl border border-border p-3"><p className="text-xs font-semibold">Video cover</p>{initialCoverUrl&&!removeCover&&!coverFile&&<img src={initialCoverUrl} alt="Current cover" className="h-24 w-24 rounded-lg object-cover"/>}<label className="block text-xs text-primary">Replace cover image<input type="file" accept="image/*" className="mt-1 block w-full text-xs text-foreground" onChange={e=>{setCoverFile(e.target.files?.[0]||null);setRemoveCover(false);}}/></label>{(initialCoverUrl||coverFile)&&<button type="button" onClick={()=>{setRemoveCover(true);setCoverFile(null);}} className="text-xs text-destructive">Remove cover</button>}</section><div className="flex justify-end gap-2"><Button variant="outline" onClick={()=>onOpenChange(false)} disabled={busy}>Cancel</Button><Button onClick={()=>void save()} disabled={busy||total===0}><Upload className="mr-2 h-4 w-4"/>{busy?"Saving…":"Save media"}</Button></div></DialogContent></Dialog>;
};
