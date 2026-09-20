"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

type User = { id: string; username: string; email: string } | null;
type Profile = {
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  accentColor: string;
  theme: string;
  discoverability: string;
} | null;

type AuthState = {
  user: User;
  profile: Profile;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  user: null,
  profile: null,
  loading: true,
  refresh: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [profile, setProfile] = useState<Profile>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      setUser(data.user);
      setProfile(data.profile);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setProfile(null);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = profile?.theme ?? "obsidian";
    if (profile?.accentColor) root.style.setProperty("--vy-crimson", profile.accentColor);
  }, [profile?.theme, profile?.accentColor]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
