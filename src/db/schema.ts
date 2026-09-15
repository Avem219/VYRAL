import {
  pgTable,
  text,
  boolean,
  integer,
  uuid,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { nowTimestamp } from "@/lib/time";

const id = () =>
  uuid("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const timestamps = {
  createdAt: text("created_at").notNull().$defaultFn(nowTimestamp),
  updatedAt: text("updated_at").notNull().$defaultFn(nowTimestamp),
};

/* ---------------------------------- IDENTITY ---------------------------------- */

export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().default("user"), // user | moderator | admin
    suspendedAt: text("suspended_at"),
    emailVerifiedAt: text("email_verified_at"),
    ...timestamps,
  },
  (t) => ({
    emailIdx: uniqueIndex("users_email_idx").on(t.email),
    usernameIdx: uniqueIndex("users_username_idx").on(t.username),
  })
);

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    userAgent: text("user_agent"),
    expiresAt: text("expires_at").notNull(),
    revokedAt: text("revoked_at"),
    ...timestamps,
  },
  (t) => ({
    tokenIdx: uniqueIndex("sessions_token_idx").on(t.tokenHash),
    userIdx: index("sessions_user_idx").on(t.userId),
  })
);

export const profiles = pgTable(
  "profiles",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    bio: text("bio").default(""),
    avatarUrl: text("avatar_url"),
    theme: text("theme").notNull().default("obsidian"), // minimal | obsidian | signal | aerodynamic | immersive
    accentColor: text("accent_color").notNull().default("#e11d2e"),
    layout: text("layout"), // JSON-encoded section order/visibility
    profileMusicUrl: text("profile_music_url"),
    discoverability: text("discoverability").notNull().default("everyone"), // everyone | connections | discoverable | nobody
    proximityDiscoverable: boolean("proximity_discoverable").notNull().default(false),
    ...timestamps,
  },
  (t) => ({
    userIdx: uniqueIndex("profiles_user_idx").on(t.userId),
  })
);

export const interests = pgTable(
  "interests",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
  },
  (t) => ({ userIdx: index("interests_user_idx").on(t.userId) })
);

export const socialLinks = pgTable(
  "social_links",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    url: text("url").notNull(),
    visibility: text("visibility").notNull().default("everyone"),
  },
  (t) => ({ userIdx: index("social_links_user_idx").on(t.userId) })
);

/* ------------------------------- SOCIAL GRAPH ------------------------------- */

