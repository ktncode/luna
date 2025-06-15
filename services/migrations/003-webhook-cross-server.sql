-- SPDX-License-Identifier: MPL-2.0
-- Add cross-server webhook functionality
-- This Source Code Form is subject to the terms of the Mozilla Public License v2.0

-- クロスサーバーWebHook設定テーブル
CREATE TABLE IF NOT EXISTS cross_server_webhooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_guild_id TEXT NOT NULL,
    target_guild_id TEXT NOT NULL,
    target_channel_id TEXT NOT NULL,
    webhook_path TEXT NOT NULL,
    webhook_name TEXT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (webhook_path) REFERENCES guild_webhooks(webhook_path)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_cross_webhooks_source_guild ON cross_server_webhooks(source_guild_id);
CREATE INDEX IF NOT EXISTS idx_cross_webhooks_target_guild ON cross_server_webhooks(target_guild_id);
CREATE INDEX IF NOT EXISTS idx_cross_webhooks_path ON cross_server_webhooks(webhook_path);
CREATE INDEX IF NOT EXISTS idx_cross_webhooks_enabled ON cross_server_webhooks(enabled);

-- トリガー：クロスサーバーWebHook設定の更新時刻自動更新
CREATE TRIGGER IF NOT EXISTS update_cross_webhooks_timestamp 
    AFTER UPDATE ON cross_server_webhooks
    FOR EACH ROW
BEGIN
    UPDATE cross_server_webhooks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
