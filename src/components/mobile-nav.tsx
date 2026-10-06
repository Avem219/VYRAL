"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, LayoutGrid, Clapperboard, SquarePlus, MessageCircle } from "lucide-react";

const items = [
  { href: "/explore", label: "Universe", icon: Compass },
  { href: "/", label: "Feed", icon: LayoutGrid },
  { href: "/create", label: "Create", icon: SquarePlus },
  { href: "/reels", label: "Reels", icon: Clapperboard },
  { href: "/messages", label: "Messages", icon: MessageCircle },
];

export function MobileNav() {
  const pathname = usePathname();
  if (pathname === "/login" || pathname === "/register") return null;
  return <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 vy-glass-strong border-t border-white/8" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }} aria-label="Primary">
    <ul className="flex items-stretch h-14">
      {items.map(({ href, label, icon: Icon }) => { const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`); return <li key={href} className="flex-1"><Link href={href} aria-label={label} aria-current={active ? "page" : undefined} className={`relative flex flex-col items-center justify-center h-full gap-0.5 ${active ? "text-crimson" : "text-steel"}`}><Icon size={21} strokeWidth={active ? 2.25 : 1.75}/>{active && <span className="absolute top-0 h-px w-8 bg-crimson" />}</Link></li>; })}
    </ul>
  </nav>;
}
