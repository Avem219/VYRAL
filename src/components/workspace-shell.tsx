"use client";

import { usePathname } from "next/navigation";
import { NavRail } from "@/components/nav-rail";
import { RightRail } from "@/components/right-rail";
import Link from "next/link";
import { Search } from "lucide-react";

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const authScreen = pathname === "/login" || pathname === "/register";
  const immersive = pathname === "/explore" || pathname.startsWith("/messages/");

  if (authScreen) return <>{children}</>;

  return (
    <div className="min-h-screen bg-void">
      <NavRail />
      <div className="md:pl-[76px] lg:pl-[220px]">
        <header className="md:hidden vy-topbar sticky top-0 z-30 h-14 px-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2"><img src="/vyral-logo.png" alt="VYRAL" className="h-8 w-8 object-contain" /><span className="text-xs font-semibold tracking-[.22em]">VYRAL</span></Link>
          <Link href="/search" aria-label="Search" className="text-steel hover:text-offwhite"><Search size={20}/></Link>
        </header>
        <div className="vyral-workspace mx-auto flex min-h-screen w-full max-w-[1680px]">
          <main className={`min-w-0 flex-1 ${immersive ? "" : "xl:pr-0"}`}>{children}</main>
          {!immersive && <RightRail />}
        </div>
      </div>
    </div>
  );
}
