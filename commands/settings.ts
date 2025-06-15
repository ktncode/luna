/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * Copyright (c) Kotone <git@ktn.works>
 */

import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, SlashCommandSubcommandBuilder } from 'discord.js';
import { tCmd } from '../services/i18n.js';
import { createWebhook, getGuildWebhooks, deleteWebhook, I18nManager } from '../services/db.js';
import { randomBytes } from 'crypto';

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
    .addSubcommand(subcommand =>
      subcommand
        .setName('webhook')
        .setDescription('Manage webhook settings')
        .addStringOption(option =>
          option.setName('action')
            .setDescription('Action to perform')
            .setRequired(true)
            .addChoices(
              { name: 'create', value: 'create' },
              { name: 'list', value: 'list' },
              { name: 'delete', value: 'delete' }
            )
        )
        .addStringOption(option =>
          option.setName('name')
            .setDescription('Webhook name')
            .setRequired(false)
        )
        .addStringOption(option =>
          option.setName('channel_id')
            .setDescription('Discord channel ID where messages will be sent')
            .setDescriptionLocalization('ja', 'メッセージを送信するDiscordチャンネルID')
            .setRequired(false)
        )
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
    } else if (subcommand === 'webhook') {
      const action = interaction.options.getString('action', true);
      const guildId = interaction.guildId!;

      switch (action) {
        case 'create': {
          const name = interaction.options.getString('name');
          const channelId = interaction.options.getString('channel_id');

          if (!name || !channelId) {
            await interaction.reply({
              content: tCmd(interaction, 'commands.settings.webhook.create.missing_params'),
              flags: 64
            });
            return;
          }

          // チャンネルIDの検証
          if (!/^\d{17,19}$/.test(channelId)) {
            await interaction.reply({
              content: tCmd(interaction, 'commands.settings.webhook.create.invalid_channel'),
              flags: 64
            });
            return;
          }

          // 重複しないWebHookパスを生成（最大10回試行）
          let webhookPath: string;
          let success = false;
          let attempts = 0;
          
          do {
            webhookPath = randomBytes(6).toString('hex'); // 12桁のhex文字列
            success = await createWebhook(guildId, webhookPath, channelId, name);
            attempts++;
          } while (!success && attempts < 10);

          if (success) {
            const webhookUrl = `https://luna.ktn.cat/webhook/${webhookPath}`;
            const channelMention = `<#${channelId}>`;
            await interaction.reply({
              content: tCmd(interaction, 'commands.settings.webhook.create.success', { 
                name: name, 
                url: webhookUrl,
                channel: channelMention
              }),
              flags: 64
            });
          } else {
            await interaction.reply({
              content: tCmd(interaction, 'commands.settings.webhook.create.failed'),
              flags: 64
            });
          }
          break;
        }

        case 'list': {
          const webhooks = await getGuildWebhooks(guildId);
          
          if (webhooks.length === 0) {
            await interaction.reply({
              content: tCmd(interaction, 'commands.settings.webhook.list.empty'),
              flags: 64
            });
            return;
          }

          const webhookList = webhooks
            .filter(w => w.enabled)
            .map(w => tCmd(interaction, 'commands.settings.webhook.list.item', {
              name: w.name,
              url: `https://luna.ktn.cat/webhook/${w.webhook_path}`,
              channel: `<#${w.channel_id}>`,
              created: new Date(w.created_at).toLocaleDateString()
            }))
            .join('\n');

          await interaction.reply({
            content: tCmd(interaction, 'commands.settings.webhook.list.title') + '\n' + webhookList,
            flags: 64
          });
          break;
        }

        case 'delete': {
          const webhookName = interaction.options.getString('name');
          
          if (!webhookName) {
            await interaction.reply({
              content: tCmd(interaction, 'commands.settings.webhook.delete.missing_name'),
              flags: 64
            });
            return;
          }

          // 名前で検索
          const webhooks = await getGuildWebhooks(guildId);
          const targetWebhook = webhooks.find(w => w.name === webhookName && w.enabled);
          
          if (!targetWebhook) {
            await interaction.reply({
              content: tCmd(interaction, 'commands.settings.webhook.delete.not_found'),
              flags: 64
            });
            return;
          }

          const success = await deleteWebhook(guildId, targetWebhook.id);
          
          if (success) {
            await interaction.reply({
              content: tCmd(interaction, 'commands.settings.webhook.delete.success', { 
                name: targetWebhook.name 
              }),
              flags: 64
            });
          } else {
            await interaction.reply({
              content: tCmd(interaction, 'commands.settings.webhook.delete.failed'),
              flags: 64
            });
          }
          break;
        }
      }
      return;
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
