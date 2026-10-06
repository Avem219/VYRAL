"use client";

import { useEffect, useState, Suspense } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Compass, Crosshair, Search, Users, X } from "lucide-react";
import { useAuth } from "@/components/auth-context";

export type ExploreNode = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  accentColor: string;
  sharedInterestCount: number;
  position: [number, number, number];
};

const UniverseScene = dynamic(() => import("@/components/universe-scene"), { ssr: false, loading: () => <CenteredNote text="Initializing universe…" /> });

function supportsWebGL() {
  try { const canvas = document.createElement("canvas"); return !!(canvas.getContext("webgl") || canvas.getContext("experimental-webgl")); } catch { return false; }
}

export default function ExplorePage() {
  const { user, profile, loading } = useAuth();
  const [nodes, setNodes] = useState<ExploreNode[] | null>(null);
  const [webgl, setWebgl] = useState(true);
  const [selected, setSelected] = useState<ExploreNode | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => setWebgl(supportsWebGL()), []);
  useEffect(() => { if (!user) return; fetch("/api/explore", { cache: "no-store" }).then((r) => r.json()).then((d) => setNodes(Array.isArray(d.nodes) ? d.nodes : [])).catch(() => setNodes([])); }, [user]);

  if (loading) return null;
  if (!user) return <CenteredNote text="Sign in to enter the VYRAL universe."><Link href="/login" className="vy-btn-primary mt-4 inline-block">Sign in</Link></CenteredNote>;

  const center = { displayName: profile?.displayName ?? user.username, username: user.username, avatarUrl: profile?.avatarUrl ?? null, accentColor: profile?.accentColor ?? "#e11d2e" };

  return <div className="relative h-[calc(100vh-0px)] w-full bg-void overflow-hidden">
    {nodes === null ? <CenteredNote text="Mapping the universe…" /> : !webgl ? <FallbackGrid nodes={nodes} onSelect={setSelected} /> : <Suspense fallback={<CenteredNote text="Loading scene…" />}><UniverseScene nodes={nodes} center={center} paused={paused} onSelect={setSelected} /></Suspense>}

    <div className="absolute top-5 left-5 md:top-7 md:left-7 z-10 pointer-events-none">
      <div className="vy-kicker flex items-center gap-2"><Compass size={12}/> VYRAL / Universe</div>
      <h1 className="text-2xl md:text-3xl font-semibold tracking-[-.04em] mt-2">Find your world.</h1>
      <p className="text-xs text-steel mt-1 max-w-xs">People and ideas you can discover, positioned from real social signals.</p>
    </div>

    <div className="absolute top-5 right-5 md:top-7 md:right-7 z-10 flex gap-2">
      <Link href="/search" className="vy-icon-btn" aria-label="Search"><Search size={17}/></Link>
      <button className="vy-icon-btn" aria-label={paused ? "Resume universe" : "Pause universe"} onClick={() => setPaused((v) => !v)}><Crosshair size={17}/></button>
    </div>

    <div className="absolute left-5 bottom-6 md:left-7 md:bottom-7 z-10 vy-panel vy-chamfer px-4 py-3 max-w-[280px]">
      <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-crimson shadow-[0_0_12px_var(--vy-crimson)]"/><span className="text-xs font-medium">{nodes?.length ?? 0} discoverable identities</span></div>
      <p className="text-[11px] text-steel mt-1">Your center is private. Exact location is never exposed.</p>
    </div>

    {selected && <IdentityPreview node={selected} onClose={() => setSelected(null)} />}
  </div>;
}

function CenteredNote({ text, children }: { text: string; children?: React.ReactNode }) { return <div className="h-screen w-full flex flex-col items-center justify-center text-center px-6"><p className="text-steel text-sm">{text}</p>{children}</div>; }

function FallbackGrid({ nodes, onSelect }: { nodes: ExploreNode[]; onSelect: (n: ExploreNode) => void }) { return <div className="h-full overflow-y-auto px-6 py-24"><div className="max-w-5xl mx-auto"><p className="text-steel text-xs mb-5 max-w-md">WebGL is unavailable on this device. The same real discovery data is available here.</p><div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">{nodes.map((n) => <button key={n.id} onClick={() => onSelect(n)} className="vy-panel vy-chamfer p-4 text-left hover:border-crimson transition-colors"><div className="w-11 h-11 rounded-full mb-3 overflow-hidden" style={{ background: n.accentColor }}>{n.avatarUrl && <img src={n.avatarUrl} alt="" className="w-full h-full object-cover"/>}</div><div className="text-sm font-medium truncate">{n.displayName}</div><div className="text-xs text-steel truncate">@{n.username}</div>{n.sharedInterestCount > 0 && <div className="mt-3 text-[10px] uppercase tracking-wider text-gold">{n.sharedInterestCount} shared interest{n.sharedInterestCount === 1 ? "" : "s"}</div>}</button>)}</div></div></div>; }

function IdentityPreview({ node, onClose }: { node: ExploreNode; onClose: () => void }) { return <div className="absolute z-20 bottom-5 right-5 md:bottom-7 md:right-7 w-[min(340px,calc(100vw-40px))] vy-panel vy-chamfer p-5"><button onClick={onClose} className="vy-icon-btn absolute top-3 right-3 !w-8 !h-8" aria-label="Close"><X size={15}/></button><div className="flex items-center gap-3 pr-9"><div className="w-12 h-12 rounded-full overflow-hidden shrink-0" style={{ background: node.accentColor }}>{node.avatarUrl && <img src={node.avatarUrl} alt="" className="w-full h-full object-cover"/>}</div><div className="min-w-0"><div className="text-base font-semibold truncate">{node.displayName}</div><div className="text-xs text-steel truncate">@{node.username}</div></div></div>{node.sharedInterestCount > 0 && <div className="mt-4 text-xs text-gold">{node.sharedInterestCount} shared interest{node.sharedInterestCount === 1 ? "" : "s"} — a real discovery signal</div>}<Link href={`/profile/${node.username}`} className="vy-btn-primary mt-5 w-full inline-flex items-center justify-center gap-2"><Users size={15}/> View profile</Link></div>; }
