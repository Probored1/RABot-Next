import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { eq } from "drizzle-orm";

import { COLORS } from "../config/constants";
import { db } from "../database/db";
import { wordleDailyWords } from "../database/schema";
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
        .setDescription("Override today's Wordle word (normally auto-fetched from API)")
        .addStringOption((option) =>
          option
            .setName("word")
            .setDescription("The 5-letter word to override today's word")
            .setRequired(true)
            .setMinLength(5)
            .setMaxLength(5),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("get-word").setDescription("Get today's current Wordle word and source"),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("refresh-word").setDescription("Force refresh today's word from API"),
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
    } else if (subcommand === "refresh-word") {
      await handleRefreshWord(interaction);
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
    const dailyWord = await WordleService.setAdminWord(word);
    if (!dailyWord) {
      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Failed to Set Word")
        .setDescription("Could not set today's word. Please try again later.")
        .setColor(COLORS.ERROR);

      await interaction.editReply({ embeds: [errorEmbed] });

      return;
    }

    const successEmbed = new EmbedBuilder()
      .setTitle("✅ Word Override Successful")
      .setDescription(`Today's Wordle word has been overridden to: **${dailyWord.word}**`)
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
        {
          name: "⚠️ Note",
          value: "This word was manually set by an admin, overriding the automatic API word.",
        },
      ])
      .setColor(COLORS.SUCCESS)
      .setFooter({ text: `Overridden by: ${interaction.user.tag}` });

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
        .setTitle("📅 No Word Available")
        .setDescription("No word is available for today. The system will automatically fetch one when needed.")
        .addFields([
          {
            name: "📊 Event Status",
            value: "⏳ **Pending** - Word will be auto-fetched when first requested.",
          },
          {
            name: "🔄 Auto-System",
            value: "Words are now automatically fetched from an online API daily.",
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
        {
          name: "🔄 Auto-System",
          value: "Words are now automatically fetched from an online API daily.",
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

async function handleRefreshWord(interaction: any) {
  // Defer reply since refreshing word might take time
  await interaction.deferReply({ ephemeral: true });

  try {
    // Force refresh by deleting today's word and fetching a new one
    const todayString = WordleService.getTodayString();
    
    // Delete existing word for today
    await db
      .delete(wordleDailyWords)
      .where(eq(wordleDailyWords.date, todayString));

    // Fetch new word from API
    const newWord = await WordleService.getTodayWord();
    
    if (!newWord) {
      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Failed to Refresh Word")
        .setDescription("Could not fetch a new word from the API. Please try again later.")
        .setColor(COLORS.ERROR);

      await interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    const successEmbed = new EmbedBuilder()
      .setTitle("🔄 Word Refreshed Successfully")
      .setDescription(`Today's Wordle word has been refreshed to: **${newWord.word}**`)
      .addFields([
        {
          name: "📅 Date",
          value: newWord.date,
          inline: true,
        },
        {
          name: "🔤 Letters",
          value: newWord.letters.join(" - "),
          inline: true,
        },
        {
          name: "📊 Event Status",
          value: "✅ **Active** - Users can submit achievements!",
        },
        {
          name: "💡 Example Display",
          value: WordleService.generateExampleDisplay(newWord.letters),
        },
        {
          name: "🔄 Source",
          value: "Freshly fetched from online Wordle API",
        },
      ])
      .setColor(COLORS.SUCCESS)
      .setFooter({ text: `Refreshed by: ${interaction.user.tag}` });

    await interaction.editReply({ embeds: [successEmbed] });
  } catch (error) {
    console.error("Error refreshing Wordle word:", error);

    const errorEmbed = new EmbedBuilder()
      .setTitle("❌ Error Refreshing Word")
      .setDescription(
        "An unexpected error occurred while refreshing the word. Please try again later.",
      )
      .setColor(COLORS.ERROR);

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

export default wordleAdminCommand;
