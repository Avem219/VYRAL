import type { Metadata } from "next";
import "./globals.css";
import { NavRail } from "@/components/nav-rail";
import { MobileNav } from "@/components/mobile-nav";
import { AuthProvider } from "@/components/auth-context";
import { ColorModeScript } from "@/components/color-mode-script";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: "VYRAL — Your world. Connected.",
  description: "VYRAL is a social universe for discovery, expression, and connection.",
  applicationName: "VYRAL",
  openGraph: { title: "VYRAL — Your world. Connected.", description: "A social universe for discovery, expression, and connection.", siteName: "VYRAL", type: "website" },
  twitter: { card: "summary_large_image", title: "VYRAL — Your world. Connected.", description: "A social universe for discovery, expression, and connection." },
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <ColorModeScript />
      </head>
      <body className="min-h-full bg-void text-offwhite">
        <AuthProvider>
          <div className="flex min-h-screen">
            <NavRail />
            <main className="flex-1 min-w-0 pb-16 md:pb-0">{children}</main>
          </div>
          <MobileNav />
        </AuthProvider>
      </body>
    </html>
  );
}
