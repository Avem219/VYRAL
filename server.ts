import { createServer } from "http";
import next from "next";
import { Server } from "socket.io";
import { parseCookie } from "cookie";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev });
const handle = app.getRequestHandler();
let redisPub: { quit: () => Promise<unknown> } | null = null;
let redisSub: { quit: () => Promise<unknown> } | null = null;

async function main() {
  await app.prepare();

  // Deferred imports: these touch src/db (Postgres via node-postgres), which
  // must load after Next has initialized module resolution for the custom server.
  const { getUserForSessionToken, SESSION_COOKIE } = await import("./src/lib/auth");
  const { setIo } = await import("./src/lib/realtime");
  const { assertMember, setPresence, sendMessage, markRead, addMessageReaction, removeMessageReaction, addGroupMember, removeGroupMember } = await import(
    "./src/lib/messaging"
  );

  const httpServer = createServer((req, res) => handle(req, res));
  const io = new Server(httpServer, { path: "/api/socket", transports: ["websocket", "polling"] });

  // Horizontal scaling: when REDIS_URL is configured, install the official
  // Socket.IO Redis adapter. Dynamic loading keeps local/single-instance
  // development working without Redis. Production multi-instance deploys
  // should provide the two declared Redis packages and REDIS_URL.
  if (process.env.REDIS_URL) {
    try {
      const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<any>;
      const [{ createAdapter }, { default: Redis }] = await Promise.all([
        dynamicImport("@socket.io/redis-adapter"),
        dynamicImport("ioredis"),
      ]);
      const pubClient = new Redis(process.env.REDIS_URL, { lazyConnect: true });
      const subClient = pubClient.duplicate();
      redisPub = pubClient;
      redisSub = subClient;
      pubClient.on("error", (e: Error) => console.error("Redis pub client error", e.message));
      subClient.on("error", (e: Error) => console.error("Redis sub client error", e.message));
      await Promise.all([pubClient.connect(), subClient.connect()]);
      io.adapter(createAdapter(pubClient, subClient));
      console.log("> VYRAL realtime: Redis adapter enabled");
    } catch (e) {
      console.error("REDIS_URL is set but Redis realtime scaling could not initialize", e instanceof Error ? e.message : e);
      process.exit(1);
    }
  }
  setIo(io);

  io.use(async (socket, next_) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie;
      const token = cookieHeader ? parseCookie(cookieHeader)[SESSION_COOKIE] : undefined;
      if (!token) return next_(new Error("Unauthorized"));

      const user = await getUserForSessionToken(token);
      if (!user) return next_(new Error("Unauthorized"));

      socket.data.userId = user.id;
      next_();
    } catch {
      next_(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const userId: string = socket.data.userId;

    // Every connected user gets a personal room for cross-conversation
    // pushes (new-message notifications, Express arrival, etc.) — this
    // room is keyed by the *authenticated* user id from the handshake,
    // never anything the client can supply.
    socket.join(`user:${userId}`);
    setPresence(userId, "online").catch(() => {});
    io.emit("presence:update", { userId, status: "online" });

    socket.on("conversation:join", async (conversationId: string, ack?: (ok: boolean) => void) => {
      try {
        await assertMember(conversationId, userId);
        socket.join(`conversation:${conversationId}`);
        ack?.(true);
      } catch {
        ack?.(false);
      }
    });

    socket.on("conversation:leave", (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
    });

    socket.on(
      "message:send",
      async (
        payload: { conversationId: string; kind?: string; body?: string; mediaId?: string; replyToId?: string },
        ack?: (result: { ok: boolean; error?: string; message?: unknown }) => void
      ) => {
        try {
          const message = await sendMessage({
            conversationId: payload.conversationId,
            senderId: userId,
            kind: (payload.kind as "text") ?? "text",
            body: payload.body,
            mediaId: payload.mediaId,
            replyToId: payload.replyToId,
          });
          ack?.({ ok: true, message });
        } catch (e) {
          ack?.({ ok: false, error: e instanceof Error ? e.message : "Failed to send" });
        }
      }
    );

    socket.on(
      "message:react",
      async (payload: { messageId: string; emoji: string }, ack?: (ok: boolean) => void) => {
        try {
          await addMessageReaction(payload.messageId, userId, payload.emoji);
          ack?.(true);
        } catch {
          ack?.(false);
        }
      }
    );

    socket.on(
      "message:unreact",
      async (payload: { messageId: string; emoji: string }, ack?: (ok: boolean) => void) => {
        try {
          await removeMessageReaction(payload.messageId, userId, payload.emoji);
          ack?.(true);
        } catch {
          ack?.(false);
        }
      }
    );

    socket.on(
      "group:add_member",
      async (payload: { conversationId: string; memberId: string }, ack?: (result: { ok: boolean; error?: string }) => void) => {
        try {
          await addGroupMember(payload.conversationId, userId, payload.memberId);
          ack?.({ ok: true });
        } catch (e) {
          ack?.({ ok: false, error: e instanceof Error ? e.message : "Failed" });
        }
      }
    );

    socket.on(
      "group:remove_member",
      async (payload: { conversationId: string; memberId: string }, ack?: (result: { ok: boolean; error?: string }) => void) => {
        try {
          await removeGroupMember(payload.conversationId, userId, payload.memberId);
          ack?.({ ok: true });
        } catch (e) {
          ack?.({ ok: false, error: e instanceof Error ? e.message : "Failed" });
        }
      }
    );

    socket.on("message:read", async (conversationId: string) => {
      try {
        await assertMember(conversationId, userId);
        await markRead(conversationId, userId);
      } catch {
        // swallow — unauthorized read-marks are simply ignored, not surfaced
      }
    });

    socket.on("typing:start", async (conversationId: string) => {
      try {
        await assertMember(conversationId, userId);
        socket.to(`conversation:${conversationId}`).emit("typing:update", { conversationId, userId, typing: true });
      } catch {
        // not a member — ignore silently, don't leak membership info
      }
    });

    socket.on("typing:stop", async (conversationId: string) => {
      try {
        await assertMember(conversationId, userId);
        socket.to(`conversation:${conversationId}`).emit("typing:update", { conversationId, userId, typing: false });
      } catch {
        // ignore
      }
    });

    socket.on("disconnect", async () => {
      const remaining = await io.in(`user:${userId}`).fetchSockets();
      if (remaining.length === 0) {
        await setPresence(userId, "offline").catch(() => {});
        io.emit("presence:update", { userId, status: "offline" });
      }
    });
  });

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    io.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    await Promise.allSettled([redisPub?.quit(), redisSub?.quit()]);
    process.exit(0);
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);

  httpServer.listen(port, () => {
    console.log(`> VYRAL ready on http://localhost:${port} (Socket.IO on /api/socket)`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
