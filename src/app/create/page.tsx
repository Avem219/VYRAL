import Link from "next/link";

const options = [
  { href: "/", label: "Post", desc: "Share text, photos, or a project with your world." },
  { href: "/#story", label: "Story", desc: "Add a photo, video, or text story — tap the + on your avatar in the Feed." },
  { href: "/create/reel", label: "Reel", desc: "Post a short vertical video." },
  { href: "/express", label: "Express", desc: "Send something private to one person." },
];

export default function CreatePage() {
  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-lg font-semibold tracking-tight mb-6">Create</h1>
      <div className="grid grid-cols-2 gap-4">
        {options.map((o) => (
          <Link key={o.href} href={o.href} className="vy-panel vy-chamfer p-5 hover:border-crimson transition-colors">
            <h2 className="text-sm font-medium mb-1">{o.label}</h2>
            <p className="text-xs text-steel">{o.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
