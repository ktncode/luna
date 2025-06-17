/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * SPDX-License-Identifier: MPL-2.0
 * Copyright (c) Kotone <git@ktn.works>
 */

import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { tCmd } from '../services/i18n.js';
import { logger } from '../services/logger.js';

interface SecURLData {
    status?: number;
    imgWidth?: number;
    imgHeight?: number;
    reqURL?: string;
    resURL?: string;
    title?: string;
    anchors?: string[];
    viruses?: string[];
    blackList?: string[];
    annoyUrl?: string;
    img?: string;
    capturedDate?: string;
}

const HEADERS = {
    "Connection": "keep-alive",
    "sec-ch-ua": '"Microsoft Edge";v="95", "Chromium";v="95", ";Not A Brand";v="99"',
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "X-Requested-With": "XMLHttpRequest",
    "sec-ch-ua-mobile": "?0",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.54 Safari/537.36 Edg/95.0.1020.40",
    "sec-ch-ua-platform": '"macOS"',
    "Origin": "https://securl.nu",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Dest": "empty",
    "Referer": "https://securl.nu/",
    "Accept-Language": "ja,en;q=0.9,en-GB;q=0.8,en-US;q=0.7",
};

async function checkURL(
    url: string,
    waitTime: number = 1,
    browserWidth: number = 965,
    browserHeight: number = 683
): Promise<SecURLData> {
    const formData = new URLSearchParams({
        'url': url,
        'waitTime': waitTime.toString(),
        'browserWidth': browserWidth.toString(),
        'browserHeight': browserHeight.toString(),
        'from': ''
    });

    const response = await fetch('https://securl.nu/jx/get_page_jx.php', {
        method: 'POST',
        headers: HEADERS,
        body: formData
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const text = await response.text();
    return JSON.parse(text) as SecURLData;
}

function getCapture(data: SecURLData, full: boolean = false): string | null {
    if (data.img) {
        if (full) {
            return `https://securl.nu/save_local_captured.php?key=${data.img.slice(10, -4)}`;
        } else {
            return `https://securl.nu${data.img}`;
        }
    }
    return null;
}

function isValidURL(string: string): boolean {
    try {
        new URL(string);
        return true;
    } catch {
        return false;
    }
}

export default {
    data: new SlashCommandBuilder()
        .setName('checkurl')
        .setDescription('Check if a URL is safe')
        .setDescriptionLocalization('ja', 'URLが安全かどうかをチェックします')
        .addStringOption(option =>
            option.setName('url')
                .setDescription('URL to check')
                .setDescriptionLocalization('ja', 'チェックするURL')
                .setRequired(true)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const url = interaction.options.getString('url', true);

        // URL形式の検証
        if (!isValidURL(url)) {
            const errorEmbed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('❌ ' + tCmd(interaction, 'commands.checkurl.invalid_url'))
                .setDescription(tCmd(interaction, 'commands.checkurl.invalid_url_desc'))
                .setTimestamp();

            await interaction.reply({
                embeds: [errorEmbed],
                flags: 64
            });
            return;
        }

        // 処理中メッセージ
        const loadingEmbed = new EmbedBuilder()
            .setColor(0xffff00)
            .setTitle('🔍 ' + tCmd(interaction, 'commands.checkurl.checking'))
            .setDescription(tCmd(interaction, 'commands.checkurl.checking_desc', { url }))
            .setTimestamp();

        await interaction.reply({
            embeds: [loadingEmbed]
        });

        try {
            logger.info(`Checking URL safety: ${url}`);
            const data = await checkURL(url);

            // 結果の解析
            const hasViruses = data.viruses && data.viruses.length > 0;
            const isBlacklisted = data.blackList && data.blackList.length > 0;
            const isUnsafe = hasViruses || isBlacklisted;

            // 結果Embed作成
            const resultEmbed = new EmbedBuilder()
                .setColor(isUnsafe ? 0xff0000 : 0x00ff00)
                .setTitle(isUnsafe ? 
                    '⚠️ ' + tCmd(interaction, 'commands.checkurl.unsafe') : 
                    '✅ ' + tCmd(interaction, 'commands.checkurl.safe'))
                .setDescription(tCmd(interaction, 'commands.checkurl.result_desc', { url }))
                .addFields(
                    {
                        name: tCmd(interaction, 'commands.checkurl.status'),
                        value: data.status ? data.status.toString() : 'N/A',
                        inline: true
                    },
                    {
                        name: tCmd(interaction, 'commands.checkurl.title'),
                        value: data.title || 'N/A',
                        inline: true
                    },
                    {
                        name: tCmd(interaction, 'commands.checkurl.final_url'),
                        value: data.resURL || url,
                        inline: false
                    }
                )
                .setFooter({ text: 'Powered By Securl' })
                .setTimestamp();

            // ウイルス検出があれば追加
            if (hasViruses && data.viruses) {
                resultEmbed.addFields({
                    name: '🦠 ' + tCmd(interaction, 'commands.checkurl.viruses_detected'),
                    value: data.viruses.join('\n') || 'Unknown',
                    inline: false
                });
            }

            // ブラックリストに載っていれば追加
            if (isBlacklisted && data.blackList) {
                resultEmbed.addFields({
                    name: '🚫 ' + tCmd(interaction, 'commands.checkurl.blacklisted'),
                    value: data.blackList.join('\n') || 'Unknown',
                    inline: false
                });
            }

            // キャプチャ画像があれば追加
            const captureUrl = getCapture(data);
            if (captureUrl) {
                resultEmbed.setImage(captureUrl);
                resultEmbed.addFields({
                    name: tCmd(interaction, 'commands.checkurl.captured_at'),
                    value: data.capturedDate || 'Unknown',
                    inline: true
                });
            }

            await interaction.editReply({
                embeds: [resultEmbed]
            });

        } catch (error) {
            logger.error('URL check error:', error);

            const errorEmbed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('❌ ' + tCmd(interaction, 'commands.checkurl.error'))
                .setDescription(tCmd(interaction, 'commands.checkurl.error_desc'))
                .addFields({
                    name: tCmd(interaction, 'commands.checkurl.error_details'),
                    value: error instanceof Error ? error.message : String(error),
                    inline: false
                })
                .setFooter({ text: 'Powered By Securl' })
                .setTimestamp();

            await interaction.editReply({
                embeds: [errorEmbed]
            });
        }
    },
};
