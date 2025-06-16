-- SPDX-License-Identifier: MPL-2.0
-- Add user tracking for webhook management
-- This Source Code Form is subject to the terms of the Mozilla Public License v2.0

-- WebHookテーブルに作成者情報を追加
ALTER TABLE guild_webhooks ADD COLUMN created_by TEXT;

-- クロスサーバーWebHookテーブルに作成者情報を追加
ALTER TABLE cross_server_webhooks ADD COLUMN created_by TEXT;

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_guild_webhooks_created_by ON guild_webhooks(created_by);
CREATE INDEX IF NOT EXISTS idx_cross_webhooks_created_by ON cross_server_webhooks(created_by);
