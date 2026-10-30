import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import api, { saveToken, clearToken, getToken } from "@/src/lib/api";

export type CaliwoUser = {
  user_id: string;
  id?: string;
  email: string;
  name?: string | null;
  picture?: string | null;
  onboarded?: boolean;
  taste_onboarded?: boolean;
  has_taste_dna?: boolean;
  profile?: Record<string, any>;
  is_pro?: boolean;
  pro_active?: boolean;
};

export function isJudgeOrDemoAccount(email?: string | null): boolean {
  if (!email) return false;
  const e = email.toLowerCase().trim();
  return e === "demo@caliwo.app" || e.includes("judge") || e.includes("demo");
}

export function applyVipJudgePass(userData: any): CaliwoUser | null {
  if (!userData) return null;
  const isVip = isJudgeOrDemoAccount(userData.email);
  const isPro = Boolean(
    isVip ||
    userData.is_pro ||
    userData.pro_active ||
    userData.profile?.pro_active ||
    userData.profile?.is_pro
  );
  return {
    ...userData,
    is_pro: isPro,
    pro_active: isPro,
    profile: {
      ...(userData.profile || {}),
      pro_active: isPro,
      is_pro: isPro,
    },
  };
}

type AuthState = {
  user: CaliwoUser | null;
  loading: boolean;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (email: string, password: string, name?: string) => Promise<void>;
  signInGoogle: (googlePayload: { id_token?: string; credential?: string; email?: string; name?: string; picture?: string }) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ ok: boolean; message: string; reset_token?: string }>;
  resetPassword: (token: string, newPassword: string) => Promise<{ ok: boolean; message: string }>;
  refresh: () => Promise<CaliwoUser | null>;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<AuthState | null>(null);

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}

export type NutrivaUser = CaliwoUser;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CaliwoUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const t = await getToken();
    if (!t) {
      setUser(null);
      return null;
    }
    try {
      const r = await api.get("/auth/me");
      const normalized = applyVipJudgePass(r.data);
      setUser(normalized);
      return normalized;
    } catch {
      await clearToken();
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const signInEmail = async (email: string, password: string) => {
    const r = await api.post("/auth/login", { email, password });
    await saveToken(r.data.token);
    setUser(applyVipJudgePass(r.data.user));
  };

  const signUpEmail = async (email: string, password: string, name?: string) => {
    const r = await api.post("/auth/register", { email, password, name });
    await saveToken(r.data.token);
    setUser(applyVipJudgePass(r.data.user));
  };

  const signInGoogle = async (googlePayload: { id_token?: string; credential?: string; email?: string; name?: string; picture?: string }) => {
    const r = await api.post("/auth/google", googlePayload);
    await saveToken(r.data.token);
    setUser(applyVipJudgePass(r.data.user));
  };

  const requestPasswordReset = async (email: string) => {
    const r = await api.post("/auth/forgot-password", { email });
    return r.data;
  };

  const resetPassword = async (token: string, newPassword: string) => {
    const r = await api.post("/auth/reset-password", { token, new_password: newPassword });
    return r.data;
  };

  const signOut = async () => {
    try {
      await api.post("/auth/logout");
    } catch {}
    await clearToken();
    setUser(null);
  };

  return (
    <AuthCtx.Provider
      value={{
        user,
        loading,
        signInEmail,
        signUpEmail,
        signInGoogle,
        requestPasswordReset,
        resetPassword,
        refresh,
        signOut,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

