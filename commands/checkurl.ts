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
    rating: 'r' | 'w' | 'u' | 'b';
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

export const data = new SlashCommandBuilder()
    .setName('checkurl')
    .setDescription('Check URL safety using Norton SafeWeb')
    .addStringOption(option =>
        option.setName('url')
            .setDescription('URL to check')
            .setRequired(true)
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    const url = interaction.options.getString('url', true);
    await interaction.deferReply();

    try {
        const domain = extractDomain(url);
        if (!domain) {
            const errorEmbed = new EmbedBuilder()
                .setTitle(`❌ ${tCmd(interaction, 'checkurl.invalid_url')}`)
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
            .setTitle(`❌ ${tCmd(interaction, 'checkurl.api_error')}`)
            .setColor(0xff0000)
            .setTimestamp();
        
        await interaction.editReply({ embeds: [errorEmbed] });
    }
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
    const { rating, communityRating, reviewCount, globalRestriction } = data;
    
    const ratingMap: Record<string, RatingInfo> = {
        'r': { color: 0x00ff00, key: 'checkurl.status.safe', icon: '✅' },
        'w': { color: 0xffff00, key: 'checkurl.status.warn', icon: '⚠️' },
        'u': { color: 0x808080, key: 'checkurl.status.untested', icon: '❓' },
        'b': { color: 0xff0000, key: 'checkurl.status.dangerous', icon: '🚨' }
    };

    const ratingInfo = ratingMap[rating] || { color: 0x808080, key: 'checkurl.status.unknown', icon: '❓' };

    const embed = new EmbedBuilder()
        .setTitle(`${ratingInfo.icon} ${tCmd(interaction, 'checkurl.title')}`)
        .setColor(ratingInfo.color)
        .addFields(
            { 
                name: tCmd(interaction, 'checkurl.domain'), 
                value: domain, 
                inline: true 
            },
            { 
                name: tCmd(interaction, 'checkurl.status_field'), 
                value: tCmd(interaction, ratingInfo.key), 
                inline: true 
            },
            { 
                name: tCmd(interaction, 'checkurl.rating'), 
                value: communityRating > 0 
                    ? `${communityRating}/5 (${reviewCount} ${tCmd(interaction, 'checkurl.reviews')})` 
                    : tCmd(interaction, 'checkurl.no_ratings'), 
                inline: true 
            }
        )
        .setFooter({ 
            text: tCmd(interaction, 'checkurl.powered_by', { service: 'Norton SafeWeb' }) 
        })
        .setTimestamp();

    if (globalRestriction) {
        embed.addFields({ 
            name: tCmd(interaction, 'checkurl.restriction'), 
            value: tCmd(interaction, 'checkurl.global_restriction'), 
            inline: false 
        });
    }

    return embed;
}
