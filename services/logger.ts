/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * SPDX-License-Identifier: MPL-2.0
 * Copyright (c) Kotone <git@ktn.works>
 */

import path from 'path';

// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    green: '\x1b[32m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m'
};

class Logger {
    private getCallerInfo(): string {
        const stack = new Error().stack;
        if (!stack) return 'unknown';
        
        const stackLines = stack.split('\n');
        // Skip logger internal calls and find the actual caller
        for (let i = 3; i < stackLines.length; i++) {
            const line = stackLines[i];
            if (line.includes('file://') && !line.includes('logger.')) {
                const match = line.match(/file:\/\/(.+):(\d+):(\d+)/);
                if (match) {
                    const fullPath = match[1];
                    const fileName = path.basename(fullPath);
                    const lineNumber = match[2];
                    return `${fileName}:${lineNumber}`;
                }
            }
        }
        return 'unknown';
    }

    private formatMessage(level: string, message: string, color: string): string {
        const timestamp = new Date().toISOString();
        const caller = this.getCallerInfo();
        return `${color}[${level}]${colors.reset} ${colors.gray}${timestamp}${colors.reset} ${colors.cyan}${caller}${colors.reset} ${message}`;
    }

    error(message: string, ...args: any[]): void {
        const formattedMessage = this.formatMessage('ERROR', message, colors.red);
        console.error(formattedMessage, ...args);
    }

    warn(message: string, ...args: any[]): void {
        const formattedMessage = this.formatMessage('WARN', message, colors.yellow);
        console.warn(formattedMessage, ...args);
    }

    info(message: string, ...args: any[]): void {
        const formattedMessage = this.formatMessage('INFO', message, colors.green);
        console.log(formattedMessage, ...args);
    }

    debug(message: string, ...args: any[]): void {
        if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
            const formattedMessage = this.formatMessage('DEBUG', message, colors.blue);
            console.log(formattedMessage, ...args);
        }
    }
}

export const logger = new Logger();
