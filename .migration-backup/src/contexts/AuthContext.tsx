import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  username: string;
  avatar_url: string | null;
  allow_dms: boolean;
  bio: string | null;
  study_stage: string | null;
  created_at?: string;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchProfileAndRole = async (uid: string) => {
    const [{ data: prof }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("username, avatar_url, allow_dms, bio, study_stage, created_at").eq("user_id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setProfile(prof as Profile | null);
    setIsAdmin(!!roles?.some((r: any) => r.role === "admin"));
  };

  useEffect(() => {
    // Subscribe FIRST, then check current session
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        // Defer DB calls
        setTimeout(() => { fetchProfileAndRole(sess.user.id); }, 0);
      } else {
        setProfile(null);
        setIsAdmin(false);
      }
    });

    // دخول تلقائي كمستخدم مجهول عند أول زيارة
    supabase.auth.getSession().then(async ({ data: { session: sess } }) => {
      if (sess?.user) {
        setSession(sess);
        setUser(sess.user);
        await fetchProfileAndRole(sess.user.id);
      } else {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (!error && data.user) {
          setSession(data.session);
          setUser(data.user);
          // إعطاء المُشغّل وقتاً لإنشاء الملف الشخصي
          for (let i = 0; i < 5; i++) {
            await fetchProfileAndRole(data.user.id);
            const { data: p } = await supabase.from("profiles").select("username").eq("user_id", data.user.id).maybeSingle();
            if (p) break;
            await new Promise((r) => setTimeout(r, 400));
          }
        }
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (user) await fetchProfileAndRole(user.id);
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, isAdmin, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};