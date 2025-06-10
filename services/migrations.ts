/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * Copyright (c) Kotone <git@ktn.works>
 */

import dotenv from 'dotenv';
import { initializeDatabase, runMigrations } from './db.js';

dotenv.config();

async function migrate() {
  try {
    console.log('Starting database migrations...');
    await initializeDatabase();
    await runMigrations();
    console.log('Database migrations completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
