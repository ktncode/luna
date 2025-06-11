/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * Copyright (c) Kotone <git@ktn.works>
 */

import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, GuildMember } from 'discord.js';
import { t } from '../services/i18n.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from the server')
    .setDescriptionLocalization('ja', 'ユーザーをサーバーからBANします')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to ban')
        .setDescriptionLocalization('ja', 'BANするユーザー')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the ban')
        .setDescriptionLocalization('ja', 'BANの理由')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction: ChatInputCommandInteraction) {
    const locale = interaction.guild?.preferredLocale;
    
    if (!interaction.guild) {
      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ ' + t(locale, 'errors.command_error'))
        .setDescription('This command can only be used in a server.')
        .setTimestamp();
      
      await interaction.reply({
        embeds: [errorEmbed],
        flags: 64
      });
      return;
    }

    const targetUser = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || t(locale, 'commands.ban.embed.reason');
    const executor = interaction.member as GuildMember;
    
    // Permission checks
    if (!executor.permissions.has(PermissionFlagsBits.BanMembers)) {
      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ ' + t(locale, 'commands.ban.errors.no_permission'))
        .setDescription(t(locale, 'commands.ban.errors.no_permission_detail'))
        .addFields(
          {
            name: t(locale, 'commands.ban.errors.required_permission'),
            value: 'BAN_MEMBERS',
            inline: true
          },
          {
            name: t(locale, 'commands.ban.errors.your_permissions'),
            value: executor.permissions.toArray().join(', ') || t(locale, 'commands.ban.errors.no_permissions'),
            inline: false
          }
        )
        .setTimestamp();
      
      await interaction.reply({
        embeds: [errorEmbed],
        flags: 64
      });
      return;
    }

    // Self-ban check
    if (targetUser.id === interaction.user.id) {
      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ ' + t(locale, 'commands.ban.errors.cannot_ban_self'))
        .setDescription(t(locale, 'commands.ban.errors.cannot_ban_self_detail'))
        .setTimestamp();
      
      await interaction.reply({
        embeds: [errorEmbed],
        flags: 64
      });
      return;
    }

    try {
      // Check if user is in guild
      const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      
      // Role hierarchy check (skip if executor has administrator permission)
      if (targetMember && 
          !executor.permissions.has(PermissionFlagsBits.Administrator) &&
          executor.roles.highest.position <= targetMember.roles.highest.position) {
        const errorEmbed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ ' + t(locale, 'commands.ban.errors.higher_role'))
          .setDescription(t(locale, 'commands.ban.errors.higher_role_detail'))
          .addFields(
            {
              name: t(locale, 'commands.ban.errors.your_highest_role'),
              value: `${executor.roles.highest.name} (${t(locale, 'commands.ban.errors.position')}: ${executor.roles.highest.position})`,
              inline: true
            },
            {
              name: t(locale, 'commands.ban.errors.target_highest_role'),
              value: `${targetMember.roles.highest.name} (${t(locale, 'commands.ban.errors.position')}: ${targetMember.roles.highest.position})`,
              inline: true
            }
          )
          .setTimestamp();
        
        await interaction.reply({
          embeds: [errorEmbed],
          flags: 64
        });
        return;
      }

      // Check if already banned
      const bannedUsers = await interaction.guild.bans.fetch();
      if (bannedUsers.has(targetUser.id)) {
        const errorEmbed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ ' + t(locale, 'commands.ban.errors.already_banned'))
          .setDescription(t(locale, 'commands.ban.errors.already_banned_detail'))
          .addFields(
            {
              name: t(locale, 'commands.ban.errors.target_user'),
              value: `${targetUser.tag} (${targetUser.id})`,
              inline: true
            }
          )
          .setTimestamp();
        
        await interaction.reply({
          embeds: [errorEmbed],
          flags: 64
        });
        return;
      }

      // Execute ban
      await interaction.guild.members.ban(targetUser, { reason });

      // Create success embed
      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle(t(locale, 'commands.ban.embed.title'))
        .setDescription(t(locale, 'commands.ban.embed.success', { user: targetUser.tag }))
        .addFields(
          {
            name: t(locale, 'commands.ban.embed.banned_user'),
            value: `${targetUser.tag} (${targetUser.id})`,
            inline: true
          },
          {
            name: t(locale, 'commands.ban.embed.banned_by'),
            value: `${interaction.user.tag}`,
            inline: true
          },
          {
            name: t(locale, 'commands.ban.embed.reason'),
            value: reason,
            inline: false
          }
        )
        .setTimestamp();

      await interaction.reply({
        embeds: [embed]
      });

    } catch (error) {
      console.error('Ban command error:', error);
      
      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ ' + t(locale, 'commands.ban.errors.ban_failed'))
        .setDescription(t(locale, 'commands.ban.errors.ban_failed_detail'))
        .addFields(
          {
            name: t(locale, 'commands.ban.errors.error_details'),
            value: error instanceof Error ? error.message : String(error),
            inline: false
          }
        )
        .setTimestamp();
      
      await interaction.reply({
        embeds: [errorEmbed],
        flags: 64
      });
    }
  },
};
