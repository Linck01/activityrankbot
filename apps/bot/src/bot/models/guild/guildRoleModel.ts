import { getShardDb } from '../../../models/shardDb/shardDb.js';
import type { Guild, Role } from 'discord.js';
import type {
  GuildRole as DBRole,
  GuildRoleSchema,
  GuildRoleUpdate,
} from 'models/types/kysely/shard.js';
import { getGuildModel } from './guildModel.js';
import { CachedModel } from '../generic/model.js';

const cachedFields = [
  'noXp',
  'assignLevel',
  'deassignLevel',
  'assignMessage',
  'deassignMessage',
  'xpPerVoiceMinute',
  'xpPerTextMessage',
  'xpPerVote',
  'xpPerInvite',
] as const satisfies (keyof DBRole)[];

let defaultCache: Pick<DBRole, (typeof cachedFields)[number]> | null = null;
let defaultAll: DBRole | null = null;

interface RoleCacheStorage {}

export let roleCache = new WeakMap<Role, RoleModel>();

// WeakMap doesn't have a .clear() method - see https://github.com/tc39/notes/blob/main/meetings/2014-11/nov-19.md#412-should-weakmapweakset-have-a-clear-method-markm
export function clearRoleCache() {
  roleCache = new WeakMap();
}

export class RoleModel extends CachedModel<
  Role,
  GuildRoleSchema,
  typeof cachedFields,
  RoleCacheStorage
> {
  async fetchOptional() {
    const member = await this.handle
      .selectFrom('guildRole')
      .selectAll()
      .where('roleId', '=', this._object.id)
      .where('guildId', '=', this._object.guild.id)
      .executeTakeFirst();

    return member;
  }

  async fetch(error = false) {
    const member = await this.fetchOptional();
    if (member) return member;

    if (error) throw new Error(`Could not find role ${this._object.id} in database`);
    return await this.fetchDefault();
  }

  async upsert(expr: GuildRoleUpdate) {
    await this.handle
      .insertInto('guildRole')
      .values({ roleId: this._object.id, guildId: this._object.guild.id, ...expr })
      .onDuplicateKeyUpdate(expr)
      // .returning(cachedFields) RETURNING is not supported on UPDATE statements in MySQL.
      .executeTakeFirstOrThrow();

    const res = await this.handle
      .selectFrom('guildRole')
      .select(cachedFields)
      .where('guildId', '=', this._object.guild.id)
      .where('roleId', '=', this._object.id)
      .executeTakeFirstOrThrow();

    this._db = res;
  }

  async fetchDefault() {
    if (defaultAll) return defaultAll;

    const db = getShardDb(this.dbHost);

    let res = await db
      .selectFrom('guildRole')
      .selectAll()
      .where('roleId', '=', '0')
      .where('guildId', '=', '0')
      .executeTakeFirst();

    if (!res) {
      res = await db
        .insertInto('guildRole')
        .values({ roleId: '0', guildId: '0' })
        .returningAll()
        .executeTakeFirstOrThrow();
    }

    defaultAll = res;
    return defaultAll;
  }
}

export async function getRoleModel(role: Role): Promise<RoleModel> {
  if (roleCache.has(role)) return roleCache.get(role)!;
  else return await buildCache(role);
}

export async function fetchRoleAssignments(guild: Guild) {
  const { dbHost } = await getGuildModel(guild);

  return await getShardDb(dbHost)
    .selectFrom('guildRole')
    .select(['roleId', 'assignLevel', 'deassignLevel', 'assignMessage', 'deassignMessage'])
    .where('guildId', '=', guild.id)
    .where((w) => w.or([w('assignLevel', '!=', 0), w('deassignLevel', '!=', 0)]))
    .orderBy('assignLevel asc')
    .execute();
}

export async function fetchRoleAssignmentsByLevel(
  guild: Guild,
  type: 'assignLevel' | 'deassignLevel',
  level: number,
) {
  const { dbHost } = await getGuildModel(guild);

  return await getShardDb(dbHost)
    .selectFrom('guildRole')
    .select(['roleId', 'assignLevel', 'deassignLevel', 'assignMessage', 'deassignMessage'])
    .where('guildId', '=', guild.id)
    .where(type, '=', level)
    .execute();
}

export async function fetchRoleAssignmentsByRole(guild: Guild, roleId: string) {
  const { dbHost } = await getGuildModel(guild);

  return await getShardDb(dbHost)
    .selectFrom('guildRole')
    .select(['roleId', 'assignLevel', 'deassignLevel', 'assignMessage', 'deassignMessage'])
    .where('guildId', '=', guild.id)
    .where('roleId', '=', roleId)
    .execute();
}

export async function fetchNoXpRoleIds(guild: Guild) {
  const { dbHost } = await getGuildModel(guild);

  const ids = await getShardDb(dbHost)
    .selectFrom('guildRole')
    .select('roleId')
    .where('guildId', '=', guild.id)
    .where('noXp', '=', 1)
    .execute();

  return ids.map((role) => role.roleId);
}

async function buildCache(role: Role): Promise<RoleModel> {
  const { dbHost } = await getGuildModel(role.guild);
  const db = getShardDb(dbHost);

  const foundCache = await db
    .selectFrom('guildRole')
    .select(cachedFields)
    .where('guildId', '=', role.guild.id)
    .where('roleId', '=', role.id)
    .executeTakeFirst();

  const cache = foundCache ?? { ...(await loadDefaultCache(dbHost)) };

  const built = new RoleModel(role, dbHost, cache, {});

  roleCache.set(role, built);
  return built;
}

async function loadDefaultCache(dbHost: string) {
  if (defaultCache) return defaultCache;
  const db = getShardDb(dbHost);

  let res = await db
    .selectFrom('guildRole')
    .select(cachedFields)
    .where('roleId', '=', '0')
    .where('guildId', '=', '0')
    .executeTakeFirst();

  if (!res) {
    await db
      .insertInto('guildRole')
      .values({ roleId: '0', guildId: '0' })
      // .returning(cachedFields) RETURNING is not supported well in MySQL
      .executeTakeFirstOrThrow();
    res = await db
      .selectFrom('guildRole')
      .select(cachedFields)
      .where('roleId', '=', '0')
      .where('guildId', '=', '0`')
      .executeTakeFirstOrThrow();
  }

  defaultCache = res;
  return defaultCache;
}
