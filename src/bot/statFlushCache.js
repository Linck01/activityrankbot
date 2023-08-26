import levelManager from './levelManager.js';

export const addTextMessage = (member, channel, count) => {
  return new Promise(async function (resolve, reject) {
    try {
      // Add to FlushCache
      let textMessageCache = buildStatFlushCache(member, 'textMessage');

      count = count * 1;

      let entry = textMessageCache[member.id + channel.id];
      if (!entry)
        entry = textMessageCache[member.id + channel.id] = {
          guildId: member.guild.id,
          userId: member.id,
          channelId: channel.id,
          count: count,
        };
      else entry.count += count;

      await addTotalXp(member, count * member.guild.appData.xpPerTextMessage);

      if (member.guild.appData.bonusUntilDate > Date.now() / 1000)
        await addBonus(member, count * member.guild.appData.bonusPerTextMessage);

      resolve();
    } catch (e) {
      reject(e);
    }
  });
};

export const addVoiceMinute = (member, channel, count) => {
  return new Promise(async function (resolve, reject) {
    try {
      // Add to FlushCache
      let voiceMinuteCache = buildStatFlushCache(member, 'voiceMinute');

      count = count * 1;

      let entry = voiceMinuteCache[member.id + channel.id];
      if (!entry)
        entry = voiceMinuteCache[member.id + channel.id] = {
          guildId: member.guild.id,
          userId: member.id,
          channelId: channel.id,
          count: count,
        };
      else entry.count += count;

      await addTotalXp(member, count * member.guild.appData.xpPerVoiceMinute);

      if (member.guild.appData.bonusUntilDate > Date.now() / 1000)
        await addBonus(member, count * member.guild.appData.bonusPerVoiceMinute);

      resolve();
    } catch (e) {
      reject(e);
    }
  });
};

export const addInvite = (member, count) => {
  return new Promise(async function (resolve, reject) {
    try {
      let inviteCache = buildStatFlushCache(member, 'invite');

      count = count * 1;

      let entry = inviteCache[member.id];
      if (!entry)
        entry = inviteCache[member.id] = {
          guildId: member.guild.id,
          userId: member.id,
          count: count,
        };
      else entry.count += count;

      await addTotalXp(member, count * member.guild.appData.xpPerInvite);

      if (member.guild.appData.bonusUntilDate > Date.now() / 1000)
        await addBonus(member, count * member.guild.appData.bonusPerInvite);

      resolve();
    } catch (e) {
      reject(e);
    }
  });
};

export const addVote = (member, count) => {
  return new Promise(async function (resolve, reject) {
    try {
      let voteCache = buildStatFlushCache(member, 'vote');

      count = count * 1;

      let entry = voteCache[member.id];
      if (!entry)
        entry = voteCache[member.id] = {
          guildId: member.guild.id,
          userId: member.id,
          count: count,
        };
      else entry.count += count;

      await addTotalXp(member, count * member.guild.appData.xpPerVote);

      if (member.guild.appData.bonusUntilDate > Date.now() / 1000)
        await addBonus(member, count * member.guild.appData.bonusPerVote);

      resolve();
    } catch (e) {
      reject(e);
    }
  });
};

export const addBonus = (member, count) => {
  return new Promise(async function (resolve, reject) {
    try {
      let bonusCache = buildStatFlushCache(member, 'bonus');

      count = count * 1;

      let entry = bonusCache[member.id];
      if (!entry)
        entry = bonusCache[member.id] = {
          guildId: member.guild.id,
          userId: member.id,
          count: count,
        };
      else entry.count += count;

      if (member.appData)
        await addTotalXp(member, count * member.guild.appData.xpPerBonus);

      resolve();
    } catch (e) {
      reject(e);
    }
  });
};

const addTotalXp = (member, xp) => {
  return new Promise(async function (resolve, reject) {
    try {
      const oldTotalXp = member.appData.totalXp;
      member.appData.totalXp += xp;
      const newTotalXp = member.appData.totalXp;

      await levelManager.checkLevelUp(member, oldTotalXp, newTotalXp);

      resolve();
    } catch (e) {
      reject(e);
    }
  });
};

// beta function
export const directlyAddBonus = async (userId, guild, client, count) => {
  const bonusCache = directlyBuildStatFlushCache(client, guild, 'bonus');

  count *= 1; // ?
  let entry = bonusCache[userId];
  if (!entry) entry = bonusCache[userId] = { guildId: guild.id, userId, count };
  else entry.count += count;
};

const buildStatFlushCache = (member, type) => {
  const statFlushCache = member.client.appData.statFlushCache;
  const dbHost = member.guild.appData.dbHost;

  if (!statFlushCache[dbHost]) statFlushCache[dbHost] = {};

  if (!statFlushCache[dbHost][type]) statFlushCache[dbHost][type] = {};

  return statFlushCache[dbHost][type];
};

const directlyBuildStatFlushCache = (client, guild, type) => {
  const statFlushCache = client.appData.statFlushCache;
  const dbHost = guild.appData.dbHost;

  if (!statFlushCache[dbHost]) statFlushCache[dbHost] = {};

  if (!statFlushCache[dbHost][type]) statFlushCache[dbHost][type] = {};

  return statFlushCache[dbHost][type];
};


// GENERATED: start of generated content by `exports-to-default`.
// [GENERATED: exports-to-default:v0]

export default {
    addTextMessage,
    addVoiceMinute,
    addInvite,
    addVote,
    addBonus,
    directlyAddBonus,
}

// GENERATED: end of generated content by `exports-to-default`.

