import { primaryKey, sqliteTable as table } from "drizzle-orm/sqlite-core";
import * as t from "drizzle-orm/sqlite-core";

// Teams table.
export const teams = table("teams", {
  id: t.text("id").primaryKey(),
  name: t.text("name").notNull().unique(),
  addedBy: t.text("added_by").notNull(),
  addedAt: t
    .integer("added_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Team members table.
export const teamMembers = table(
  "team_members",
  {
    userId: t.text("user_id").notNull(),
    teamId: t
      .text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    addedBy: t.text("added_by").notNull(),
    addedAt: t
      .integer("added_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.teamId] }),
  }),
);

// Polls table.
export const polls = table("polls", {
  id: t.integer("id").primaryKey({ autoIncrement: true }),
  messageId: t.text("message_id").notNull().unique(),
  channelId: t.text("channel_id").notNull(),
  creatorId: t.text("creator_id").notNull(),
  question: t.text("question").notNull(),
  options: t.text("options").notNull(), // JSON array.
  endTime: t.integer("end_time", { mode: "timestamp" }),
  createdAt: t
    .integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Poll votes table.
export const pollVotes = table(
  "poll_votes",
  {
    pollId: t
      .integer("poll_id")
      .notNull()
      .references(() => polls.id, { onDelete: "cascade" }),
    userId: t.text("user_id").notNull(),
    optionIndex: t.integer("option_index").notNull(),
    votedAt: t
      .integer("voted_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.pollId, table.userId] }),
  }),
);

// UWC polls table.
export const uwcPolls = table("uwc_polls", {
  id: t.integer("id").primaryKey({ autoIncrement: true }),
  messageId: t.text("message_id").notNull().unique(),
  channelId: t.text("channel_id").notNull(),
  threadId: t.text("thread_id"), // Nullable - only for forum threads.
  creatorId: t.text("creator_id").notNull(),
  achievementId: t.integer("achievement_id"), // RA achievement ID if available.
  achievementName: t.text("achievement_name"), // For searching.
  gameId: t.integer("game_id"), // RA game ID if available.
  gameName: t.text("game_name"), // For searching.
  pollUrl: t.text("poll_url").notNull(), // Direct link to poll message.
  startedAt: t
    .integer("started_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  endedAt: t.integer("ended_at", { mode: "timestamp" }), // Null if active.
  status: t.text("status").notNull().default("active"), // 'active' | 'completed' | 'cancelled'
});

// UWC poll results table.
export const uwcPollResults = table("uwc_poll_results", {
  id: t.integer("id").primaryKey({ autoIncrement: true }),
  uwcPollId: t
    .integer("uwc_poll_id")
    .notNull()
    .references(() => uwcPolls.id, { onDelete: "cascade" }),
  optionText: t.text("option_text").notNull(), // e.g., "No, leave as is"
  voteCount: t.integer("vote_count").notNull().default(0),
  votePercentage: t.real("vote_percentage").notNull().default(0), // 0-100
});

// Wordle Achievement Event - User RA Account Connections
export const wordleUserConnections = table("wordle_user_connections", {
  id: t.integer("id").primaryKey({ autoIncrement: true }),
  discordUserId: t.text("discord_user_id").notNull().unique(),
  raUsername: t.text("ra_username").notNull(),
  connectedAt: t
    .integer("connected_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  lastVerified: t.integer("last_verified", { mode: "timestamp" }),
  isVerified: t.integer("is_verified").notNull().default(0), // 0 = false, 1 = true
});

// Wordle Achievement Event - Daily Words
export const wordleDailyWords = table("wordle_daily_words", {
  id: t.integer("id").primaryKey({ autoIncrement: true }),
  date: t.text("date").notNull().unique(), // YYYY-MM-DD format
  word: t.text("word").notNull(),
  letters: t.text("letters").notNull(), // JSON array of letters e.g., ["A","S","S","E","T"]
  createdAt: t
    .integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Wordle Achievement Event - User Submissions
export const wordleUserSubmissions = table(
  "wordle_user_submissions",
  {
    id: t.integer("id").primaryKey({ autoIncrement: true }),
    discordUserId: t.text("discord_user_id").notNull(),
    wordleDate: t.text("wordle_date").notNull(), // YYYY-MM-DD format
    achievementIds: t.text("achievement_ids").notNull(), // JSON array of achievement IDs
    achievementUrls: t.text("achievement_urls").notNull(), // JSON array of achievement URLs
    isValidated: t.integer("is_validated").notNull().default(0), // 0 = pending, 1 = valid, -1 = invalid
    validationMessage: t.text("validation_message"),
    submittedAt: t
      .integer("submitted_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    validatedAt: t.integer("validated_at", { mode: "timestamp" }),
  },
  (table) => ({
    uniqueUserDate: primaryKey({ columns: [table.discordUserId, table.wordleDate] }),
  }),
);

// Wordle Achievement Event - User Progress
export const wordleUserProgress = table("wordle_user_progress", {
  id: t.integer("id").primaryKey({ autoIncrement: true }),
  discordUserId: t.text("discord_user_id").notNull().unique(),
  successfulSubmissions: t.integer("successful_submissions").notNull().default(0),
  totalSubmissions: t.integer("total_submissions").notNull().default(0),
  lastSubmissionDate: t.text("last_submission_date"), // YYYY-MM-DD format
  isEligibleForPrize: t.integer("is_eligible_for_prize").notNull().default(0), // 0 = false, 1 = true
  prizeNotified: t.integer("prize_notified").notNull().default(0), // 0 = false, 1 = true
  updatedAt: t
    .integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
