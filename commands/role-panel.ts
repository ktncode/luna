/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * SPDX-License-Identifier: MPL-2.0
 * Copyright (c) Kotone <git@ktn.works>
 */

import { 
    ChatInputCommandInteraction, 
    SlashCommandBuilder, 
    EmbedBuilder, 
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    Client
} from 'discord.js';
import { tCmd } from '../services/i18n.js';
import { 
    createRolePanel, 
    addRoleToPanelId, 
    getGuildRolePanels, 
    deleteRolePanel,
    getRolePanelByMessage,
    getRolePanelRoles
} from '../services/db.js';
import { logger } from '../services/logger.js';
import { setupRolePanelHandlers, updateRolePanelMessage } from '../services/role-panel.js';

// コマンドロード時に役職パネルハンドラーを初期化
let handlersSetup = false;

export default {
    data: new SlashCommandBuilder()
        .setName('role-panel')
        .setDescription('Manage role assignment panels')
        .setDescriptionLocalization('ja', '役職パネルを管理します')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a new role panel')
                .setDescriptionLocalization('ja', '新しい役職パネルを作成します')
                .addStringOption(option =>
                    option.setName('title')
                        .setDescription('Panel title')
                        .setDescriptionLocalization('ja', 'パネルのタイトル')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('description')
                        .setDescription('Panel description')
                        .setDescriptionLocalization('ja', 'パネルの説明')
                        .setRequired(false)
                )
                .addStringOption(option =>
                    option.setName('color')
                        .setDescription('Panel color (hex code)')
                        .setDescriptionLocalization('ja', 'パネルの色（16進数）')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('add-role')
                .setDescription('Add a role to an existing panel')
                .setDescriptionLocalization('ja', '既存のパネルに役職を追加します')
                .addStringOption(option =>
                    option.setName('panel_name')
                        .setDescription('Panel name')
                        .setDescriptionLocalization('ja', 'パネル名')
                        .setRequired(true)
                )
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('Role to add')
                        .setDescriptionLocalization('ja', '追加する役職')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('description')
                        .setDescription('Role description')
                        .setDescriptionLocalization('ja', '役職の説明')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all role panels')
                .setDescriptionLocalization('ja', '役職パネル一覧を表示します')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Delete a role panel')
                .setDescriptionLocalization('ja', '役職パネルを削除します')
                .addStringOption(option =>
                    option.setName('panel_name')
                        .setDescription('Panel name to delete')
                        .setDescriptionLocalization('ja', '削除するパネル名')
                        .setRequired(true)
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction: ChatInputCommandInteraction) {
        // 初回実行時にハンドラーを設定
        if (!handlersSetup && interaction.client) {
            setupRolePanelHandlers(interaction.client);
            handlersSetup = true;
            logger.info('Role panel handlers initialized');
        }

        if (!interaction.guild) {
            await interaction.reply({
                content: tCmd(interaction, 'errors.command_error'),
                flags: 64
            });
            return;
        }

        // STAFF権限チェック
        const member = interaction.member;
        const hasStaffPermission = !!(member && typeof member.permissions !== 'string' && 
            (member.permissions.has(PermissionFlagsBits.ManageRoles) || 
             member.permissions.has(PermissionFlagsBits.Administrator)));

        if (!hasStaffPermission) {
            await interaction.reply({
                content: tCmd(interaction, 'commands.role_panel.no_permission'),
                flags: 64
            });
            return;
        }

        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guildId!;

        switch (subcommand) {
            case 'create': {
                await handleCreatePanel(interaction, guildId);
                break;
            }
            case 'add-role': {
                await handleAddRole(interaction, guildId);
                break;
            }
            case 'list': {
                await handleListPanels(interaction, guildId);
                break;
            }
            case 'delete': {
                await handleDeletePanel(interaction, guildId);
                break;
            }
        }
    }
};

async function handleCreatePanel(interaction: ChatInputCommandInteraction, guildId: string) {
    const title = interaction.options.getString('title', true);
    const description = interaction.options.getString('description');
    const colorInput = interaction.options.getString('color');
    
    let color = 0x5865F2; // Default Discord blue
    if (colorInput) {
        const parsedColor = parseInt(colorInput.replace('#', ''), 16);
        if (!isNaN(parsedColor)) {
            color = parsedColor;
        }
    }

    const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor(color)
        .setFooter({ text: tCmd(interaction, 'commands.role_panel.footer') });

    if (description) {
        embed.setDescription(description);
    }

    try {
        const message = await interaction.reply({
            embeds: [embed],
            fetchReply: true
        });

        const panelId = await createRolePanel(
            guildId,
            interaction.channelId,
            message.id,
            title,
            description,
            color,
            interaction.user.id
        );

        if (panelId) {
            await interaction.followUp({
                content: tCmd(interaction, 'commands.role_panel.create.success', { id: panelId }),
                flags: 64
            });
        } else {
            await interaction.followUp({
                content: tCmd(interaction, 'commands.role_panel.create.failed'),
                flags: 64
            });
        }
    } catch (error) {
        await interaction.followUp({
            content: tCmd(interaction, 'commands.role_panel.create.failed'),
            flags: 64
        });
    }
}

async function handleAddRole(interaction: ChatInputCommandInteraction, guildId: string) {
    const panelName = interaction.options.getString('panel_name', true);
    const role = interaction.options.getRole('role', true);
    const description = interaction.options.getString('description');

    // パネル名からパネルを取得
    const panels = await getGuildRolePanels(guildId);
    const panel = panels.find(p => p.title === panelName);
    
    if (!panel) {
        await interaction.reply({
            content: tCmd(interaction, 'commands.role_panel.add_role.panel_not_found'),
            flags: 64
        });
        return;
    }

    // 既存の役職数を取得して次の絵文字を決定
    const existingRoles = await getRolePanelRoles(panel.id);
    const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    
    if (existingRoles.length >= numberEmojis.length) {
        await interaction.reply({
            content: tCmd(interaction, 'commands.role_panel.add_role.max_roles'),
            flags: 64
        });
        return;
    }

    const emoji = numberEmojis[existingRoles.length];

    // 役職をパネルに追加
    const success = await addRoleToPanelId(panel.id, role.id, emoji, description);

    if (success) {
        await interaction.reply({
            content: tCmd(interaction, 'commands.role_panel.add_role.success', { 
                role: role.name, 
                panel: panelName 
            }),
            flags: 64
        });
        
        // パネルを更新
        await updateRolePanelMessage(interaction.client, panel.id);
    } else {
        await interaction.reply({
            content: tCmd(interaction, 'commands.role_panel.add_role.failed'),
            flags: 64
        });
    }
}

async function handleListPanels(interaction: ChatInputCommandInteraction, guildId: string) {
    const panels = await getGuildRolePanels(guildId);

    if (panels.length === 0) {
        await interaction.reply({
            content: tCmd(interaction, 'commands.role_panel.list.empty'),
            flags: 64
        });
        return;
    }

    const panelList = panels.map(panel => 
        tCmd(interaction, 'commands.role_panel.list.item', {
            id: panel.id,
            title: panel.title,
            channel: `<#${panel.channel_id}>`,
            created: new Date(panel.created_at).toLocaleDateString()
        })
    ).join('\n');

    await interaction.reply({
        content: tCmd(interaction, 'commands.role_panel.list.title') + '\n' + panelList,
        flags: 64
    });
}

async function handleDeletePanel(interaction: ChatInputCommandInteraction, guildId: string) {
    const panelName = interaction.options.getString('panel_name', true);
    
    // パネル名からパネルを取得
    const panels = await getGuildRolePanels(guildId);
    const panel = panels.find(p => p.title === panelName);
    
    if (!panel) {
        await interaction.reply({
            content: tCmd(interaction, 'commands.role_panel.delete.not_found'),
            flags: 64
        });
        return;
    }

    const member = interaction.member;
    const hasAdministratorPermission = !!(member && typeof member.permissions !== 'string' && 
        member.permissions.has(PermissionFlagsBits.Administrator));

    const success = await deleteRolePanel(panel.id, guildId, interaction.user.id, hasAdministratorPermission);

    if (success) {
        await interaction.reply({
            content: tCmd(interaction, 'commands.role_panel.delete.success'),
            flags: 64
        });
    } else {
        await interaction.reply({
            content: tCmd(interaction, 'commands.role_panel.delete.failed'),
            flags: 64
        });
    }
}
