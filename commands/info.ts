/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * Copyright (c) Kotone <git@ktn.works>
 */

import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { cpus, totalmem, freemem, arch, platform } from 'os';
import { readFileSync } from 'fs';
import { join } from 'path';
import { t } from '../services/i18n.js';

export default {
  data: new SlashCommandBuilder()
    .setName('info')
    .setDescription('Display information about Luna Bot')
    .setDescriptionLocalization('ja', 'Luna Botの情報を表示します'),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const locale = interaction.guild?.preferredLocale;
    
    // Get version from package.json (read from project root, not dist)
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
    const version = packageJson.version;
    
    const cpuInfo = cpus()[0];
    const totalMemory = totalmem();
    const freeMemory = freemem();
    const usedMemory = totalMemory - freeMemory;
    
    // Format memory in GB
    const totalGB = (totalMemory / 1024 / 1024 / 1024).toFixed(2);
    const usedGB = (usedMemory / 1024 / 1024 / 1024).toFixed(2);
    const memoryUsage = ((usedMemory / totalMemory) * 100).toFixed(1);
    
    // Get process memory usage
    const processMemory = process.memoryUsage();
    const processUsedMB = (processMemory.heapUsed / 1024 / 1024).toFixed(2);
    
    // Get server language if in a guild
    const serverLanguage = interaction.guild?.preferredLocale || 'Unknown';
    
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(t(locale, 'commands.info.embed.title'))
      .setDescription(t(locale, 'commands.info.embed.description'))
      .addFields(
        { name: `📊 ${t(locale, 'commands.info.embed.fields.version')}`, value: version, inline: true },
        { name: `🔧 ${t(locale, 'commands.info.embed.fields.framework')}`, value: 'Discord.js v14', inline: true },
        { name: `⚡ ${t(locale, 'commands.info.embed.fields.runtime')}`, value: `Node.js ${process.version}`, inline: true },
        { name: `💻 ${t(locale, 'commands.info.embed.fields.cpu_model')}`, value: cpuInfo.model, inline: false },
        { name: `🏗️ ${t(locale, 'commands.info.embed.fields.architecture')}`, value: `${arch()} (${platform()})`, inline: true },
        { name: `⚙️ ${t(locale, 'commands.info.embed.fields.cpu_cores')}`, value: `${cpus().length} cores`, inline: true },
        { name: `🧠 ${t(locale, 'commands.info.embed.fields.system_memory')}`, value: `${usedGB}GB / ${totalGB}GB (${memoryUsage}%)`, inline: true },
        { name: `📦 ${t(locale, 'commands.info.embed.fields.bot_memory')}`, value: `${processUsedMB}MB`, inline: true },
        { name: `📄 ${t(locale, 'commands.info.embed.fields.license')}`, value: 'Mozilla Public License v2.0', inline: true },
        { name: `👥 ${t(locale, 'commands.info.embed.fields.servers')}`, value: `${interaction.client.guilds.cache.size}`, inline: true },
        { name: `👤 ${t(locale, 'commands.info.embed.fields.users')}`, value: `${interaction.client.users.cache.size}`, inline: true },
        { name: `🌍 ${t(locale, 'commands.info.embed.fields.server_language')}`, value: serverLanguage, inline: true }
      )
      .setFooter({ text: t(locale, 'commands.info.embed.footer') })
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
  },
};
