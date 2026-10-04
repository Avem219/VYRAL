import { randomUUID } from "crypto";
import path from "path";
import fs from "fs/promises";

export type StorageRangeResult = {
  data: Buffer;
  status: 206 | 200;
  contentLength: number;
  contentRange?: string;
  totalSize?: number;
};

export interface StorageProvider {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  getRange(key: string, rangeHeader: string): Promise<StorageRangeResult | null>;
  delete(key: string): Promise<void>;
  canSign: boolean;
  signedUrlFor?(key: string): Promise<string>;
}

const UPLOAD_ROOT = path.join(process.cwd(), ".data", "media");

function parseRangeHeader(header: string, total: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
  if (!match || total <= 0) return null;
  let start = match[1] ? Number(match[1]) : NaN;
  let end = match[2] ? Number(match[2]) : NaN;
  if (Number.isNaN(start)) {
    const suffix = Number(match[2]);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    start = Math.max(total - suffix, 0);
    end = total - 1;
  } else {
    if (start >= total) return null;
    end = Number.isNaN(end) ? total - 1 : Math.min(end, total - 1);
    if (end < start) return null;
  }
  return { start, end };
}

class LocalDiskProvider implements StorageProvider {
  canSign = false;
  async put(key: string, data: Buffer) { const filePath = path.join(UPLOAD_ROOT, key); await fs.mkdir(path.dirname(filePath), { recursive: true }); await fs.writeFile(filePath, data); }
  async get(key: string) { try { return await fs.readFile(path.join(UPLOAD_ROOT, key)); } catch { return null; } }
  async getRange(key: string, rangeHeader: string) {
    try {
      const filePath = path.join(UPLOAD_ROOT, key);
      const stat = await fs.stat(filePath);
      const range = parseRangeHeader(rangeHeader, stat.size);
      if (!range) return null;
      const handle = await fs.open(filePath, "r");
      try { const data = Buffer.alloc(range.end - range.start + 1); await handle.read(data, 0, data.length, range.start); return { data, status: 206 as const, contentLength: data.length, contentRange: `bytes ${range.start}-${range.end}/${stat.size}`, totalSize: stat.size }; }
      finally { await handle.close(); }
    } catch { return null; }
  }
  async delete(key: string) { await fs.rm(path.join(UPLOAD_ROOT, key), { force: true }); }
}

class SupabaseStorageProvider implements StorageProvider {
  canSign = false;
  constructor(private readonly baseUrl: string, private readonly serviceKey: string, private readonly bucket: string) {}
  private objectUrl(key: string) { return `${this.baseUrl.replace(/\/$/, "")}/storage/v1/object/${encodeURIComponent(this.bucket)}/${key.split("/").map(encodeURIComponent).join("/")}`; }
  private headers(extra: Record<string, string> = {}) { return { Authorization: `Bearer ${this.serviceKey}`, apikey: this.serviceKey, ...extra }; }
  async put(key: string, data: Buffer, contentType: string) {
    const response = await fetch(this.objectUrl(key), { method: "POST", headers: this.headers({ "Content-Type": contentType, "x-upsert": "false" }), body: new Uint8Array(data) });
    if (!response.ok) throw new Error(`Supabase storage upload failed (${response.status}): ${await response.text().catch(() => "")}`);
  }
  async get(key: string) {
    const response = await fetch(this.objectUrl(key), { headers: this.headers(), cache: "no-store" });
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  }
  async getRange(key: string, rangeHeader: string) {
    const response = await fetch(this.objectUrl(key), { headers: this.headers({ Range: rangeHeader }), cache: "no-store" });
    if (response.status !== 206 && response.ok) {
      const full = Buffer.from(await response.arrayBuffer());
      const range = parseRangeHeader(rangeHeader, full.length);
      if (!range) return null;
      const data = full.subarray(range.start, range.end + 1);
      return { data, status: 206 as const, contentLength: data.length, contentRange: `bytes ${range.start}-${range.end}/${full.length}`, totalSize: full.length };
    }
    if (!response.ok) return null;
    const data = Buffer.from(await response.arrayBuffer());
    const contentRange = response.headers.get("content-range") ?? undefined;
    const totalMatch = contentRange?.match(/\/(\d+)$/);
    return { data, status: 206 as const, contentLength: data.length, contentRange, totalSize: totalMatch ? Number(totalMatch[1]) : undefined };
  }
  async delete(key: string) {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/storage/v1/object/${encodeURIComponent(this.bucket)}/${key.split("/").map(encodeURIComponent).join("/")}`, { method: "DELETE", headers: this.headers() });
    if (!response.ok && response.status !== 404) throw new Error(`Supabase storage delete failed (${response.status})`);
  }
}

let provider: StorageProvider | null = null;
export function getStorageProvider(): StorageProvider {
  if (provider) return provider;
  switch (process.env.STORAGE_PROVIDER ?? "local") {
    case "local": provider = new LocalDiskProvider(); break;
    case "supabase":
      if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.SUPABASE_STORAGE_BUCKET) throw new Error("Supabase storage is not fully configured");
      provider = new SupabaseStorageProvider(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.SUPABASE_STORAGE_BUCKET); break;
    default: throw new Error(`Unsupported STORAGE_PROVIDER "${process.env.STORAGE_PROVIDER}"`);
  }
  return provider;
}

export async function getMediaUrl(mediaRow: { id: string; storageKey: string }): Promise<string> { const p = getStorageProvider(); return p.canSign && p.signedUrlFor ? p.signedUrlFor(mediaRow.storageKey) : `/api/media/${mediaRow.id}`; }
export function newStorageKey(ownerId: string, originalName: string) { const ext = path.extname(originalName).slice(0, 10).toLowerCase(); const safeExt = /^\.[a-z0-9]{1,9}$/.test(ext) ? ext : ""; return `${ownerId}/${randomUUID()}${safeExt}`; }
export const ALLOWED_MIME_PREFIXES = ["image/", "video/", "audio/"];
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export function kindForMime(mime: string): "image" | "video" | "audio" | null { if (mime.startsWith("image/")) return "image"; if (mime.startsWith("video/")) return "video"; if (mime.startsWith("audio/")) return "audio"; return null; }
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
  const detected = (isJpeg && "image/jpeg") || (isPng && "image/png") || (isGif && "image/gif") || (isWebp && "image/webp") || (isMp4 && "video/mp4") || (isWebm && "video/webm") || (isOgg && "audio/ogg") || (isWav && "audio/wav") || (isMp3 && "audio/mpeg") || null;
  if (!detected) return null;
  const claimedKind = kindForMime(claimedMime);
  if (claimedKind === "audio" && detected === "video/webm") return "audio/webm";
  if (claimedKind === "audio" && detected === "video/mp4") return "audio/mp4";
  return kindForMime(detected) === claimedKind ? detected : null;
}
