import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useUserRole = () => {
  const { user } = useAuth();
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshRoles = useCallback(async () => {
    if (!user?.id) {
      setRoles([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    // Fail closed: never grant admin UI if the role lookup fails.
    if (error) {
      console.error("Could not load the signed-in user's roles:", error);
      setRoles([]);
    } else {
      setRoles((data ?? []).map((roleRow) => roleRow.role));
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    let active = true;

    const loadRoles = async () => {
      if (!user?.id) {
        if (active) {
          setRoles([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (!active) return;
      if (error) {
        console.error("Could not load the signed-in user's roles:", error);
        setRoles([]);
      } else {
        setRoles((data ?? []).map((roleRow) => roleRow.role));
      }
      setLoading(false);
    };

    void loadRoles();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const isAdmin = roles.includes("admin") || roles.includes("superior_admin");
  const isSuperiorAdmin = roles.includes("superior_admin");
  const isModerator = roles.includes("moderator");
  const isAdviser = roles.includes("adviser");

  return { isAdmin, isSuperiorAdmin, isModerator, isAdviser, roles, loading, refreshRoles };
};
