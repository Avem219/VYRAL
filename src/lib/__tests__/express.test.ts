import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { createIsolatedTestDatabase } from "./pg-test-db";

let dropTestDb: () => Promise<void>;

describe("Express privacy", () => {
  let db: typeof import("../../db").db;
  let schema: typeof import("../../db").schema;
  let sendExpress: typeof import("../express").sendExpress;
  let getExpressForViewer: typeof import("../express").getExpressForViewer;
  let ExpressAuthError: typeof import("../express").ExpressAuthError;

  before(async () => {
    dropTestDb = await createIsolatedTestDatabase();
    ({ db, schema } = await import("../../db"));
    ({ sendExpress, getExpressForViewer, ExpressAuthError } = await import("../express"));
  });

  after(async () => {
    const { pool } = await import("../../db");
    await pool.end();
    await dropTestDb();
  });

  async function makeUser(username: string) {
    const [user] = await db.insert(schema.users).values({ email: `${username}@test.local`, username, passwordHash: "x" }).returning();
    await db.insert(schema.expressPermissions).values({ userId: user.id });
    return user;
  }

  test("sender cannot Express a stranger when recipient policy is connections-only (the default)", async () => {
    const alice = await makeUser("alice_" + Date.now());
    const bob = await makeUser("bob_" + Date.now());

    await assert.rejects(
      () => sendExpress({ senderId: alice.id, recipientId: bob.id, kind: "text", body: "hi" }),
      ExpressAuthError
    );
  });

  test("sender CAN Express once connected, and recipient can read it", async () => {
    const alice = await makeUser("alice2_" + Date.now());
    const bob = await makeUser("bob2_" + Date.now());

    await db.insert(schema.connections).values({ requesterId: alice.id, addresseeId: bob.id, status: "accepted" });

    const msg = await sendExpress({ senderId: alice.id, recipientId: bob.id, kind: "text", body: "secret" });
    const readByRecipient = await getExpressForViewer(msg.id, bob.id);
    assert.equal(readByRecipient?.body, "secret");
  });

  test("a third party cannot read the Express — getExpressForViewer throws for a non-participant", async () => {
    const alice = await makeUser("alice3_" + Date.now());
    const bob = await makeUser("bob3_" + Date.now());
    const mallory = await makeUser("mallory3_" + Date.now());

    await db.insert(schema.connections).values({ requesterId: alice.id, addresseeId: bob.id, status: "accepted" });
    const msg = await sendExpress({ senderId: alice.id, recipientId: bob.id, kind: "text", body: "secret" });

    await assert.rejects(() => getExpressForViewer(msg.id, mallory.id), ExpressAuthError);
  });

  test("a blocked sender cannot Express the blocker even if otherwise connected", async () => {
    const alice = await makeUser("alice4_" + Date.now());
    const bob = await makeUser("bob4_" + Date.now());

    await db.insert(schema.connections).values({ requesterId: alice.id, addresseeId: bob.id, status: "accepted" });
    await db.insert(schema.blocks).values({ blockerId: bob.id, blockedId: alice.id });

    await assert.rejects(
      () => sendExpress({ senderId: alice.id, recipientId: bob.id, kind: "text", body: "hi" }),
      ExpressAuthError
    );
  });
});
