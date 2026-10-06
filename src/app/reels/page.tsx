"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Clapperboard, Plus, Volume2, VolumeX } from "lucide-react";
import { useAuth } from "@/components/auth-context";
import { ReelCard, type ReelItem } from "@/components/reel-card";

export default function ReelsPage() {
  const { user, loading: authLoading } = useAuth();
  const [reels, setReels] = useState<ReelItem[] | null>(null);
  const [error, setError] = useState(false);
  const [muted, setMuted] = useState(true);
  const load = useCallback(async () => { setError(false); try { const res=await fetch("/api/reels",{cache:"no-store"}); if(!res.ok){setError(true);return;} setReels((await res.json()).items??[]);} catch {setError(true);} },[]);
  useEffect(()=>{if(user) void load();},[user,load]);
  if(authLoading)return null;
  if(!user)return <div className="min-h-screen flex flex-col items-center justify-center text-center px-6"><Clapperboard size={28} className="text-crimson mb-4"/><p className="text-steel text-sm mb-4">Sign in to watch Reels.</p><Link href="/login" className="vy-btn-primary">Sign in</Link></div>;
  if(error)return <div className="min-h-screen flex flex-col items-center justify-center text-center px-6"><p className="text-steel text-sm mb-4">Couldn&apos;t load Reels.</p><button onClick={load} className="vy-btn-secondary">Retry</button></div>;
  if(reels===null)return <div className="min-h-screen flex items-center justify-center text-steel text-sm">Loading Reels…</div>;
  if(reels.length===0)return <div className="min-h-screen flex flex-col items-center justify-center text-center px-6"><Clapperboard size={30} className="text-steel mb-4"/><p className="text-steel text-sm mb-4">No Reels yet — be the first to publish one.</p><Link href="/create/reel" className="vy-btn-primary inline-flex items-center gap-2"><Plus size={15}/>Create a Reel</Link></div>;
  return <div className="relative h-screen overflow-y-scroll snap-y snap-mandatory bg-black"><div className="fixed z-20 top-4 left-4 right-4 md:left-[calc(76px+1rem)] lg:left-[calc(232px+1rem)] flex items-center justify-between pointer-events-none"><div><div className="vy-kicker text-white/60">VYRAL / Reels</div><div className="text-sm font-semibold text-white mt-1">Discover in motion</div></div><button onClick={()=>setMuted(v=>!v)} className="pointer-events-auto vy-icon-btn !text-white !border-white/15 !bg-black/30" aria-label={muted?"Unmute all Reels":"Mute all Reels"}>{muted?<VolumeX size={17}/>:<Volume2 size={17}/>}</button></div>{reels.map(reel=><ReelCard key={reel.id} reel={reel} muted={muted} onToggleMute={()=>setMuted(v=>!v)}/>)}</div>;
}
