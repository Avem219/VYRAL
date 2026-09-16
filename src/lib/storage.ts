import { randomUUID } from "crypto";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";

/**
 * VYRAL media storage abstraction.
 *
 * In production, swap `getStorageProvider()` to return an S3/R2/Supabase
 * implementation of this interface — nothing else in the app should know
 * or care where bytes physically live. The local-disk provider below is
 * for development only: it is NOT suitable for production (no CDN, no
 * durability guarantees across deploys, and files sit next to the app).
 *
 * Access control lives above this layer (see src/app/api/media/[id]/route.ts):
 * this module only stores/serves bytes by key, it doesn't know about
 * ownership or privacy.
 */
export interface StorageProvider {
  /** Persist a buffer, return the storage key to save on the media row. */
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  /** Read a stored object back out. */
  get(key: string): Promise<Buffer | null>;
  /** Remove a stored object (used on deletion / orphan cleanup). */
  delete(key: string): Promise<void>;
  /**
   * True if this provider can hand back its own signed, access-controlled
   * URL (e.g. S3/R2 pre-signed URLs). The local dev provider returns false
   * — for local storage, access control instead happens in our own
   * /api/media/[id] route, which checks ownership/privacy before streaming
   * bytes back.
   */
  canSign: boolean;
  /** Only meaningful when canSign is true. */
  signedUrlFor?(key: string): Promise<string>;
}

const UPLOAD_ROOT = path.join(process.cwd(), ".data", "media");

class LocalDiskProvider implements StorageProvider {
  canSign = false;

  async put(key: string, data: Buffer) {
    const filePath = path.join(UPLOAD_ROOT, key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, data);
  }

  async get(key: string) {
    try {
      return await fs.readFile(path.join(UPLOAD_ROOT, key));
    } catch {
      return null;
    }
  }

  async delete(key: string) {
    await fs.rm(path.join(UPLOAD_ROOT, key), { force: true });
  }
}



class SupabaseStorageProvider implements StorageProvider {
  canSign = false;
  constructor(private base: string, private serviceKey: string, private bucket: string) {}
  private url(key: string) { return `${this.base.replace(/\/$/, "")}/storage/v1/object/${encodeURIComponent(this.bucket)}/${key.split("/").map(encodeURIComponent).join("/")}`; }
  private headers(contentType?: string) { return { Authorization: `Bearer ${this.serviceKey}`, apikey: this.serviceKey, ...(contentType ? { "Content-Type": contentType } : {}) }; }
  async put(key: string, data: Buffer, contentType: string) { const r = await fetch(this.url(key), { method: "POST", headers: { ...this.headers(contentType), "x-upsert": "true" }, body: new Uint8Array(data), cache: "no-store" }); if (!r.ok) throw new Error(`Supabase upload failed: ${r.status}`); }
  async get(key: string) { const r = await fetch(this.url(key), { headers: this.headers(), cache: "no-store" }); if (r.status === 404) return null; if (!r.ok) throw new Error(`Supabase download failed: ${r.status}`); return Buffer.from(await r.arrayBuffer()); }
  async delete(key: string) { const r = await fetch(`${this.base.replace(/\/$/, "")}/storage/v1/object/remove/${encodeURIComponent(this.bucket)}`, { method: "POST", headers: { ...this.headers("application/json"), "Content-Type": "application/json" }, body: JSON.stringify({ prefixes: [key] }), cache: "no-store" }); if (!r.ok && r.status !== 404) throw new Error(`Supabase delete failed: ${r.status}`); }
}

class S3CompatibleProvider implements StorageProvider {
  canSign = true;
  constructor(private readonly cfg: { endpoint: string; region: string; bucket: string; accessKey: string; secretKey: string; publicBase?: string }) {}

