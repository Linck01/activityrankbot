const guildModel = require('../models/guild/guildModel.js');
const userModel = require('../models/userModel.js');
const guildChannelModel = require('../models/guild/guildChannelModel.js');
const tokenBurn = require('../util/tokenBurn.js');
const askForPremium = require('../util/askForPremium.js');
const {
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { supportServerInviteLink } = require('../../const/config.js');
const userPrivileges = require('../../const/privilegedUsers').userLevels;

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    try {
      if (!interaction.guild || !interaction.channel) return;

      await guildModel.cache.load(interaction.guild);

      if (interaction.guild.appData.isBanned) {
        console.log(`Banned guild ${interaction.guild.id} used interaction.`);
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setDescription('❌ This server been blacklisted from the bot.')
              .setColor(0xff0000),
          ],
          components: [
            new ActionRowBuilder().setComponents(
              new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setURL(supportServerInviteLink)
                .setLabel('Appeal')
            ),
          ],
        });
        return await interaction.guild.leave();
      }

      await userModel.cache.load(interaction.user);

      if (interaction.user.appData.isBanned) {
        console.log(`Banned user ${interaction.user.id} used interaction.`);
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setDescription('❌ You have been blacklisted from the bot.')
              .setColor(0xff0000),
          ],
          components: [
            new ActionRowBuilder().setComponents(
              new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setURL(supportServerInviteLink)
                .setLabel('Appeal')
            ),
          ],
        });
      }

      await guildChannelModel.cache.load(interaction.channel);

      if (
        interaction.channel.appData.noCommand &&
        !interaction.member
          .permissionsIn(interaction.channel)
          .has(PermissionFlagsBits.ManageGuild)
      ) {
        return await interaction.reply({
          content: 'This is a noCommand channel, and you are not an admin.',
          ephemeral: true,
        });
      }

      if (
        interaction.guild.appData.commandOnlyChannel != 0 &&
        interaction.guild.appData.commandOnlyChannel !=
          interaction.channel.id &&
        !interaction.member
          .permissionsIn(interaction.channel)
          .has(PermissionFlagsBits.ManageGuild)
      ) {
        return await interaction.reply({
          content: `Commands can only be used in <#${interaction.guild.appData.commandOnlyChannel}> unless you are an admin.`,
          ephemeral: true,
        });
      }

      await tokenBurn(interaction.guild);

      if (
        interaction.isButton() ||
        interaction.isStringSelectMenu() ||
        interaction.isChannelSelectMenu()
      ) {
        await component(interaction);
      } else if (interaction.isUserContextMenuCommand()) {
        await userCtx(interaction);
      } else if (interaction.isModalSubmit()) {
        await modalSubmit(interaction);
      } else if (interaction.isCommand() || interaction.isAutocomplete()) {
        const path = await getPath(interaction);
        const command =
          interaction.client.commands.get(path) ??
          interaction.client.adminCommands.get(interaction.commandName);
        if (!command) return console.log('No command found: ', path);

        if (
          command.isAdmin &&
          userPrivileges[interaction.user.id] &&
          userPrivileges[interaction.user.id] < command.requiredPrivileges
        ) {
          console.log(
            `!!! Unauthorized command attempt: ${interaction.user.id} ${interaction.commandName}`
          );
          return await interaction.reply({
            content: 'This is an admin command you have no access to.',
            ephemeral: true,
          });
        }

        if (interaction.isCommand()) {
          await command.execute(interaction);
          if (!command.isAdmin) await askForPremium(interaction);
        } else if (interaction.isAutocomplete()) {
          await command.autocomplete(interaction);
        }
      }
    } catch (e) {
      if (!interaction.replied) {
        try {
          if (interaction.deferred)
            await interaction.editReply({
              content: 'There was an error while executing this command!',
              ephemeral: true,
            });
          else
            await interaction.reply({
              content: 'There was an error while executing this command!',
              ephemeral: true,
            });
        } catch (e2) {
          if (e2.code !== 10062)
            // Unknown Interaction
            throw e2;
          else return console.log('Unknown interaction after error');
        }
      }
      throw e;
    }
  },
};

const getPath = async (interaction) => {
  let path = 'commandsSlash';
  path = path.concat('/', interaction.commandName);
  const group = await interaction.options.getSubcommandGroup(false);
  const sub = await interaction.options.getSubcommand(false);
  if (group) path = path.concat('/', group);
  if (sub) path = path.concat('/', sub);
  path = path.concat('.js');

  console.log(path);
  return path;
};

const component = async (interaction) => {
  if (interaction.customId.split(' ')[0] === 'ignore') return;
  const command = interaction.client.commands.get(
    interaction.customId.split(' ')[0]
  );

  if (!command) return;

  await command.component(interaction);
};

const userCtx = async (interaction) => {
  const command = interaction.client.commands.get(
    `contextMenus/${interaction.commandName}.js`
  );

  await command.execute(interaction);
};

async function modalSubmit(interaction) {
  const command = interaction.client.commands.get(
    interaction.customId.split(' ')[0]
  );
  if (!command) return;
  await command.modal(interaction);
}
