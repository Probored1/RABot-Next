import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

// Create new tables for Wordle Achievement Event
const createWordleTablesSQL = `
-- Wordle Achievement Event - User RA Account Connections
CREATE TABLE IF NOT EXISTS wordle_user_connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_user_id TEXT NOT NULL UNIQUE,
  ra_username TEXT NOT NULL,
  connected_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_verified INTEGER,
  is_verified INTEGER NOT NULL DEFAULT 0
);

-- Wordle Achievement Event - Daily Words
CREATE TABLE IF NOT EXISTS wordle_daily_words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  word TEXT NOT NULL,
  letters TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Wordle Achievement Event - User Submissions
CREATE TABLE IF NOT EXISTS wordle_user_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_user_id TEXT NOT NULL,
  wordle_date TEXT NOT NULL,
  achievement_ids TEXT NOT NULL,
  achievement_urls TEXT NOT NULL,
  is_validated INTEGER NOT NULL DEFAULT 0,
  validation_message TEXT,
  submitted_at INTEGER NOT NULL DEFAULT (unixepoch()),
  validated_at INTEGER,
  UNIQUE (discord_user_id, wordle_date)
);

-- Wordle Achievement Event - User Progress
CREATE TABLE IF NOT EXISTS wordle_user_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_user_id TEXT NOT NULL UNIQUE,
  successful_submissions INTEGER NOT NULL DEFAULT 0,
  total_submissions INTEGER NOT NULL DEFAULT 0,
  last_submission_date TEXT,
  is_eligible_for_prize INTEGER NOT NULL DEFAULT 0,
  prize_notified INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
`;

async function runWordleMigration() {
  try {
    const sqlite = new Database("./data.db");
    const _db = drizzle(sqlite);

    console.log("🔄 Running Wordle Achievement Event migration...");

    sqlite.exec(createWordleTablesSQL);

    console.log("✅ Wordle Achievement Event migration completed successfully!");
    console.log("\nCreated tables:");
    console.log("• wordle_user_connections");
    console.log("• wordle_daily_words");
    console.log("• wordle_user_submissions");
    console.log("• wordle_user_progress");

    sqlite.close();
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

// ✅ Use ESM-compatible entry point check
if (import.meta.main) {
  runWordleMigration();
}

export { runWordleMigration };
