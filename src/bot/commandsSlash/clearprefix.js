const { SlashCommandBuilder } = require('discord.js');
const guildModel = require('../models/guild/guildModel.js');

module.exports.data = new SlashCommandBuilder()
  .setName('clearprefix')
  .setDescription('Clears your legacy prefix!')
  .addStringOption(o => o
    .setName('reminder')
    .setDescription('Sets a prefix that will continue to warn members if used.'));

module.exports.execute = async function(i) {
  if (!i.member.permissionsIn(i.channel).has('MANAGE_GUILD')) {
    return await i.reply({
      content: 'You need the permission to manage the server, in order to use this command.',
      ephemeral: true,
    });
  }
  if (i.options.getString('reminder'))
    await guildModel.storage.set(i.guild, 'prefix', i.options.getString('reminder'));
  else
    await guildModel.storage.set(i.guild, 'prefix', 'fAY1md_BXaN4mnebk_zzyYuYYJREoT3');
  await i.reply({
    content: `Prefix cleared. ${i.options.getString('reminder') ? 'Reminder prefix set.' : ''}`,
  });
};