  private hostAndPath(key: string) {
    const encodedKey = key.split("/").map(encodeURIComponent).join("/");
    const base = new URL(this.cfg.endpoint.replace(/\/$/, ""));
    const host = base.host;
    const pathName = `${base.pathname.replace(/\/$/, "")}/${encodeURIComponent(this.cfg.bucket)}/${encodedKey}`;
    return { base, host, pathName };
  }
  private hmac(key: crypto.BinaryLike, data: string) { return crypto.createHmac("sha256", key).update(data).digest(); }
  private signingKey(date: string) {
    const kDate = this.hmac(`AWS4${this.cfg.secretKey}`, date);
    const kRegion = this.hmac(kDate, this.cfg.region);
    const kService = this.hmac(kRegion, "s3");
    return this.hmac(kService, "aws4_request");
  }
  private async request(method: string, key: string, body?: Buffer, contentType?: string, query = "") {
    const { host, pathName } = this.hostAndPath(key);
    const now = new Date();
    const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    const date = amzDate.slice(0, 8);
    const payloadHash = crypto.createHash("sha256").update(body ?? Buffer.alloc(0)).digest("hex");
    const headers: Record<string,string> = { host, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate };
    if (contentType) headers["content-type"] = contentType;
    const canonicalHeaders = Object.keys(headers).sort().map(k => `${k}:${headers[k].trim()}\n`).join("");
    const signedHeaders = Object.keys(headers).sort().join(";");
    const canonicalRequest = [method, pathName, query, canonicalHeaders, signedHeaders, payloadHash].join("\n");
    const credentialScope = `${date}/${this.cfg.region}/s3/aws4_request`;
    const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, crypto.createHash("sha256").update(canonicalRequest).digest("hex")].join("\n");
    const signature = crypto.createHmac("sha256", this.signingKey(date)).update(stringToSign).digest("hex");
    const authorization = `AWS4-HMAC-SHA256 Credential=${this.cfg.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    const url = `${this.cfg.endpoint.replace(/\/$/, "")}${pathName}${query ? `?${query}` : ""}`;
    return fetch(url, { method, headers: { ...headers, Authorization: authorization }, body: body ? new Uint8Array(body) : undefined, cache: "no-store" });
  }
  async put(key: string, data: Buffer, contentType: string) { const r = await this.request("PUT", key, data, contentType); if (!r.ok) throw new Error(`S3 PUT failed: ${r.status}`); }
  async get(key: string) { const r = await this.request("GET", key); if (r.status === 404) return null; if (!r.ok) throw new Error(`S3 GET failed: ${r.status}`); return Buffer.from(await r.arrayBuffer()); }
  async delete(key: string) { const r = await this.request("DELETE", key); if (!r.ok && r.status !== 404) throw new Error(`S3 DELETE failed: ${r.status}`); }
  async signedUrlFor(key: string) {
    const { pathName } = this.hostAndPath(key);
    const now = new Date();
    const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    const date = amzDate.slice(0, 8);
    const credentialScope = `${date}/${this.cfg.region}/s3/aws4_request`;
    const params = new URLSearchParams({ "X-Amz-Algorithm": "AWS4-HMAC-SHA256", "X-Amz-Credential": `${this.cfg.accessKey}/${credentialScope}`, "X-Amz-Date": amzDate, "X-Amz-Expires": "900", "X-Amz-SignedHeaders": "host" });
    const canonicalQuery = [...params.entries()].sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
    const canonicalHeaders = `host:${new URL(this.cfg.endpoint).host}\n`;
    const canonicalRequest = ["GET", pathName, canonicalQuery, canonicalHeaders, "host", "UNSIGNED-PAYLOAD"].join("\n");
    const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, crypto.createHash("sha256").update(canonicalRequest).digest("hex")].join("\n");
    const signature = crypto.createHmac("sha256", this.signingKey(date)).update(stringToSign).digest("hex");
    params.set("X-Amz-Signature", signature);
    return `${this.cfg.endpoint.replace(/\/$/, "")}${pathName}?${params.toString()}`;
  }
}

let provider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (provider) return provider;
  const kind = process.env.STORAGE_PROVIDER ?? (process.env.NODE_ENV === "production" ? "" : "local");
  switch (kind) {
    case "local":
      if (process.env.NODE_ENV === "production") {
        throw new Error("Local media storage is development-only. Configure STORAGE_PROVIDER=s3, r2, or supabase in production.");
      }
      provider = new LocalDiskProvider();
      break;
    case "s3":
    case "r2": {
      const region = process.env.S3_REGION || "auto";
      const endpoint = process.env.S3_ENDPOINT || (kind === "r2" && process.env.R2_ACCOUNT_ID ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : `https://s3.${region}.amazonaws.com`);
      const bucket = process.env.S3_BUCKET || process.env.R2_BUCKET;
      const accessKey = process.env.S3_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID;
      const secretKey = process.env.S3_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY;
      if (!bucket || !accessKey || !secretKey) throw new Error("S3/R2 storage requires bucket, access key, and secret key");
      provider = new S3CompatibleProvider({ endpoint, bucket, accessKey, secretKey, region });
      break;
    }
    case "supabase": {
      const base = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const bucket = process.env.SUPABASE_STORAGE_BUCKET;
      if (!base || !key || !bucket) throw new Error("Supabase storage requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_STORAGE_BUCKET");
      provider = new SupabaseStorageProvider(base, key, bucket);
      break;
    }
    default:
      throw new Error(
        `Unknown STORAGE_PROVIDER "${kind}". Implement it in src/lib/storage.ts, or set STORAGE_PROVIDER=local for development.`
      );
  }
  return provider;
}

