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
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/integrations/firebase/client";

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
}

interface AuthCtx {
  user: User | null;
  profile: UserProfile | null;
  tenant: Tenant | null;
  loading: boolean;
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

  // Bootstrap: create tenant + profile
  const tenantId = user.uid; // owner's uid = tenant id (simple, unique)
  const tenant: Tenant = {
    id: tenantId,
    name: companyHint || user.displayName || user.email?.split("@")[0] || "Workspace",
    ownerId: user.uid,
    plan: "trial",
    status: "active",
    createdAt: new Date().toISOString(),
  };
  await setDoc(doc(db, "tenants", tenantId), { ...tenant, _ts: serverTimestamp() });

  const profile: UserProfile = {
    uid: user.uid,
    email: user.email || "",
    displayName: user.displayName || user.email?.split("@")[0] || "",
    tenantId,
    role: "owner",
  };
  await setDoc(profileRef, { ...profile, _ts: serverTimestamp() });

  return { profile, tenant };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const { profile, tenant } = await ensureTenantAndProfile(u);
          setProfile(profile);
          setTenant(tenant);
        } catch (e) {
          console.error("[auth] bootstrap failed:", e);
        }
      } else {
        setProfile(null);
        setTenant(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const value: AuthCtx = {
    user, profile, tenant, loading,
    signInEmail: async (email, password) => { await signInWithEmailAndPassword(auth, email, password); },
    signUpEmail: async (email, password, displayName, company) => {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await ensureTenantAndProfile({ ...cred.user, displayName } as User, company);
    },
    signInGoogle: async () => {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    },
    signOut: async () => { await fbSignOut(auth); },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
