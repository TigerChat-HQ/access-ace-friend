import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StoryAvatar } from "@/components/social/StoryAvatar";
interface Profile { user_id: string; display_name: string | null; username: string | null; avatar_url: string | null; }
interface Props { open: boolean; onOpenChange: (v: boolean) => void; userId: string; mode: "followers" | "following"; }
export const FollowListDialog = ({ open, onOpenChange, userId, mode }: Props) => {
 const { user } = useAuth(); const [profiles,setProfiles]=useState<Profile[]>([]); const [myFollowing,setMyFollowing]=useState<Set<string>>(new Set()); const [loading,setLoading]=useState(false);
 useEffect(()=>{ if(!open)return; let active=true; setLoading(true); (async()=>{
  const col=mode==="followers"?"follower_id":"following_id"; const filterCol=mode==="followers"?"following_id":"follower_id";
  const {data:rows}=await supabase.from("follows").select(col).eq(filterCol,userId); const ids=((rows??[]) as unknown as Record<string,string>[]).map(row=>row[col]).filter((id):id is string=>typeof id==="string"&&id.length>0);
  const [{data:profs},{data:mine}]=await Promise.all([ids.length?supabase.from("profiles").select("user_id, display_name, username, avatar_url").in("user_id",ids):Promise.resolve({data:[]}),user?supabase.from("follows").select("following_id").eq("follower_id",user.id):Promise.resolve({data:[]})]);
  if(!active)return; setProfiles((profs||[]) as Profile[]); setMyFollowing(new Set(((mine||[]) as {following_id:string}[]).map(row=>row.following_id))); setLoading(false);
 })(); return()=>{active=false;}; },[open,userId,mode,user?.id]);
 const toggleFollow=async(target:string)=>{if(!user||target===user.id)return;if(myFollowing.has(target)){await supabase.from("follows").delete().eq("follower_id",user.id).eq("following_id",target);setMyFollowing(s=>{const n=new Set(s);n.delete(target);return n;});}else{await supabase.from("follows").insert({follower_id:user.id,following_id:target});setMyFollowing(s=>new Set(s).add(target));}};
 return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="bg-card border-border/50 max-w-sm"><DialogHeader><DialogTitle className="text-foreground capitalize">{mode}</DialogTitle></DialogHeader><div className="max-h-80 overflow-y-auto scrollbar-thin">
 {loading?<p className="text-center text-sm text-muted-foreground py-6">Loading...</p>:profiles.length===0?<p className="text-center text-sm text-muted-foreground py-6">No {mode} yet.</p>:profiles.map(p=><div key={p.user_id} className="flex items-center gap-3 py-2"><StoryAvatar userId={p.user_id} displayName={p.display_name} username={p.username} avatarUrl={p.avatar_url} size="md" showName className="flex-1 min-w-0" />{user&&user.id!==p.user_id&&<Button size="sm" variant={myFollowing.has(p.user_id)?"outline":"default"} onClick={()=>toggleFollow(p.user_id)}>{myFollowing.has(p.user_id)?"Following":"Follow"}</Button>}</div>)}
 </div></DialogContent></Dialog>;
};