/**
 * The single place that turns a media DB row into a URL the client can
 * load. Every consumer (feed, profile, stories, reels, express, messages)
 * should call this rather than reading media.storageKey directly.
 */
export async function getMediaUrl(mediaRow: { id: string; storageKey: string }): Promise<string> {
  // Keep the application media endpoint as the public URL surface. It performs
  // audience/ownership authorization on every request, which prevents a
  // signed object-storage URL from becoming a bypass around Express, Close
  // Circle, Story, Reel, post, or message privacy. Providers may still use
  // their own signing internally when a future streaming path is introduced.
  return `/api/media/${mediaRow.id}`;
}

export function newStorageKey(ownerId: string, originalName: string) {
  const rawExt = path.extname(originalName).slice(0, 10).toLowerCase();
  // Only ever emit a plain ".word" extension — strips path separators,
  // traversal sequences, or anything else smuggled into a client-supplied
  // filename. ownerId is always our own UUID, never client-supplied text.
  const safeExt = /^\.[a-z0-9]{1,9}$/.test(rawExt) ? rawExt : "";
  return `${ownerId}/${randomUUID()}${safeExt}`;
}

export const ALLOWED_MIME_PREFIXES = ["image/", "video/", "audio/"];
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 100MB

export function kindForMime(mime: string): "image" | "video" | "audio" | null {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return null;
}

/**
 * Sniffs the actual file signature rather than trusting the client-supplied
 * Content-Type/extension. Deliberately small and conservative — extend as
 * new formats are supported. Returns null if the bytes don't match any
 * known signature for the claimed kind.
 */
export function sniffMime(buffer: Buffer, claimedMime: string): string | null {
  const sig = buffer.subarray(0, 12);
  const isJpeg = sig[0] === 0xff && sig[1] === 0xd8;
  const isPng = sig[0] === 0x89 && sig[1] === 0x50 && sig[2] === 0x4e && sig[3] === 0x47;
  const isGif = sig.toString("ascii", 0, 3) === "GIF";
  const isWebp = sig.toString("ascii", 0, 4) === "RIFF" && sig.toString("ascii", 8, 12) === "WEBP";
  const isMp4 = sig.toString("ascii", 4, 8) === "ftyp";
  const isWebm = sig[0] === 0x1a && sig[1] === 0x45 && sig[2] === 0xdf && sig[3] === 0xa3;
  const isMp3 = sig.toString("ascii", 0, 3) === "ID3" || (sig[0] === 0xff && (sig[1] & 0xe0) === 0xe0);
  const isWav = sig.toString("ascii", 0, 4) === "RIFF" && sig.toString("ascii", 8, 12) === "WAVE";
  const isOgg = sig.toString("ascii", 0, 4) === "OggS";

  const detected =
    (isJpeg && "image/jpeg") ||
    (isPng && "image/png") ||
    (isGif && "image/gif") ||
    (isWebp && "image/webp") ||
    (isMp4 && "video/mp4") ||
    (isWebm && "video/webm") ||
    (isOgg && "audio/ogg") ||
    (isWav && "audio/wav") ||
    (isMp3 && "audio/mpeg") ||
    null;

  if (!detected) return null;
  // The broad kind (image/video/audio) must match what was claimed, even if
  // the exact subtype differs (e.g. claimed "image/jpg" vs sniffed "image/jpeg").
  if (kindForMime(detected) !== kindForMime(claimedMime)) return null;
  return detected;
}
