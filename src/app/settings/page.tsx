"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth-context";
import { ColorModeToggle } from "@/components/color-mode";
import { MusicPicker, type SelectedMusic } from "@/components/music-picker";

const THEMES = ["minimal", "obsidian", "signal", "aerodynamic", "immersive"];
const DISCOVERABILITY = ["everyone", "connections", "discoverable", "nobody"];

export default function SettingsPage() {
  const { user, profile, refresh } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [theme, setTheme] = useState("obsidian");
  const [accentColor, setAccentColor] = useState("#e11d2e");
  const [discoverability, setDiscoverability] = useState("everyone");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileMusic, setProfileMusic] = useState<SelectedMusic | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName ?? "");
    setBio(profile.bio ?? "");
    setTheme(profile.theme ?? "obsidian");
    setAccentColor(profile.accentColor ?? "#e11d2e");
    setDiscoverability(profile.discoverability ?? "everyone");
    setAvatarUrl(profile.avatarUrl ?? null);
    setProfileMusic(profile.profileMusicUrl ? { id: "profile", title: "Profile soundtrack", artist: "Spotify", album: "", artworkUrl: null, externalUrl: profile.profileMusicUrl, provider: "spotify" } : null);
  }, [profile]);

  async function uploadAvatar(file: File) {
    setUploading(true); setMessage(null);
    try {
      if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
      const form = new FormData(); form.append("file", file);
      const response = await fetch("/api/media", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok || !data.media?.id) throw new Error(data.error ?? "Avatar upload failed");
      const patch = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ avatarMediaId: data.media.id }) });
      const patchData = await patch.json();
      if (!patch.ok) throw new Error(patchData.error ?? "Could not save avatar");
      setAvatarUrl(patchData.profile?.avatarUrl ?? data.media.url ?? null);
      await refresh();
      setMessage("Profile photo updated.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Avatar upload failed"); }
    finally { setUploading(false); }
  }

  async function save() {
    setSaving(true); setMessage(null);
    try {
      const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName, bio, theme, accentColor, discoverability, profileMusicUrl: profileMusic?.externalUrl ?? null }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save settings");
      await refresh();
      setMessage("Settings saved.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save settings"); }
    finally { setSaving(false); }
  }

  if (!user) return <div className="h-screen flex items-center justify-center text-steel text-sm">Sign in to manage settings.</div>;

  return <div className="max-w-2xl mx-auto px-4 py-8 pb-24"><h1 className="text-lg font-semibold tracking-tight mb-6">Settings</h1><div className="space-y-5">
    <section className="vy-panel vy-chamfer p-6">
      <h2 className="text-xs uppercase tracking-[0.18em] text-steel mb-4">Profile identity</h2>
      <div className="flex items-center gap-4 mb-5"><div className="h-20 w-20 overflow-hidden rounded-full" style={{ background: accentColor }}>{avatarUrl ? <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" /> : <span className="h-full w-full flex items-center justify-center text-2xl font-semibold">{displayName[0]?.toUpperCase() || "V"}</span>}</div><div><input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => { const f=e.target.files?.[0]; if(f) void uploadAvatar(f); }} /><button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="vy-btn-secondary">{uploading ? "Uploading…" : "Change photo"}</button><p className="mt-2 text-xs text-steel">Use a clear image up to the server&apos;s media limit.</p></div></div>
      <label className="block mb-4"><span className="block text-xs text-steel mb-1.5">Display name</span><input value={displayName} onChange={(e)=>setDisplayName(e.target.value)} className="vy-input" /></label>
      <label className="block"><span className="block text-xs text-steel mb-1.5">Bio</span><textarea value={bio} onChange={(e)=>setBio(e.target.value)} rows={3} className="vy-input resize-none" /></label>
    </section>

    <section className="vy-panel vy-chamfer p-6 space-y-4"><h2 className="text-xs uppercase tracking-[0.18em] text-steel">Appearance & discovery</h2><label className="block"><span className="block text-xs text-steel mb-1.5">Appearance</span><ColorModeToggle /></label><label className="block"><span className="block text-xs text-steel mb-1.5">Theme</span><select value={theme} onChange={(e)=>setTheme(e.target.value)} className="vy-input capitalize">{THEMES.map(t=><option key={t} value={t}>{t}</option>)}</select></label><label className="block"><span className="block text-xs text-steel mb-1.5">Accent color</span><input type="color" value={accentColor} onChange={(e)=>setAccentColor(e.target.value)} className="h-10 w-16 bg-transparent" /></label><label className="block"><span className="block text-xs text-steel mb-1.5">Who can find you</span><select value={discoverability} onChange={(e)=>setDiscoverability(e.target.value)} className="vy-input capitalize">{DISCOVERABILITY.map(d=><option key={d} value={d}>{d}</option>)}</select></label></section>

    <section className="vy-panel vy-chamfer p-6"><h2 className="text-xs uppercase tracking-[0.18em] text-steel mb-4">Profile music</h2><MusicPicker value={profileMusic} onChange={setProfileMusic}/><p className="mt-3 text-xs text-steel">Music is linked through the provider&apos;s official track page; VYRAL does not re-host copyrighted audio.</p></section>
    {message && <p className="text-sm text-steel">{message}</p>}
    <button onClick={save} disabled={saving || uploading} className="vy-btn-primary w-full">{saving ? "Saving…" : "Save changes"}</button>
  </div></div>;
}
