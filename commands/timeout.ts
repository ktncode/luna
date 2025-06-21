/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * SPDX-License-Identifier: MPL-2.0
 * Copyright (c) Kotone <git@ktn.works>
 */

import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, GuildMember } from 'discord.js';
import { tCmd } from '../services/i18n.js';

export default {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout a user in the server')
    .setDescriptionLocalization('ja', 'ユーザーをサーバーでタイムアウトします')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to timeout')
        .setDescriptionLocalization('ja', 'タイムアウトするユーザー')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('duration')
        .setDescription('Duration in minutes (1-40320)')
        .setDescriptionLocalization('ja', '時間（分）(1-40320)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(40320)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the timeout')
        .setDescriptionLocalization('ja', 'タイムアウトの理由')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

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

    const targetUser = interaction.options.getUser('user', true);
    const duration = interaction.options.getInteger('duration', true);
    const reason = interaction.options.getString('reason') || tCmd(interaction, 'commands.timeout.embed.reason');
    const executor = interaction.member as GuildMember;
    
    // Permission checks
    if (!executor.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ ' + tCmd(interaction, 'commands.timeout.errors.no_permission'))
        .setDescription(tCmd(interaction, 'commands.timeout.errors.no_permission_detail'))
        .addFields(
          {
            name: tCmd(interaction, 'commands.timeout.errors.required_permission'),
            value: 'MODERATE_MEMBERS',
            inline: true
          },
          {
            name: tCmd(interaction, 'commands.timeout.errors.your_permissions'),
            value: executor.permissions.toArray().join(', ') || tCmd(interaction, 'commands.timeout.errors.no_permissions'),
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

    // Self-timeout check
    if (targetUser.id === interaction.user.id) {
      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ ' + tCmd(interaction, 'commands.timeout.errors.cannot_timeout_self'))
        .setDescription(tCmd(interaction, 'commands.timeout.errors.cannot_timeout_self_detail'))
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
      
      if (!targetMember) {
        const errorEmbed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ ' + tCmd(interaction, 'commands.timeout.errors.user_not_found'))
          .setDescription(tCmd(interaction, 'commands.timeout.errors.user_not_found_detail'))
          .setTimestamp();
        
        await interaction.reply({
          embeds: [errorEmbed],
          flags: 64
        });
        return;
      }

      // Role hierarchy check (skip if executor has administrator permission)
      if (!executor.permissions.has(PermissionFlagsBits.Administrator) &&
          executor.roles.highest.position <= targetMember.roles.highest.position) {
        const errorEmbed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ ' + tCmd(interaction, 'commands.timeout.errors.higher_role'))
          .setDescription(tCmd(interaction, 'commands.timeout.errors.higher_role_detail'))
          .addFields(
            {
              name: tCmd(interaction, 'commands.timeout.errors.your_highest_role'),
              value: `${executor.roles.highest.name} (${tCmd(interaction, 'commands.timeout.errors.position')}: ${executor.roles.highest.position})`,
              inline: true
            },
            {
              name: tCmd(interaction, 'commands.timeout.errors.target_highest_role'),
              value: `${targetMember.roles.highest.name} (${tCmd(interaction, 'commands.timeout.errors.position')}: ${targetMember.roles.highest.position})`,
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

      // Check if already timed out
      if (targetMember.communicationDisabledUntil && targetMember.communicationDisabledUntil > new Date()) {
        const errorEmbed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ ' + tCmd(interaction, 'commands.timeout.errors.already_timed_out'))
          .setDescription(tCmd(interaction, 'commands.timeout.errors.already_timed_out_detail'))
          .addFields(
            {
              name: tCmd(interaction, 'commands.timeout.errors.target_user'),
              value: `${targetUser.tag} (${targetUser.id})`,
              inline: true
            },
            {
              name: tCmd(interaction, 'commands.timeout.errors.timeout_until'),
              value: `<t:${Math.floor(targetMember.communicationDisabledUntil.getTime() / 1000)}:F>`,
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

      // Calculate timeout end time
      const timeoutUntil = new Date(Date.now() + (duration * 60 * 1000));

      // Execute timeout
      await targetMember.timeout(duration * 60 * 1000, reason);

      // Create success embed
      const embed = new EmbedBuilder()
        .setColor(0xffaa00)
        .setTitle(tCmd(interaction, 'commands.timeout.embed.title'))
        .setDescription(tCmd(interaction, 'commands.timeout.embed.success', { user: targetUser.tag }))
        .addFields(
          {
            name: tCmd(interaction, 'commands.timeout.embed.timed_out_user'),
            value: `${targetUser.tag} (${targetUser.id})`,
            inline: true
          },
          {
            name: tCmd(interaction, 'commands.timeout.embed.timed_out_by'),
            value: `${interaction.user.tag}`,
            inline: true
          },
          {
            name: tCmd(interaction, 'commands.timeout.embed.duration'),
            value: `${duration} ${tCmd(interaction, 'commands.timeout.embed.minutes')}`,
            inline: true
          },
          {
            name: tCmd(interaction, 'commands.timeout.embed.timeout_until'),
            value: `<t:${Math.floor(timeoutUntil.getTime() / 1000)}:F>`,
            inline: false
          },
          {
            name: tCmd(interaction, 'commands.timeout.embed.reason'),
            value: reason,
            inline: false
          }
        )
        .setTimestamp();

      await interaction.reply({
        embeds: [embed]
      });

    } catch (error) {
      console.error('Timeout command error:', error);
      
      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ ' + tCmd(interaction, 'commands.timeout.errors.timeout_failed'))
        .setDescription(tCmd(interaction, 'commands.timeout.errors.timeout_failed_detail'))
        .addFields(
          {
            name: tCmd(interaction, 'commands.timeout.errors.error_details'),
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