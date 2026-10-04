"use client";

import { useEffect, useState } from "react";
import { Music2, Search, X } from "lucide-react";

export type SelectedMusic = {
  id: string;
  title: string;
  artist: string;
  album: string;
  artworkUrl: string | null;
  externalUrl: string;
  provider: "spotify";
};

export function MusicPicker({ value, onChange }: { value: SelectedMusic | null; onChange: (track: SelectedMusic | null) => void }) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<SelectedMusic[]>([]);
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setItems([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/music/search?q=${encodeURIComponent(query.trim())}`, { cache: "no-store" });
        const data = await response.json();
        setConfigured(data.configured !== false);
        setItems(Array.isArray(data.items) ? data.items : []);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [query, open]);

  async function select(track: SelectedMusic) {
    const response = await fetch("/api/music/tracks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(track),
    });
    const data = await response.json();
    if (response.ok && data.track?.id) {
      onChange({ ...track, id: data.track.id });
      setOpen(false);
      setQuery("");
    }
  }

  if (value) {
    return (
      <div className="flex items-center gap-3 border border-white/10 bg-white/[0.03] p-3">
        {value.artworkUrl ? <img src={value.artworkUrl} alt="" className="h-11 w-11 object-cover" /> : <div className="h-11 w-11 bg-white/10 flex items-center justify-center"><Music2 size={18} /></div>}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{value.title}</p>
          <p className="truncate text-xs text-steel">{value.artist}</p>
        </div>
        <button type="button" onClick={() => onChange(null)} className="p-2 text-steel hover:text-white" aria-label="Remove music"><X size={16} /></button>
      </div>
    );
  }

  return (
    <div>
      <button type="button" onClick={() => setOpen((v) => !v)} className="vy-btn-secondary inline-flex items-center gap-2">
        <Music2 size={16} /> Add music
      </button>
      {open && (
        <div className="mt-3 border border-white/10 bg-black/95 p-3">
          <div className="flex items-center gap-2 border border-white/10 px-3">
            <Search size={15} className="text-steel" />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search Spotify" className="w-full bg-transparent py-2.5 text-sm outline-none" />
          </div>
          {!configured && <p className="px-2 py-4 text-xs text-steel">Music is not configured on this server.</p>}
          {loading && <p className="px-2 py-4 text-xs text-steel">Searching…</p>}
          {!loading && configured && query.trim().length >= 2 && items.length === 0 && <p className="px-2 py-4 text-xs text-steel">No tracks found.</p>}
          <div className="mt-2 max-h-64 overflow-y-auto">
            {items.map((track) => (
              <button type="button" key={`${track.provider}:${track.id}`} onClick={() => select(track)} className="flex w-full items-center gap-3 p-2 text-left hover:bg-white/[0.05]">
                {track.artworkUrl ? <img src={track.artworkUrl} alt="" className="h-10 w-10 object-cover" /> : <div className="h-10 w-10 bg-white/10 flex items-center justify-center"><Music2 size={16} /></div>}
                <span className="min-w-0 flex-1"><span className="block truncate text-sm">{track.title}</span><span className="block truncate text-xs text-steel">{track.artist} · {track.album}</span></span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
