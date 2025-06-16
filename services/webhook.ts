// SPDX-License-Identifier: MPL-2.0
// This Source Code Form is subject to the terms of the Mozilla Public License v2.0

import * as http from 'http';
import * as url from 'url';
import { getWebhookByPath, updateWebhookStats, getCrossServerTargets } from './db.js';
import { Client } from 'discord.js';

const WEBHOOK_PORT = process.env.WEBHOOK_PORT || 3000;

interface WebhookRequest {
    content?: string;
    embeds?: any[];
    username?: string;
    avatar_url?: string;
    [key: string]: any;
}

export class WebhookServer {
    private server: http.Server;
    private client: Client;

    constructor(client: Client) {
        this.client = client;
        this.server = http.createServer(this.handleRequest.bind(this));
    }

    private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
        const parsedUrl = url.parse(req.url || '', true);
        const pathname = parsedUrl.pathname || '';

        // CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        // WebHookパス以外は404を返す
        if (!pathname.startsWith('/webhook/')) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Not found' }));
            return;
        }

        if (req.method !== 'POST') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed' }));
            return;
        }

        // WebHookパスの検証 (/webhook/{12桁のpath} 形式)
        const webhookMatch = pathname.match(/^\/webhook\/([a-f0-9]{12})$/);
        if (!webhookMatch) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid webhook path format' }));
            return;
        }

        const webhookPath = webhookMatch[1];

        try {
            // データベースからWebHook設定を取得
            const webhookConfig = await getWebhookByPath(webhookPath);
            if (!webhookConfig || !webhookConfig.enabled) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Webhook not found or disabled' }));
                return;
            }

            // リクエストボディを読み取り
            const body = await this.readRequestBody(req);
            let webhookData: WebhookRequest;

            try {
                webhookData = JSON.parse(body);
            } catch {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
                return;
            }

            // Botからチャンネルに送信
            const success = await this.sendToChannel(webhookConfig.channel_id, webhookData, webhookConfig.name);
            
            // クロスサーバー配信もチェック
            const crossTargets = await getCrossServerTargets(webhookPath);
            for (const target of crossTargets) {
                await this.sendToChannel(target.target_channel_id, webhookData, target.webhook_name);
            }

            if (success) {
                // 統計を更新
                await updateWebhookStats(webhookPath, webhookConfig.guild_id);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } else {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to send message' }));
            }

        } catch (error) {
            console.error('Webhook error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
        }
    }

    private async sendToChannel(channelId: string, data: WebhookRequest, webhookName: string): Promise<boolean> {
        try {
            const channel = await this.client.channels.fetch(channelId);
            if (!channel || !channel.isTextBased()) {
                console.error('Channel not found or not text-based:', channelId);
                return false;
            }

            // Discord WebHook仕様に準拠したメッセージ形式
            const messageOptions: any = {};

            if (data.content) {
                messageOptions.content = data.content;
            }

            if (data.embeds && data.embeds.length > 0) {
                messageOptions.embeds = data.embeds;
            } else if (!data.content) {
                // contentもembedsもない場合は、受信データからembedを作成
                const embed = this.createEmbedFromData(data, webhookName);
                messageOptions.embeds = [embed];
            }

            // sendメソッドが存在するかチェック
            if ('send' in channel) {
                await channel.send(messageOptions);
                return true;
            } else {
                console.error('Channel does not support sending messages:', channelId);
                return false;
            }

        } catch (error) {
            console.error('Error sending to channel:', error);
            return false;
        }
    }

    private createEmbedFromData(data: WebhookRequest, webhookName: string): any {
        const timestamp = new Date().toISOString();
        
        const embed: any = {
            title: data.title || `Webhook: ${webhookName}`,
            color: data.color || 0x5865F2,
            timestamp: timestamp,
            footer: {
                text: 'Luna Bot Webhook System'
            }
        };

        if (data.content) {
            embed.description = data.content;
        }

        // その他のフィールドを追加
        const fields: any[] = [];
        Object.keys(data).forEach(key => {
            if (!['content', 'title', 'color', 'embeds', 'username', 'avatar_url'].includes(key)) {
                const value = typeof data[key] === 'object' ? JSON.stringify(data[key], null, 2) : String(data[key]);
                if (value.length <= 1024) {
                    fields.push({
                        name: key,
                        value: value,
                        inline: true
                    });
                }
            }
        });

        if (fields.length > 0) {
            embed.fields = fields.slice(0, 25); // Discord limit
        }

        return embed;
    }

    private readRequestBody(req: http.IncomingMessage): Promise<string> {
        return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                resolve(body);
            });
            req.on('error', reject);
        });
    }

    public start(): void {
        this.server.listen(WEBHOOK_PORT, () => {
            console.log(`Webhook server running on port ${WEBHOOK_PORT}`);
        });
    }

    public stop(): void {
        this.server.close();
    }
}

export function createWebhookServer(client: Client): WebhookServer {
    return new WebhookServer(client);
}