export const follows = pgTable(
  "follows",
  {
    id: id(),
    followerId: uuid("follower_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    followingId: uuid("following_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => ({
    pairIdx: uniqueIndex("follows_pair_idx").on(t.followerId, t.followingId),
    followingIdx: index("follows_following_idx").on(t.followingId),
  })
);

export const connections = pgTable(
  "connections",
  {
    id: id(),
    requesterId: uuid("requester_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    addresseeId: uuid("addressee_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"), // pending | accepted | declined
    ...timestamps,
  },
  (t) => ({
    pairIdx: uniqueIndex("connections_pair_idx").on(t.requesterId, t.addresseeId),
  })
);

export const blocks = pgTable(
  "blocks",
  {
    id: id(),
    blockerId: uuid("blocker_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    blockedId: uuid("blocked_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => ({ pairIdx: uniqueIndex("blocks_pair_idx").on(t.blockerId, t.blockedId) })
);

export const mutes = pgTable(
  "mutes",
  {
    id: id(),
    muterId: uuid("muter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    mutedId: uuid("muted_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => ({ pairIdx: uniqueIndex("mutes_pair_idx").on(t.muterId, t.mutedId) })
);

export const circles = pgTable(
  "circles",
  {
    id: id(),
    ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    ...timestamps,
  },
  (t) => ({ ownerIdx: index("circles_owner_idx").on(t.ownerId) })
);

export const circleMembers = pgTable(
  "circle_members",
  {
    id: id(),
    circleId: uuid("circle_id").notNull().references(() => circles.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => ({ pairIdx: uniqueIndex("circle_members_pair_idx").on(t.circleId, t.memberId) })
);

/* ---------------------------------- CONTENT ---------------------------------- */

export const posts = pgTable(
  "posts",
  {
    id: id(),
    authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().default("text"), // text | photo | video | carousel | music | project | poll
    body: text("body"),
    mediaJson: text("media_json"), // JSON array of media.id values (resolved to URLs via the storage provider)
    musicTrackId: uuid("music_track_id"),
    audience: text("audience").notNull().default("everyone"),
    ...timestamps,
  },
  (t) => ({ authorIdx: index("posts_author_idx").on(t.authorId) })
);

export const comments = pgTable(
  "comments",
  {
    id: id(),
    postId: uuid("post_id").references(() => posts.id, { onDelete: "cascade" }),
    reelId: uuid("reel_id").references(() => reels.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    parentId: text("parent_id"),
    body: text("body").notNull(),
    ...timestamps,
  },
  (t) => ({
    postIdx: index("comments_post_idx").on(t.postId),
    reelIdx: index("comments_reel_idx").on(t.reelId),
  })
);

export const reactions = pgTable(
  "reactions",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    targetType: text("target_type").notNull(), // post | comment | story | reel
    targetId: text("target_id").notNull(),
    kind: text("kind").notNull().default("like"),
    ...timestamps,
  },
  (t) => ({
    uniqIdx: uniqueIndex("reactions_uniq_idx").on(t.userId, t.targetType, t.targetId, t.kind),
    targetIdx: index("reactions_target_idx").on(t.targetType, t.targetId),
  })
);

export const saves = pgTable(
  "saves",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    collectionId: text("collection_id"),
    ...timestamps,
  },
  (t) => ({ userIdx: index("saves_user_idx").on(t.userId) })
);

export const collections = pgTable(
  "collections",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isPrivate: boolean("is_private").notNull().default(true),
    ...timestamps,
  },
  (t) => ({ userIdx: index("collections_user_idx").on(t.userId) })
);

export const stories = pgTable(
  "stories",
  {
    id: id(),
    authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().default("photo"), // photo | video | text
    mediaId: uuid("media_id").references(() => media.id, { onDelete: "set null" }),
    body: text("body"),
    audience: text("audience").notNull().default("everyone"), // everyone | connections | circle
    circleId: uuid("circle_id").references(() => circles.id, { onDelete: "set null" }),
    expiresAt: text("expires_at").notNull(),
    musicTrackId: uuid("music_track_id"),
    ...timestamps,
  },
  (t) => ({ authorIdx: index("stories_author_idx").on(t.authorId) })
);

export const storyViews = pgTable(
  "story_views",
  {
    id: id(),
    storyId: uuid("story_id").notNull().references(() => stories.id, { onDelete: "cascade" }),
    viewerId: uuid("viewer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    viewedAt: text("viewed_at").notNull().$defaultFn(nowTimestamp),
  },
  (t) => ({ pairIdx: uniqueIndex("story_views_pair_idx").on(t.storyId, t.viewerId) })
);

export const reels = pgTable(
  "reels",
  {
    id: id(),
    authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id").notNull().references(() => media.id, { onDelete: "cascade" }),
    thumbnailMediaId: uuid("thumbnail_media_id").references(() => media.id, { onDelete: "set null" }),
    caption: text("caption"),
    musicTrackId: uuid("music_track_id"),
    audience: text("audience").notNull().default("everyone"),
    ...timestamps,
  },
  (t) => ({ authorIdx: index("reels_author_idx").on(t.authorId) })
);

/* --------------------------------- MESSAGING --------------------------------- */

export const conversations = pgTable(
  "conversations",
  {
    id: id(),
    isGroup: boolean("is_group").notNull().default(false),
    title: text("title"),
    avatarMediaId: text("avatar_media_id"),
    ...timestamps,
  }
);

export const conversationMembers = pgTable(
  "conversation_members",
  {
    id: id(),
    conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    lastReadAt: text("last_read_at"),
    isRequest: boolean("is_request").notNull().default(false),
    isAdmin: boolean("is_admin").notNull().default(false), // group management rights; irrelevant for direct conversations
  },
  (t) => ({
    pairIdx: uniqueIndex("conversation_members_pair_idx").on(t.conversationId, t.userId),
    userIdx: index("conversation_members_user_idx").on(t.userId),
  })
);

export const messages = pgTable(
  "messages",
  {
    id: id(),
    conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().default("text"), // text | image | video | audio | shared_post | shared_reel | shared_profile
    body: text("body"),
    mediaId: text("media_id"), // resolved to a URL via getMediaUrl(); access-gated by conversation membership, see media route
    sharedTargetType: text("shared_target_type"),
    sharedTargetId: text("shared_target_id"),
    replyToId: text("reply_to_id"),
    deliveredAt: text("delivered_at"),
    ...timestamps,
  },
  (t) => ({ convoIdx: index("messages_convo_idx").on(t.conversationId) })
);

export const messageReactions = pgTable(
  "message_reactions",
  {
    id: id(),
    messageId: uuid("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
  },
  (t) => ({ uniqIdx: uniqueIndex("message_reactions_uniq_idx").on(t.messageId, t.userId, t.emoji) })
);

export const presence = pgTable(
  "presence",
  {
    userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("offline"), // online | away | offline
    lastSeenAt: text("last_seen_at").notNull().$defaultFn(nowTimestamp),
  }
);

/* ----------------------------------- EXPRESS ----------------------------------- */
/*
  Express is private-by-construction: rows are only ever queried scoped to
  (senderId = me OR recipientId = me) — see src/lib/express.ts. There is no
  public listing endpoint and Express content is excluded from every other
  domain's queries (feed, search, explore, analytics, notification previews).
*/
export const expressMessages = pgTable(
  "express_messages",
  {
    id: id(),
    senderId: uuid("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    recipientId: uuid("recipient_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().default("text"), // text | image | video | audio | music | link
    body: text("body"),
    mediaId: text("media_id"),
    musicTrackId: uuid("music_track_id"),
    allowReply: boolean("allow_reply").notNull().default(true),
    allowForward: boolean("allow_forward").notNull().default(false),
    expiresAt: text("expires_at"), // null = never
    openedAt: text("opened_at"),
    recalledAt: text("recalled_at"),
    archivedBySender: boolean("archived_by_sender").notNull().default(false),
    archivedByRecipient: boolean("archived_by_recipient").notNull().default(false),
    deletedBySender: boolean("deleted_by_sender").notNull().default(false),
    deletedByRecipient: boolean("deleted_by_recipient").notNull().default(false),
    ...timestamps,
  },
  (t) => ({
    senderIdx: index("express_sender_idx").on(t.senderId),
    recipientIdx: index("express_recipient_idx").on(t.recipientId),
  })
);

export const expressPermissions = pgTable(
  "express_permissions",
  {
    userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
    whoCanSend: text("who_can_send").notNull().default("connections"), // everyone | connections | nobody
  }
);

/* -------------------------------- NOTIFICATIONS -------------------------------- */

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // follow | connection | like | comment | mention | message | story | express | system
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "cascade" }),
    targetType: text("target_type"),
    targetId: text("target_id"),
    // Deliberately no content preview for kind = 'express'; see src/lib/notifications.ts
    readAt: text("read_at"),
    ...timestamps,
  },
  (t) => ({ userIdx: index("notifications_user_idx").on(t.userId) })
);

/* ----------------------------------- MUSIC ----------------------------------- */

export const tracks = pgTable(
  "tracks",
  {
    id: id(),
    title: text("title").notNull(),
    artist: text("artist").notNull(),
    provider: text("provider").notNull().default("external"), // licensed provider key
    externalUrl: text("external_url").notNull(),
    ...timestamps,
  }
);

/* ----------------------------------- MEDIA ----------------------------------- */
/*
  Provider-agnostic media record. `provider` + `storageKey` let the actual
  bytes live anywhere (local disk in dev, S3/R2/Supabase Storage in
  production) behind the interface in src/lib/storage.ts. Nothing else in
  the app should construct storage paths directly — always go through
  getMediaUrl()/the storage provider so swapping providers is a one-file
  change.
*/
export const media = pgTable(
  "media",
  {
    id: id(),
    ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("local"), // local | s3 | r2 | supabase
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    kind: text("kind").notNull(), // image | video | audio
    status: text("status").notNull().default("ready"), // pending | ready | failed
    isPrivate: boolean("is_private").notNull().default(false),
    ...timestamps,
  },
  (t) => ({ ownerIdx: index("media_owner_idx").on(t.ownerId) })
);

/* --------------------------------- ADMIN/AUDIT --------------------------------- */

export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    metadata: text("metadata"), // JSON
    createdAt: text("created_at").notNull().$defaultFn(nowTimestamp),
  },
  (t) => ({ actorIdx: index("audit_log_actor_idx").on(t.actorId) })
);

/* --------------------------------- ANALYTICS --------------------------------- */

export const profileViews = pgTable(
  "profile_views",
  {
    id: id(),
    profileUserId: uuid("profile_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    viewerId: uuid("viewer_id").references(() => users.id, { onDelete: "set null" }),
    viewedAt: text("viewed_at").notNull().$defaultFn(nowTimestamp),
  },
  (t) => ({ profileIdx: index("profile_views_profile_idx").on(t.profileUserId) })
);

export const contentViews = pgTable(
  "content_views",
  {
    id: id(),
    targetType: text("target_type").notNull(), // post | story | reel
    targetId: text("target_id").notNull(),
    viewerId: uuid("viewer_id").references(() => users.id, { onDelete: "set null" }),
    viewedAt: text("viewed_at").notNull().$defaultFn(nowTimestamp),
  },
  (t) => ({ targetIdx: index("content_views_target_idx").on(t.targetType, t.targetId) })
);

/* --------------------------------- MODERATION --------------------------------- */

export const reports = pgTable(
  "reports",
  {
    id: id(),
    reporterId: uuid("reporter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    reason: text("reason").notNull(),
    status: text("status").notNull().default("open"), // open | reviewed | actioned | dismissed
    ...timestamps,
  }
);
