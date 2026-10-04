"use client";

import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

/** One socket per browser tab, connected lazily on first use, authenticated via the existing session cookie (no token handling needed client-side). */
export function getSocket(): Socket {
  if (!socket) {
    socket = io({ path: "/api/socket", withCredentials: true });
  }
  return socket;
}
