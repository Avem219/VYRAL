"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

type Circle = { id: string; name: string };

export function StoryComposer({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [kind, setKind] = useState<"text" | "photo" | "video">("text");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [audience, setAudience] = useState<"everyone" | "connections" | "circle">("everyone");
  const [circles, setCircles] = useState<Circle[] | null>(null);
  const [circleId, setCircleId] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (audience === "circle" && circles === null) {
      fetch("/api/circles")
        .then((r) => r.json())
        .then((d) => setCircles(d.items ?? []));
    }
  }, [audience, circles]);

  function pickFile(selected: File) {
    setFile(selected);
    setKind(selected.type.startsWith("video/") ? "video" : "photo");
    setPreviewUrl(URL.createObjectURL(selected));
  }

  async function submit() {
    setError(null);
    if (kind === "text" && !body.trim()) {
      setError("Write something first.");
      return;
    }
    if (kind !== "text" && !file) {
      setError("Choose a photo or video first.");
      return;
    }
    if (audience === "circle" && !circleId) {
      setError("Choose a circle.");
      return;
    }

    setUploading(true);
    try {
      let mediaId: string | undefined;
      if (file) {
        const form = new FormData();
        form.append("file", file);
        const uploadRes = await fetch("/api/media", { method: "POST", body: form });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) {
          setError(uploadData.error ?? "Upload failed");
          return;
        }
        mediaId = uploadData.media.id;
      }

      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          mediaId,
          body: body || undefined,
          audience,
          circleId: audience === "circle" ? circleId : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't post your story");
        return;
      }
      onCreated();
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-void/95 z-50 flex items-center justify-center px-4">
      <div className="vy-panel vy-chamfer p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">New story</h2>
          <button onClick={onClose} aria-label="Close" className="text-steel hover:text-offwhite">
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-1 mb-4">
          {(["text", "photo", "video"] as const).map((k) => (
            <button
              key={k}
              onClick={() => {
                setKind(k);
                if (k === "text") {
                  setFile(null);
                  setPreviewUrl(null);
                } else {
                  fileInputRef.current?.click();
                }
              }}
              className={`flex-1 text-xs py-2 capitalize border ${
                kind === k ? "border-crimson text-offwhite" : "border-charcoal text-steel"
              }`}
            >
              {k}
            </button>
          ))}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && pickFile(e.target.files[0])}
        />

        {kind === "text" ? (
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Say something…"
            rows={4}
            maxLength={500}
            className="vy-input resize-none mb-4"
            autoFocus
          />
        ) : previewUrl ? (
          <div className="mb-4 aspect-[9/16] max-h-64 bg-obsidian overflow-hidden flex items-center justify-center">
            {kind === "photo" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Story preview" className="max-h-full max-w-full object-contain" />
            ) : (
              <video src={previewUrl} className="max-h-full max-w-full object-contain" controls />
            )}
          </div>
        ) : (
          <button onClick={() => fileInputRef.current?.click()} className="vy-btn-secondary w-full mb-4">
            Choose {kind}
          </button>
        )}

        <label className="block mb-4">
          <span className="block text-xs text-steel mb-1.5">Who can see this</span>
          <select value={audience} onChange={(e) => setAudience(e.target.value as typeof audience)} className="vy-input">
            <option value="everyone">Everyone</option>
            <option value="connections">Connections</option>
            <option value="circle">A Close Circle</option>
          </select>
        </label>

        {audience === "circle" && (
          <label className="block mb-4">
            <span className="block text-xs text-steel mb-1.5">Which circle</span>
            {circles === null ? (
              <p className="text-xs text-steel">Loading circles…</p>
            ) : circles.length === 0 ? (
              <p className="text-xs text-steel">
                You don&apos;t have any circles yet — create one from the Circles page first.
              </p>
            ) : (
              <select value={circleId} onChange={(e) => setCircleId(e.target.value)} className="vy-input">
                <option value="">Select…</option>
                {circles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </label>
        )}

        {error && <p className="text-sm text-crimson mb-3">{error}</p>}

        <button onClick={submit} disabled={uploading} className="vy-btn-primary w-full">
          {uploading ? "Posting…" : "Share to story"}
        </button>
      </div>
    </div>
  );
}
