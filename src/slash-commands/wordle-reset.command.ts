import { EmbedBuilder, SlashCommandBuilder } from "discord.js";

import { COLORS } from "../config/constants";
import type { SlashCommand } from "../models";
import { RAUserService } from "../services/ra-user.service";
import { WordleService } from "../services/wordle.service";

const wordleResetCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("wordle-reset")
    .setDescription("Reset your submission for today's Wordle Achievement Event"),

  async execute(interaction) {
    const discordUserId = interaction.user.id;

    // Defer reply since we need to check data
    await interaction.deferReply({ ephemeral: true });

    try {
      // Check if event is active
      const isEventActive = await WordleService.isEventActive();
      if (!isEventActive) {
        const noEventEmbed = new EmbedBuilder()
          .setTitle("📅 No Active Wordle Event")
          .setDescription(
            "There is currently no active Wordle Achievement Event. An administrator needs to set today's word to start the event.",
          )
          .setColor(COLORS.WARNING);

        await interaction.editReply({ embeds: [noEventEmbed] });
        return;
      }

      // Check if user is connected
      const userConnection = await RAUserService.getUserConnection(discordUserId);
      if (!userConnection) {
        const notConnectedEmbed = new EmbedBuilder()
          .setTitle("🔗 Account Not Connected")
          .setDescription("You need to connect your RetroAchievements account first!")
          .addFields([
            {
              name: "📝 How to Connect",
              value: "Use `/wordle-connect <username>` to link your RA account",
            },
          ])
          .setColor(COLORS.WARNING);

        await interaction.editReply({ embeds: [notConnectedEmbed] });
        return;
      }

      // Delete today's submission
      const todayString = WordleService.getTodayString();
      const deleted = await RAUserService.deleteSubmission(discordUserId, todayString);

      if (!deleted) {
        const noSubmissionEmbed = new EmbedBuilder()
          .setTitle("📋 No Submission Found")
          .setDescription("You don't have a submission for today to reset.")
          .addFields([
            {
              name: "📝 Next Steps",
              value: "• Use `/wordle-status` to check today's word\n• Use `/wordle-submit` to make your submission",
            },
          ])
          .setColor(COLORS.INFO);

        await interaction.editReply({ embeds: [noSubmissionEmbed] });
        return;
      }

      // Success message
      const successEmbed = new EmbedBuilder()
        .setTitle("🔄 Submission Reset")
        .setDescription(`Successfully reset your submission for **${todayString}**.`)
        .addFields([
          {
            name: "📝 What's Next?",
            value: "• Use `/wordle-status` to check today's word requirements\n• Use `/wordle-submit` to make a new submission",
          },
          {
            name: "ℹ️ Important",
            value: "You can only make one submission per day, so make sure your new submission is correct!",
          },
        ])
        .setColor(COLORS.SUCCESS)
        .setFooter({ text: `Connected as: ${userConnection.raUsername}` });

      await interaction.editReply({ embeds: [successEmbed] });
    } catch (error) {
      console.error("Error in wordle-reset command:", error);

      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Reset Error")
        .setDescription("An unexpected error occurred while resetting your submission. Please try again later.")
        .setColor(COLORS.ERROR);

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },
};

export default wordleResetCommand;