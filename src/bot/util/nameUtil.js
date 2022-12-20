const { ChannelType } = require('discord.js');

exports.getChannelName = (channels, channelId) => {
  const channel = channels.get(channelId);

  if (channel) return exports.cutName(channel.name);
  else return 'Deleted [' + channelId + ']';
};

exports.getChannelMention = (channels, channelId) => {
  const channel = channels.get(channelId);

  if (channel) return channel.toString();
  else return `Deleted [${channelId}]`;
};

exports.getChannelType = (channels, channelId) => {
  const channel = channels.get(channelId);

  if (channel) return channel.type;
  else return null;
};

exports.getRoleName = (roles, roleId) => {
  const role = roles.get(roleId);

  if (role) return exports.cutName(role.name);
  else return 'Deleted [' + roleId + ']\n';
};

exports.getRoleMention = (roles, roleId) => {
  const role = roles.get(roleId);

  if (role) return role.toString();
  else return `Deleted [${roleId}]`;
};

exports.getChannelTypeIcon = (channels, channelId) => {
  const channel = channels.get(channelId);

  if (!channel) return ':grey_question:';

  switch (channel.type) {
    case ChannelType.GuildVoice:
      return ':microphone2:';
    case ChannelType.GuildText:
    case ChannelType.GuildAnnouncement:
      return ':writing_hand:';
    case ChannelType.GuildForum:
      return '<:Forum:1026009067350659145>';
    default:
      return ':grey_question:';
  }
};

exports.getGuildMemberInfos = (guild, userIds) => {
  return new Promise(async function (resolve, reject) {
    try {
      let member,
        userIdsToFetch = [],
        infos = {};
      // Add cached
      for (const userId of userIds) {
        member = guild.members.cache.get(userId);

        if (member) {
          infos[userId] = {};
          infos[userId].name = exports.getGuildMemberAlias(member);
          infos[userId].avatarUrl = member.user.avatarURL();
          infos[userId].joinedAt = member.joinedAt;
        } else {
          userIdsToFetch.push(userId);
        }
      }

      // Add fetched
      if (userIdsToFetch.length > 0) {
        const fetchedMembers = await guild.members.fetch({
          user: userIdsToFetch,
          withPresences: false,
          cache: false,
        }); // #discordapi
        for (const fetchedMember of fetchedMembers) {
          member = fetchedMember[1];
          infos[member.id] = {};
          infos[member.id].name = exports.getGuildMemberAlias(member);
          infos[member.id].avatarUrl = member.user.avatarURL();
          infos[member.id].joinedAt = member.joinedAt;
        }
      }

      // Add deleted
      for (userId of userIds) {
        if (!infos[userId]) {
          infos[userId] = {};
          infos[userId].name = 'User left [' + userId + ']';
          infos[userId].avatarUrl = '';
          infos[userId].joinedAt = 'n/a';
        }
      }

      resolve(infos);
    } catch (e) {
      return reject(e);
    }
  });
};

exports.getGuildMemberInfo = (guild, userId) => {
  return new Promise(async function (resolve, reject) {
    try {
      const guildMemberName = (
        await exports.getGuildMemberInfos(guild, [userId])
      )[userId];
      resolve(guildMemberName);
    } catch (e) {
      return reject(e);
    }
  });
};

exports.getGuildMemberMention = (members, memberId) => {
  const role = members.get(memberId);

  if (role) return role.toString();
  else return `Deleted [${memberId}]`;
};

exports.addGuildMemberNamesToRanks = (guild, memberRanks) => {
  return new Promise(async function (resolve, reject) {
    try {
      let userIds = [],
        memberRank;
      for (memberRank of memberRanks) userIds.push(memberRank.userId);
      const memberInfos = await exports.getGuildMemberInfos(guild, userIds);

      for (memberRank of memberRanks)
        memberRank.name = memberInfos[memberRank.userId].name;

      resolve();
    } catch (e) {
      return reject(e);
    }
  });
};

exports.getGuildMemberAlias = (member) => {
  if (member.guild.appData.showNicknames) {
    if (member.nickname) return exports.cutName(member.nickname);
    else return exports.cutName(member.user.username);
  } else {
    return exports.cutName(member.user.username);
  }
};

exports.cutName = (name) => {
  if (name.length > 32) name = name.substr(0, 32) + '..';

  return name;
};

/* exports.getSimpleEmbed = (title,text) => {
  const embed = new Discord.EmbedBuilder();
  embed.setColor(0x00AE86);

  if (title != '')
    embed.setAuthor(title);

  if (text != '')
    embed.setDescription(text);

  return embed;

} */
