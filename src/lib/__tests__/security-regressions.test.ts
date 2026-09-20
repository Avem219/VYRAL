import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { createIsolatedTestDatabase } from "./pg-test-db";

let dropTestDb: () => Promise<void>;

describe("Security regressions", () => {
  let db: typeof import("../../db").db;
  let schema: typeof import("../../db").schema;
  let messaging: typeof import("../messaging");
  let posts: typeof import("../posts");
  let reels: typeof import("../reels");

  before(async () => {
    dropTestDb = await createIsolatedTestDatabase();
    ({ db, schema } = await import("../../db"));
    messaging = await import("../messaging");
    posts = await import("../posts");
    reels = await import("../reels");
  });

  after(async () => {
    const { pool } = await import("../../db");
    await pool.end();
    await dropTestDb();
  });

  async function makeUser(username: string) {
    const [user] = await db.insert(schema.users).values({ email: `${username}@test.local`, username, passwordHash: "x" }).returning();
    return user;
  }

  describe("messaging authorization (IDOR)", () => {
    test("a non-member cannot read messages by guessing/knowing the conversation ID", async () => {
      const a = await makeUser("msg_a_" + Date.now());
      const b = await makeUser("msg_b_" + Date.now());
      const stranger = await makeUser("msg_stranger_" + Date.now());

      const conversation = await messaging.getOrCreateDirectConversation(a.id, b.id);
      await messaging.sendMessage({ conversationId: conversation.id, senderId: a.id, kind: "text", body: "secret" });

      await assert.rejects(
        () => messaging.getMessages(conversation.id, stranger.id),
        messaging.MessagingAuthError
      );
    });

    test("a non-member cannot send a message into a conversation they don't belong to", async () => {
      const a = await makeUser("msg2_a_" + Date.now());
      const b = await makeUser("msg2_b_" + Date.now());
      const stranger = await makeUser("msg2_stranger_" + Date.now());
      const conversation = await messaging.getOrCreateDirectConversation(a.id, b.id);

      await assert.rejects(
        () => messaging.sendMessage({ conversationId: conversation.id, senderId: stranger.id, kind: "text", body: "injected" }),
        messaging.MessagingAuthError
      );
    });

    test("a blocked user cannot start a direct conversation with the blocker", async () => {
      const a = await makeUser("msg3_a_" + Date.now());
      const b = await makeUser("msg3_b_" + Date.now());
      await db.insert(schema.blocks).values({ blockerId: b.id, blockedId: a.id });

      await assert.rejects(
        () => messaging.getOrCreateDirectConversation(a.id, b.id),
        messaging.MessagingAuthError
      );
    });
  });

  describe("group messaging authorization", () => {
    test("a non-admin member cannot add new members to a group", async () => {
      const admin = await makeUser("grp_admin_" + Date.now());
      const member = await makeUser("grp_member_" + Date.now());
      const outsider = await makeUser("grp_outsider_" + Date.now());
      const group = await messaging.createGroupConversation(admin.id, [member.id], "Test");

      await assert.rejects(
        () => messaging.addGroupMember(group.id, member.id, outsider.id),
        messaging.MessagingAuthError
      );
    });

    test("the admin CAN add members, and a member can always remove themself", async () => {
      const admin = await makeUser("grp2_admin_" + Date.now());
      const member = await makeUser("grp2_member_" + Date.now());
      const newcomer = await makeUser("grp2_newcomer_" + Date.now());
      const group = await messaging.createGroupConversation(admin.id, [member.id], "Test2");

      await messaging.addGroupMember(group.id, admin.id, newcomer.id);
      await assert.doesNotReject(() => messaging.assertMember(group.id, newcomer.id));

      await messaging.removeGroupMember(group.id, member.id, member.id);
      await assert.rejects(() => messaging.assertMember(group.id, member.id), messaging.MessagingAuthError);
    });

    test("a non-admin cannot remove a different member (only self-leave is allowed without admin rights)", async () => {
      const admin = await makeUser("grp3_admin_" + Date.now());
      const memberA = await makeUser("grp3_a_" + Date.now());
      const memberB = await makeUser("grp3_b_" + Date.now());
      const group = await messaging.createGroupConversation(admin.id, [memberA.id, memberB.id], "Test3");

      await assert.rejects(
        () => messaging.removeGroupMember(group.id, memberA.id, memberB.id),
        messaging.MessagingAuthError
      );
    });
  });

  describe("comment authorization respects post audience", () => {
    test("a stranger cannot view canViewPost=true for a connections-only post", async () => {
      const author = await makeUser("cmt_author_" + Date.now());
      const stranger = await makeUser("cmt_stranger_" + Date.now());
      const [post] = await db.insert(schema.posts).values({ authorId: author.id, kind: "text", body: "hi", audience: "connections" }).returning();

      const allowed = await posts.canViewPost(post, stranger.id);
      assert.equal(allowed, false);
    });

    test("a connection CAN view a connections-only post", async () => {
      const author = await makeUser("cmt2_author_" + Date.now());
      const friend = await makeUser("cmt2_friend_" + Date.now());
      await db.insert(schema.connections).values({ requesterId: author.id, addresseeId: friend.id, status: "accepted" });
      const [post] = await db.insert(schema.posts).values({ authorId: author.id, kind: "text", body: "hi", audience: "connections" }).returning();

      const allowed = await posts.canViewPost(post, friend.id);
      assert.equal(allowed, true);
    });

    test("a block overrides an 'everyone' audience post", async () => {
      const author = await makeUser("cmt3_author_" + Date.now());
      const blockedViewer = await makeUser("cmt3_blocked_" + Date.now());
      await db.insert(schema.blocks).values({ blockerId: author.id, blockedId: blockedViewer.id });
      const [post] = await db.insert(schema.posts).values({ authorId: author.id, kind: "text", body: "hi", audience: "everyone" }).returning();

      const allowed = await posts.canViewPost(post, blockedViewer.id);
      assert.equal(allowed, false);
    });
  });

  describe("reel visibility", () => {
    test("a stranger cannot view a connections-only reel", async () => {
      const author = await makeUser("reel_author_" + Date.now());
      const stranger = await makeUser("reel_stranger_" + Date.now());
      const [media] = await db.insert(schema.media).values({
        ownerId: author.id,
        provider: "local",
        storageKey: "test/reel.mp4",
        mimeType: "video/mp4",
        sizeBytes: 1,
        kind: "video",
      }).returning();
      const [reel] = await db.insert(schema.reels).values({ authorId: author.id, mediaId: media.id, audience: "connections" }).returning();
      assert.equal(await reels.canViewReel(reel, stranger.id), false);
    });

    test("an accepted connection can view a connections-only reel", async () => {
      const author = await makeUser("reel2_author_" + Date.now());
      const friend = await makeUser("reel2_friend_" + Date.now());
      await db.insert(schema.connections).values({ requesterId: author.id, addresseeId: friend.id, status: "accepted" });
      const [media] = await db.insert(schema.media).values({
        ownerId: author.id,
        provider: "local",
        storageKey: "test/reel2.mp4",
        mimeType: "video/mp4",
        sizeBytes: 1,
        kind: "video",
      }).returning();
      const [reel] = await db.insert(schema.reels).values({ authorId: author.id, mediaId: media.id, audience: "connections" }).returning();
      assert.equal(await reels.canViewReel(reel, friend.id), true);
    });

    test("a block overrides an everyone reel", async () => {
      const author = await makeUser("reel3_author_" + Date.now());
      const blockedViewer = await makeUser("reel3_blocked_" + Date.now());
      await db.insert(schema.blocks).values({ blockerId: author.id, blockedId: blockedViewer.id });
      const [media] = await db.insert(schema.media).values({
        ownerId: author.id,
        provider: "local",
        storageKey: "test/reel3.mp4",
        mimeType: "video/mp4",
        sizeBytes: 1,
        kind: "video",
      }).returning();
      const [reel] = await db.insert(schema.reels).values({ authorId: author.id, mediaId: media.id, audience: "everyone" }).returning();
      assert.equal(await reels.canViewReel(reel, blockedViewer.id), false);
    });
  });

  describe("mute is distinct from block", () => {
    test("muting does not prevent the muted user from messaging or connecting", async () => {
      const muter = await makeUser("mute_a_" + Date.now());
      const muted = await makeUser("mute_b_" + Date.now());
      await db.insert(schema.mutes).values({ muterId: muter.id, mutedId: muted.id });

      // A mute should NOT throw MessagingAuthError the way a block does.
      const conversation = await messaging.getOrCreateDirectConversation(muter.id, muted.id);
      assert.ok(conversation.id);
    });

    test("a block (unlike mute) does prevent messaging", async () => {
      const blocker = await makeUser("block_a_" + Date.now());
      const blocked = await makeUser("block_b_" + Date.now());
      await db.insert(schema.blocks).values({ blockerId: blocker.id, blockedId: blocked.id });

      await assert.rejects(
        () => messaging.getOrCreateDirectConversation(blocker.id, blocked.id),
        messaging.MessagingAuthError
      );
    });
  });

  describe("CSRF Origin check", () => {
    test("rejects a state-changing request with a mismatched Origin header", async () => {
      const { checkCsrf } = await import("../csrf");
      const { NextRequest } = await import("next/server");
      const req = new NextRequest("http://localhost:3000/api/posts", {
        method: "POST",
        headers: { origin: "http://evil.com", host: "localhost:3000" },
      });
      const result = checkCsrf(req);
      assert.ok(result, "expected a rejection response");
      assert.equal(result!.status, 403);
    });

    test("allows a state-changing request whose Origin matches the Host", async () => {
      const { checkCsrf } = await import("../csrf");
      const { NextRequest } = await import("next/server");
      const req = new NextRequest("http://localhost:3000/api/posts", {
        method: "POST",
        headers: { origin: "http://localhost:3000", host: "localhost:3000" },
      });
      assert.equal(checkCsrf(req), null);
    });

    test("does not touch safe methods like GET regardless of Origin", async () => {
      const { checkCsrf } = await import("../csrf");
      const { NextRequest } = await import("next/server");
      const req = new NextRequest("http://localhost:3000/api/feed", {
        method: "GET",
        headers: { origin: "http://evil.com", host: "localhost:3000" },
      });
      assert.equal(checkCsrf(req), null);
    });
  });
});
