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
  db = new Database('luna.db');
  
  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');
  
  // Run migrations
  await runMigrations();
}

async function runMigrations(): Promise<void> {
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
