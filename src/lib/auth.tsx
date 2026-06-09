import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { type User, type Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { isMasterEmail } from "@/lib/master";

const ACTIVE_TENANT_KEY = "agenthub.activeTenantId";

export type Role = "owner" | "admin" | "editor" | "viewer" | "agent";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  tenantId: string;
  role: Role;
}

export interface Tenant {
  id: string;
  name: string;
  ownerId: string;
  plan: "trial" | "starter" | "pro" | "enterprise";
  status: "active" | "suspended";
  createdAt: string;
  onboardedAt?: string;
}

interface AuthCtx {
  user: User | null;
  profile: UserProfile | null;
  tenant: Tenant | null;
  loading: boolean;
  isMaster: boolean;
  switchTenant: (tenantId: string) => Promise<void>;
  resetTenant: () => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (
    email: string,
    password: string,
    displayName: string,
    company: string,
  ) => Promise<void>;
  signInGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

async function isMasterUser(user: User | null): Promise<boolean> {
  if (!user) return false;
  if (user.email && isMasterEmail(user.email)) return true;
  
  try {
    const { data, error } = await supabase
      .from("master_admins")
      .select("id")
      .eq("id", user.id)
      .single();
    
    if (data && !error) return true;
  } catch (e) {
    console.warn("[auth] falha ao verificar master_admins:", e);
  }
  return false;
}

async function ensureTenantAndProfile(
  user: User,
  companyHint?: string,
): Promise<{ profile: UserProfile; tenant: Tenant }> {
  const { data: profileSnap } = await supabase
    .from("users")
    .select("*")
    .eq("uid", user.id)
    .single();

  if (profileSnap) {
    const profile = profileSnap as UserProfile;
    if (profile.tenantId) {
      const { data: tenantSnap } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", profile.tenantId)
        .single();
        
      if (tenantSnap) {
        let tenant = tenantSnap as Tenant;
        if (isMasterEmail(user.email) && tenant.plan !== "enterprise") {
          tenant.plan = "enterprise";
          await supabase.from("tenants").update({ plan: "enterprise" }).eq("id", tenant.id);
        }
        return {
          profile,
          tenant,
        };
      }
      console.warn("[auth] perfil aponta para tenant inexistente; recriando workspace", {
        tenantId: profile.tenantId,
      });
    } else {
      console.warn("[auth] perfil sem tenantId; recriando workspace");
    }
  }

  // Procura convite pendente pelo e-mail
  const email = (user.email || "").toLowerCase();
  let invitedTenantId: string | null = null;
  let invitedRole: Role = "agent";
  let inviteDocId: string | null = null;
  
  if (email) {
    try {
      const { data: inv } = await supabase
        .from("invites")
        .select("*")
        .eq("email", email)
        .limit(1)
        .single();
        
      if (inv) {
        invitedTenantId = inv.tenantId || null;
        invitedRole = inv.role || "agent";
        inviteDocId = inv.id;
      }
    } catch (e) {
      console.warn("[auth] invite lookup falhou:", e);
    }
  }

  let tenant: Tenant;
  let profile: UserProfile;

  if (invitedTenantId) {
    profile = {
      uid: user.id,
      email: user.email || "",
      displayName: user.user_metadata?.displayName || user.email?.split("@")[0] || "",
      tenantId: invitedTenantId,
      role: invitedRole,
    };
    
    await supabase.from("users").upsert(
      { ...profile, updated_at: new Date().toISOString() },
      { onConflict: "uid" }
    );

    try {
      const { data: tSnap, error } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", invitedTenantId)
        .single();
        
      if (error || !tSnap) throw new Error("Tenant do convite não existe");
      
      tenant = tSnap as Tenant;
      
      await supabase.from("tenant_members").upsert(
        {
          uid: user.id,
          tenantId: tenant.id,
          email: profile.email,
          displayName: profile.displayName,
          role: invitedRole,
          joinedAt: new Date().toISOString(),
        },
        { onConflict: "uid,tenantId" }
      );
      
      if (inviteDocId) {
        await supabase.from("invites").delete().eq("id", inviteDocId);
      }
      return { profile, tenant };
    } catch (e) {
      console.warn("[auth] convite inválido ou sem permissão; criando workspace próprio", e);
    }
  }

  // Bootstrap: cria tenant + profile (novo owner)
  const tenantId = user.id;
  tenant = {
    id: tenantId,
    name: companyHint || user.user_metadata?.displayName || user.email?.split("@")[0] || "Workspace",
    ownerId: user.id,
    plan: isMasterEmail(user.email) ? "enterprise" : "trial",
    status: "active",
    createdAt: new Date().toISOString(),
  };
  profile = {
    uid: user.id,
    email: user.email || "",
    displayName: user.user_metadata?.displayName || user.email?.split("@")[0] || "",
    tenantId,
    role: "owner",
  };
  
  await supabase.from("users").upsert(
    { ...profile, updated_at: new Date().toISOString() },
    { onConflict: "uid" }
  );
  await supabase.from("tenants").upsert(
    { ...tenant, updated_at: new Date().toISOString() },
    { onConflict: "id" }
  );
  await supabase.from("tenant_members").upsert(
    {
      uid: user.id,
      tenantId: tenant.id,
      email: profile.email,
      displayName: profile.displayName,
      role: "owner",
      joinedAt: new Date().toISOString(),
    },
    { onConflict: "uid,tenantId" }
  );

  return { profile, tenant };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMaster, setIsMaster] = useState(false);

