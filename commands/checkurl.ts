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
    reqUrl?: string;  // reqURL -> reqUrl
    resUrl?: string;  // resURL -> resUrl
    title?: string;
    anchors?: Array<{
        url: string;
        text: string;
        x: number;
        y: number;
        w: number;
        h: number;
    }>;
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
            .setDescription(tCmd(interaction, 'commands.checkurl.checking_desc', { url: `\`${url}\`` }))
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
            const isRedirected = data.resUrl && data.resUrl !== url;
            
            // HARファイルから判明：status: 0 が正常
            const isSuspiciousStatus = data.status && data.status >= 400;
            const isUnsafe = hasViruses || isBlacklisted || isSuspiciousStatus;

            // ステータスコードの解釈を修正
            let statusText = 'N/A';
            if (data.status !== undefined) {
                switch (data.status) {
                    case 0:
                        statusText = `${data.status} (Analysis Complete)`;
                        break;
                    case 200:
                        statusText = `${data.status} (OK)`;
                        break;
                    case 301:
                    case 302:
                        statusText = `${data.status} (Redirect)`;
                        break;
                    case 404:
                        statusText = `${data.status} (Not Found)`;
                        break;
                    case 500:
                        statusText = `${data.status} (Server Error)`;
                        break;
                    case 590:
                        statusText = `${data.status} (Security Check Failed)`;
                        break;
                    default:
                        statusText = data.status.toString();
                }
            }

            // 結果Embed作成
            const resultEmbed = new EmbedBuilder()
                .setColor(isUnsafe ? 0xff0000 : 0x00ff00)
                .setTitle(isUnsafe ? 
                    '⚠️ ' + tCmd(interaction, 'commands.checkurl.unsafe') : 
                    '✅ ' + tCmd(interaction, 'commands.checkurl.safe'))
                .setDescription(tCmd(interaction, 'commands.checkurl.result_desc', { url: `\`${url}\`` }))
                .addFields(
                    {
                        name: tCmd(interaction, 'commands.checkurl.status'),
                        value: statusText,
                        inline: true
                    },
                    {
                        name: tCmd(interaction, 'commands.checkurl.title'),
                        value: data.title || 'N/A',
                        inline: true
                    }
                )
                .setFooter({ text: 'Powered By Securl' })
                .setTimestamp();

            // リダイレクトされた場合の警告
            if (isRedirected) {
                resultEmbed.addFields({
                    name: '🔄 ' + tCmd(interaction, 'commands.checkurl.redirected'),
                    value: tCmd(interaction, 'commands.checkurl.redirect_warning', { 
                        original: `\`${url}\``, 
                        final: `\`${data.resUrl}\``
                    }),
                    inline: false
                });
            } else {
                resultEmbed.addFields({
                    name: tCmd(interaction, 'commands.checkurl.final_url'),
                    value: `\`${data.resUrl || url}\``,
                    inline: false
                });
            }

            // ステータス0の場合の説明を追加
            if (data.status === 0) {
                resultEmbed.addFields({
                    name: 'ℹ️ ' + tCmd(interaction, 'commands.checkurl.analysis_info'),
                    value: tCmd(interaction, 'commands.checkurl.status_0_info'),
                    inline: false
                });
            }

            // ステータス590の場合の説明（実際にはほとんど発生しない）
            if (data.status === 590) {
                resultEmbed.addFields({
                    name: '⚠️ ' + tCmd(interaction, 'commands.checkurl.security_warning'),
                    value: tCmd(interaction, 'commands.checkurl.status_590_desc'),
                    inline: false
                });
            }

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

            // アンカー情報があれば追加（デバッグ用）
            if (data.anchors && data.anchors.length > 0) {
                const anchorCount = data.anchors.length;
                resultEmbed.addFields({
                    name: '🔗 ' + tCmd(interaction, 'commands.checkurl.anchors_found'),
                    value: tCmd(interaction, 'commands.checkurl.anchors_count', { count: anchorCount }),
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
