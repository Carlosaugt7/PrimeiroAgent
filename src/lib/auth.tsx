import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { auth, db } from "@/integrations/firebase/client";
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
  signUpEmail: (email: string, password: string, displayName: string, company: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

async function ensureTenantAndProfile(user: User, companyHint?: string): Promise<{ profile: UserProfile; tenant: Tenant }> {
  const profileRef = doc(db, "users", user.uid);
  const profileSnap = await getDoc(profileRef);

  if (profileSnap.exists()) {
    const profile = { uid: user.uid, ...(profileSnap.data() as Omit<UserProfile, "uid">) };
    const tenantSnap = await getDoc(doc(db, "tenants", profile.tenantId));
    if (tenantSnap.exists()) {
      return { profile, tenant: { id: tenantSnap.id, ...(tenantSnap.data() as Omit<Tenant, "id">) } };
    }
  }

  // Procura convite pendente pelo e-mail (top-level `invites`)
  const email = (user.email || "").toLowerCase();
  let invitedTenantId: string | null = null;
  let invitedRole: Role = "agent";
  let inviteDocId: string | null = null;
  if (email) {
    let inv: Awaited<ReturnType<typeof getDoc>> | Awaited<ReturnType<typeof getDocs>>["docs"][number] | undefined;
    try {
      const directInvite = await getDoc(doc(db, "invites", encodeURIComponent(email)));
      if (directInvite.exists()) inv = directInvite;
    } catch (e) { console.warn("[auth] direct invite lookup falhou:", e); }
    if (!inv) {
      try {
        const snap = await getDocs(query(collection(db, "invites"), where("email", "==", email)));
        inv = snap.docs[0];
      } catch (e) { console.warn("[auth] invite lookup falhou:", e); }
    }
    if (inv) {
      if (inv) {
        const data = inv.data() as { tenantId: string; role: Role };
        invitedTenantId = data.tenantId;
        invitedRole = data.role || "agent";
        inviteDocId = inv.id;
      }
    }
  }

  let tenant: Tenant;
  let profile: UserProfile;

  if (invitedTenantId) {
    profile = {
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || user.email?.split("@")[0] || "",
      tenantId: invitedTenantId,
      role: invitedRole,
    };
    // Cria o vínculo do usuário antes de ler o tenant; as regras liberam o tenant pelo vínculo.
    await setDoc(profileRef, { ...profile, _ts: serverTimestamp() });

    const tSnap = await getDoc(doc(db, "tenants", invitedTenantId));
    if (!tSnap.exists()) throw new Error("Tenant do convite não existe");
    tenant = { id: tSnap.id, ...(tSnap.data() as Omit<Tenant, "id">) };
    await setDoc(doc(db, "tenants", tenant.id, "members", user.uid), {
      uid: user.uid, email: profile.email, displayName: profile.displayName,
      role: invitedRole, joinedAt: new Date().toISOString(),
    });
    if (inviteDocId) { try { await deleteDoc(doc(db, "invites", inviteDocId)); } catch {} }
    return { profile, tenant };
  }

  // Bootstrap: cria tenant + profile (novo owner)
  const tenantId = user.uid;
  tenant = {
    id: tenantId,
    name: companyHint || user.displayName || user.email?.split("@")[0] || "Workspace",
    ownerId: user.uid,
    plan: "trial",
    status: "active",
    createdAt: new Date().toISOString(),
  };
  await setDoc(doc(db, "tenants", tenantId), { ...tenant, _ts: serverTimestamp() });

  profile = {
    uid: user.uid,
    email: user.email || "",
    displayName: user.displayName || user.email?.split("@")[0] || "",
    tenantId,
    role: "owner",
  };
  await setDoc(profileRef, { ...profile, _ts: serverTimestamp() });
  await setDoc(doc(db, "tenants", tenantId, "members", user.uid), {
    uid: user.uid, email: profile.email, displayName: profile.displayName,
    role: "owner", joinedAt: new Date().toISOString(),
  });

  return { profile, tenant };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setLoading(true);
      setUser(u);
      if (u) {
        try {
          const { profile, tenant } = await ensureTenantAndProfile(u);
          setProfile(profile);

          // Master admin pode persistir um tenant ativo diferente do seu
          let activeTenant = tenant;
          if (isMasterEmail(u.email)) {
            const saved = typeof window !== "undefined" ? localStorage.getItem(ACTIVE_TENANT_KEY) : null;
            if (saved && saved !== tenant.id) {
              try {
                const ts = await getDoc(doc(db, "tenants", saved));
                if (ts.exists()) activeTenant = { id: ts.id, ...(ts.data() as Omit<Tenant, "id">) };
              } catch (e) { console.warn("[auth] failed to load active tenant:", e); }
            }
          }
          setTenant(activeTenant);
        } catch (e) {
          console.error("[auth] bootstrap failed:", e);
          setProfile(null);
          setTenant(null);
        }
      } else {
        setProfile(null);
        setTenant(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const switchTenant = async (tenantId: string) => {
    if (!user) return;
    if (!isMasterEmail(user.email)) throw new Error("Apenas Master Admin pode trocar de tenant");
    const ts = await getDoc(doc(db, "tenants", tenantId));
    if (!ts.exists()) throw new Error("Tenant não encontrado");
    localStorage.setItem(ACTIVE_TENANT_KEY, tenantId);
    setTenant({ id: ts.id, ...(ts.data() as Omit<Tenant, "id">) });
  };

  const resetTenant = async () => {
    if (!user) return;
    localStorage.removeItem(ACTIVE_TENANT_KEY);
    const ts = await getDoc(doc(db, "tenants", user.uid));
    if (ts.exists()) setTenant({ id: ts.id, ...(ts.data() as Omit<Tenant, "id">) });
  };

  const value: AuthCtx = {
    user, profile, tenant, loading,
    isMaster: isMasterEmail(user?.email),
    switchTenant, resetTenant,
    signInEmail: async (email, password) => { await signInWithEmailAndPassword(auth, email, password); },
    signUpEmail: async (email, password, displayName, company) => {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await ensureTenantAndProfile({ ...cred.user, displayName } as User, company);
    },
    signInGoogle: async () => {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    },
    signOut: async () => {
      localStorage.removeItem(ACTIVE_TENANT_KEY);
      await fbSignOut(auth);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
