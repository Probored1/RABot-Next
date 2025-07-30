import { EmbedBuilder, SlashCommandBuilder } from "discord.js";

import { COLORS } from "../config/constants";
import type { SlashCommand } from "../models";
import { WordleService } from "../services/wordle.service";
import { AdminChecker } from "../utils/admin-checker";

const wordleAdminCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("wordle-admin")
    .setDescription("Admin commands for the Wordle Achievement Event")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("set-word")
        .setDescription("Set today's Wordle word for the event")
        .addStringOption((option) =>
          option
            .setName("word")
            .setDescription("The 5-letter word for today's event")
            .setRequired(true)
            .setMinLength(5)
            .setMaxLength(5),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("get-word").setDescription("Get today's current Wordle word"),
    ),

  async execute(interaction) {
    // Check if user is admin
    const isAdmin = AdminChecker.isAdminFromInteraction(interaction);
    if (!isAdmin) {
      const notAdminEmbed = new EmbedBuilder()
        .setTitle("🔒 Access Denied")
        .setDescription("You don't have permission to use admin commands.")
        .setColor(COLORS.ERROR);

      await interaction.reply({ embeds: [notAdminEmbed], ephemeral: true });

      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "set-word") {
      await handleSetWord(interaction);
    } else if (subcommand === "get-word") {
      await handleGetWord(interaction);
    }
  },
};

async function handleSetWord(interaction: any) {
  const word = interaction.options.getString("word", true).trim().toUpperCase();

  // Validate word is exactly 5 letters and contains only alphabetic characters
  if (!/^[A-Z]{5}$/.test(word)) {
    const invalidWordEmbed = new EmbedBuilder()
      .setTitle("❌ Invalid Word")
      .setDescription("The word must be exactly 5 letters and contain only alphabetic characters.")
      .setColor(COLORS.ERROR);

    await interaction.reply({ embeds: [invalidWordEmbed], ephemeral: true });

    return;
  }

  // Defer reply since setting word might take time
  await interaction.deferReply({ ephemeral: true });

  try {
    const dailyWord = await WordleService.setTodayWord(word);
    if (!dailyWord) {
      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Failed to Set Word")
        .setDescription("Could not set today's word. Please try again later.")
        .setColor(COLORS.ERROR);

      await interaction.editReply({ embeds: [errorEmbed] });

      return;
    }

    const successEmbed = new EmbedBuilder()
      .setTitle("✅ Word Set Successfully")
      .setDescription(`Today's Wordle word has been set to: **${dailyWord.word}**`)
      .addFields([
        {
          name: "📅 Date",
          value: dailyWord.date,
          inline: true,
        },
        {
          name: "🔤 Letters",
          value: dailyWord.letters.join(" - "),
          inline: true,
        },
        {
          name: "📊 Event Status",
          value: "✅ **Active** - Users can now submit achievements!",
        },
        {
          name: "💡 Example Display",
          value: WordleService.generateExampleDisplay(dailyWord.letters),
        },
      ])
      .setColor(COLORS.SUCCESS)
      .setFooter({ text: `Set by: ${interaction.user.tag}` });

    await interaction.editReply({ embeds: [successEmbed] });
  } catch (error) {
    console.error("Error setting Wordle word:", error);

    const errorEmbed = new EmbedBuilder()
      .setTitle("❌ Error Setting Word")
      .setDescription(
        "An unexpected error occurred while setting the word. Please try again later.",
      )
      .setColor(COLORS.ERROR);

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleGetWord(interaction: any) {
  // Defer reply since getting word might take time
  await interaction.deferReply({ ephemeral: true });

  try {
    const todayWord = await WordleService.getTodayWord();
    if (!todayWord) {
      const noWordEmbed = new EmbedBuilder()
        .setTitle("📅 No Word Set")
        .setDescription("No word has been set for today. Use `/wordle-admin set-word` to set one.")
        .addFields([
          {
            name: "📊 Event Status",
            value: "❌ **Inactive** - Users cannot submit achievements until a word is set.",
          },
        ])
        .setColor(COLORS.WARNING);

      await interaction.editReply({ embeds: [noWordEmbed] });

      return;
    }

    const wordEmbed = new EmbedBuilder()
      .setTitle("📅 Today's Wordle Word")
      .setDescription(`**${todayWord.word}**`)
      .addFields([
        {
          name: "📅 Date",
          value: todayWord.date,
          inline: true,
        },
        {
          name: "🔤 Letters",
          value: todayWord.letters.join(" - "),
          inline: true,
        },
        {
          name: "📊 Event Status",
          value: "✅ **Active** - Users can submit achievements!",
        },
        {
          name: "🎯 User Display",
          value: WordleService.formatTodayWordDisplay(todayWord),
        },
      ])
      .setColor(COLORS.PRIMARY)
      .setFooter({ text: `Created: ${todayWord.createdAt.toISOString().split("T")[0]}` });

    await interaction.editReply({ embeds: [wordEmbed] });
  } catch (error) {
    console.error("Error getting Wordle word:", error);

    const errorEmbed = new EmbedBuilder()
      .setTitle("❌ Error Getting Word")
      .setDescription(
        "An unexpected error occurred while retrieving the word. Please try again later.",
      )
      .setColor(COLORS.ERROR);

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

export default wordleAdminCommand;
