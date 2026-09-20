"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-context";

const THEMES = ["minimal", "obsidian", "signal", "aerodynamic", "immersive"];
const DISCOVERABILITY = ["everyone", "connections", "discoverable", "nobody"];

export default function SettingsPage() {
  const { user, profile, refresh } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [theme, setTheme] = useState("obsidian");
  const [accentColor, setAccentColor] = useState("#e11d2e");
  const [discoverability, setDiscoverability] = useState("everyone");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName ?? "");
      setBio(profile.bio ?? "");
      setTheme(profile.theme ?? "obsidian");
      setAccentColor(profile.accentColor ?? "#e11d2e");
      setDiscoverability(profile.discoverability ?? "everyone");
    }
  }, [profile]);

  async function save() {
    setSaving(true);
    try {
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, bio, theme, accentColor, discoverability }),
      });
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!user) {
    return <div className="h-screen flex items-center justify-center text-steel text-sm">Sign in to manage settings.</div>;
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-lg font-semibold tracking-tight mb-6">Settings</h1>

      <div className="vy-panel vy-chamfer p-6 space-y-4">
        <label className="block">
          <span className="block text-xs text-steel mb-1.5">Display name</span>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="vy-input" />
        </label>
        <label className="block">
          <span className="block text-xs text-steel mb-1.5">Bio</span>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="vy-input resize-none" />
        </label>
        <label className="block">
          <span className="block text-xs text-steel mb-1.5">Theme</span>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
            {THEMES.map((t) => <button type="button" key={t} onClick={() => setTheme(t)} className={`h-14 border text-left p-2 text-[10px] uppercase tracking-wider ${theme===t ? "border-crimson text-offwhite" : "border-white/10 text-steel"}`} data-theme={t}><span className="block w-full h-1 mb-2" style={{background:t==="immersive"?"#a855f7":t==="aerodynamic"?"#d8dbe0":"#e11d2e"}} />{t}</button>)}
          </div>
          <select value={theme} onChange={(e) => setTheme(e.target.value)} className="vy-input capitalize">
            {THEMES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs text-steel mb-1.5">Accent color</span>
          <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="h-10 w-16 bg-transparent" />
        </label>
        <label className="block">
          <span className="block text-xs text-steel mb-1.5">Who can find you in Explore &amp; Search</span>
          <select value={discoverability} onChange={(e) => setDiscoverability(e.target.value)} className="vy-input capitalize">
            {DISCOVERABILITY.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <button onClick={save} disabled={saving} className="vy-btn-primary">
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
