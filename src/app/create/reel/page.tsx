"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-context";
import { MusicPicker, type SelectedMusic } from "@/components/music-picker";

type Stage = "idle" | "uploading" | "publishing" | "error" | "success";

export default function CreateReelPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [music, setMusic] = useState<SelectedMusic | null>(null);
  const [audience, setAudience] = useState<"everyone" | "connections">("everyone");
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function pickFile(selected: File) {
    if (!selected.type.startsWith("video/")) {
      setError("Reels must be a video file.");
      return;
    }
    if (selected.size > 50 * 1024 * 1024) {
      setError("Video is too large (50MB limit).");
      return;
    }
    setError(null);
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
  }

  function uploadWithProgress(url: string, form: FormData): Promise<{ ok: boolean; data: { media?: { id: string }; error?: string } }> {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        try {
          resolve({ ok: xhr.status >= 200 && xhr.status < 300, data: JSON.parse(xhr.responseText) });
        } catch {
          resolve({ ok: false, data: { error: "Upload failed" } });
        }
      };
      xhr.onerror = () => resolve({ ok: false, data: { error: "Network error during upload" } });
      xhr.send(form);
    });
  }

  async function publish() {
    if (!file) {
      setError("Choose a video first.");
      return;
    }
    setError(null);
    setStage("uploading");
    setProgress(0);

    const form = new FormData();
    form.append("file", file);
    const uploadResult = await uploadWithProgress("/api/media", form);
    if (!uploadResult.ok || !uploadResult.data.media) {
      setError(uploadResult.data.error ?? "Upload failed");
      setStage("error");
      return;
    }

    setStage("publishing");
    try {
      const res = await fetch("/api/reels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId: uploadResult.data.media.id, caption: caption || undefined, audience, musicTrackId: music?.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't publish your reel");
        setStage("error");
        return;
      }
      setStage("success");
      setTimeout(() => router.push("/reels"), 800);
    } catch {
      setError("Network error while publishing");
      setStage("error");
    }
  }

  if (!user) return null;

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <h1 className="text-lg font-semibold tracking-tight mb-6">New Reel</h1>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && pickFile(e.target.files[0])}
      />

      {previewUrl ? (
        <div className="mb-4 aspect-[9/16] max-h-96 bg-obsidian overflow-hidden mx-auto flex items-center justify-center vy-chamfer">
          <video src={previewUrl} controls className="max-h-full max-w-full object-contain" />
        </div>
      ) : (
        <button onClick={() => fileInputRef.current?.click()} className="vy-panel vy-chamfer w-full aspect-[9/16] max-h-96 mx-auto flex items-center justify-center text-steel text-sm mb-4">
          Choose a video
        </button>
      )}

      {file && (
        <button onClick={() => fileInputRef.current?.click()} className="text-xs text-steel hover:text-crimson mb-4 block">
          Choose a different video
        </button>
      )}

      <label className="block mb-4">
        <span className="block text-xs text-steel mb-1.5">Caption</span>
        <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={2} maxLength={500} className="vy-input resize-none" />
      </label>

      <div className="mb-6">
        <span className="block text-xs text-steel mb-1.5">Soundtrack</span>
        <MusicPicker value={music} onChange={setMusic} />
      </div>

      <label className="block mb-6">
        <span className="block text-xs text-steel mb-1.5">Who can see this</span>
        <select value={audience} onChange={(e) => setAudience(e.target.value as typeof audience)} className="vy-input">
          <option value="everyone">Everyone</option>
          <option value="connections">Connections</option>
        </select>
      </label>

      {stage === "uploading" && (
        <div className="mb-4">
          <div className="h-1.5 bg-charcoal rounded-full overflow-hidden mb-1.5">
            <div className="h-full bg-crimson transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-steel">Uploading… {progress}%</p>
        </div>
      )}
      {stage === "publishing" && <p className="text-xs text-steel mb-4">Publishing…</p>}
      {stage === "success" && <p className="text-xs text-signal-green mb-4">Posted! Taking you to Reels…</p>}
      {error && (
        <div className="mb-4">
          <p className="text-sm text-crimson mb-2">{error}</p>
          <button onClick={publish} className="vy-btn-secondary text-xs">
            Retry
          </button>
        </div>
      )}

      <button
        onClick={publish}
        disabled={stage === "uploading" || stage === "publishing" || stage === "success" || !file}
        className="vy-btn-primary w-full"
      >
        {stage === "uploading" || stage === "publishing" ? "Posting…" : "Post Reel"}
      </button>
    </div>
  );
}
