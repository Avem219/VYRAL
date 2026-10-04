import { createServer } from "http";
import next from "next";
import { Server } from "socket.io";
import { parseCookie } from "cookie";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT) || 3000;
const hostname = "0.0.0.0";

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

async function main() {
  await app.prepare();

  const { getUserForSessionToken, SESSION_COOKIE } = await import("./src/lib/auth");
  const { setIo } = await import("./src/lib/realtime");
  const {
    assertMember,
    setPresence,
    sendMessage,
    markRead,
    addMessageReaction,
    removeMessageReaction,
    addGroupMember,
    removeGroupMember,
  } = await import("./src/lib/messaging");

  const httpServer = createServer((req, res) => handle(req, res));

  const io = new Server(httpServer, {
    path: "/api/socket",
  });

  setIo(io);

  io.use(async (socket, next_) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie;
      const token = cookieHeader
        ? parseCookie(cookieHeader)[SESSION_COOKIE]
        : undefined;

      if (!token) {
        return next_(new Error("Unauthorized"));
      }

      const user = await getUserForSessionToken(token);

      if (!user) {
        return next_(new Error("Unauthorized"));
      }

      socket.data.userId = user.id;
      next_();
    } catch {
      next_(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const userId: string = socket.data.userId;

    socket.join(`user:${userId}`);

    setPresence(userId, "online").catch(() => {});

    io.emit("presence:update", {
      userId,
      status: "online",
    });

    socket.on(
      "conversation:join",
      async (
        conversationId: string,
        ack?: (ok: boolean) => void
      ) => {
        try {
          await assertMember(conversationId, userId);
          socket.join(`conversation:${conversationId}`);
          ack?.(true);
        } catch {
          ack?.(false);
        }
      }
    );

    socket.on("conversation:leave", (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
    });

    socket.on(
      "message:send",
      async (
        payload: {
          conversationId: string;
          kind?: string;
          body?: string;
          mediaId?: string;
          replyToId?: string;
        },
        ack?: (result: {
          ok: boolean;
          error?: string;
          message?: unknown;
        }) => void
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

          ack?.({
            ok: true,
            message,
          });
        } catch (e) {
          ack?.({
            ok: false,
            error: e instanceof Error ? e.message : "Failed to send",
          });
        }
      }
    );

    socket.on(
      "message:react",
      async (
        payload: {
          messageId: string;
          emoji: string;
        },
        ack?: (ok: boolean) => void
      ) => {
        try {
          await addMessageReaction(
            payload.messageId,
            userId,
            payload.emoji
          );

          ack?.(true);
        } catch {
          ack?.(false);
        }
      }
    );

    socket.on(
      "message:unreact",
      async (
        payload: {
          messageId: string;
          emoji: string;
        },
        ack?: (ok: boolean) => void
      ) => {
        try {
          await removeMessageReaction(
            payload.messageId,
            userId,
            payload.emoji
          );

          ack?.(true);
        } catch {
          ack?.(false);
        }
      }
    );

    socket.on(
      "group:add_member",
      async (
        payload: {
          conversationId: string;
          memberId: string;
        },
        ack?: (result: {
          ok: boolean;
          error?: string;
        }) => void
      ) => {
        try {
          await addGroupMember(
            payload.conversationId,
            userId,
            payload.memberId
          );

          ack?.({ ok: true });
        } catch (e) {
          ack?.({
            ok: false,
            error: e instanceof Error ? e.message : "Failed",
          });
        }
      }
    );

    socket.on(
      "group:remove_member",
      async (
        payload: {
          conversationId: string;
          memberId: string;
        },
        ack?: (result: {
          ok: boolean;
          error?: string;
        }) => void
      ) => {
        try {
          await removeGroupMember(
            payload.conversationId,
            userId,
            payload.memberId
          );

          ack?.({ ok: true });
        } catch (e) {
          ack?.({
            ok: false,
            error: e instanceof Error ? e.message : "Failed",
          });
        }
      }
    );

    socket.on("message:read", async (conversationId: string) => {
      try {
        await assertMember(conversationId, userId);
        await markRead(conversationId, userId);
      } catch {
        // Ignore unauthorized read marks.
      }
    });

    socket.on("typing:start", async (conversationId: string) => {
      try {
        await assertMember(conversationId, userId);

        socket
          .to(`conversation:${conversationId}`)
          .emit("typing:update", {
            conversationId,
            userId,
            typing: true,
          });
      } catch {
        // Ignore unauthorized typing events.
      }
    });

    socket.on("typing:stop", async (conversationId: string) => {
      try {
        await assertMember(conversationId, userId);

        socket
          .to(`conversation:${conversationId}`)
          .emit("typing:update", {
            conversationId,
            userId,
            typing: false,
          });
      } catch {
        // Ignore unauthorized typing events.
      }
    });

    socket.on("disconnect", async () => {
      const remaining = await io
        .in(`user:${userId}`)
        .fetchSockets();

      if (remaining.length === 0) {
        await setPresence(userId, "offline").catch(() => {});

        io.emit("presence:update", {
          userId,
          status: "offline",
        });
      }
    });
  });

  httpServer.listen(port, hostname, () => {
    console.log(
      `> VYRAL ready on http://${hostname}:${port} (Socket.IO on /api/socket)`
    );
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
