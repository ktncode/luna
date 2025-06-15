-- SPDX-License-Identifier: MPL-2.0
-- This Source Code Form is subject to the terms of the Mozilla Public License v2.0

-- ギルドのWebHook設定テーブル
CREATE TABLE IF NOT EXISTS guild_webhooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    webhook_path TEXT NOT NULL UNIQUE,
    channel_id TEXT NOT NULL,
    name TEXT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guild_id) REFERENCES guild_i18n(guild_id)
);

-- WebHook使用統計テーブル
CREATE TABLE IF NOT EXISTS webhook_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    webhook_path TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    request_count INTEGER DEFAULT 1,
    last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (webhook_path) REFERENCES guild_webhooks(webhook_path)
);

-- トリガー：WebHook設定の更新時刻自動更新
CREATE TRIGGER IF NOT EXISTS update_guild_webhooks_timestamp 
    AFTER UPDATE ON guild_webhooks
    FOR EACH ROW
BEGIN
    UPDATE guild_webhooks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_guild_webhooks_guild_id ON guild_webhooks(guild_id);
CREATE INDEX IF NOT EXISTS idx_guild_webhooks_path ON guild_webhooks(webhook_path);
CREATE INDEX IF NOT EXISTS idx_guild_webhooks_enabled ON guild_webhooks(enabled);
CREATE INDEX IF NOT EXISTS idx_webhook_stats_path ON webhook_stats(webhook_path);
CREATE INDEX IF NOT EXISTS idx_webhook_stats_guild_id ON webhook_stats(guild_id);
CREATE INDEX IF NOT EXISTS idx_webhook_stats_last_used ON webhook_stats(last_used_at);

-- ギルドあたり最大5つまでのWebHookを制限する制約
CREATE VIEW IF NOT EXISTS webhook_count_check AS
SELECT guild_id, COUNT(*) as webhook_count
FROM guild_webhooks
WHERE enabled = TRUE
GROUP BY guild_id;
