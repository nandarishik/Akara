import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { User } from "@/types";

interface SignUpMeta {
  display_name: string;
  company_name: string;
  whatsapp?: string;
  turnstile_token?: string;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, meta: SignUpMeta) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Build a User from Supabase session metadata.
 * Used as a fallback when /auth/me fails (e.g. Railway misconfiguration).
 */
function userFromSession(supabaseUser: SupabaseUser): User | null {
  const meta = supabaseUser.user_metadata ?? {};
  const tenantId = meta.tenant_id as string | undefined;
  const role = (meta.role as string | undefined) ?? "user";

  if (!tenantId) return null;

  return {
    id: supabaseUser.id,
    email: supabaseUser.email ?? "",
    tenantId,
    role: role === "admin" ? "admin" : "user",
    displayName: meta.display_name as string | undefined,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(supabaseUser: SupabaseUser, accessToken: string) {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/auth/me`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) throw new Error(`Profile fetch failed: ${res.status}`);
      const data = await res.json();
      setUser({
        id: data.user_id,
        email: data.email,
        tenantId: data.tenant_id ?? null,
        role: data.role,
      });
    } catch (err) {
      console.warn("fetchProfile failed, using session metadata fallback:", err);
      const fallback = userFromSession(supabaseUser);
      setUser(fallback);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user && session.access_token) {
        fetchProfile(session.user, session.access_token).finally(() =>
          setLoading(false)
        );
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user && session.access_token) {
        fetchProfile(session.user, session.access_token);
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.session) {
      setSession(data.session);
      await fetchProfile(data.session.user, data.session.access_token);
    }
  }

  async function signUp(email: string, password: string, meta: SignUpMeta) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: meta.display_name,
          company_name: meta.company_name,
          whatsapp: meta.whatsapp,
        },
      },
    });
    if (error) throw error;
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }

  async function refreshProfile() {
    if (!session?.user || !session.access_token) return;
    await fetchProfile(session.user, session.access_token);
  }

  return (
    <AuthContext.Provider value={{ session, user, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
