import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useUserRole = () => {
  const { user } = useAuth();
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setRoles([]); setLoading(false); return; }
    (async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      setRoles((data || []).map((roleRow) => roleRow.role));
      setLoading(false);
    })();
  }, [user]);

  const isAdmin = roles.includes("admin") || roles.includes("superior_admin");
  const isSuperiorAdmin = roles.includes("superior_admin");
  const isModerator = roles.includes("moderator");
  const isAdviser = roles.includes("adviser");

  return { isAdmin, isSuperiorAdmin, isModerator, isAdviser, roles, loading };
};
