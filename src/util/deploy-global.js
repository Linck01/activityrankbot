import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import fs from 'fs';
import path from 'path';
import { get as getKeys } from '../const/keys.js';
const { botId, botAuth, adminGuild } = getKeys();

const commands = [];
const adminCommands = [];

const commandFiles = fs
  .readdirSync(path.resolve(__dirname, '../bot/commandsSlash'))
  .filter((file) => file.endsWith('.js') && !file.startsWith('-'));
const contextFiles = fs
  .readdirSync(path.resolve(__dirname, '../bot/contextMenus'))
  .filter((file) => file.endsWith('.js') && !file.startsWith('-'));

const adminFiles = fs
  .readdirSync(path.resolve(__dirname, '../bot/commandsAdmin'))
  .filter((file) => file.endsWith('.js') && !file.startsWith('-'));

export default async function () {
  for (const file of commandFiles) {
    const command = require(`../bot/commandsSlash/${file}`);
    commands.push(command.data.toJSON());
  }
  for (const file of contextFiles) {
    const command = require(`../bot/contextMenus/${file}`);
    commands.push(command.data.toJSON());
  }
  for (const file of adminFiles) {
    const command = require(`../bot/commandsAdmin/${file}`);
    adminCommands.push(command.data.toJSON());
  }

  const rest = new REST({ version: '9' }).setToken(botAuth);

  try {
    console.log('Refreshing GLOBAL application (/) commands...');
    await rest.put(Routes.applicationCommands(botId), { body: commands });
    console.log(
      'Successfully reloaded GLOBAL application (/) commands.\nRefreshing admin commands...',
    );
    await rest.put(Routes.applicationGuildCommands(botId, adminGuild), {
      body: adminCommands,
    });
    console.log(
      `Loaded local application and admin (/) commands in admin guild (${adminGuild})`,
    );
  } catch (error) {
    console.error(error);
  }
}
