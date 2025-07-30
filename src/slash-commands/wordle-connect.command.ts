import { EmbedBuilder, SlashCommandBuilder } from "discord.js";

import { COLORS } from "../config/constants";
import type { SlashCommand } from "../models";
import { RAUserService } from "../services/ra-user.service";

const wordleConnectCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("wordle-connect")
    .setDescription(
      "Connect your Discord account to your RetroAchievements profile for the Wordle Achievement Event",
    )
    .addStringOption((option) =>
      option
        .setName("username")
        .setDescription("Your RetroAchievements username")
        .setRequired(true),
    ),

  async execute(interaction) {
    const raUsername = interaction.options.getString("username", true).trim();
    const discordUserId = interaction.user.id;

    // Defer reply since verification might take time
    await interaction.deferReply({ ephemeral: true });

    try {
      // Validate RetroAchievements username
      const isValidUser = await RAUserService.verifyRAUser(raUsername);
      if (!isValidUser) {
        const errorEmbed = new EmbedBuilder()
          .setTitle("❌ Invalid Username")
          .setDescription(
            `The RetroAchievements username "${raUsername}" could not be found. Please check your username and try again.`,
          )
          .setColor(COLORS.ERROR)
          .setFooter({ text: "Make sure to use your exact RA username" });

        await interaction.editReply({ embeds: [errorEmbed] });

        return;
      }

      // Connect the user
      const connection = await RAUserService.connectUser(discordUserId, raUsername);
      if (!connection) {
        const errorEmbed = new EmbedBuilder()
          .setTitle("❌ Connection Failed")
          .setDescription(
            "Failed to connect your account. Please try again later or contact an administrator.",
          )
          .setColor(COLORS.ERROR);

        await interaction.editReply({ embeds: [errorEmbed] });

        return;
      }

      // Success message
      const successEmbed = new EmbedBuilder()
        .setTitle("✅ Account Connected!")
        .setDescription(
          `Successfully connected your Discord account to **${raUsername}** on RetroAchievements!`,
        )
        .addFields([
          {
            name: "📝 What's Next?",
            value:
              "• Use `/wordle-status` to check today's word and your progress\n• Use `/wordle-submit` to submit your 5 achievements\n• Use `/wordle-reset` if you need to change your submission",
          },
          {
            name: "🎯 Event Goal",
            value:
              "Complete 30 successful Wordle Achievement submissions to become eligible for a prize!",
          },
        ])
        .setColor(COLORS.SUCCESS)
        .setFooter({ text: "Your account verification is complete!" });

      await interaction.editReply({ embeds: [successEmbed] });
    } catch (error) {
      console.error("Error in wordle-connect command:", error);

      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Connection Error")
        .setDescription(
          "An unexpected error occurred while connecting your account. Please try again later.",
        )
        .setColor(COLORS.ERROR);

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },
};

export default wordleConnectCommand;
