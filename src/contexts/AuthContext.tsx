import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const PASSWORD_RECOVERY_STORAGE_KEY = "tigerchat:password-recovery";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Supabase emits INITIAL_SESSION after it has restored the persisted session.
    // Use this single event stream as the source of truth. Calling getSession()
    // in parallel can race with INITIAL_SESSION / SIGNED_IN and overwrite a
    // newer account session with an older snapshot during refresh.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      // The recovery code can be exchanged and removed from the URL before
      // ResetPassword mounts. Persist the event for this tab so that route can
      // still distinguish a recovery session from an ordinary signed-in session.
      if (event === "PASSWORD_RECOVERY") {
        try {
          window.sessionStorage.setItem(PASSWORD_RECOVERY_STORAGE_KEY, "true");
        } catch {
          // The auth event still updates the in-memory session if storage is unavailable.
        }
      } else if (event === "SIGNED_OUT") {
        try {
          window.sessionStorage.removeItem(PASSWORD_RECOVERY_STORAGE_KEY);
        } catch {
          // Ignore unavailable session storage.
        }
      }

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    if (user) {
      const { disablePush } = await import("@/lib/firebase-push");
      await disablePush(user.id);
    }
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
