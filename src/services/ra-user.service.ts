import {
  buildAuthorization,
  getAchievementsEarnedOnDay,
  getUserProfile,
} from "@retroachievements/api";
import { and, eq } from "drizzle-orm";

import { RA_WEB_API_KEY } from "../config/constants";
import { db } from "../database/db";
import {
  wordleUserConnections,
  wordleUserProgress,
  wordleUserSubmissions,
} from "../database/schema";
// import { logError, logger } from "../utils/logger";

export interface UserConnection {
  id: number;
  discordUserId: string;
  raUsername: string;
  connectedAt: Date;
  lastVerified: Date | null;
  isVerified: boolean;
}

export interface UserProgress {
  id: number;
  discordUserId: string;
  successfulSubmissions: number;
  totalSubmissions: number;
  lastSubmissionDate: string | null;
  isEligibleForPrize: boolean;
  prizeNotified: boolean;
  updatedAt: Date;
}

export interface UserSubmission {
  id: number;
  discordUserId: string;
  wordleDate: string;
  achievementIds: number[];
  achievementUrls: string[];
  isValidated: number; // 0 = pending, 1 = valid, -1 = invalid
  validationMessage: string | null;
  submittedAt: Date;
  validatedAt: Date | null;
}

export interface AchievementValidationResult {
  isValid: boolean;
  message: string;
  achievementTitles?: string[];
}

/**
 * Service for managing RetroAchievements user connections and validations
 * for the Wordle Achievement Event.
 */
export class RAUserService {
  /**
   * Connect a Discord user to their RetroAchievements account
   */
  static async connectUser(
    discordUserId: string,
    raUsername: string,
  ): Promise<UserConnection | null> {
    try {
      // First verify the RA username exists
      const isValid = await this.verifyRAUser(raUsername);
      if (!isValid) {
        return null;
      }

      // Check if user already has a connection
      const existingConnection = await db
        .select()
        .from(wordleUserConnections)
        .where(eq(wordleUserConnections.discordUserId, discordUserId))
        .limit(1);

      if (existingConnection.length > 0) {
        // Update existing connection
        const updated = await db
          .update(wordleUserConnections)
          .set({
            raUsername,
            lastVerified: new Date(),
            isVerified: 1,
          })
          .where(eq(wordleUserConnections.discordUserId, discordUserId))
          .returning();

        if (updated.length > 0) {
          const connection = updated[0]!;

          return {
            id: connection.id,
            discordUserId: connection.discordUserId,
            raUsername: connection.raUsername,
            connectedAt: connection.connectedAt,
            lastVerified: connection.lastVerified,
            isVerified: Boolean(connection.isVerified),
          };
        }
      } else {
        // Create new connection
        const inserted = await db
          .insert(wordleUserConnections)
          .values({
            discordUserId,
            raUsername,
            lastVerified: new Date(),
            isVerified: 1,
          })
          .returning();

        if (inserted.length > 0) {
          const connection = inserted[0]!;

          return {
            id: connection.id,
            discordUserId: connection.discordUserId,
            raUsername: connection.raUsername,
            connectedAt: connection.connectedAt,
            lastVerified: connection.lastVerified,
            isVerified: Boolean(connection.isVerified),
          };
        }
      }

      return null;
    } catch (error) {
      logError(error, { event: "ra_user_connect_error", discordUserId, raUsername });

      return null;
    }
  }

  /**
   * Verify if a RetroAchievements username exists
   */
  static async verifyRAUser(raUsername: string): Promise<boolean> {
    try {
      const authorization = buildAuthorization({
        username: "RABot",
        webApiKey: RA_WEB_API_KEY,
      });

      const profile = await getUserProfile(authorization, { username: raUsername });

      return profile !== null;
    } catch (error) {
      logError(error, { event: "ra_user_verify_error", raUsername });

      return false;
    }
  }

  /**
   * Get user connection by Discord ID
   */
  static async getUserConnection(discordUserId: string): Promise<UserConnection | null> {
    try {
      const connection = await db
        .select()
        .from(wordleUserConnections)
        .where(eq(wordleUserConnections.discordUserId, discordUserId))
        .limit(1);

      if (connection.length > 0) {
        const conn = connection[0]!;

        return {
          id: conn.id,
          discordUserId: conn.discordUserId,
          raUsername: conn.raUsername,
          connectedAt: conn.connectedAt,
          lastVerified: conn.lastVerified,
          isVerified: Boolean(conn.isVerified),
        };
      }

      return null;
    } catch (error) {
      logError(error, { event: "ra_user_get_connection_error", discordUserId });

      return null;
    }
  }

