/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * Copyright (c) Kotone <git@ktn.works>
 */

import { Client, Collection, SlashCommandBuilder, REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';
import { t } from './i18n.js';
import { logger } from './logger.js';

export interface Command {
  data: SlashCommandBuilder;
  execute: (interaction: any) => Promise<void>;
}

declare module 'discord.js' {
  export interface Client {
    commands: Collection<string, Command>;
  }
}

export async function loadCommands(client: Client): Promise<void> {
  client.commands = new Collection();
  const commands = [];
  
  const commandsPath = join(__dirname, '..', 'commands');
  
  try {
    const commandFiles = readdirSync(commandsPath)
      .filter(file => file.endsWith('.ts') || file.endsWith('.js'));
    
    for (const file of commandFiles) {
      const filePath = join(commandsPath, file);
      const command = await import(filePath);
      
      if ('data' in command.default && 'execute' in command.default) {
        client.commands.set(command.default.data.name, command.default);
        commands.push(command.default.data.toJSON());
        logger.info(`Loaded command: ${command.default.data.name}`);
      } else {
        logger.warn(`Command at ${filePath} is missing required "data" or "execute" property`);
      }
    }
    
    // Register global commands
    if (process.env.DISCORD_TOKEN && process.env.CLIENT_ID) {
      const rest = new REST().setToken(process.env.DISCORD_TOKEN);
      
      logger.info(`Started refreshing ${commands.length} application (/) commands globally.`);
      
      const data = await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands },
      ) as any[];
      
      logger.info(`Successfully reloaded ${data.length} application (/) commands globally.`);
    }
    
    // Set up interaction handler
    client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      
      const command = client.commands.get(interaction.commandName);
      
      if (!command) {
        logger.error(`No command matching ${interaction.commandName} was found.`);
        return;
      }
      
      try {
        await command.execute(interaction);
      } catch (error) {
        logger.error('Error executing command:', error);
        
        const guildId = interaction.guild?.id;
        const locale = interaction.guild?.preferredLocale;
        const reply = {
          content: t(guildId, locale, 'errors.command_error'),
          flags: 64, // MessageFlags.Ephemeral
        };
        
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply);
        } else {
          await interaction.reply(reply);
        }
      }
    });
  } catch (error) {
    logger.error('Error loading commands:', error);
    throw error;
  }
}
