"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-context";
import { Field } from "@/components/ui";

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  google_not_configured: "Google sign-in isn't set up on this server yet.",
  google_denied: "Google sign-in was cancelled.",
  invalid_callback: "That Google sign-in link was invalid or expired.",
  state_mismatch: "That Google sign-in link was invalid or expired. Please try again.",
  account_suspended: "This account has been suspended.",
  account_error: "Couldn't sign you in with that Google account. Please try again.",
  google_unavailable: "Couldn't reach Google right now. Please try again.",
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleAvailable, setGoogleAvailable] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useAuth();

  useEffect(() => {
    fetch("/api/auth/oauth/config")
      .then((r) => r.json())
      .then((d) => setGoogleAvailable(!!d.google))
      .catch(() => {});

    const oauthError = searchParams.get("error");
    if (oauthError) {
      setError(OAUTH_ERROR_MESSAGES[oauthError] ?? "Something went wrong signing in.");
    }
  }, [searchParams]);

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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/vyral-logo.png" alt="VYRAL" className="w-40 h-40 object-contain" />
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
        </form>

        {googleAvailable && (
          <>
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-charcoal" />
              <span className="text-xs text-steel">or</span>
              <div className="flex-1 h-px bg-charcoal" />
            </div>
            <a href="/api/auth/oauth/google" className="vy-btn-secondary w-full block text-center">
              Continue with Google
            </a>
          </>
        )}

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
