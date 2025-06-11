/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * Copyright (c) Kotone <git@ktn.works>
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { load } from 'js-yaml';
import { I18nManager } from './db.js';

interface Translations {
  [key: string]: any;
}

const translations: Map<string, Translations> = new Map();
const defaultLocale = 'ja-JP';

// Load translation files
function loadTranslations() {
  const locales = ['ja_JP', 'en_US'];
  
  for (const locale of locales) {
    try {
      const filePath = join(__dirname, '..', 'locales', `${locale}.yml`);
      const content = readFileSync(filePath, 'utf8');
      const data = load(content) as Translations;
      translations.set(locale.replace('_', '-'), data);
    } catch (error) {
      console.error(`Failed to load locale ${locale}:`, error);
    }
  }
}

// Get translation with key path and variables
export function t(guildId: string | undefined, discordLocale: string | undefined, keyPath: string, variables?: Record<string, string | number>): string {
  // Priority: DB locale (if not null) > Discord locale > default locale
  let locale = defaultLocale;
  
  if (guildId) {
    const dbLocale = I18nManager.getGuildLocale(guildId);
    
    if (dbLocale !== null) {
      // DBに明示的にlocaleが設定されている場合はそれを使用
      locale = dbLocale;
    } else if (discordLocale) {
      // DB localeがnullの場合はDiscord APIから取得
      locale = normalizeLocale(discordLocale);
    }
    
    // 使用統計をログに記録
    I18nManager.logLocaleUsage(guildId, locale);
  } else if (discordLocale) {
    locale = normalizeLocale(discordLocale);
  }
  
  const translation = getNestedValue(translations.get(locale), keyPath) || 
                     getNestedValue(translations.get(defaultLocale), keyPath) || 
                     keyPath;
  
  if (variables && typeof translation === 'string') {
    return translation.replace(/\{(\w+)\}/g, (match, key) => {
      return variables[key]?.toString() || match;
    });
  }
  
  return translation;
}

// Normalize Discord locale to file locale
function normalizeLocale(locale: string | undefined): string {
  if (!locale) return defaultLocale;
  
  // Map Discord locales to our file locales based on preferredLocale
  const localeMap: Record<string, string> = {
    'ja': 'ja-JP',
    'ja-JP': 'ja-JP',
    'en-US': 'en-US',
    'en-GB': 'en-US', // Fallback to US English
    'en': 'en-US', // Fallback to US English
  };
  
  return localeMap[locale] || defaultLocale;
}

// Get nested value from object using dot notation
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

// Initialize translations
loadTranslations();

// Helper function for commands
export function tCmd(interaction: any, keyPath: string, variables?: Record<string, string | number>): string {
  const guildId = interaction.guild?.id;
  const discordLocale = interaction.guild?.preferredLocale;
  const result = t(guildId, discordLocale, keyPath, variables);
  
  // コマンド使用統計をログに記録
  if (guildId) {
    I18nManager.logLocaleUsage(
      guildId, 
      I18nManager.getGuildLocale(guildId) || defaultLocale, 
      interaction.commandName
    );
  }
  
  return result;
}

export { defaultLocale };
