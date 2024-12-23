import type { Guild, GuildBasedChannel } from 'discord.js';
import shardDb from '../../../models/shardDb/shardDb.js';
import { escape } from 'mysql2/promise';
import type {
  GuildChannelSchema,
  TextMessageSchema,
  VoiceMinuteSchema,
} from 'models/types/shard.js';
import { getGuildModel } from './guildModel.js';

const cachedFields = ['noXp', 'noCommand'] as const;
let defaultCache: CachedDbFields | null = null;
let defaultAll: GuildChannelSchema | null = null;

type CachedDbFields = Pick<GuildChannelSchema, (typeof cachedFields)[number]>;

export interface CachedGuildChannel {
  db: CachedDbFields;
}

export const channelCache = new WeakMap<GuildBasedChannel, CachedGuildChannel>();

export const cache = {
  get: async function (channel: GuildBasedChannel): Promise<CachedGuildChannel> {
    if (channelCache.has(channel)) return channelCache.get(channel)!;
    return await buildCache(channel);
  },
};

function isCachableDbKey(key: keyof GuildChannelSchema): key is keyof CachedDbFields {
  return cachedFields.includes(key as keyof CachedDbFields);
}

export const storage = {
  get: async (guild: Guild, channelId: string): Promise<GuildChannelSchema> => {
    const { dbHost } = await getGuildModel(guild);
    const res = await shardDb.query<GuildChannelSchema[]>(
      dbHost,
      `SELECT * FROM guildChannel WHERE guildId = ${guild.id} && channelId = ${escape(channelId)}`,
    );

    if (res.length == 0) {
      if (!defaultAll)
        defaultAll = (
          await shardDb.query<GuildChannelSchema[]>(
            dbHost,
            `SELECT * FROM guildChannel WHERE guildId = 0 AND channelId = 0`,
          )
        )[0];
      return defaultAll;
    } else return res[0];
  },

  set: async <K extends keyof GuildChannelSchema>(
    guild: Guild,
    channelId: string,
    field: K,
    value: GuildChannelSchema[K],
  ) => {
    const { dbHost } = await getGuildModel(guild);
    await shardDb.query(
      dbHost,
      `INSERT INTO guildChannel (guildId,channelId,${field}) VALUES (${guild.id},${escape(
        channelId,
      )},${escape(value)}) ON DUPLICATE KEY UPDATE ${field} = ${escape(value)}`,
    );

    const channel = guild.channels.cache.get(channelId);
    if (channel && isCachableDbKey(field)) {
      const cachedChannel = await cache.get(channel);
      Object.defineProperty(cachedChannel.db, field, { value });
    }
  },
};

export const getRankedChannelIds = async (guild: Guild) => {
  const { dbHost } = await getGuildModel(guild);
  const textmessageUserIds = await shardDb.query<TextMessageSchema[]>(
    dbHost,
    `SELECT DISTINCT channelId FROM textMessage WHERE guildId = ${guild.id} AND alltime != 0`,
  );
  const voiceMinuteUserIds = await shardDb.query<VoiceMinuteSchema[]>(
    dbHost,
    `SELECT DISTINCT channelId FROM voiceMinute WHERE guildId = ${guild.id} AND alltime != 0`,
  );

  const ids = [...new Set([...textmessageUserIds, ...voiceMinuteUserIds])];

  let channelIds = [];
  for (let id of ids) {
    channelIds.push(id.channelId);
  }

  return channelIds;
};

export const getNoXpChannelIds = async (guild: Guild) => {
  const { dbHost } = await getGuildModel(guild);
  const res = await shardDb.query<Pick<GuildChannelSchema, 'channelId'>[]>(
    dbHost,
    `SELECT channelId FROM guildChannel WHERE guildId = ${guild.id} AND noXp = 1`,
  );

  return res.map((i) => i.channelId);
};

export const getNoCommandChannelIds = async (guild: Guild) => {
  const { dbHost } = await getGuildModel(guild);
  const res = await shardDb.query<Pick<GuildChannelSchema, 'channelId'>[]>(
    dbHost,
    `SELECT channelId FROM guildChannel WHERE guildId = ${guild.id} AND noCommand = 1`,
  );

  return res.map((i) => i.channelId);
};

async function buildCache(channel: GuildBasedChannel): Promise<CachedGuildChannel> {
  const { dbHost } = await getGuildModel(channel.guild);
  let foundCache = await shardDb.query<CachedDbFields[]>(
    dbHost,
    `SELECT ${cachedFields.join(',')} FROM guildChannel WHERE guildId = ${
      channel.guild.id
    } AND channelId = ${channel.id}`,
  );

  const db = foundCache.length > 0 ? foundCache[0] : { ...(await loadDefaultCache(dbHost)) };

  const res = { db };
  channelCache.set(channel, res);
  return res;
}

const loadDefaultCache = async (dbHost: string) => {
  let res = await shardDb.query<CachedDbFields[]>(
    dbHost,
    `SELECT ${cachedFields.join(',')} FROM guildChannel WHERE guildId = 0 AND channelId = 0`,
  );

  if (res.length == 0)
    await shardDb.query(dbHost, `INSERT IGNORE INTO guildChannel (guildId,channelId) VALUES (0,0)`);

  res = await shardDb.query(
    dbHost,
    `SELECT ${cachedFields.join(',')} FROM guildChannel WHERE guildId = 0 AND channelId = 0`,
  );

  defaultCache = res[0]!;
  return defaultCache;
};

export default {
  cache,
  storage,
  getRankedChannelIds,
  getNoXpChannelIds,
  getNoCommandChannelIds,
};
