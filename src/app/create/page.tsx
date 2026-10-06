import Link from "next/link";
import { ArrowUpRight, Clapperboard, ImagePlus, Mail, Sparkles } from "lucide-react";

const options = [
  { href: "/", label: "Post", icon: ImagePlus, desc: "Share text, photos, video, or something you are building." },
  { href: "/stories", label: "Story", icon: Sparkles, desc: "View active stories. Add yours directly from the Feed story tray." },
  { href: "/create/reel", label: "Reel", icon: Clapperboard, desc: "Publish a short vertical video with optional music attribution." },
  { href: "/express", label: "Express", icon: Mail, desc: "Send a private, rich expression to one person." },
];

export default function CreatePage() {
  return <main className="vy-shell vy-mobile-safe py-8 md:py-12">
    <div className="max-w-3xl mx-auto">
      <div className="vy-kicker">VYRAL / Create</div>
      <h1 className="vy-section-title mt-2">Put something into the world.</h1>
      <p className="text-sm text-steel mt-2 max-w-xl">Every creation is connected to your real account and VYRAL&apos;s existing privacy, media, and social graph rules.</p>

      <div className="grid sm:grid-cols-2 gap-4 mt-8">
        {options.map(({ href, label, icon: Icon, desc }) => <Link key={label} href={href} className="group vy-panel vy-chamfer p-6 min-h-[170px] hover:border-crimson transition-colors">
          <div className="flex items-start justify-between"><span className="w-10 h-10 border border-white/10 bg-white/[.03] flex items-center justify-center text-crimson"><Icon size={19}/></span><ArrowUpRight size={16} className="text-steel group-hover:text-offwhite transition-colors"/></div>
          <h2 className="text-base font-semibold mt-8">{label}</h2><p className="text-xs text-steel mt-1.5 leading-5">{desc}</p>
        </Link>)}
      </div>

      <div className="mt-6 vy-panel vy-chamfer p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><div className="vy-eyebrow">Private by design</div><p className="text-sm font-medium mt-2">Need to say something that should stay between two people?</p><p className="text-xs text-steel mt-1">Use Express instead of publishing it to the feed.</p></div>
        <Link href="/express" className="vy-btn-secondary shrink-0">Open Express</Link>
      </div>
    </div>
  </main>;
}
