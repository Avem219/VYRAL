"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-context";

 type Report = {
  id: string;
  reporterId: string;
  targetType: string;
  targetId: string;
  reason: string;
  status: string;
  createdAt: string;
};

export default function AdminPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/reports", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Unable to load reports");
      setReports(data.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load reports");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (user?.role === "admin" || user?.role === "moderator") void load(); else setLoading(false); }, [user, load]);

  async function setStatus(reportId: string, status: "reviewed" | "dismissed") {
    setBusy(reportId);
    try {
      const res = await fetch("/api/admin/reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, status }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Action failed");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Action failed"); }
    finally { setBusy(null); }
  }

  async function remove(report: Report) {
    if (!["post", "reel", "story", "comment"].includes(report.targetType)) {
      setError("This report type requires user-level moderation rather than direct content removal.");
      return;
    }
    if (!confirm(`Delete this ${report.targetType}? This cannot be undone.`)) return;
    setBusy(report.id);
    try {
      const res = await fetch(`/api/admin/content/${report.targetType}/${report.targetId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Delete failed");
      await fetch("/api/admin/reports", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reportId: report.id, status: "actioned" }) });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Delete failed"); }
    finally { setBusy(null); }
  }

  if (!user) return <main className="max-w-3xl mx-auto px-4 py-10"><p className="text-steel">Sign in to access moderation.</p></main>;
  if (user.role !== "admin" && user.role !== "moderator") return <main className="max-w-3xl mx-auto px-4 py-10"><p className="text-steel">Not authorized.</p></main>;

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 pb-24">
      <p className="eyebrow">VYRAL / MODERATION</p>
      <div className="flex items-end justify-between gap-4 mt-2 mb-6">
        <div><h1 className="text-2xl font-semibold">Reports</h1><p className="text-sm text-steel mt-1">Review reported content with server-enforced moderator access.</p></div>
        <button className="vy-btn-secondary" onClick={() => void load()} disabled={loading}>Refresh</button>
      </div>
      {error && <p className="mb-4 text-sm text-crimson">{error}</p>}
      {loading ? <p className="text-steel">Loading…</p> : reports.length === 0 ? <div className="vy-panel vy-chamfer p-6 text-steel">No reports.</div> :
        <div className="space-y-3">{reports.map((r) => (
          <article key={r.id} className="vy-panel vy-chamfer p-5">
            <div className="flex flex-wrap justify-between gap-3">
              <div><div className="text-xs uppercase tracking-wide text-steel">{r.targetType} · {r.status}</div><div className="text-sm mt-2 break-all">{r.targetId}</div></div>
              <div className="text-xs text-steel">{new Date(r.createdAt).toLocaleString()}</div>
            </div>
            <p className="text-sm mt-4">{r.reason}</p>
            <div className="flex flex-wrap gap-2 mt-5">
              {r.status === "open" && <><button className="vy-btn-secondary" disabled={busy === r.id} onClick={() => void setStatus(r.id, "reviewed")}>Mark reviewed</button><button className="vy-btn-secondary" disabled={busy === r.id} onClick={() => void setStatus(r.id, "dismissed")}>Dismiss</button></>}
              {["post", "reel", "story", "comment"].includes(r.targetType) && <button className="vy-btn-primary" disabled={busy === r.id} onClick={() => void remove(r)}>Delete content</button>}
            </div>
          </article>
        ))}</div>}
    </main>
  );
}
