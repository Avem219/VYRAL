import type { Metadata } from "next";
import "./globals.css";
import { NavRail } from "@/components/nav-rail";
import { AuthProvider } from "@/components/auth-context";
import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  title: "VYRAL — Your world. Connected.",
  description: "VYRAL is a social universe for discovery, expression, and connection.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  applicationName: "VYRAL",
  manifest: "/manifest.webmanifest",
  openGraph: { title: "VYRAL — Your world. Connected.", description: "A social universe for discovery, expression, and connection.", type: "website" },
  twitter: { card: "summary", title: "VYRAL — Your world. Connected.", description: "A social universe for discovery, expression, and connection." },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-void text-offwhite">
        <AuthProvider>
          <PwaRegister />
          <div className="flex min-h-screen">
            <NavRail />
            <main className="flex-1 min-w-0">{children}</main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
