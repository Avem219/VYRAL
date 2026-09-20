"use client";

import { useEffect, useState, Suspense } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
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

const UniverseScene = dynamic(() => import("@/components/universe-scene"), {
  ssr: false,
  loading: () => <CenteredNote text="Initializing universe…" />,
});

function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

export default function ExplorePage() {
  const { user, loading } = useAuth();
  const [nodes, setNodes] = useState<ExploreNode[] | null>(null);
  const [webgl, setWebgl] = useState(true);
  const [selected, setSelected] = useState<ExploreNode | null>(null);

  useEffect(() => {
    setWebgl(supportsWebGL());
  }, []);

  useEffect(() => {
    if (!user) return;
    fetch("/api/explore")
      .then((r) => r.json())
      .then((d) => setNodes(d.nodes));
  }, [user]);

  if (loading) return null;
  if (!user) {
    return (
      <CenteredNote text="Sign in to enter the VYRAL universe.">
        <Link href="/login" className="vy-btn-primary mt-4 inline-block">
          Sign in
        </Link>
      </CenteredNote>
    );
  }

  return (
    <div className="relative h-screen w-full bg-void overflow-hidden">
      {nodes === null ? (
        <CenteredNote text="Mapping the universe…" />
      ) : !webgl ? (
        <FallbackGrid nodes={nodes} onSelect={setSelected} />
      ) : (
        <Suspense fallback={<CenteredNote text="Loading scene…" />}>
          <UniverseScene nodes={nodes} onSelect={setSelected} />
        </Suspense>
      )}

      {selected && <IdentityPreview node={selected} onClose={() => setSelected(null)} />}

      <div className="absolute top-6 left-6 pointer-events-none">
        <h1 className="text-sm font-semibold tracking-wide text-offwhite/90">EXPLORE</h1>
        <p className="text-xs text-steel mt-0.5">{nodes ? `${nodes.length} identities in range` : ""}</p>
      </div>
    </div>
  );
}

function CenteredNote({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <div className="h-screen w-full flex flex-col items-center justify-center text-center px-6">
      <p className="text-steel text-sm">{text}</p>
      {children}
    </div>
  );
}

function FallbackGrid({ nodes, onSelect }: { nodes: ExploreNode[]; onSelect: (n: ExploreNode) => void }) {
  return (
    <div className="h-full overflow-y-auto px-6 py-20">
      <p className="text-steel text-xs mb-4 max-w-md">
        Your browser doesn&apos;t support WebGL, so here&apos;s Explore in grid form — same data, no 3D.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 max-w-4xl">
        {nodes.map((n) => (
          <button key={n.id} onClick={() => onSelect(n)} className="vy-panel vy-chamfer p-4 text-left hover:border-crimson transition-colors">
            <div className="w-10 h-10 rounded-full mb-2" style={{ background: n.accentColor }} />
            <div className="text-sm font-medium truncate">{n.displayName}</div>
            <div className="text-xs text-steel truncate">@{n.username}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function IdentityPreview({ node, onClose }: { node: ExploreNode; onClose: () => void }) {
  return (
    <div className="absolute bottom-6 right-6 w-72 vy-panel vy-chamfer p-5">
      <button onClick={onClose} className="absolute top-3 right-3 text-steel hover:text-offwhite text-xs">
        ✕
      </button>
      <div className="w-12 h-12 rounded-full mb-3" style={{ background: node.accentColor }} />
      <div className="text-base font-medium">{node.displayName}</div>
      <div className="text-xs text-steel mb-3">@{node.username}</div>
      {node.sharedInterestCount > 0 && (
        <p className="text-xs text-steel mb-3">
          {node.sharedInterestCount} shared interest{node.sharedInterestCount === 1 ? "" : "s"}
        </p>
      )}
      <Link href={`/profile/${node.username}`} className="vy-btn-primary block text-center">
        View profile
      </Link>
    </div>
  );
}
