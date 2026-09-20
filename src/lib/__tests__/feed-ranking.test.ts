import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { rankFeed, defaultScorer, type FeedCandidate } from "../feed-ranking";

function candidate(overrides: Partial<FeedCandidate>): FeedCandidate {
  return {
    id: "id",
    authorId: "author",
    createdAt: new Date().toISOString(),
    reactionCount: 0,
    commentCount: 0,
    isFollowedAuthor: false,
    isConnectedAuthor: false,
    ...overrides,
  };
}

describe("feed-ranking", () => {
  test("ranks a connection's post above a stranger's post of the same age", () => {
    const now = new Date().toISOString();
    const fromConnection = candidate({ id: "a", createdAt: now, isConnectedAuthor: true });
    const fromStranger = candidate({ id: "b", createdAt: now, isConnectedAuthor: false });

    const ranked = rankFeed([fromStranger, fromConnection]);
    assert.equal(ranked[0].id, "a");
  });

  test("ranks a recent post above an old post from the same relationship tier", () => {
    const recent = candidate({ id: "new", createdAt: new Date().toISOString() });
    const old = candidate({ id: "old", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString() });

    const ranked = rankFeed([old, recent]);
    assert.equal(ranked[0].id, "new");
  });

  test("engagement provides a boost but doesn't override a strong relationship+recency signal", () => {
    const now = new Date().toISOString();
    const connectionNoEngagement = candidate({ id: "conn", createdAt: now, isConnectedAuthor: true, reactionCount: 0 });
    const strangerHighEngagement = candidate({ id: "viral-stranger", createdAt: now, reactionCount: 500, commentCount: 50 });

    const ranked = rankFeed([strangerHighEngagement, connectionNoEngagement]);
    assert.equal(ranked[0].id, "conn");
  });

  test("defaultScorer returns a finite, non-negative number", () => {
    const score = defaultScorer(candidate({}), Date.now());
    assert.ok(Number.isFinite(score));
    assert.ok(score >= 0);
  });
});
