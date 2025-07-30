// Define COLORS as a const object so values have literal types, not just `number`
import { EmbedBuilder, SlashCommandBuilder } from "discord.js";

// import { COLORS } from "../config/constants";
import type { SlashCommand } from "../models";
import { RAUserService } from "../services/ra-user.service";
import { WordleService } from "../services/wordle.service";

//const COLORS = {
//  SUCCESS: 0x00ff00, // 65280 decimal
//  ERROR: 0xff0000, // 16711680 decimal
//} as const;

// Somewhere in your code where you declare validationColor, specify the type as one of the literal values:
// let validationColor: typeof COLORS.SUCCESS | typeof COLORS.ERROR;

// Then assign without casting:
// validationColor = COLORS.ERROR;   // no TS error
// ...
// validationColor = COLORS.SUCCESS; // no TS error

// Assuming validationColor is declared here:
// let _validationColor: typeof COLORS.SUCCESS | typeof COLORS.ERROR;

//function _someFunction() {
// ...

//  if (someErrorCondition) {
//    validationColor = COLORS.ERROR; // valid assignment
//  } else {
//    validationColor = COLORS.SUCCESS; // valid assignment
//  }

// ...
//}

const wordleSubmitCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("wordle-submit")
    .setDescription("Submit your 5 achievements for today's Wordle Achievement Event")
    .addStringOption((option) =>
      option
        .setName("achievement1")
        .setDescription("First achievement URL or ID")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("achievement2")
        .setDescription("Second achievement URL or ID")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("achievement3")
        .setDescription("Third achievement URL or ID")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("achievement4")
        .setDescription("Fourth achievement URL or ID")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("achievement5")
        .setDescription("Fifth achievement URL or ID")
        .setRequired(true),
    ),

  async execute(interaction) {
    const discordUserId = interaction.user.id;
    const achievementInputs = [
      interaction.options.getString("achievement1", true).trim(),
      interaction.options.getString("achievement2", true).trim(),
      interaction.options.getString("achievement3", true).trim(),
      interaction.options.getString("achievement4", true).trim(),
      interaction.options.getString("achievement5", true).trim(),
    ];

    // Defer reply since validation might take time
    await interaction.deferReply({ ephemeral: true });

    try {
      // Check if event is active
      const isEventActive = await WordleService.isEventActive();
      if (!isEventActive) {
        const noEventEmbed = new EmbedBuilder()
          .setTitle("📅 No Active Wordle Event")
          .setDescription(
            "There is currently no active Wordle Achievement Event. An administrator needs to set today's word to start the event.",
          );
        //          .setColor(COLORS.WARNING);

        await interaction.editReply({ embeds: [noEventEmbed] });

        return;
      }

      // Get today's word
      const todayWord = await WordleService.getTodayWord();
      if (!todayWord) {
        const errorEmbed = new EmbedBuilder()
          .setTitle("❌ Error Loading Event")
          .setDescription("Could not load today's Wordle word. Please try again later.");
        //          .setColor(COLORS.ERROR);

        await interaction.editReply({ embeds: [errorEmbed] });

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
          ]);
        //          .setColor(COLORS.WARNING);

        await interaction.editReply({ embeds: [notConnectedEmbed] });

        return;
      }

      // Validate achievement URLs/IDs
      const { ids: achievementIds, errors: urlErrors } =
        WordleService.validateAchievementIds(achievementInputs);
      if (urlErrors.length > 0) {
        const urlErrorEmbed = new EmbedBuilder()
          .setTitle("❌ Invalid Achievement URLs/IDs")
          .setDescription(urlErrors.join("\n"))
          .addFields([
            {
              name: "✅ Valid Formats",
              value:
                "• `https://retroachievements.org/achievement/123456`\n• `123456` (just the ID)",
            },
          ]);
        //          .setColor(COLORS.ERROR);

        await interaction.editReply({ embeds: [urlErrorEmbed] });

        return;
      }

      // Submit achievements (this will update if already exists)
      const todayString = WordleService.getTodayString();
      const submission = await RAUserService.submitAchievements(
        discordUserId,
        todayString,
        achievementIds,
        achievementInputs,
      );

      if (!submission) {
        const errorEmbed = new EmbedBuilder()
          .setTitle("❌ Submission Failed")
          .setDescription("Failed to save your submission. Please try again later.");
        //          .setColor(COLORS.ERROR);

        await interaction.editReply({ embeds: [errorEmbed] });

        return;
      }

      // Start validation process
      const validationResult = await RAUserService.validateAchievementsEarnedOnDate(
        userConnection.raUsername,
        achievementIds,
        todayString,
      );

      let validationStatus = "";
      //      let validationColor = COLORS.WARNING;

      if (!validationResult.isValid) {
        // Mark as invalid
        await RAUserService.markSubmissionValidated(submission.id, false, validationResult.message);
        await RAUserService.updateUserProgress(discordUserId, todayString, false);

        validationStatus = "❌ **Validation Failed**";
        //        validationColor = COLORS.ERROR as number;
      } else if (validationResult.achievementTitles) {
        // Validate first letters match
        const letterValidation = WordleService.validateAchievementTitles(
          validationResult.achievementTitles,
          todayWord.letters,
        );

        if (!letterValidation.isValid) {
          // Mark as invalid due to letter mismatch
          await RAUserService.markSubmissionValidated(
            submission.id,
            false,
            letterValidation.message,
          );
          await RAUserService.updateUserProgress(discordUserId, todayString, false);

          validationStatus = "❌ **Letter Validation Failed**";
          //          validationColor = COLORS.ERROR as number;
        } else {
          // Mark as valid
          await RAUserService.markSubmissionValidated(
            submission.id,
            true,
            letterValidation.message,
          );
          const updatedProgress = await RAUserService.updateUserProgress(
            discordUserId,
            todayString,
            true,
          );

          validationStatus = "✅ **Validation Successful**";
          //          validationColor = COLORS.SUCCESS as number;

          // Check if user became eligible for prize
          if (updatedProgress?.isEligibleForPrize && updatedProgress.successfulSubmissions === 30) {
            validationStatus += "\n🏆 **Congratulations! You're now eligible for a prize!**";
          }
        }
      } else {
        // Should not happen, but handle gracefully
        await RAUserService.markSubmissionValidated(
          submission.id,
          false,
          "Validation failed due to missing achievement data.",
        );
        await RAUserService.updateUserProgress(discordUserId, todayString, false);

        validationStatus = "❌ **Validation Error**";
        //        validationColor = COLORS.ERROR as number;
      }

      // Build result embed
      const resultEmbed = new EmbedBuilder()
        .setTitle("📋 Submission Result")
        .setDescription(`${validationStatus}\n\n**Today's Word:** ${todayWord.word}`)
        .addFields([
          {
            name: "📝 Submitted Achievements",
            value: achievementInputs.map((input, i) => `${i + 1}. ${input}`).join("\n"),
          },
        ]);
      //        .setColor(validationColor);

      if (validationResult.achievementTitles && validationResult.isValid) {
        resultEmbed.addFields([
          {
            name: "🎯 Achievement Titles",
            value: validationResult.achievementTitles
              .map((title, i) => `${todayWord.letters[i]}: "${title}"`)
              .join("\n"),
          },
        ]);
      }

      resultEmbed.addFields([
        {
          name: "💬 Validation Message",
          value: validationResult.message,
        },
        {
          name: "📊 Next Steps",
          value:
            "• Use `/wordle-status` to check your overall progress\n• Use `/wordle-reset` if you need to change your submission\n• Come back tomorrow for the next word!",
        },
      ]);

      resultEmbed.setFooter({
        text: `Submitted: ${todayString} | RA Account: ${userConnection.raUsername}`,
      });

      await interaction.editReply({ embeds: [resultEmbed] });
    } catch (error) {
      console.error("Error in wordle-submit command:", error);

      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Submission Error")
        .setDescription(
          "An unexpected error occurred while processing your submission. Please try again later.",
        );
      //        .setColor(COLORS.ERROR);

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },
};

export default wordleSubmitCommand;
