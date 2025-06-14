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
