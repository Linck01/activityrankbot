import cron from 'node-cron';
import voiceXpRound from './voiceXpRound.js';
import autoAssignPatreonRoles from './autoAssignPatreonRoles.js';
import resetJob from './resetJob.js';
import fct from '../../util/fct.js';
import config from '../../const/config.js';
import util from 'util';
import type { Client } from 'discord.js';
import { getShardStat } from 'bot/models/shardStatModel.js';

const isProd = process.env.NODE_ENV === 'production';

const logShardDiagnostics = isProd ? '0 */10 * * * *' : '*/20 * * * * *';
const logHighestGuildsInterval = isProd ? '0 */20 * * * *' : '*/20 * * * * *';
const autoAssignPatreonRolesInterval = isProd ? '15 */15 * * * *' : '*/15 * * * * *';
const resetJobInterval = 3_000;

export const start = (client: Client) => {
  // Loops
  startVoiceXp(client);
  startResetJob(client);

  /*
  cron.schedule(logHighestGuildsInterval, async () => {
    try {
      const sort = client.guilds.cache
        .sort((a, b) => (a.memberCount < b.memberCount ? 1 : -1))
        .first(20);

      let str = '';
      for (let a of sort)
        str += `${a.memberCount.toLocaleString().padEnd(9)} | ${a.name}\n`;

      client.logger.info('High-member count guilds:\n' + str);
    } catch (e) {
      client.logger.warn(e, 'Error in highestGuilds');
    }
  });
  */

  cron.schedule(logShardDiagnostics, async () => {
    try {
      let str = '';
      // @ts-ignore FIXME: debug & works for now - fix later
      str += client.options.presence.status + ' ';
      // @ts-ignore FIXME: debug & works for now - fix later
      str += client.options.ws.presence.status + ' ';
      str += client.ws.status + ' ';
      // @ts-ignore FIXME: debug & works for now - fix later
      str += client.ws.destroyed + ' ';

      // @ts-ignore FIXME: debug & works for now - fix later
      str += client.rest.requestManager.globalRemaining + ' ';
      // @ts-ignore FIXME: debug & works for now - fix later
      str += client.rest.requestManager.hashTimer._destroyed + ' ';
      // @ts-ignore FIXME: debug & works for now - fix later
      str += client.rest.requestManager.handlerTimer._destroyed + ' ';

      str += client.guilds.cache.size + ' ';
      // @ts-ignore FIXME: debug & works for now - fix later
      str += client.presence.status + ' ';
      // @ts-ignore FIXME: debug & works for now - fix later
      str += client.presence.clientStatus + ' ';

      // @ts-ignore FIXME: debug & works for now - fix later
      str += JSON.stringify(util.inspect(client.sweepers.threads)) + ' ';

      const stat = getShardStat();

      str += stat.commandsTotal + ' ';
      str += stat.textMessagesTotal + ' ';

      client.logger.debug('logShardDiagnostics: ' + str);
    } catch (e) {
      client.logger.warn(e, 'Error in logShardDiagnostics');
    }
  });

  const supportGuild = client.guilds.cache.get(config.supportServerId);
  if (supportGuild) {
    cron.schedule(autoAssignPatreonRolesInterval, async () => {
      try {
        await autoAssignPatreonRoles(supportGuild);

        client.logger.info('Updated support server Patreon roles');
      } catch (e) {
        client.logger.warn(e, 'Error in autoAssignPatreonRoles');
      }
    });
  }
};

const startVoiceXp = async (client: Client) => {
  while (true) {
    await voiceXpRound(client).catch((e) => client.logger.warn(e, 'Error in voiceXpRound'));
  }
};

const startResetJob = async (client: Client) => {
  while (true) {
    await resetJob().catch((e) => client.logger.warn(e, 'Error in resetJob'));
    await fct
      .sleep(resetJobInterval)
      .catch((e) => client.logger.warn(e, 'Error sleeping in resetJob interval'));
  }
};

export default { start };
