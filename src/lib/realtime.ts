import type { Server } from "socket.io";

const g = globalThis as unknown as { __vyralIo?: Server };

export function setIo(io: Server) {
  g.__vyralIo = io;
}

/** Returns null outside the custom server (e.g. during `next build`), so callers must treat real-time push as best-effort. */
export function getIo(): Server | null {
  return g.__vyralIo ?? null;
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  getIo()?.to(`user:${userId}`).emit(event, payload);
}

export function emitToConversation(conversationId: string, event: string, payload: unknown) {
  getIo()?.to(`conversation:${conversationId}`).emit(event, payload);
}

/** Forcibly disconnects every live socket for a user — used when an admin suspends an account, so the suspension takes effect immediately rather than waiting for a reconnect. */
export async function disconnectUser(userId: string) {
  const io = getIo();
  if (!io) return;
  const sockets = await io.in(`user:${userId}`).fetchSockets();
  for (const s of sockets) s.disconnect(true);
}
