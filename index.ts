/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * Copyright (c) Kotone <git@ktn.works>
 */

import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
import { loadCommands } from './services/command.js';
import { initializeDatabase } from './services/db.js';
import { createWebhookServer } from './services/webhook.js';

dotenv.config();

// Debug: Check if token is loaded
if (!process.env.DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN is not set in environment variables');
  process.exit(1);
}

console.log('Token loaded:', process.env.DISCORD_TOKEN ? 'Yes' : 'No');
console.log('Token length:', process.env.DISCORD_TOKEN?.length || 0);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

async function main() {
  try {
    console.log('Luna Bot starting...');
    
    // Initialize database (optional, won't fail if not available)
    try {
      await initializeDatabase();
      console.log('Database initialized');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn('Database initialization failed, continuing without database:', errorMessage);
    }
    
    // Load commands
    await loadCommands(client);
    console.log('Commands loaded');
    
    // Login to Discord
    await client.login(process.env.DISCORD_TOKEN);
    console.log('Luna Bot is online!');
  } catch (error) {
    console.error('Failed to start Luna Bot:', error);
    process.exit(1);
  }
}

// Bot initialization
client.once('ready', async () => {
  console.log(`Logged in as ${client.user?.tag}!`);
  
  // WebHookサーバーを初期化して起動
  const webhookServer = createWebhookServer(client);
  webhookServer.start();
  
  // プロセス終了時のクリーンアップ
  process.on('SIGINT', () => {
      console.log('Shutting down...');
      webhookServer.stop();
      client.destroy();
      process.exit(0);
  });
});

main();
