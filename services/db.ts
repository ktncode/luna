/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * Copyright (c) Kotone <git@ktn.works>
 */

import Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

let db: Database.Database;

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

export async function initializeDatabase(): Promise<void> {
  const dbPath = process.env.DATABASE_PATH || 'luna.db';
  db = new Database(dbPath);
  
  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');
  
  console.log(`Database initialized at: ${dbPath}`);
}

export async function runMigrations(): Promise<void> {
  const migrationsDir = join(__dirname, 'migrations');
  
  try {
    const migrationFiles = readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    for (const file of migrationFiles) {
      const migrationPath = join(migrationsDir, file);
      const migration = readFileSync(migrationPath, 'utf8');
      
      console.log(`Running migration: ${file}`);
      db.exec(migration);
    }
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  }
}

// ============================================
// 汎用DB操作クラス
// ============================================

export class DBManager {
  private static instance: DBManager;
  private static preparedStatements: Map<string, Database.Statement> = new Map();
  
  static getInstance(): DBManager {
    if (!this.instance) {
      this.instance = new DBManager();
    }
    return this.instance;
  }

  // プリペアドステートメントのキャッシュ機能
  private getStatement(key: string, sql: string): Database.Statement {
    if (!DBManager.preparedStatements.has(key)) {
      DBManager.preparedStatements.set(key, db.prepare(sql));
    }
    return DBManager.preparedStatements.get(key)!;
  }

  // 高速SELECT（プリペアドステートメント使用）
  selectFast<T = any>(table: string, where: Record<string, any>): T[] {
    if (!db) return [];
    
    try {
      const keys = Object.keys(where);
      const cacheKey = `select_${table}_${keys.join('_')}`;
      const whereClause = keys.map(key => `${key} = ?`).join(' AND ');
      const sql = `SELECT * FROM ${table} WHERE ${whereClause}`;
      
      const stmt = this.getStatement(cacheKey, sql);
      return stmt.all(...Object.values(where)) as T[];
    } catch (error) {
      console.error('SelectFast error:', error);
      return [];
    }
  }

  // 高速UPSERT（プリペアドステートメント使用）
  upsertFast(table: string, data: Record<string, any>, conflictColumns: string[]): boolean {
    if (!db) return false;
    
    try {
      const columns = Object.keys(data);
      const cacheKey = `upsert_${table}_${columns.join('_')}_${conflictColumns.join('_')}`;
      
      const placeholders = columns.map(() => '?').join(', ');
      const updateClause = columns
        .filter(col => !conflictColumns.includes(col))
        .map(col => `${col} = excluded.${col}`)
        .join(', ');
      
      let sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
      
      if (updateClause) {
        sql += ` ON CONFLICT(${conflictColumns.join(', ')}) DO UPDATE SET ${updateClause}, updated_at = CURRENT_TIMESTAMP`;
      }
      
      const stmt = this.getStatement(cacheKey, sql);
      stmt.run(...Object.values(data));
      return true;
    } catch (error) {
      console.error('UpsertFast error:', error);
      return false;
    }
  }

  // 高速単一行取得
  findOneFast<T = any>(table: string, where: Record<string, any>): T | null {
    if (!db) return null;
    
    try {
      const keys = Object.keys(where);
      const cacheKey = `findone_${table}_${keys.join('_')}`;
      const whereClause = keys.map(key => `${key} = ?`).join(' AND ');
      const sql = `SELECT * FROM ${table} WHERE ${whereClause} LIMIT 1`;
      
      const stmt = this.getStatement(cacheKey, sql);
      const result = stmt.get(...Object.values(where)) as T;
      return result || null;
    } catch (error) {
      console.error('FindOneFast error:', error);
      return null;
    }
  }

  // 汎用SELECT操作
  select<T = any>(table: string, where?: Record<string, any>, options?: {
    columns?: string[];
    orderBy?: string;
    limit?: number;
    offset?: number;
  }): T[] {
    if (!db) return [];
    
    try {
      let query = `SELECT ${options?.columns?.join(', ') || '*'} FROM ${table}`;
      const params: any[] = [];
      
      if (where && Object.keys(where).length > 0) {
        const conditions = Object.keys(where).map(key => `${key} = ?`);
        query += ` WHERE ${conditions.join(' AND ')}`;
        params.push(...Object.values(where));
      }
      
      if (options?.orderBy) {
        query += ` ORDER BY ${options.orderBy}`;
      }
      
      if (options?.limit) {
        query += ` LIMIT ${options.limit}`;
      }
      
      if (options?.offset) {
        query += ` OFFSET ${options.offset}`;
      }
      
      const stmt = db.prepare(query);
      return stmt.all(...params) as T[];
    } catch (error) {
      console.error('Select error:', error);
      return [];
    }
  }

