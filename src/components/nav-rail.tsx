"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  LayoutGrid,
  SquarePlus,
  MessageCircle,
  User,
  Search,
  Bell,
  Bookmark,
  Settings,
  LogOut,
  Users,
  BarChart3,
  PlaySquare,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "./auth-context";

const primaryNav = [
  { href: "/stories", label: "Stories", icon: PlaySquare },
  { href: "/reels", label: "Reels", icon: PlaySquare },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/", label: "Feed", icon: LayoutGrid },
  { href: "/create", label: "Create", icon: SquarePlus },
  { href: "/messages", label: "Messages", icon: MessageCircle },
];

const secondaryNav = [
  { href: "/search", label: "Search", icon: Search },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/saved", label: "Saved", icon: Bookmark },
  { href: "/circles", label: "Circles", icon: Users },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function NavRail() {
  const pathname = usePathname();
  const { user, profile, loading, logout } = useAuth();

  if (pathname === "/login" || pathname === "/register") return null;

  return (
    <>
    <nav className="hidden md:flex fixed left-0 top-0 z-40 w-[76px] lg:w-[220px] shrink-0 flex-col border-r border-white/5 bg-black/60 backdrop-blur-xl h-screen">
      <div className="h-16 flex items-center px-4 lg:px-5 gap-3 border-b border-white/5">
        <img src="/vyral-logo.png" alt="VYRAL" className="h-9 w-9 object-contain" />
        <span className="hidden lg:inline text-[15px] font-semibold tracking-[.22em]">VYRAL</span>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-2 lg:px-3">
        <ul className="space-y-1">
          {primaryNav.map((item) => (
            <NavItem key={item.href} {...item} active={pathname === item.href} />
          ))}
          {(user?.role === "admin" || user?.role === "moderator") && (
            <NavItem href="/admin" label="Moderation" icon={ShieldCheck} active={pathname === "/admin"} />
          )}
        </ul>

        <div className="my-4 h-px bg-charcoal" />

        <ul className="space-y-1">
          {secondaryNav.map((item) => (
            <NavItem key={item.href} {...item} active={pathname === item.href} />
          ))}
        </ul>
      </div>

      <div className="border-t vy-hairline p-3">
        {loading ? null : user ? (
          <Link
            href={`/profile/${user.username}`}
            className="flex items-center gap-3 px-2 py-2 rounded hover:bg-graphite transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-charcoal flex items-center justify-center shrink-0">
              <User size={16} className="text-steel" />
            </div>
            <div className="hidden lg:block min-w-0">
              <div className="text-sm font-medium truncate">{profile?.displayName ?? user.username}</div>
              <div className="text-xs text-steel truncate">@{user.username}</div>
            </div>
          </Link>
        ) : (
          <Link
            href="/login"
            className="flex items-center justify-center lg:justify-start gap-2 px-3 py-2 bg-crimson text-white text-sm font-medium vy-chamfer-sm"
          >
            <span className="hidden lg:inline">Sign in</span>
            <User size={16} className="lg:hidden" />
          </Link>
        )}
        {user && (
          <button
            onClick={() => logout()}
            className="mt-1 w-full flex items-center gap-3 px-2 py-2 rounded text-steel hover:text-offwhite hover:bg-graphite transition-colors text-sm"
          >
            <LogOut size={16} />
            <span className="hidden lg:inline">Sign out</span>
          </button>
        )}
      </div>

    </nav>
    <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-obsidian/95 backdrop-blur border-t border-charcoal grid grid-cols-5 p-1 safe-bottom">
        {[{href:"/",label:"Feed",icon:LayoutGrid},{href:"/explore",label:"Explore",icon:Compass},{href:"/stories",label:"Stories",icon:PlaySquare},{href:"/messages",label:"Messages",icon:MessageCircle},{href:user?`/profile/${user.username}`:"/login",label:"Profile",icon:User}].map(({href,label,icon:Icon})=><Link key={href} href={href} aria-label={label} className={`flex flex-col items-center gap-0.5 py-2 text-[10px] ${pathname===href?"text-offwhite":"text-steel"}`}><Icon size={18}/><span>{label}</span></Link>)}
      </div>
    </>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof Compass;
  active: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        className={`flex items-center gap-3 px-3 py-2.5 transition-colors border-l-2 ${
          active ? "vy-sidebar-active text-offwhite border-crimson" : "border-transparent text-steel hover:text-offwhite hover:bg-white/[.025]"
        }`}
      >
        <Icon size={19} strokeWidth={active ? 2.25 : 1.75} className={active ? "text-crimson" : ""} />
        <span className="hidden lg:inline text-sm">{label}</span>
      </Link>
    </li>
  );
}

/** Original VYRAL symbol: a chamfered diamond split by a single crimson edge — reads as a compass/node mark at any size. */
export function VyralMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M16 2 L28 16 L16 30 L4 16 Z" stroke="var(--vy-off-white)" strokeWidth="1.5" fill="var(--vy-graphite)" />
      <path d="M16 2 L28 16 L16 16 Z" fill="var(--vy-crimson)" />
    </svg>
  );
}
