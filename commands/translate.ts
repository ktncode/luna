/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * SPDX-License-Identifier: MPL-2.0
 * Copyright (c) Kotone <git@ktn.works>
 */

import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { translate } from '@vitalets/google-translate-api';
import { tCmd } from '../services/i18n.js';

export default {
    data: new SlashCommandBuilder()
        .setName('translate')
        .setDescription('Translate text using Google Translate')
        .setDescriptionLocalization('ja', 'Google翻訳を使用してテキストを翻訳します')
        .addStringOption(option =>
            option.setName('text')
                .setDescription('Text to translate')
                .setDescriptionLocalization('ja', '翻訳するテキスト')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('to')
                .setDescription('Target language')
                .setDescriptionLocalization('ja', '翻訳先言語')
                .setRequired(false)
                .addChoices(
                    { name: 'Japanese (日本語)', value: 'ja' },
                    { name: 'English', value: 'en' },
                    { name: 'Korean (한국어)', value: 'ko' },
                    { name: 'Chinese Simplified (简体中文)', value: 'zh-cn' },
                    { name: 'Chinese Traditional (繁體中文)', value: 'zh-tw' },
                    { name: 'Spanish (Español)', value: 'es' },
                    { name: 'French (Français)', value: 'fr' },
                    { name: 'German (Deutsch)', value: 'de' },
                    { name: 'Italian (Italiano)', value: 'it' },
                    { name: 'Portuguese (Português)', value: 'pt' },
                    { name: 'Russian (Русский)', value: 'ru' },
                    { name: 'Arabic (العربية)', value: 'ar' },
                    { name: 'Hindi (हिन्दी)', value: 'hi' },
                    { name: 'Thai (ไทย)', value: 'th' },
                    { name: 'Vietnamese (Tiếng Việt)', value: 'vi' },
                    { name: 'Indonesian (Bahasa Indonesia)', value: 'id' },
                    { name: 'Dutch (Nederlands)', value: 'nl' },
                    { name: 'Polish (Polski)', value: 'pl' },
                    { name: 'Turkish (Türkçe)', value: 'tr' },
                    { name: 'Swedish (Svenska)', value: 'sv' },
                    { name: 'Finnish (Suomi)', value: 'fi' },
                    { name: 'Norwegian (Norsk)', value: 'no' },
                    { name: 'Danish (Dansk)', value: 'da' },
                    { name: 'Greek (Ελληνικά)', value: 'el' },
                    { name: 'Ukrainian (Українська)', value: 'uk' }
                )
        )
        .addStringOption(option =>
            option.setName('to_custom')
                .setDescription('Custom target language code (e.g., "cs" for Czech)')
                .setDescriptionLocalization('ja', 'カスタム翻訳先言語コード (例: "cs" でチェコ語)')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('from')
                .setDescription('Source language (default: auto-detect)')
                .setDescriptionLocalization('ja', '翻訳元言語 (デフォルト: 自動検出)')
                .setRequired(false)
                .addChoices(
                    { name: 'Auto-detect', value: 'auto' },
                    { name: 'Japanese (日本語)', value: 'ja' },
                    { name: 'English', value: 'en' },
                    { name: 'Korean (한국어)', value: 'ko' },
                    { name: 'Chinese Simplified (简体中文)', value: 'zh-cn' },
                    { name: 'Chinese Traditional (繁體中文)', value: 'zh-tw' },
                    { name: 'Spanish (Español)', value: 'es' },
                    { name: 'French (Français)', value: 'fr' },
                    { name: 'German (Deutsch)', value: 'de' },
                    { name: 'Italian (Italiano)', value: 'it' },
                    { name: 'Portuguese (Português)', value: 'pt' },
                    { name: 'Russian (Русский)', value: 'ru' },
                    { name: 'Arabic (العربية)', value: 'ar' },
                    { name: 'Hindi (हिन्दी)', value: 'hi' },
                    { name: 'Thai (ไทย)', value: 'th' },
                    { name: 'Vietnamese (Tiếng Việt)', value: 'vi' },
                    { name: 'Indonesian (Bahasa Indonesia)', value: 'id' },
                    { name: 'Dutch (Nederlands)', value: 'nl' },
                    { name: 'Polish (Polski)', value: 'pl' },
                    { name: 'Turkish (Türkçe)', value: 'tr' },
                    { name: 'Swedish (Svenska)', value: 'sv' },
                    { name: 'Finnish (Suomi)', value: 'fi' },
                    { name: 'Norwegian (Norsk)', value: 'no' },
                    { name: 'Danish (Dansk)', value: 'da' },
                    { name: 'Greek (Ελληνικά)', value: 'el' }
                )
        )
        .addStringOption(option =>
            option.setName('from_custom')
                .setDescription('Custom source language code (e.g., "cs" for Czech)')
                .setDescriptionLocalization('ja', 'カスタム翻訳元言語コード (例: "cs" でチェコ語)')
                .setRequired(false)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const text = interaction.options.getString('text', true);
        const targetLang = interaction.options.getString('to_custom') || 
                          interaction.options.getString('to') || 
                          (interaction.locale === 'ja' ? 'en' : 'ja');
        const sourceLang = interaction.options.getString('from_custom') || 
                          interaction.options.getString('from') || 
                          'auto';

        await interaction.deferReply();

        try {
            if (text.length > 1000) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle(`❌ ${tCmd(interaction, 'commands.translate.error_title')}`)
                    .setDescription(tCmd(interaction, 'commands.translate.text_too_long'))
                    .setColor(0xff0000)
                    .setTimestamp();
                
                await interaction.editReply({ embeds: [errorEmbed] });
                return;
            }

            const result = await translate(text, { 
                from: sourceLang === 'auto' ? undefined : sourceLang, 
                to: targetLang 
            });

            // 安全にrawレスポンスから言語情報を取得
            let detectedLang = sourceLang;
            try {
                const rawArray = result.raw as unknown as any[];
                if (Array.isArray(rawArray) && rawArray.length > 2 && typeof rawArray[2] === 'string') {
                    detectedLang = rawArray[2];
                }
            } catch {
                // rawレスポンスの解析に失敗した場合はデフォルト値を使用
            }

            const sourceLanguage = sourceLang === 'auto' ? detectedLang : sourceLang;

            const embed = new EmbedBuilder()
                .setTitle(`🌐 ${tCmd(interaction, 'commands.translate.title')}`)
                .setColor(0x4285f4)
                .addFields(
                    {
                        name: `📝 ${tCmd(interaction, 'commands.translate.original')} (${getLanguageName(sourceLanguage)})`,
                        value: `\`\`\`\n${text}\n\`\`\``,
                        inline: false
                    },
                    {
                        name: `✨ ${tCmd(interaction, 'commands.translate.translated')} (${getLanguageName(targetLang)})`,
                        value: `\`\`\`\n${result.text}\n\`\`\``,
                        inline: false
                    }
                )
                .setFooter({
                    text: tCmd(interaction, 'commands.translate.powered_by')
                })
                .setTimestamp();

            // 自動検出の場合は検出された言語を表示
            if (sourceLang === 'auto' && detectedLang && detectedLang !== 'auto' && detectedLang !== sourceLang) {
                embed.addFields({
                    name: `🔍 ${tCmd(interaction, 'commands.translate.detected')}`,
                    value: getLanguageName(detectedLang),
                    inline: true
                });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Translation error:', error);
            const errorEmbed = new EmbedBuilder()
                .setTitle(`❌ ${tCmd(interaction, 'commands.translate.error_title')}`)
                .setDescription(tCmd(interaction, 'commands.translate.api_error'))
                .setColor(0xff0000)
                .setTimestamp();
            
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },
};

function getLanguageName(code: string): string {
    const languageNames: Record<string, string> = {
        'ja': '日本語',
        'en': 'English',
        'ko': '한국어',
        'zh-cn': '简体中文',
        'zh-tw': '繁體中文',
        'es': 'Español',
        'fr': 'Français',
        'de': 'Deutsch',
        'it': 'Italiano',
        'pt': 'Português',
        'ru': 'Русский',
        'ar': 'العربية',
        'hi': 'हिन्दी',
        'th': 'ไทย',
        'vi': 'Tiếng Việt',
        'id': 'Bahasa Indonesia',
        'ms': 'Bahasa Melayu',
        'nl': 'Nederlands',
        'pl': 'Polski',
        'tr': 'Türkçe',
        'sv': 'Svenska',
        'da': 'Dansk',
        'no': 'Norsk',
        'fi': 'Suomi',
        'el': 'Ελληνικά',
        'auto': 'Auto-detect',
        // 追加の言語
        'uk': 'Українська',
        'bg': 'Български',
        'hr': 'Hrvatski',
        'cs': 'Čeština',
        'sk': 'Slovenčina',
        'sl': 'Slovenščina',
        'et': 'Eesti',
        'lv': 'Latviešu',
        'lt': 'Lietuvių',
        'hu': 'Magyar',
        'ro': 'Română',
        'mt': 'Malti',
        'is': 'Íslenska',
        'ga': 'Gaeilge',
        'cy': 'Cymraeg',
        'eu': 'Euskera',
        'ca': 'Català',
        'gl': 'Galego',
        'fa': 'فارسی',
        'ur': 'اردو',
        'he': 'עברית',
        'bn': 'বাংলা',
        'ta': 'தமிழ்',
        'te': 'తెలుగు',
        'kn': 'ಕನ್ನಡ',
        'ml': 'മലയാളം',
        'gu': 'ગુજરાતી',
        'pa': 'ਪੰਜਾਬੀ',
        'ne': 'नेपाली',
        'si': 'සිංහල',
        'my': 'မြန်မာ',
        'km': 'ខ្មែរ',
        'lo': 'ລາວ',
        'ka': 'ქართული',
        'am': 'አማርኛ',
        'sw': 'Kiswahili',
        'zu': 'isiZulu',
        'af': 'Afrikaans'
    };
    
    return languageNames[code] || code.toUpperCase();
}
