import { registerEvent } from 'bot/util/eventLoader.js';
import { Events } from 'discord.js';
import guildModel from '../models/guild/guildModel.js';

registerEvent(Events.GuildCreate, async function (guild) {
  guild.client.logger.info(`Joined guild ${guild.toString()}`);
  const cachedGuild = await guildModel.cache.get(guild);

  if (cachedGuild.db.isBanned) {
    guild.client.logger.debug(`Joined banned guild ${guild.id}`);
    await guild.leave();
    return;
  }
});