  // 汎用INSERT操作
  insert(table: string, data: Record<string, any>): boolean {
    if (!db) return false;
    
    try {
      const columns = Object.keys(data);
      const placeholders = columns.map(() => '?').join(', ');
      const query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
      
      const stmt = db.prepare(query);
      stmt.run(...Object.values(data));
      return true;
    } catch (error) {
      console.error('Insert error:', error);
      return false;
    }
  }

  // 汎用UPDATE操作
  update(table: string, data: Record<string, any>, where: Record<string, any>): boolean {
    if (!db) return false;
    
    try {
      const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
      const whereClause = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
      const query = `UPDATE ${table} SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE ${whereClause}`;
      
      const params = [...Object.values(data), ...Object.values(where)];
      const stmt = db.prepare(query);
      stmt.run(...params);
      return true;
    } catch (error) {
      console.error('Update error:', error);
      return false;
    }
  }

  // 汎用UPSERT操作
  upsert(table: string, data: Record<string, any>, conflictColumns: string[]): boolean {
    if (!db) return false;
    
    try {
      const columns = Object.keys(data);
      const placeholders = columns.map(() => '?').join(', ');
      const updateClause = columns
        .filter(col => !conflictColumns.includes(col))
        .map(col => `${col} = excluded.${col}`)
        .join(', ');
      
      let query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
      
      if (updateClause) {
        query += ` ON CONFLICT(${conflictColumns.join(', ')}) DO UPDATE SET ${updateClause}, updated_at = CURRENT_TIMESTAMP`;
      }
      
      const stmt = db.prepare(query);
      stmt.run(...Object.values(data));
      return true;
    } catch (error) {
      console.error('Upsert error:', error);
      return false;
    }
  }

  // 汎用DELETE操作
  delete(table: string, where: Record<string, any>): boolean {
    if (!db) return false;
    
    try {
      const whereClause = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
      const query = `DELETE FROM ${table} WHERE ${whereClause}`;
      
      const stmt = db.prepare(query);
      stmt.run(...Object.values(where));
      return true;
    } catch (error) {
      console.error('Delete error:', error);
      return false;
    }
  }

  // カスタムクエリ実行
  query<T = any>(sql: string, params: any[] = []): T[] {
    if (!db) return [];
    
    try {
      const stmt = db.prepare(sql);
      return stmt.all(...params) as T[];
    } catch (error) {
      console.error('Query error:', error);
      return [];
    }
  }

  // 単一行取得
  findOne<T = any>(table: string, where: Record<string, any>): T | null {
    const results = this.select<T>(table, where, { limit: 1 });
    return results.length > 0 ? results[0] : null;
  }

  // 件数取得
  count(table: string, where?: Record<string, any>): number {
    if (!db) return 0;
    
    try {
      let query = `SELECT COUNT(*) as count FROM ${table}`;
      const params: any[] = [];
      
      if (where && Object.keys(where).length > 0) {
        const conditions = Object.keys(where).map(key => `${key} = ?`);
        query += ` WHERE ${conditions.join(' AND ')}`;
        params.push(...Object.values(where));
      }
      
      const stmt = db.prepare(query);
      const result = stmt.get(...params) as { count: number };
      return result.count;
    } catch (error) {
      console.error('Count error:', error);
      return 0;
    }
  }
}

// ============================================
// i18n専用管理クラス
// ============================================

export class I18nManager {
  private static dbm = DBManager.getInstance();
  private static localeCache: Map<string, string> = new Map();
  private static cacheTimeout = 5 * 60 * 1000; // 5分
  private static lastCacheUpdate = 0;

