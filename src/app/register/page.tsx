"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-context";
import { VyralMark } from "@/components/nav-rail";
import { Field } from "@/components/ui";

export default function RegisterPage() {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const { refresh } = useAuth();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, username, email, password }),
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
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <VyralMark size={40} />
          <h1 className="mt-4 text-xl font-semibold tracking-tight">Create your VYRAL identity</h1>
          <p className="text-steel text-sm mt-1 text-center">Your world. Connected.</p>
        </div>

        <form onSubmit={onSubmit} className="vy-panel vy-chamfer p-6 space-y-4">
          <Field label="Display name">
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required autoFocus className="vy-input" />
          </Field>
          <Field label="Username">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
              required
              pattern="[a-zA-Z0-9_]+"
              minLength={3}
              maxLength={24}
              className="vy-input"
            />
          </Field>
          <Field label="Email">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="vy-input" />
          </Field>
          <Field label="Password">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="vy-input"
            />
          </Field>

          {error && <p className="text-sm text-crimson">{error}</p>}

          <button type="submit" disabled={submitting} className="vy-btn-primary w-full">
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm text-steel mt-6">
          Already on VYRAL?{" "}
          <Link href="/login" className="text-offwhite hover:text-crimson transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
