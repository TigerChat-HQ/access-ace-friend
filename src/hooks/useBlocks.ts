import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useBlocks = () => {
  const { user } = useAuth();
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());

  const fetchBlocks = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("blocks")
      .select("blocked_id")
      .eq("blocker_id", user.id);
    setBlockedIds(new Set(data?.map((d) => d.blocked_id) || []));
  }, [user]);

  useEffect(() => {
    fetchBlocks();
  }, [fetchBlocks]);

  const block = async (targetId: string) => {
    if (!user || targetId === user.id) return { error: new Error("Cannot block self") };
    const { error } = await supabase
      .from("blocks")
      .insert({ blocker_id: user.id, blocked_id: targetId });
    if (!error) await fetchBlocks();
    return { error };
  };

  const unblock = async (targetId: string) => {
    if (!user) return { error: null };
    const { error } = await supabase
      .from("blocks")
      .delete()
      .eq("blocker_id", user.id)
      .eq("blocked_id", targetId);
    if (!error) await fetchBlocks();
    return { error };
  };

  const isBlocked = (id: string) => blockedIds.has(id);

  return { blockedIds, isBlocked, block, unblock, refetch: fetchBlocks };
};

export const reportContent = async (
  reporterId: string,
  targetType: "post" | "comment" | "user",
  targetId: string,
  reason: string
) => {
  return supabase.from("reports").insert({
    reporter_id: reporterId,
    target_type: targetType,
    target_id: targetId,
    reason,
  });
};
