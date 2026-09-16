```ts
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/require-auth";
import {
  getStorageProvider,
  getMediaUrl,
  newStorageKey,
  sniffMime,
  kindForMime,
  MAX_UPLOAD_BYTES,
} from "@/lib/storage";
import { rateLimit } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { user, res } = await requireUser();
  if (!user) return res;

  const { allowed } = rateLimit(`upload:${user.id}`, 30, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many uploads. Slow down." },
      { status: 429 },
    );
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const isPrivate = form?.get("private") === "true";

  if (!file || typeof file === "string") {
    return NextResponse.json(
      { error: "No file provided" },
      { status: 400 },
    );
  }

  if (file.size === 0) {
    return NextResponse.json(
      { error: "Empty file" },
      { status: 400 },
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      {
        error: `File exceeds ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB limit`,
      },
      { status: 413 },
    );
  }

  const claimedMime = file.type || "application/octet-stream";
  const buffer = Buffer.from(await file.arrayBuffer());

  // Never trust the client-supplied MIME type or file extension.
  // Inspect the actual bytes and reject unsupported media.
  const realMime = sniffMime(buffer, claimedMime);

  if (!realMime) {
    return NextResponse.json(
      {
        error:
          "File content doesn't match an accepted media type",
      },
      { status: 415 },
    );
  }

  const kind = kindForMime(realMime);

  if (!kind) {
    return NextResponse.json(
      { error: "Unsupported media kind" },
      { status: 415 },
    );
  }

  const key = newStorageKey(
    user.id,
    file.name || "upload",
  );

  /*
   * IMPORTANT:
   * getStorageProvider() is intentionally inside this try block.
   *
   * In production, an incorrectly configured STORAGE_PROVIDER,
   * R2 configuration, or Supabase configuration can throw.
   * Previously that exception escaped the route and could produce
   * a non-JSON 500 response, causing the frontend to throw:
   *
   * "Unexpected end of JSON input"
   */
  try {
    const provider = getStorageProvider();

    const [mediaRow] = await db
      .insert(schema.media)
      .values({
        ownerId: user.id,
        provider: process.env.STORAGE_PROVIDER ?? "local",
        storageKey: key,
        mimeType: realMime,
        sizeBytes: file.size,
        kind,
        status: "pending",
        isPrivate,
      })
      .returning();

    try {
      await provider.put(key, buffer, realMime);
    } catch (error) {
      console.error("Media storage upload failed:", error);

      await db
        .update(schema.media)
        .set({ status: "failed" })
        .where(eq(schema.media.id, mediaRow.id));

      return NextResponse.json(
        { error: "Upload failed" },
        { status: 500 },
      );
    }

    const [ready] = await db
      .update(schema.media)
      .set({ status: "ready" })
      .where(eq(schema.media.id, mediaRow.id))
      .returning();

    if (!ready) {
      return NextResponse.json(
        { error: "Media could not be finalized" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      media: {
        id: ready.id,
        kind: ready.kind,
        url: await getMediaUrl(ready),
      },
    });
  } catch (error) {
    console.error("Media upload configuration/request error:", error);

    return NextResponse.json(
      {
        error: "Media upload is currently unavailable",
        message:
          process.env.NODE_ENV === "production"
            ? "Media storage is not configured correctly."
            : error instanceof Error
              ? error.message
              : "Unknown upload error",
      },
      { status: 500 },
    );
  }
}
```
