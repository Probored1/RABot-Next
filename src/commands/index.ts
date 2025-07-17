import { Glob } from "bun";
import { Collection } from "discord.js";

import type { Command } from "../models";
import { logError, logger } from "../utils/logger";

export async function loadCommands(): Promise<Collection<string, Command>> {
  const commands = new Collection<string, Command>();

  // Use Bun's glob to find all command files.
  const glob = new Glob("**/*.command.ts");
  const commandFiles = Array.from(glob.scanSync({ cwd: import.meta.dir }));

  for (const file of commandFiles) {
    try {
      const commandModule = await import(`./${file}`);
      const command: Command = commandModule.default || commandModule;

      if (!command.name || !command.execute) {
        logger.warn(`Invalid command file: ${file}`);
        continue;
      }

      commands.set(command.name, command);
      logger.debug(`✅ Loaded command: ${command.name}`);
    } catch (error) {
      logError(error, {
        event: "command_load_error",
        file,
      });
    }
  }

  return commands;
}
