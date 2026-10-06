import Link from "next/link";
export default function NotFound() {
  return <main className="min-h-screen flex items-center justify-center px-6"><div className="text-center max-w-md"><div className="vy-kicker">VYRAL / 404</div><h1 className="vy-section-title mt-3">This space does not exist.</h1><p className="text-sm text-steel mt-3">The identity or page you requested is unavailable.</p><div className="mt-6 flex justify-center gap-2"><Link href="/" className="vy-btn-primary">Return to Feed</Link><Link href="/explore" className="vy-btn-secondary">Enter Universe</Link></div></div></main>;
}
