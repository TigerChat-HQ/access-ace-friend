import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Bookmark, FolderPlus, Trash2, Folder, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

type Collection = { id: string; name: string; created_at: string };
type SavedPost = { id: string; caption: string | null; media_url: string | null; media_type: string; created_at: string };
const db = supabase as any;

const PostCollections = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selected, setSelected] = useState<Collection | null>(null);
  const [posts, setPosts] = useState<SavedPost[]>([]);
  const [savedPosts, setSavedPosts] = useState<SavedPost[]>([]);
  const [items, setItems] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const loadCollections = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: groups, error }, { data: saves }] = await Promise.all([
      db.from("post_collections").select("id,name,created_at").eq("user_id", user.id).order("updated_at", { ascending: false }),
      db.from("post_saves").select("post_id").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    if (error) toast({ title: "Could not load collections", description: error.message, variant: "destructive" });
    setCollections(groups || []);
    const ids = (saves || []).map((x: {post_id:string}) => x.post_id);
    if (ids.length) {
      const { data } = await supabase.from("posts").select("id,caption,media_url,media_type,created_at").in("id", ids).is("archived_at", null);
      setSavedPosts((data || []) as SavedPost[]);
    } else setSavedPosts([]);
    setLoading(false);
  }, [user, toast]);
  const loadSelected = useCallback(async (collection: Collection) => {
    setSelected(collection);
    const { data: rows } = await db.from("post_collection_items").select("post_id").eq("collection_id", collection.id);
    const ids = (rows || []).map((x: {post_id:string}) => x.post_id);
    setItems(ids);
    if (!ids.length) { setPosts([]); return; }
    const { data } = await supabase.from("posts").select("id,caption,media_url,media_type,created_at").in("id", ids).is("archived_at", null);
    const byId = new Map((data || []).map((p) => [p.id, p]));
    setPosts(ids.map((id: string) => byId.get(id)).filter(Boolean) as SavedPost[]);
  }, []);
  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !name.trim()) return;
    const { error } = await db.from("post_collections").insert({ user_id: user.id, name: name.trim() });
    if (error) toast({ title: "Could not create collection", description: error.message, variant: "destructive" });
    else { setName(""); toast({ title: "Collection created" }); await loadCollections(); }
  };
  const add = async (postId: string) => {
    if (!selected) return;
    const { error } = await db.from("post_collection_items").insert({ collection_id: selected.id, post_id: postId });
    if (error) toast({ title: "Could not add post", description: error.message, variant: "destructive" });
    else { toast({ title: "Post added to collection" }); await loadSelected(selected); }
  };
  const remove = async (postId: string) => {
    if (!selected) return;
    const { error } = await db.from("post_collection_items").delete().eq("collection_id", selected.id).eq("post_id", postId);
    if (error) toast({ title: "Could not remove post", description: error.message, variant: "destructive" });
    else await loadSelected(selected);
  };
  const removeCollection = async (collection: Collection) => {
    if (!confirm(`Delete "${collection.name}"? Saved posts themselves will remain saved.`)) return;
    const { error } = await db.from("post_collections").delete().eq("id", collection.id).eq("user_id", user?.id);
    if (error) toast({ title: "Could not delete collection", description: error.message, variant: "destructive" });
    else { if (selected?.id === collection.id) { setSelected(null); setPosts([]); } await loadCollections(); }
  };
  useEffect(() => { void loadCollections(); }, [loadCollections]);
  return <div className="flex h-full flex-col bg-background">
    <header className="tiger-page-header gap-3"><Link to="/saved" className="tiger-header-action" aria-label="Back to saved posts"><ArrowLeft className="h-5 w-5" /></Link><h1 className="flex-1 text-sm font-semibold">Saved collections</h1></header>
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <form onSubmit={create} className="flex gap-2"><input value={name} onChange={e=>setName(e.target.value)} maxLength={60} placeholder="New collection name" className="min-w-0 flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm" /><Button type="submit" disabled={!name.trim()}><FolderPlus className="mr-1.5 h-4 w-4"/>Create</Button></form>
      {loading ? <p className="py-12 text-center text-sm text-muted-foreground">Loading collections…</p> : collections.length ? <div className="space-y-2">{collections.map(c=><div key={c.id} className="flex items-center gap-2 rounded-xl border border-border p-3"><button onClick={()=>void loadSelected(c)} className="flex min-w-0 flex-1 items-center gap-3 text-left"><Folder className="h-5 w-5 shrink-0 text-primary"/><span className="truncate text-sm font-medium">{c.name}</span></button><button onClick={()=>void removeCollection(c)} aria-label={`Delete ${c.name}`} className="p-2 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4"/></button></div>)}</div> : <p className="py-8 text-center text-sm text-muted-foreground">Create a collection to organize your saved posts.</p>}
      {selected && <section className="space-y-3 border-t border-border pt-4"><div className="flex items-center justify-between"><h2 className="font-semibold">{selected.name}</h2><button onClick={()=>{setSelected(null);setPosts([])}} aria-label="Close collection" className="p-1"><X className="h-4 w-4"/></button></div>
        <div className="grid grid-cols-3 gap-2">{posts.map(p=><div key={p.id} className="relative aspect-square overflow-hidden rounded-lg bg-muted"><Link to={`/post/${p.id}`} className="block h-full w-full">{p.media_url && p.media_type==="image" ? <img src={p.media_url} alt="" className="h-full w-full object-cover"/> : p.media_url && p.media_type==="video" ? <video src={p.media_url} className="h-full w-full object-cover"/> : <p className="p-2 text-xs">{p.caption}</p>}</Link><button onClick={()=>void remove(p.id)} aria-label="Remove from collection" className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white"><X className="h-3 w-3"/></button></div>)}</div>
        <h3 className="text-xs font-semibold text-muted-foreground">ADD FROM SAVED POSTS</h3>
        <div className="space-y-2">{savedPosts.filter(p=>!items.includes(p.id)).map(p=><div key={p.id} className="flex items-center gap-3 rounded-lg border border-border p-2">{p.media_url && <img src={p.media_url} alt="" className="h-12 w-12 rounded object-cover"/>}<span className="min-w-0 flex-1 truncate text-xs">{p.caption || "Saved post"}</span><Button size="sm" variant="outline" onClick={()=>void add(p.id)}>Add</Button></div>)}</div>
        {!posts.length && <p className="text-center text-sm text-muted-foreground">This collection is empty.</p>}
      </section>}
      {!savedPosts.length && !loading && <p className="text-center text-xs text-muted-foreground">Save posts from the feed before adding them to collections.</p>}
    </div>
  </div>;
};
export default PostCollections;