  // キャッシュ付きロケール取得
  static getGuildLocale(guildId: string): string | null {
    // キャッシュの有効性をチェック
    const now = Date.now();
    if (now - this.lastCacheUpdate > this.cacheTimeout) {
      this.localeCache.clear();
      this.lastCacheUpdate = now;
    }

    // キャッシュから取得
    if (this.localeCache.has(guildId)) {
      return this.localeCache.get(guildId)!;
    }

    // DBから取得してキャッシュに保存
    const result = this.dbm.findOneFast<{ locale: string }>('guild_i18n', { guild_id: guildId });
    const locale = result?.locale || null;
    
    if (locale) {
      this.localeCache.set(guildId, locale);
    }
    
    return locale;
  }

  static setGuildLocale(guildId: string, locale: string | null): boolean {
    // locale値の検証
    if (locale !== null && !['ja-JP', 'en-US'].includes(locale)) {
      console.error(`Invalid locale: ${locale}. Only 'ja-JP' and 'en-US' are supported.`);
      return false;
    }

    const success = this.dbm.upsertFast('guild_i18n', {
      guild_id: guildId,
      locale: locale
    }, ['guild_id']);

    // キャッシュを更新
    if (success) {
      if (locale === null) {
        this.localeCache.delete(guildId);
      } else {
        this.localeCache.set(guildId, locale);
      }
    }

    return success;
  }

  static getGuildI18nSettings(guildId: string): {
    locale: string | null;
    autoDetect: boolean;
  } | null {
    const result = this.dbm.findOneFast<{
      locale: string | null;
      auto_detect: boolean;
    }>('guild_i18n', { guild_id: guildId });
    
    if (!result) {
      // 設定がない場合はauto_detectをtrueとして返す
      return {
        locale: null,
        autoDetect: true
      };
    }
    
    return {
      locale: result.locale,
      autoDetect: !!result.auto_detect
    };
  }

  // バッチログ記録（パフォーマンス向上）
  private static logQueue: Array<{
    guild_id: string | null;
    locale: string;
    command_name?: string;
  }> = [];

  static logLocaleUsage(guildId: string | null, locale: string, commandName?: string): void {
    this.logQueue.push({
      guild_id: guildId,
      locale: locale,
      command_name: commandName
    });

    // キューが一定数に達したらまとめて処理
    if (this.logQueue.length >= 10) {
      this.flushLogQueue();
    }
  }

  private static flushLogQueue(): void {
    if (this.logQueue.length === 0) return;

    try {
      const stmt = db.prepare(`
        INSERT INTO i18n_stats (guild_id, locale, command_name, used_at) 
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `);

      const transaction = db.transaction(() => {
        for (const log of this.logQueue) {
          stmt.run(log.guild_id, log.locale, log.command_name);
        }
      });

      transaction();
      this.logQueue = [];
    } catch (error) {
      console.error('Error flushing log queue:', error);
    }
  }

  static getSupportedLocales(): Array<{
    localeCode: string;
    localeName: string;
    nativeName: string;
    enabled: boolean;
  }> {
    return this.dbm.selectFast<{
      locale_code: string;
      locale_name: string;
      native_name: string;
      enabled: boolean;
    }>('supported_locales', { enabled: true }).map(row => ({
      localeCode: row.locale_code,
      localeName: row.locale_name,
      nativeName: row.native_name,
      enabled: !!row.enabled
    }));
  }

  // アプリケーション終了時にキューをフラッシュ
  static shutdown(): void {
    this.flushLogQueue();
  }
}

// ============================================
// 後方互換性のための関数（i18n専用版）
// ============================================

export function getGuildLocale(guildId: string): string | null {
  return I18nManager.getGuildLocale(guildId);
}

export function setGuildLocale(guildId: string, locale: string | null): boolean {
  return I18nManager.setGuildLocale(guildId, locale);
}

// WebHook関連のインターフェース
export interface WebhookConfig {
    id: number;
    guild_id: string;
    webhook_path: string;
    channel_id: string;
    name: string;
    enabled: boolean;
    created_at: string;
    updated_at: string;
    created_by?: string;
}

// クロスサーバーWebHook関連のインターフェース
export interface CrossServerWebhookConfig {
    id: number;
    source_guild_id: string;
    target_guild_id: string;
    target_channel_id: string;
    webhook_path: string;
    webhook_name: string;
    enabled: boolean;
    created_at: string;
    updated_at: string;
    created_by?: string;
}

