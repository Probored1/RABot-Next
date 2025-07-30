import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { and, eq } from "drizzle-orm";

import { COLORS } from "../config/constants";
import { db } from "../database/db";
import { wordleUserSubmissions } from "../database/schema";
import type { SlashCommand } from "../models";
import { RAUserService } from "../services/ra-user.service";
import { WordleService } from "../services/wordle.service";

const wordleStatusCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("wordle-status")
    .setDescription("Check today's Wordle word and your progress in the Achievement Event"),

  async execute(interaction) {
    const discordUserId = interaction.user.id;

    // Defer reply since we need to fetch data
    await interaction.deferReply({ ephemeral: true });

    try {
      const isEventActive = await WordleService.isEventActive();
      if (!isEventActive) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle("📅 Wordle Event Loading")
              .setDescription("The Wordle Achievement Event is loading today's word automatically. Please try again in a moment.")
              .setColor(COLORS.WARNING)
              .setFooter({ text: "Words are now automatically fetched from an online API" }),
          ],
        });
        return;
      }

      const todayWord = await WordleService.getTodayWord();
      if (!todayWord) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle("❌ Error Loading Event")
              .setDescription("Could not load today's Wordle word. Please try again later.")
              .setColor(COLORS.ERROR),
          ],
        });
        return;
      }

      const userConnection = await RAUserService.getUserConnection(discordUserId);
      if (!userConnection) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle("🔗 Account Not Connected")
              .setDescription("You need to connect your RetroAchievements account first!")
              .addFields([
                { name: "📝 How to Connect", value: "Use `/wordle-connect <username>` to link your RA account" },
                { name: "📅 Today's Word", value: WordleService.formatTodayWordDisplay(todayWord) },
              ])
              .setColor(COLORS.WARNING),
          ],
        });
        return;
      }

      // Get user progress
      const userProgress = await RAUserService.getUserProgress(discordUserId);

      // Check if user has submitted for today
      const todayString = WordleService.getTodayString();
      // Get existing submission without creating a new one
      const todaySubmission = await db
        .select()
        .from(wordleUserSubmissions)
        .where(
          and(
            eq(wordleUserSubmissions.discordUserId, discordUserId),
            eq(wordleUserSubmissions.wordleDate, todayString),
          ),
        )
        .limit(1)
        .then((results) => {
          if (results.length > 0) {
            const submission = results[0]!;

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

          return null;
        });

      // Build status embed
      const statusEmbed = new EmbedBuilder()
        .setTitle("🎯 Wordle Achievement Event Status")
        .setDescription(WordleService.formatTodayWordDisplay(todayWord))
        .addFields([
          {
            name: "🔗 Connected Account",
            value: `**${userConnection.raUsername}** on RetroAchievements`,
            inline: true,
          },
        ])
        .setColor(COLORS.PRIMARY);

      // Add today's submission status
      if (todaySubmission && todaySubmission.achievementIds.length > 0) {
        let submissionStatus = "";
        if (todaySubmission.isValidated === 0) {
          submissionStatus = "🟡 **Pending Validation**";
        } else if (todaySubmission.isValidated === 1) {
          submissionStatus = "✅ **Validated Successfully**";
        } else {
          submissionStatus = "❌ **Validation Failed**";
        }

        statusEmbed.addFields([
          {
            name: "📋 Today's Submission",
            value: `${submissionStatus}\nSubmitted ${todaySubmission.achievementIds.length}/5 achievements`,
          },
        ]);

        if (todaySubmission.validationMessage) {
          statusEmbed.addFields([
            {
              name: "💬 Validation Details",
              value: todaySubmission.validationMessage,
            },
          ]);
        }
      } else {
        statusEmbed.addFields([
          {
            name: "📋 Today's Submission",
            value: "❌ **Not submitted yet**\nUse `/wordle-submit` to submit your achievements",
          },
        ]);
      }

      // Add overall progress
      if (userProgress) {
        const progressText = `**${userProgress.successfulSubmissions}/30** successful submissions\n**${userProgress.totalSubmissions}** total submissions`;
        const eligibilityText = userProgress.isEligibleForPrize
          ? "🏆 **Eligible for prize!**"
          : `Need ${30 - userProgress.successfulSubmissions} more successful submissions`;

        statusEmbed.addFields([
          {
            name: "📊 Overall Progress",
            value: `${progressText}\n${eligibilityText}`,
          },
        ]);
      } else {
        statusEmbed.addFields([
          {
            name: "📊 Overall Progress",
            value:
              "**0/30** successful submissions\nMake your first submission to start tracking progress!",
          },
        ]);
      }

      // Add examples
      statusEmbed.addFields([
        {
          name: "💡 Example Submissions",
          value: WordleService.generateExampleDisplay(todayWord.letters),
        },
        {
          name: "📝 Commands",
          value:
            "• `/wordle-submit` - Submit your 5 achievements\n• `/wordle-reset` - Reset today's submission\n• `/wordle-connect` - Change connected RA account",
        },
      ]);

      statusEmbed.setFooter({
        text: `Event Date: ${todayWord.date} | Connected as: ${userConnection.raUsername}`,
      });

      await interaction.editReply({ embeds: [statusEmbed] });
    } catch (error) {
      console.error("Error in wordle-status command:", error);

      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Status Error")
        .setDescription(
          "An unexpected error occurred while fetching your status. Please try again later.",
        )
        .setColor(COLORS.ERROR);

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },
};

export default wordleStatusCommand;
