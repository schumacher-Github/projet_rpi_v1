import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "chef_service" | "technicien" | "demandeur";

export interface Profile {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  service: string | null;
  matricule: string | null;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (uid: string) => {
    const [{ data: prof }, { data: roleRows }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setProfile(prof as Profile | null);
    setRoles(((roleRows ?? []) as { role: AppRole }[]).map((r) => r.role));
  };

  useEffect(() => {
    let mounted = true;

    const applySession = (sess: Session | null) => {
      if (!mounted) return;
      setSession(sess);
      setUser(sess?.user ?? null);

      if (!sess?.user) {
        setProfile(null);
        setRoles([]);
        setLoading(false);
        return;
      }

      // Le client Supabase maintient un verrou interne pendant l'exécution
      // du callback onAuthStateChange : y lancer directement une requête
      // (ici le chargement du profil et des rôles) provoque un
      // interblocage et l'application reste figée sur l'écran de
      // chargement à chaque rafraîchissement de page. La requête est donc
      // repoussée hors du callback.
      const uid = sess.user.id;
      setTimeout(() => {
        if (!mounted) return;
        void loadProfile(uid).finally(() => {
          if (mounted) setLoading(false);
        });
      }, 0);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      applySession(sess);
    });

    void supabase.auth.getSession().then(({ data }) => applySession(data.session));

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value: AuthContextValue = {
    user,
    session,
    profile,
    roles,
    loading,
    hasRole: (r) => roles.includes(r),
    hasAnyRole: (rs) => rs.some((r) => roles.includes(r)),
    signOut: async () => {
      await supabase.auth.signOut();
    },
    refresh: async () => {
      if (user) await loadProfile(user.id);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrateur",
  chef_service: "Chef de service",
  technicien: "Technicien",
  demandeur: "Demandeur",
};
