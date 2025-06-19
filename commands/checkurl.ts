/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * SPDX-License-Identifier: MPL-2.0
 * Copyright (c) Kotone <git@ktn.works>
 */

import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { tCmd } from '../services/i18n.js';

interface NortonSafeWebResponse {
    id: number;
    url: string;
    rating: 'r' | 'w' | 'u' | 'b' | 'g';
    categories: number[];
    communityRating: number;
    reviewCount: number;
    userRating: number;
    globalRestriction: boolean;
}

interface RatingInfo {
    color: number;
    key: string;
    icon: string;
}

function extractDomain(url: string): string | null {
    try {
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }
        return new URL(url).hostname;
    } catch {
        return null;
    }
}

function createSafetyEmbed(data: NortonSafeWebResponse, domain: string, interaction: ChatInputCommandInteraction): EmbedBuilder {
    const { rating, communityRating, reviewCount, globalRestriction, categories } = data;
    
    const ratingMap: Record<string, RatingInfo> = {
        'r': { color: 0x00ff00, key: 'commands.checkurl.status.safe', icon: '✅' },
        'g': { color: 0x00ff00, key: 'commands.checkurl.status.safe', icon: '✅' },
        'w': { color: 0xffff00, key: 'commands.checkurl.status.warn', icon: '⚠️' },
        'u': { color: 0x808080, key: 'commands.checkurl.status.untested', icon: '❓' },
        'b': { color: 0xff0000, key: 'commands.checkurl.status.dangerous', icon: '🚨' }
    };

    const ratingInfo = ratingMap[rating] || { color: 0x808080, key: 'commands.checkurl.status.unknown', icon: '❓' };

    const embed = new EmbedBuilder()
        .setTitle(`${ratingInfo.icon} ${tCmd(interaction, 'commands.checkurl.title')}`)
        .setDescription(`**${domain}** ${tCmd(interaction, 'commands.checkurl.description')}`)
        .setColor(ratingInfo.color)
        .addFields(
            { 
                name: `🌐 ${tCmd(interaction, 'commands.checkurl.domain')}`, 
                value: `\`${domain}\``, 
                inline: true 
            },
            { 
                name: `📊 ${tCmd(interaction, 'commands.checkurl.status_field')}`, 
                value: `**${tCmd(interaction, ratingInfo.key)}**`, 
                inline: true 
            },
            { 
                name: `⭐ ${tCmd(interaction, 'commands.checkurl.rating')}`, 
                value: communityRating > 0 
                    ? `${communityRating}/5.0 ⭐ (${reviewCount} ${tCmd(interaction, 'commands.checkurl.reviews')})` 
                    : `${tCmd(interaction, 'commands.checkurl.no_ratings')} ❌`, 
                inline: true 
            }
        )
        .setFooter({ 
            text: `${tCmd(interaction, 'commands.checkurl.powered_by')} Norton SafeWeb`
        })
        .setTimestamp();

    if (globalRestriction) {
        embed.addFields({
            name: `🚫 ${tCmd(interaction, 'commands.checkurl.restriction')}`,
            value: `⚠️ ${tCmd(interaction, 'commands.checkurl.global_restriction')}`,
            inline: false
        });
    }

    if (categories && categories.length > 0) {
        embed.addFields({
            name: `📂 ${tCmd(interaction, 'commands.checkurl.categories')}`,
            value: categories.map(cat => `\`${cat}\``).join(', '),
            inline: false
        });
    }

    // セキュリティレベルに応じた追加情報
    if (rating === 'b') {
        embed.addFields({
            name: `⚠️ ${tCmd(interaction, 'commands.checkurl.warning')}`,
            value: tCmd(interaction, 'commands.checkurl.warning_text'),
            inline: false
        });
    } else if (rating === 'r' || rating === 'g') {
        embed.addFields({
            name: `✅ ${tCmd(interaction, 'commands.checkurl.safe_info')}`,
            value: tCmd(interaction, 'commands.checkurl.safe_text'),
            inline: false
        });
    }

    return embed;
}

export default {
    data: new SlashCommandBuilder()
        .setName('checkurl')
        .setDescription('Check URL safety using Norton SafeWeb')
        .setDescriptionLocalization('ja', 'Norton SafeWebを使用してURLの安全性をチェックします')
        .addStringOption(option =>
            option.setName('url')
                .setDescription('URL to check')
                .setDescriptionLocalization('ja', 'チェックするURL')
                .setRequired(true)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const url = interaction.options.getString('url', true);
        await interaction.deferReply();

        try {
            const domain = extractDomain(url);
            if (!domain) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle(`❌ ${tCmd(interaction, 'commands.checkurl.invalid_url')}`)
                    .setColor(0xff0000)
                    .setTimestamp();
                
                await interaction.editReply({ embeds: [errorEmbed] });
                return;
            }

            const response = await fetch(`https://safeweb.norton.com/safeweb/sites/v1/details?url=${encodeURIComponent(domain)}&insert=0`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json() as NortonSafeWebResponse;
            const embed = createSafetyEmbed(data, domain, interaction);
            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Norton SafeWeb API error:', error);
            const errorEmbed = new EmbedBuilder()
                .setTitle(`❌ ${tCmd(interaction, 'commands.checkurl.api_error')}`)
                .setColor(0xff0000)
                .setTimestamp();
            
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },
};
