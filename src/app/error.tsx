"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="min-h-screen flex items-center justify-center px-6"><div className="vy-panel vy-chamfer max-w-md w-full p-8 text-center"><p className="vy-eyebrow">VYRAL / RECOVERY</p><h1 className="text-xl font-semibold mt-3">Something interrupted the experience.</h1><p className="text-sm text-steel mt-2">The page can be retried without losing your session.</p><button onClick={() => reset()} className="vy-btn-primary mt-6">Retry</button></div></main>;
}
