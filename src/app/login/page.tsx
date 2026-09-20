"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-context";
import { VyralMark } from "@/components/nav-rail";
import { Field } from "@/components/ui";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const { refresh } = useAuth();
  useEffect(() => { const status = new URLSearchParams(window.location.search).get("oauth"); if (status === "failed") setError("Google sign-in failed. Please try again."); else if (status === "invalid_state") setError("Google sign-in expired. Please try again."); else if (status === "unavailable") setError("Google sign-in is not configured on this server."); else if (status === "denied") setError("Google sign-in was cancelled."); }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      await refresh();
      router.push("/");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <VyralMark size={40} />
          <h1 className="mt-4 text-xl font-semibold tracking-tight">Sign in to VYRAL</h1>
          <p className="text-steel text-sm mt-1">Your world. Connected.</p>
        </div>

        <form onSubmit={onSubmit} className="vy-panel vy-chamfer p-6 space-y-4">
          <Field label="Email or username">
            <input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoFocus
              className="vy-input"
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="vy-input"
            />
          </Field>

          {error && <p className="text-sm text-crimson">{error}</p>}

          <button type="submit" disabled={submitting} className="vy-btn-primary w-full">
            {submitting ? "Signing in…" : "Sign in"}
          </button>
          <div className="relative my-1">
            <div className="border-t border-charcoal" />
            <span className="absolute left-1/2 -translate-x-1/2 -top-2 bg-graphite px-2 text-[11px] text-steel">OR</span>
          </div>
          <a href="/api/auth/google" className="vy-btn-secondary w-full block text-center">Continue with Google</a>
        </form>

        <p className="text-center text-sm text-steel mt-6">
          New to VYRAL?{" "}
          <Link href="/register" className="text-offwhite hover:text-crimson transition-colors">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
