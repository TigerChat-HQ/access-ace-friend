import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useFollow = (targetUserId: string | undefined) => {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!targetUserId) return;
    const [{ data: mine }, { count: followers }, { count: following }] = await Promise.all([
      user
        ? supabase.from("follows").select("id").eq("follower_id", user.id).eq("following_id", targetUserId).maybeSingle()
        : Promise.resolve({ data: null as any }),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", targetUserId),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", targetUserId),
    ]);
    setIsFollowing(!!mine);
    setFollowerCount(followers || 0);
    setFollowingCount(following || 0);
    setLoading(false);
  }, [targetUserId, user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggle = async () => {
    if (!user || !targetUserId || user.id === targetUserId) return;
    if (isFollowing) {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", targetUserId);
    } else {
      await supabase.from("follows").insert({ follower_id: user.id, following_id: targetUserId });
    }
    refresh();
  };

  return { isFollowing, followerCount, followingCount, loading, toggle };
};
