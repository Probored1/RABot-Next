import { eq } from "drizzle-orm";

import { db } from "../database/db";
import { wordleDailyWords } from "../database/schema";
import { logError } from "../utils/logger";

export interface DailyWord {
  id: number;
  date: string;
  word: string;
  letters: string[];
  createdAt: Date;
}

export interface WordleValidationResult {
  isValid: boolean;
  message: string;
}

/**
 * Service for managing Wordle Achievement Event functionality.
 * Handles daily word generation, letter extraction, and validation logic.
 */
export class WordleService {
  /**
   * Get today's date in YYYY-MM-DD format
   */
  static getTodayString(): string {
    const today = new Date();

    return today.toISOString().split("T")[0]!;
  }

  /**
   * Get or create today's Wordle word
   */
  static async getTodayWord(): Promise<DailyWord | null> {
    const todayString = this.getTodayString();

    try {
      // First try to get existing word for today
      const existingWord = await db
        .select()
        .from(wordleDailyWords)
        .where(eq(wordleDailyWords.date, todayString))
        .limit(1);

      if (existingWord.length > 0) {
        const word = existingWord[0]!;

        return {
          id: word.id,
          date: word.date,
          word: word.word,
          letters: JSON.parse(word.letters) as string[],
          createdAt: word.createdAt,
        };
      }

      // If no word exists for today, return null (admin needs to set it)
      return null;
    } catch (error) {
      logError(error, { event: "wordle_get_today_word_error" });

      return null;
    }
  }

  /**
   * Set today's Wordle word (admin function)
   */
  static async setTodayWord(word: string): Promise<DailyWord | null> {
    const todayString = this.getTodayString();
    const letters = word.toUpperCase().split("");

    try {
      // Check if word for today already exists
      const existingWord = await db
        .select()
        .from(wordleDailyWords)
        .where(eq(wordleDailyWords.date, todayString))
        .limit(1);

      if (existingWord.length > 0) {
        // Update existing word
        const updated = await db
          .update(wordleDailyWords)
          .set({
            word: word.toUpperCase(),
            letters: JSON.stringify(letters),
          })
          .where(eq(wordleDailyWords.date, todayString))
          .returning();

        if (updated.length > 0) {
          const updatedWord = updated[0]!;

          return {
            id: updatedWord.id,
            date: updatedWord.date,
            word: updatedWord.word,
            letters: JSON.parse(updatedWord.letters) as string[],
            createdAt: updatedWord.createdAt,
          };
        }
      } else {
        // Insert new word
        const inserted = await db
          .insert(wordleDailyWords)
          .values({
            date: todayString,
            word: word.toUpperCase(),
            letters: JSON.stringify(letters),
          })
          .returning();

        if (inserted.length > 0) {
          const insertedWord = inserted[0]!;

          return {
            id: insertedWord.id,
            date: insertedWord.date,
            word: insertedWord.word,
            letters: JSON.parse(insertedWord.letters) as string[],
            createdAt: insertedWord.createdAt,
          };
        }
      }

      return null;
    } catch (error) {
      logError(error, { event: "wordle_set_today_word_error", word });

      return null;
    }
  }

  /**
   * Validate if achievement titles match the required letters
   */
  static validateAchievementTitles(
    achievementTitles: string[],
    requiredLetters: string[],
  ): WordleValidationResult {
    if (achievementTitles.length !== 5) {
      return {
        isValid: false,
        message: "You must submit exactly 5 achievements.",
      };
    }

    if (requiredLetters.length !== 5) {
      return {
        isValid: false,
        message: "Invalid word configuration. Please contact an administrator.",
      };
    }

    const firstLetters = achievementTitles.map((title) => title.charAt(0).toUpperCase());
    const mismatches: string[] = [];

    for (let i = 0; i < 5; i++) {
      const required = requiredLetters[i]!.toUpperCase();
      const actual = firstLetters[i]!;

      if (required !== actual) {
        mismatches.push(
          `Achievement ${i + 1}: "${achievementTitles[i]}" starts with "${actual}" but needs to start with "${required}"`,
        );
      }
    }

    if (mismatches.length > 0) {
      return {
        isValid: false,
        message: `Letter mismatches found:\n${mismatches.join("\n")}`,
      };
    }

    return {
      isValid: true,
      message: "All achievement titles match the required letters!",
    };
  }

  /**
   * Extract achievement ID from RetroAchievements URL
   */
  static extractAchievementId(url: string): number | null {
    try {
      // Handle both achievement URLs and direct IDs
      if (/^\d+$/.test(url.trim())) {
        return parseInt(url.trim(), 10);
      }

      // Match RetroAchievements achievement URLs
      const achievementMatch = url.match(/retroachievements\.org\/achievement\/(\d+)/i);
      if (achievementMatch) {
        return parseInt(achievementMatch[1]!, 10);
      }

      return null;
    } catch (error) {
      logError(error, { event: "extract_achievement_id_error", url });

      return null;
    }
  }

  /**
   * Validate achievement URLs/IDs
   */
  static validateAchievementIds(inputs: string[]): { ids: number[]; errors: string[] } {
    const ids: number[] = [];
    const errors: string[] = [];

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i]!.trim();
      const id = this.extractAchievementId(input);

      if (id === null) {
        errors.push(
          `Achievement ${i + 1}: "${input}" is not a valid RetroAchievements URL or achievement ID`,
        );
      } else {
        ids.push(id);
      }
    }

    return { ids, errors };
  }

  /**
   * Format today's word display for Discord
   */
  static formatTodayWordDisplay(dailyWord: DailyWord): string {
    const letterDisplay = dailyWord.letters.join(" - ");

    return `**Today's Wordle Word:** ${dailyWord.word}\n**Required Letters:** ${letterDisplay}\n\nFind 5 achievements where the first letter matches each position!`;
  }

  /**
   * Generate example achievement display
   */
  static generateExampleDisplay(letters: string[]): string {
    const examples = [
      `${letters[0]}: "A Distorted Village" (starts with ${letters[0]})`,
      `${letters[1]}: "San Francisco" (starts with ${letters[1]})`,
      `${letters[2]}: "Santa Would be so Proud" (starts with ${letters[2]})`,
      `${letters[3]}: "Excellent Work" (starts with ${letters[3]})`,
      `${letters[4]}: "Top Score" (starts with ${letters[4]})`,
    ];

    return `**Example submissions:**\n${examples.join("\n")}`;
  }

  /**
   * Check if the event is currently active
   */
  static async isEventActive(): Promise<boolean> {
    const todayWord = await this.getTodayWord();

    return todayWord !== null;
  }

  /**
   * Get word for a specific date
   */
  static async getWordForDate(date: string): Promise<DailyWord | null> {
    try {
      const word = await db
        .select()
        .from(wordleDailyWords)
        .where(eq(wordleDailyWords.date, date))
        .limit(1);

      if (word.length > 0) {
        const wordData = word[0]!;

        return {
          id: wordData.id,
          date: wordData.date,
          word: wordData.word,
          letters: JSON.parse(wordData.letters) as string[],
          createdAt: wordData.createdAt,
        };
      }

      return null;
    } catch (error) {
      logError(error, { event: "wordle_get_word_for_date_error", date });

      return null;
    }
  }
}