// WebHook設定の作成
export async function createWebhook(guildId: string, webhookPath: string, channelId: string, name: string, userId: string): Promise<boolean> {
    try {
        const dbm = DBManager.getInstance();
        
        // guild_i18nレコードが存在しない場合は作成
        const existingGuild = dbm.findOne('guild_i18n', { guild_id: guildId });
        if (!existingGuild) {
            dbm.insert('guild_i18n', {
                guild_id: guildId,
                locale: null
            });
        }
        
        // WebHookパスの重複チェック（全体で一意である必要がある）
        const existingPath = dbm.findOne('guild_webhooks', { 
            webhook_path: webhookPath 
        });
        
        if (existingPath) {
            console.log(`Webhook path collision detected: ${webhookPath}`);
            return false; // パスが重複している
        }
        
        // 既存のWebHook数をチェック（最大5つまで）
        const countResult = dbm.query(
            'SELECT COUNT(*) as count FROM guild_webhooks WHERE guild_id = ? AND enabled = TRUE',
            [guildId]
        );
        
        if (countResult[0]?.count >= 5) {
            console.log(`Webhook limit reached for guild: ${guildId}`);
            return false; // 上限に達している
        }

        return dbm.insert('guild_webhooks', {
            guild_id: guildId,
            webhook_path: webhookPath,
            channel_id: channelId,
            name: name,
            created_by: userId
        });
    } catch (error) {
        console.error('Error creating webhook:', error);
        return false;
    }
}

// WebHook設定の削除（権限チェック付き）
export async function deleteWebhook(guildId: string, webhookId: number, userId: string, hasManageGuildPermission: boolean): Promise<boolean> {
    try {
        const dbm = DBManager.getInstance();
        
        // WebHookの存在と作成者をチェック
        const webhook = dbm.findOne<WebhookConfig>('guild_webhooks', { 
            id: webhookId, 
            guild_id: guildId,
            enabled: true
        });
        
        if (!webhook) {
            console.log(`Webhook not found: ${webhookId}`);
            return false;
        }
        
        // 権限チェック：作成者または管理者権限を持つユーザーのみ削除可能
        if (webhook.created_by !== userId && !hasManageGuildPermission) {
            console.log(`Insufficient permissions to delete webhook: user ${userId}, creator ${webhook.created_by}`);
            return false;
        }
        
        const stmt = db.prepare('UPDATE guild_webhooks SET enabled = 0 WHERE id = ? AND guild_id = ?');
        stmt.run(webhookId, guildId);
        return true;
    } catch (error) {
        console.error('Error deleting webhook:', error);
        return false;
    }
}

// クロスサーバーWebHook設定の作成
export async function createCrossServerWebhook(
    sourceGuildId: string, 
    targetGuildId: string, 
    targetChannelId: string, 
    webhookPath: string, 
    webhookName: string,
    userId: string
): Promise<boolean> {
    try {
        const dbm = DBManager.getInstance();
        
        // WebHookパスが存在するかチェック
        const existingWebhook = await getWebhookByPath(webhookPath);
        if (!existingWebhook) {
            console.log(`Webhook path not found: ${webhookPath}`);
            return false;
        }
        
        // WebHook名が一致するかチェック
        if (existingWebhook.name !== webhookName) {
            console.log(`Webhook name mismatch: expected ${webhookName}, got ${existingWebhook.name}`);
            return false;
        }
        
        // 既存のクロスサーバー設定をチェック
        const existing = dbm.findOne('cross_server_webhooks', {
            source_guild_id: sourceGuildId,
            target_guild_id: targetGuildId,
            webhook_path: webhookPath
        });
        
        if (existing) {
            console.log(`Cross-server webhook already exists`);
            return false;
        }

        return dbm.insert('cross_server_webhooks', {
            source_guild_id: sourceGuildId,
            target_guild_id: targetGuildId,
            target_channel_id: targetChannelId,
            webhook_path: webhookPath,
            webhook_name: webhookName,
            created_by: userId
        });
    } catch (error) {
        console.error('Error creating cross-server webhook:', error);
        return false;
    }
}