  /**
   * Validate achievements were earned on a specific date
   */
  static async validateAchievementsEarnedOnDate(
    raUsername: string,
    achievementIds: number[],
    date: string,
  ): Promise<AchievementValidationResult> {
    try {
      const authorization = buildAuthorization({
        username: "RABot",
        webApiKey: RA_WEB_API_KEY,
      });

      // Get achievements earned on the specific date
      const achievementsEarned = await getAchievementsEarnedOnDay(authorization, {
        username: raUsername,
        onDate: new Date(date),
      });

      if (!achievementsEarned) {
        return {
          isValid: false,
          message: "Could not retrieve achievement data from RetroAchievements API.",
        };
      }

      const earnedIds = achievementsEarned.map((achievement) => achievement.achievementId);
      const earnedTitles = achievementsEarned.map((achievement) => achievement.title);
      const missingAchievements: number[] = [];
      const foundTitles: string[] = [];

      // Check each submitted achievement ID
      for (const achievementId of achievementIds) {
        const earnedIndex = earnedIds.indexOf(achievementId);
        if (earnedIndex === -1) {
          missingAchievements.push(achievementId);
        } else {
          foundTitles.push(earnedTitles[earnedIndex]!);
        }
      }

      if (missingAchievements.length > 0) {
        return {
          isValid: false,
          message: `The following achievement(s) were not earned on ${date}: ${missingAchievements.join(", ")}`,
        };
      }

      return {
        isValid: true,
        message: "All achievements were verified as earned on the specified date!",
        achievementTitles: foundTitles,
      };
    } catch (error) {
      logError(error, {
        event: "ra_user_validate_achievements_error",
        raUsername,
        achievementIds,
        date,
      });

      return {
        isValid: false,
        message: "Error occurred while validating achievements. Please try again later.",
      };
    }
  }

  /**
   * Submit achievements for validation
   */
  static async submitAchievements(
    discordUserId: string,
    wordleDate: string,
    achievementIds: number[],
    achievementUrls: string[],
  ): Promise<UserSubmission | null> {
    try {
      // Check if user already has a submission for this date
      const existingSubmission = await db
        .select()
        .from(wordleUserSubmissions)
        .where(
          and(
            eq(wordleUserSubmissions.discordUserId, discordUserId),
            eq(wordleUserSubmissions.wordleDate, wordleDate),
          ),
        )
        .limit(1);

      if (existingSubmission.length > 0) {
        // Update existing submission
        const updated = await db
          .update(wordleUserSubmissions)
          .set({
            achievementIds: JSON.stringify(achievementIds),
            achievementUrls: JSON.stringify(achievementUrls),
            isValidated: 0, // Reset validation status
            validationMessage: null,
            submittedAt: new Date(),
            validatedAt: null,
          })
          .where(
            and(
              eq(wordleUserSubmissions.discordUserId, discordUserId),
              eq(wordleUserSubmissions.wordleDate, wordleDate),
            ),
          )
          .returning();

        if (updated.length > 0) {
          const submission = updated[0]!;

          return {
            id: submission.id,
            discordUserId: submission.discordUserId,
            wordleDate: submission.wordleDate,
            achievementIds: JSON.parse(submission.achievementIds) as number[],
            achievementUrls: JSON.parse(submission.achievementUrls) as string[],
            isValidated: submission.isValidated,
            validationMessage: submission.validationMessage,
            submittedAt: submission.submittedAt,
            validatedAt: submission.validatedAt,
          };
        }
      } else {
        // Create new submission
        const inserted = await db
          .insert(wordleUserSubmissions)
          .values({
            discordUserId,
            wordleDate,
            achievementIds: JSON.stringify(achievementIds),
            achievementUrls: JSON.stringify(achievementUrls),
            isValidated: 0,
            validationMessage: null,
          })
          .returning();

        if (inserted.length > 0) {
          const submission = inserted[0]!;

          return {
            id: submission.id,
            discordUserId: submission.discordUserId,
            wordleDate: submission.wordleDate,
            achievementIds: JSON.parse(submission.achievementIds) as number[],
            achievementUrls: JSON.parse(submission.achievementUrls) as string[],
            isValidated: submission.isValidated,
            validationMessage: submission.validationMessage,
            submittedAt: submission.submittedAt,
            validatedAt: submission.validatedAt,
          };
        }
      }

      return null;
    } catch (error) {
      logError(error, {
        event: "ra_user_submit_achievements_error",
        discordUserId,
        wordleDate,
        achievementIds,
      });

      return null;
    }
  }

