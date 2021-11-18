const guildModel = require('../models/guild/guildModel.js');
const handleCommand = require('./handleCommand.js');
const guildChannelModel = require('../models/guild/guildChannelModel.js');
const guildRoleModel = require('../models/guild/guildRoleModel.js');
const guildMemberModel = require('../models/guild/guildMemberModel.js');
const statFlushCache = require('../statFlushCache.js');
const fct = require('../../util/fct.js');
const skip = require('../skip.js');

module.exports = {
	name: 'messageCreate',
	execute(msg) {
        return new Promise(async function (resolve,reject) {
            try {
                let types = ['GUILD_TEXT', 'GUILD_PUBLIC_THREAD', 'GUILD_PRIVATE_THREAD']
                if (msg.author.bot == true) {
                    return resolve();
                } else if (!msg.guild) {
                    msg.reply({ content:('Hi. Please use your commands inside the channel of a server i am in.\n Thanks!'),
                                ephemeral: true })
                } else if (skip(msg.guildId)) {
                    return resolve();
                } else if (types.includes(msg.channel.type) && msg.type == 'DEFAULT' && msg.system == false) {
                    await guildModel.cache.load(msg.guild);
                    
                    if (msg.content.startsWith(msg.guild.appData.prefix)) { 
                        await handleCommand(msg); 
                    } else if (msg.mentions.members.first() && msg.mentions.members.first().id == msg.client.user.id) {
                        await msg.reply({ content:'Hey, thanks for mentioning me! The prefix for the bot on this server is ``'+msg.guild.appData.prefix+'``. Type ``'+msg.guild.appData.prefix+'help`` for more information. Have fun!', ephemeral: true });
                    } else if (msg.guild.appData.textXp) { await rankMessage(msg); }
                } else {
                    console.log(msg.channel.type);
                    console.log(msg.type);
                    console.log(msg.system)
                }

                resolve();
            } catch (e) { reject(e); }
        });
        
	},
};


function rankMessage(msg) {
  return new Promise(async function(resolve, reject) {
    try {
      await msg.guild.members.fetch(msg.author.id);

      if (!msg.member)
        return resolve();

      // Check noxp channel & allowInvisibleXp
      await guildChannelModel.cache.load(msg.channel);

      if (msg.channel.appData.noXp)
        return resolve();

      // Check noxp role
      for (let role of msg.member.roles.cache) {
        role = role[1];
        await guildRoleModel.cache.load(role);

        if (role.appData.noXp)
          return resolve();
      }

      // Check textmessage cooldown
      await guildMemberModel.cache.load(msg.member);
      const nowSec = Date.now() / 1000;

      if (typeof msg.guild.appData.textMessageCooldownSeconds !== 'undefined') {
        if (nowSec - msg.member.appData.lastTextMessageDate < msg.guild.appData.textMessageCooldownSeconds)
          return resolve();

        msg.member.appData.lastTextMessageDate = nowSec;
      }

      // Add Score
      await statFlushCache.addTextMessage(msg.member,msg.channel,1);

      resolve();
    } catch (e) { reject(e); }
  });
}

function hasCommandPrefix(str) {
  const prefixes = ['+','-','!','`','$','/',';','>','.'];
  for (prefix of prefixes) {
    if (str.indexOf(prefix) != -1)
      return true;
  }

  return false;
}