// クロスサーバーWebHook削除（権限チェック付き）
export async function deleteCrossServerWebhook(guildId: string, crossWebhookId: number, userId: string, hasManageGuildPermission: boolean): Promise<boolean> {
    try {
        const dbm = DBManager.getInstance();
        
        // クロスサーバーWebHookの存在と作成者をチェック
        const crossWebhook = dbm.findOne<CrossServerWebhookConfig>('cross_server_webhooks', { 
            id: crossWebhookId,
            enabled: true
        });
        
        if (!crossWebhook) {
            console.log(`Cross-server webhook not found: ${crossWebhookId}`);
            return false;
        }
        
        // ギルドに関連するかチェック
        if (crossWebhook.source_guild_id !== guildId && crossWebhook.target_guild_id !== guildId) {
            console.log(`Cross-server webhook not related to guild: ${guildId}`);
            return false;
        }
        
        // 権限チェック：作成者または管理者権限を持つユーザーのみ削除可能
        if (crossWebhook.created_by !== userId && !hasManageGuildPermission) {
            console.log(`Insufficient permissions to delete cross-server webhook: user ${userId}, creator ${crossWebhook.created_by}`);
            return false;
        }
        
        const stmt = db.prepare('UPDATE cross_server_webhooks SET enabled = 0 WHERE id = ?');
        stmt.run(crossWebhookId);
        return true;
    } catch (error) {
        console.error('Error deleting cross-server webhook:', error);
        return false;
    }
}

// WebHookパスに対応するクロスサーバー設定を取得
export async function getCrossServerTargets(webhookPath: string): Promise<CrossServerWebhookConfig[]> {
    try {
        const dbm = DBManager.getInstance();
        return dbm.query(
            'SELECT * FROM cross_server_webhooks WHERE webhook_path = ? AND enabled = 1',
            [webhookPath]
        );
    } catch (error) {
        console.error('Error getting cross-server targets:', error);
        return [];
    }
}

// WebHook統計の更新
export async function updateWebhookStats(webhookPath: string, guildId: string): Promise<void> {
    try {
        const dbm = DBManager.getInstance();
        
        // 既存の統計レコードがあるかチェック
        const existing = dbm.query(
            'SELECT * FROM webhook_stats WHERE webhook_path = ? AND guild_id = ?',
            [webhookPath, guildId]
        );

        if (existing.length > 0) {
            // 既存レコードの更新
            const updateStmt = db.prepare(
                'UPDATE webhook_stats SET request_count = request_count + 1, last_used_at = CURRENT_TIMESTAMP WHERE webhook_path = ? AND guild_id = ?'
            );
            updateStmt.run(webhookPath, guildId);
        } else {
            // 新規レコードの作成
            dbm.insert('webhook_stats', {
                webhook_path: webhookPath,
                guild_id: guildId
            });
        }
    } catch (error) {
        console.error('Error updating webhook stats:', error);
    }
}

// WebHook設定の取得（パス指定）
export async function getWebhookByPath(webhookPath: string): Promise<WebhookConfig | null> {
    try {
        const dbm = DBManager.getInstance();
        // 直接SQLクエリを使用してバインドエラーを回避
        const result = dbm.query(
            'SELECT * FROM guild_webhooks WHERE webhook_path = ? AND enabled = 1 LIMIT 1',
            [webhookPath]
        );
        return result[0] || null;
    } catch (error) {
        console.error('Error getting webhook by path:', error);
        return null;
    }
}

// ギルドのWebHook一覧取得
export async function getGuildWebhooks(guildId: string): Promise<WebhookConfig[]> {
    try {
        const dbm = DBManager.getInstance();
        return dbm.query(
            'SELECT * FROM guild_webhooks WHERE guild_id = ? ORDER BY created_at DESC',
            [guildId]
        );
    } catch (error) {
        console.error('Error getting guild webhooks:', error);
        return [];
    }
}

// クロスサーバーWebHook一覧取得
export async function getCrossServerWebhooks(guildId: string): Promise<CrossServerWebhookConfig[]> {
    try {
        const dbm = DBManager.getInstance();
        return dbm.query(
            'SELECT * FROM cross_server_webhooks WHERE source_guild_id = ? OR target_guild_id = ? ORDER BY created_at DESC',
            [guildId, guildId]
        );
    } catch (error) {
        console.error('Error getting cross-server webhooks:', error);
        return [];
    }
}
