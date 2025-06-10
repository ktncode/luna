/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * Copyright (c) Kotone <git@ktn.works>
 */

import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { t } from '../services/i18n.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!')
    .setDescriptionLocalization('ja', 'Pong!で応答します'),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const locale = interaction.guild?.preferredLocale;
    
    const sent = await interaction.reply({ 
      content: t(locale, 'commands.ping.response.pinging'), 
      fetchReply: true 
    });
    
    const roundtripLatency = sent.createdTimestamp - interaction.createdTimestamp;
    const wsLatency = interaction.client.ws.ping;
    
    await interaction.editReply(
      t(locale, 'commands.ping.response.result', {
        roundtrip: roundtripLatency.toString(),
        websocket: wsLatency.toString()
      })
    );
  },
};