  useEffect(() => {
    // Buscar sessão atual ao carregar
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleAuthChange(session);
    });

    // Escutar mudanças de autenticação
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      handleAuthChange(session);
    });

    return () => subscription.unsubscribe();
  }, []);
  
  const handleAuthChange = async (session: Session | null) => {
    setLoading(true);
    const u = session?.user || null;
    setUser(u);
    
    if (u) {
      try {
        const { profile, tenant } = await ensureTenantAndProfile(u);
        const master = await isMasterUser(u);
        setIsMaster(master);
        setProfile(profile);

        let activeTenant = tenant;
        if (master) {
          const saved = typeof window !== "undefined" ? localStorage.getItem(ACTIVE_TENANT_KEY) : null;
          if (saved && saved !== tenant.id) {
            try {
              const { data: ts } = await supabase.from("tenants").select("*").eq("id", saved).single();
              if (ts) {
                activeTenant = ts as Tenant;
              }
            } catch (e) {
              console.warn("[auth] failed to load active tenant:", e);
            }
          }
        }
        setTenant(activeTenant);
      } catch (e) {
        console.error("[auth] bootstrap failed:", e);
        setIsMaster(false);
        setProfile(null);
        setTenant(null);
      }
    } else {
      setIsMaster(false);
      setProfile(null);
      setTenant(null);
    }
    setLoading(false);
  };

  const switchTenant = async (tenantId: string) => {
    if (!user) return;
    if (!isMaster) throw new Error("Apenas Master Admin pode trocar de tenant");
    
    const { data: ts, error } = await supabase.from("tenants").select("*").eq("id", tenantId).single();
    if (error || !ts) throw new Error("Tenant não encontrado");
    
    localStorage.setItem(ACTIVE_TENANT_KEY, tenantId);
    setTenant(ts as Tenant);
  };

  const resetTenant = async () => {
    if (!user) return;
    localStorage.removeItem(ACTIVE_TENANT_KEY);
    const { data: ts } = await supabase.from("tenants").select("*").eq("id", user.id).single();
    if (ts) setTenant(ts as Tenant);
  };

  const value: AuthCtx = {
    user,
    profile,
    tenant,
    loading,
    isMaster,
    switchTenant,
    resetTenant,
    signInEmail: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    signUpEmail: async (email, password, displayName, company) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { displayName }
        }
      });
      if (error) throw error;
      if (data.user) {
        await ensureTenantAndProfile(data.user, company);
      }
    },
    signInGoogle: async () => {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
      if (error) throw error;
    },
    signOut: async () => {
      localStorage.removeItem(ACTIVE_TENANT_KEY);
      await supabase.auth.signOut();
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