  /**
   * Get user progress
   */
  static async getUserProgress(discordUserId: string): Promise<UserProgress | null> {
    try {
      const progress = await db
        .select()
        .from(wordleUserProgress)
        .where(eq(wordleUserProgress.discordUserId, discordUserId))
        .limit(1);

      if (progress.length > 0) {
        const userProgress = progress[0]!;

        return {
          id: userProgress.id,
          discordUserId: userProgress.discordUserId,
          successfulSubmissions: userProgress.successfulSubmissions,
          totalSubmissions: userProgress.totalSubmissions,
          lastSubmissionDate: userProgress.lastSubmissionDate,
          isEligibleForPrize: Boolean(userProgress.isEligibleForPrize),
          prizeNotified: Boolean(userProgress.prizeNotified),
          updatedAt: userProgress.updatedAt,
        };
      }

      return null;
    } catch (error) {
      logError(error, { event: "ra_user_get_progress_error", discordUserId });

      return null;
    }
  }

  /**
   * Update user progress after successful validation
   */
  static async updateUserProgress(
    discordUserId: string,
    wordleDate: string,
    isSuccessful: boolean,
  ): Promise<UserProgress | null> {
    try {
      // Get current progress or create new
      let currentProgress = await this.getUserProgress(discordUserId);

      if (!currentProgress) {
        // Create new progress record
        const inserted = await db
          .insert(wordleUserProgress)
          .values({
            discordUserId,
            successfulSubmissions: isSuccessful ? 1 : 0,
            totalSubmissions: 1,
            lastSubmissionDate: wordleDate,
            isEligibleForPrize: 0,
            prizeNotified: 0,
          })
          .returning();

        if (inserted.length > 0) {
          const progress = inserted[0]!;
          currentProgress = {
            id: progress.id,
            discordUserId: progress.discordUserId,
            successfulSubmissions: progress.successfulSubmissions,
            totalSubmissions: progress.totalSubmissions,
            lastSubmissionDate: progress.lastSubmissionDate,
            isEligibleForPrize: Boolean(progress.isEligibleForPrize),
            prizeNotified: Boolean(progress.prizeNotified),
            updatedAt: progress.updatedAt,
          };
        }
      } else {
        // Update existing progress
        const newSuccessfulSubmissions = isSuccessful
          ? currentProgress.successfulSubmissions + 1
          : currentProgress.successfulSubmissions;
        const newTotalSubmissions = currentProgress.totalSubmissions + 1;
        const isEligibleForPrize = newSuccessfulSubmissions >= 30;

        const updated = await db
          .update(wordleUserProgress)
          .set({
            successfulSubmissions: newSuccessfulSubmissions,
            totalSubmissions: newTotalSubmissions,
            lastSubmissionDate: wordleDate,
            isEligibleForPrize: isEligibleForPrize ? 1 : 0,
            updatedAt: new Date(),
          })
          .where(eq(wordleUserProgress.discordUserId, discordUserId))
          .returning();

        if (updated.length > 0) {
          const progress = updated[0]!;
          currentProgress = {
            id: progress.id,
            discordUserId: progress.discordUserId,
            successfulSubmissions: progress.successfulSubmissions,
            totalSubmissions: progress.totalSubmissions,
            lastSubmissionDate: progress.lastSubmissionDate,
            isEligibleForPrize: Boolean(progress.isEligibleForPrize),
            prizeNotified: Boolean(progress.prizeNotified),
            updatedAt: progress.updatedAt,
          };
        }
      }

      return currentProgress;
    } catch (error) {
      logError(error, {
        event: "ra_user_update_progress_error",
        discordUserId,
        wordleDate,
        isSuccessful,
      });

      return null;
    }
  }

  /**
   * Mark submission as validated
   */
  static async markSubmissionValidated(
    submissionId: number,
    isValid: boolean,
    message: string,
  ): Promise<boolean> {
    try {
      const updated = await db
        .update(wordleUserSubmissions)
        .set({
          isValidated: isValid ? 1 : -1,
          validationMessage: message,
          validatedAt: new Date(),
        })
        .where(eq(wordleUserSubmissions.id, submissionId))
        .returning();

      return updated.length > 0;
    } catch (error) {
      logError(error, { event: "ra_user_mark_validated_error", submissionId, isValid, message });

      return false;
    }
  }

  /**
   * Delete submission (for reset functionality)
   */
  static async deleteSubmission(discordUserId: string, wordleDate: string): Promise<boolean> {
    try {
      const deleted = await db
        .delete(wordleUserSubmissions)
        .where(
          and(
            eq(wordleUserSubmissions.discordUserId, discordUserId),
            eq(wordleUserSubmissions.wordleDate, wordleDate),
          ),
        )
        .returning();

      return deleted.length > 0;
    } catch (error) {
      logError(error, { event: "ra_user_delete_submission_error", discordUserId, wordleDate });

      return false;
    }
  }
}
