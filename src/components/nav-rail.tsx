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
  Clapperboard,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "./auth-context";

const primaryNav = [
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/", label: "Feed", icon: LayoutGrid },
  { href: "/reels", label: "Reels", icon: Clapperboard },
  { href: "/stories", label: "Stories", icon: Clapperboard },
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
    <nav className="hidden md:flex w-[76px] lg:w-[220px] shrink-0 flex-col border-r border-white/8 vy-glass-strong h-screen sticky top-0 z-30">
      <div className="h-16 flex items-center px-4 lg:px-5 gap-3 border-b border-white/8">
        <VyralMark />
        <span className="hidden lg:inline text-[15px] font-semibold tracking-tight">VYRAL</span>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-2 lg:px-3">
        <ul className="space-y-1">
          {primaryNav.map((item) => (
            <NavItem key={item.href} {...item} active={pathname === item.href} />
          ))}
        </ul>

        <div className="my-4 h-px bg-charcoal" />

        <ul className="space-y-1">
          {secondaryNav.map((item) => (
            <NavItem key={item.href} {...item} active={pathname === item.href} />
          ))}
          {user && (user.role === "admin" || user.role === "moderator") && <NavItem href="/admin" label="Moderation" icon={ShieldCheck} active={pathname === "/admin"} />}
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
        className={`flex items-center gap-3 px-3 py-2.5 rounded transition-colors ${
          active ? "bg-graphite text-offwhite" : "text-steel hover:text-offwhite hover:bg-graphite/60"
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
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/brand/vyral-icon-square.png" alt="VYRAL" width={size} height={size} className="object-contain" />
  );
}
