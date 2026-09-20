export type FeedCandidate = {
  id: string;
  authorId: string;
  createdAt: string;
  reactionCount: number;
  commentCount: number;
  isFollowedAuthor: boolean;
  isConnectedAuthor: boolean;
};

export type FeedScorer = (c: FeedCandidate, now: number) => number;

/**
 * Default scorer: recency decay + a boost for people the viewer actually
 * follows/is connected to + a mild engagement signal. This is intentionally
 * simple and swappable — replace `defaultScorer` (or pass a different
 * FeedScorer into rankFeed) to change ranking behavior without touching
 * the query layer.
 */
export const defaultScorer: FeedScorer = (c, now) => {
  const ageHours = (now - new Date(c.createdAt).getTime()) / (1000 * 60 * 60);
  const recency = 1 / (1 + ageHours / 12); // halves roughly every 12h
  const relationship = (c.isConnectedAuthor ? 1.5 : 0) + (c.isFollowedAuthor ? 1 : 0);
  const engagement = Math.log1p(c.reactionCount + c.commentCount * 2);
  return recency * (1 + relationship) + engagement * 0.2;
};

export function rankFeed(candidates: FeedCandidate[], scorer: FeedScorer = defaultScorer) {
  const now = Date.now();
  return [...candidates]
    .map((c) => ({ c, score: scorer(c, now) }))
    .sort((a, b) => b.score - a.score)
    .map(({ c }) => c);
}
