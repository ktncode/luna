/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * Copyright (c) Kotone <git@ktn.works>
 */

import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { tCmd } from '../services/i18n.js';
import { I18nManager } from '../services/db.js';

export default {
  data: new SlashCommandBuilder()
    .setName('settings')
    .setDescription('Configure server settings')
    .setDescriptionLocalization('ja', 'サーバー設定を管理します')
    .addSubcommand(subcommand =>
      subcommand
        .setName('language')
        .setDescription('Configure server language settings')
        .setDescriptionLocalization('ja', 'サーバーの言語設定を管理します')
        .addStringOption(option =>
          option.setName('locale')
            .setDescription('Set server language (leave empty to use Discord default)')
            .setDescriptionLocalization('ja', 'サーバー言語を設定（空欄でDiscordデフォルト）')
            .setRequired(false)
            .addChoices(
              { name: '日本語', value: 'ja-JP' },
              { name: 'English', value: 'en-US' },
              { name: 'Discord Default', value: 'auto' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('View current server settings')
        .setDescriptionLocalization('ja', '現在のサーバー設定を表示します')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ ' + tCmd(interaction, 'errors.command_error'))
        .setDescription('This command can only be used in a server.')
        .setTimestamp();
      
      await interaction.reply({
        embeds: [errorEmbed],
        flags: 64
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'language') {
      await handleLanguageSettings(interaction);
    } else if (subcommand === 'view') {
      await handleViewSettings(interaction);
    }
  },
};

async function handleLanguageSettings(interaction: ChatInputCommandInteraction) {
  const locale = interaction.options.getString('locale');
  const guildId = interaction.guild!.id;

  if (locale === undefined) {
    // 現在の言語設定を表示
    const currentLocale = I18nManager.getGuildLocale(guildId);
    const displayLocale = currentLocale || 'Discord Default';
    
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(tCmd(interaction, 'commands.settings.language.current_title'))
      .addFields(
        {
          name: tCmd(interaction, 'commands.settings.language.current_language'),
          value: getLocaleDisplayName(displayLocale),
          inline: true
        },
        {
          name: tCmd(interaction, 'commands.settings.language.discord_language'),
          value: interaction.guild!.preferredLocale || 'Unknown',
          inline: true
        }
      )
      .setFooter({ text: tCmd(interaction, 'commands.settings.language.help_text') })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    return;
  }

  // 言語設定を変更
  let newLocale: string | null = null;
  if (locale === 'auto') {
    newLocale = null; // Discord default
  } else {
    newLocale = locale;
  }

  const success = I18nManager.setGuildLocale(guildId, newLocale);

  if (success) {
    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ ' + tCmd(interaction, 'commands.settings.language.success_title'))
      .setDescription(tCmd(interaction, 'commands.settings.language.success_description', {
        language: getLocaleDisplayName(newLocale || 'Discord Default')
      }))
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } else {
    const errorEmbed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('❌ ' + tCmd(interaction, 'commands.settings.language.error_title'))
      .setDescription(tCmd(interaction, 'commands.settings.language.error_description'))
      .setTimestamp();

    await interaction.reply({
      embeds: [errorEmbed],
      flags: 64
    });
  }
}

async function handleViewSettings(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guild!.id;
  const currentLocale = I18nManager.getGuildLocale(guildId);
  const displayLocale = currentLocale || 'Discord Default';

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(tCmd(interaction, 'commands.settings.view.title'))
    .setDescription(tCmd(interaction, 'commands.settings.view.description'))
    .addFields(
      {
        name: '🌍 ' + tCmd(interaction, 'commands.settings.view.language_section'),
        value: [
          `**${tCmd(interaction, 'commands.settings.view.current_language')}:** ${getLocaleDisplayName(displayLocale)}`,
          `**${tCmd(interaction, 'commands.settings.view.discord_language')}:** ${interaction.guild!.preferredLocale || 'Unknown'}`,
          `**${tCmd(interaction, 'commands.settings.view.auto_detection')}:** ${currentLocale === null ? '✅' : '❌'}`
        ].join('\n'),
        inline: false
      },
      {
        name: '⚙️ ' + tCmd(interaction, 'commands.settings.view.other_section'),
        value: tCmd(interaction, 'commands.settings.view.coming_soon'),
        inline: false
      }
    )
    .setFooter({ text: tCmd(interaction, 'commands.settings.view.footer') })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

function getLocaleDisplayName(locale: string): string {
  const localeNames: Record<string, string> = {
    'ja-JP': '🇯🇵 日本語',
    'en-US': '🇺🇸 English',
    'Discord Default': '🤖 Discord Default'
  };
  
  return localeNames[locale] || locale;
}
