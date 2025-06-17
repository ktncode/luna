-- SPDX-License-Identifier: MPL-2.0
-- This Source Code Form is subject to the terms of the Mozilla Public License v2.0
-- Copyright (c) Kotone <git@ktn.works>

-- 役職パネルテーブル
CREATE TABLE IF NOT EXISTS role_panels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    color INTEGER DEFAULT 5814783,
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    enabled BOOLEAN DEFAULT TRUE
);

-- 役職パネルのロール設定テーブル
CREATE TABLE IF NOT EXISTS role_panel_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    panel_id INTEGER NOT NULL,
    role_id TEXT NOT NULL,
    emoji TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (panel_id) REFERENCES role_panels(id) ON DELETE CASCADE
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_role_panels_guild ON role_panels(guild_id);
CREATE INDEX IF NOT EXISTS idx_role_panels_message ON role_panels(message_id);
CREATE INDEX IF NOT EXISTS idx_role_panel_roles_panel ON role_panel_roles(panel_id);

-- トリガー：役職パネルの更新時刻自動更新
CREATE TRIGGER IF NOT EXISTS update_role_panels_timestamp 
    AFTER UPDATE ON role_panels
    FOR EACH ROW
BEGIN
    UPDATE role_panels SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
