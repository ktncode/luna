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
    .setName('kick')
    .setDescription('Kick a user from the server')
    .setDescriptionLocalization('ja', 'ユーザーをサーバーからキックします')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to kick')
        .setDescriptionLocalization('ja', 'キックするユーザー')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the kick')
        .setDescriptionLocalization('ja', 'キックの理由')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

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
    const reason = interaction.options.getString('reason') || tCmd(interaction, 'commands.kick.embed.reason');
    const executor = interaction.member as GuildMember;
    
    // Permission checks
    if (!executor.permissions.has(PermissionFlagsBits.KickMembers)) {
      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ ' + tCmd(interaction, 'commands.kick.errors.no_permission'))
        .setDescription(tCmd(interaction, 'commands.kick.errors.no_permission_detail'))
        .addFields(
          {
            name: tCmd(interaction, 'commands.kick.errors.required_permission'),
            value: 'KICK_MEMBERS',
            inline: true
          },
          {
            name: tCmd(interaction, 'commands.kick.errors.your_permissions'),
            value: executor.permissions.toArray().join(', ') || tCmd(interaction, 'commands.kick.errors.no_permissions'),
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

    // Self-kick check
    if (targetUser.id === interaction.user.id) {
      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ ' + tCmd(interaction, 'commands.kick.errors.cannot_kick_self'))
        .setDescription(tCmd(interaction, 'commands.kick.errors.cannot_kick_self_detail'))
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
          .setTitle('❌ ' + tCmd(interaction, 'commands.kick.errors.not_in_guild'))
          .setDescription(tCmd(interaction, 'commands.kick.errors.not_in_guild_detail'))
          .addFields(
            {
              name: tCmd(interaction, 'commands.kick.errors.target_user'),
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

      // Role hierarchy check (skip if executor has administrator permission)
      if (!executor.permissions.has(PermissionFlagsBits.Administrator) &&
          executor.roles.highest.position <= targetMember.roles.highest.position) {
        const errorEmbed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ ' + tCmd(interaction, 'commands.kick.errors.higher_role'))
          .setDescription(tCmd(interaction, 'commands.kick.errors.higher_role_detail'))
          .addFields(
            {
              name: tCmd(interaction, 'commands.kick.errors.your_highest_role'),
              value: `${executor.roles.highest.name} (${tCmd(interaction, 'commands.kick.errors.position')}: ${executor.roles.highest.position})`,
              inline: true
            },
            {
              name: tCmd(interaction, 'commands.kick.errors.target_highest_role'),
              value: `${targetMember.roles.highest.name} (${tCmd(interaction, 'commands.kick.errors.position')}: ${targetMember.roles.highest.position})`,
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

      // Execute kick
      await targetMember.kick(reason);

      // Create success embed
      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle(tCmd(interaction, 'commands.kick.embed.title'))
        .setDescription(tCmd(interaction, 'commands.kick.embed.success', { user: targetUser.tag }))
        .addFields(
          {
            name: tCmd(interaction, 'commands.kick.embed.kicked_user'),
            value: `${targetUser.tag} (${targetUser.id})`,
            inline: true
          },
          {
            name: tCmd(interaction, 'commands.kick.embed.kicked_by'),
            value: `${interaction.user.tag}`,
            inline: true
          },
          {
            name: tCmd(interaction, 'commands.kick.embed.reason'),
            value: reason,
            inline: false
          }
        )
        .setTimestamp();

      await interaction.reply({
        embeds: [embed]
      });

    } catch (error) {
      console.error('Kick command error:', error);
      
      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ ' + tCmd(interaction, 'commands.kick.errors.kick_failed'))
        .setDescription(tCmd(interaction, 'commands.kick.errors.kick_failed_detail'))
        .addFields(
          {
            name: tCmd(interaction, 'commands.kick.errors.error_details'),
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
