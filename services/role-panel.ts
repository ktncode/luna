/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * SPDX-License-Identifier: MPL-2.0
 * Copyright (c) Kotone <git@ktn.works>
 */

import { Client, MessageReaction, PartialMessageReaction, User, PartialUser, GuildMember, EmbedBuilder } from 'discord.js';
import { getRolePanelByMessage, getRolePanelRoles, getRolePanelById } from './db.js';
import { logger } from './logger.js';
import { t } from './i18n.js';

let handlersInitialized = false;

export function setupRolePanelHandlers(client: Client) {
    if (handlersInitialized) {
        return; // 既に初期化済み
    }
    
    logger.info('Setting up role panel handlers...');
    
    client.on('messageReactionAdd', async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
        await handleReactionChange(reaction, user, 'add');
    });

    client.on('messageReactionRemove', async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
        await handleReactionChange(reaction, user, 'remove');
    });
    
    handlersInitialized = true;
}

async function handleReactionChange(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser, action: 'add' | 'remove') {
    // Botのリアクションは無視
    if (user.bot) return;

    try {
        // パーシャルデータの場合はフェッチ
        if (reaction.partial) {
            await reaction.fetch();
        }
        if (user.partial) {
            await user.fetch();
        }

        const messageId = reaction.message.id;
        const panel = await getRolePanelByMessage(messageId);
        
        if (!panel) return; // このメッセージは役職パネルではない

        const roles = await getRolePanelRoles(panel.id);
        const targetRole = roles.find(role => role.emoji === reaction.emoji?.toString());
        
        if (!targetRole) return; // この絵文字に対応する役職がない

        const guild = reaction.message.guild;
        if (!guild) return;

        const member = await guild.members.fetch(user.id).catch(() => null);
        if (!member) return;

        const role = await guild.roles.fetch(targetRole.role_id).catch(() => null);
        if (!role) {
            logger.warn(`Role not found: ${targetRole.role_id}`);
            return;
        }

        // Botに役職管理権限があるかチェック
        if (!guild.members.me?.permissions.has('ManageRoles')) {
            logger.warn(`Bot lacks ManageRoles permission in guild ${guild.name}`);
            return;
        }

        // Botの役職がターゲット役職より上位にあるかチェック
        if (guild.members.me.roles.highest.position <= role.position) {
            logger.warn(`Bot role is not high enough to manage role ${role.name} in guild ${guild.name}`);
            return;
        }

        // 役職の付与/削除
        if (action === 'add') {
            if (!member.roles.cache.has(role.id)) {
                await member.roles.add(role);
                logger.info(`Added role ${role.name} to user ${user.tag} in guild ${guild.name}`);
                
                // チャンネルで通知
                try {
                    const guildLocale = guild.preferredLocale || 'en-US';
                    const notificationContent = t(guild.id, guildLocale, 'commands.role_panel.role_added_notification', {
                        user: `<@${user.id}>`,
                        role: role.name
                    });
                    
                    const channel = reaction.message.channel;
                    if (channel && channel.isTextBased() && 'send' in channel) {
                        const notificationMessage = await channel.send({
                            content: notificationContent
                        });
                        
                        // 5秒後に削除
                        setTimeout(async () => {
                            try {
                                await notificationMessage.delete();
                            } catch (error) {
                                // メッセージ削除エラーは無視
                            }
                        }, 5000);
                    }
                } catch (error) {
                    // 通知送信失敗は無視
                }
            }
        } else {
            if (member.roles.cache.has(role.id)) {
                await member.roles.remove(role);
                logger.info(`Removed role ${role.name} from user ${user.tag} in guild ${guild.name}`);
                
                // チャンネルで通知
                try {
                    const guildLocale = guild.preferredLocale || 'en-US';
                    const notificationContent = t(guild.id, guildLocale, 'commands.role_panel.role_removed_notification', {
                        user: `<@${user.id}>`,
                        role: role.name
                    });
                    
                    const channel = reaction.message.channel;
                    if (channel && channel.isTextBased() && 'send' in channel) {
                        const notificationMessage = await channel.send({
                            content: notificationContent
                        });
                        
                        // 5秒後に削除
                        setTimeout(async () => {
                            try {
                                await notificationMessage.delete();
                            } catch (error) {
                                // メッセージ削除エラーは無視
                            }
                        }, 5000);
                    }
                } catch (error) {
                    // 通知送信失敗は無視
                }
            }
        }

    } catch (error) {
        logger.error('Error handling role panel reaction:', error);
    }
}

export async function updateRolePanelMessage(client: Client, panelId: number) {
    try {
        const panel = await getRolePanelById(panelId);
        if (!panel) {
            logger.error(`Panel not found: ${panelId}`);
            return;
        }

        const roles = await getRolePanelRoles(panelId);
        
        // ギルドを取得してロケールを決定
        const guild = await client.guilds.fetch(panel.guild_id);
        const guildLocale = guild?.preferredLocale || 'en-US';
        
        // Embedを再構築
        const embed = new EmbedBuilder()
            .setTitle(panel.title)
            .setColor(panel.color)
            .setFooter({ text: t(panel.guild_id, guildLocale, 'commands.role_panel.footer') });

        if (panel.description) {
            embed.setDescription(panel.description);
        }

        // 役職フィールドを追加
        if (roles.length > 0) {
            const roleFields = roles.map(role => 
                `${role.emoji} <@&${role.role_id}>${role.description ? ` - ${role.description}` : ''}`
            ).join('\n');
            
            embed.addFields({
                name: t(panel.guild_id, guildLocale, 'commands.role_panel.available_roles'),
                value: roleFields
            });
        } else {
            embed.addFields({
                name: t(panel.guild_id, guildLocale, 'commands.role_panel.available_roles'),
                value: t(panel.guild_id, guildLocale, 'commands.role_panel.no_roles_configured')
            });
        }

        // メッセージを取得して更新
        const channel = await client.channels.fetch(panel.channel_id);
        if (channel && channel.isTextBased()) {
            const message = await channel.messages.fetch(panel.message_id);
            await message.edit({ embeds: [embed] });

            // 既存のリアクションをクリアして新しいリアクションを追加
            await message.reactions.removeAll();
            for (const role of roles) {
                try {
                    await message.react(role.emoji);
                } catch (error) {
                    logger.warn(`Failed to add reaction ${role.emoji}: ${error}`);
                }
            }
            
            logger.info(`Updated role panel message for panel ${panelId}`);
        }
    } catch (error) {
        logger.error('Error updating role panel message:', error);
    }
}
