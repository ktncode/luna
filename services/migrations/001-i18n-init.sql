-- SPDX-License-Identifier: MPL-2.0
-- This Source Code Form is subject to the terms of the Mozilla Public License v2.0
-- Copyright (c) Kotone <git@ktn.works>

-- Initialize i18n localization tables

-- Guild専用のi18n設定テーブル
CREATE TABLE IF NOT EXISTS guild_i18n (
    guild_id TEXT PRIMARY KEY,
    locale TEXT CHECK (locale IN ('ja-JP', 'en-US') OR locale IS NULL),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- サポート言語管理テーブル（将来の言語追加用）
CREATE TABLE IF NOT EXISTS supported_locales (
    locale_code TEXT PRIMARY KEY,
    locale_name TEXT NOT NULL,
    native_name TEXT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 翻訳統計テーブル（どの言語がよく使われるかの統計用）
CREATE TABLE IF NOT EXISTS i18n_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT,
    locale TEXT NOT NULL,
    command_name TEXT,
    used_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- トリガー：Guild i18n設定の更新時刻自動更新
CREATE TRIGGER IF NOT EXISTS update_guild_i18n_timestamp 
    AFTER UPDATE ON guild_i18n
    FOR EACH ROW
BEGIN
    UPDATE guild_i18n SET updated_at = CURRENT_TIMESTAMP WHERE guild_id = NEW.guild_id;
END;

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_guild_i18n_locale ON guild_i18n(locale);
CREATE INDEX IF NOT EXISTS idx_i18n_stats_guild_id ON i18n_stats(guild_id);
CREATE INDEX IF NOT EXISTS idx_i18n_stats_locale ON i18n_stats(locale);
CREATE INDEX IF NOT EXISTS idx_i18n_stats_used_at ON i18n_stats(used_at);
CREATE INDEX IF NOT EXISTS idx_supported_locales_enabled ON supported_locales(enabled);

-- 初期サポート言語データの挿入（現在は ja-JP と en-US のみ有効）
INSERT OR IGNORE INTO supported_locales (locale_code, locale_name, native_name, enabled) VALUES
('ja-JP', 'Japanese', '日本語', TRUE),
('en-US', 'English (US)', 'English', TRUE),
('en-GB', 'English (UK)', 'English (UK)', FALSE),
('ko-KR', 'Korean', '한국어', FALSE),
('zh-CN', 'Chinese (Simplified)', '简体中文', FALSE),
('zh-TW', 'Chinese (Traditional)', '繁體中文', FALSE),
('es-ES', 'Spanish', 'Español', FALSE),
('fr-FR', 'French', 'Français', FALSE),
('de-DE', 'German', 'Deutsch', FALSE),
('ru-RU', 'Russian', 'Русский', FALSE);
