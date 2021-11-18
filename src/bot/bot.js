const fs = require('fs');
const { Client, Collection, Intents } = require('discord.js');
const { botAuth } = require('../const/keys.js')
const fct = require('../util/fct.js');
const cronScheduler = require('./cron/scheduler.js');
const settingModel = require('../models/managerDb/settingModel.js');
const textModel = require('../models/managerDb/textModel.js');

const flags = Intents.FLAGS
const intents = [
    flags.GUILDS,
    // flags.GUILD_MEMBERS, // !!! PRIVILEGED !!!
    // flags.GUILD_MESSAGES,
    flags.GUILD_BANS,
    flags.GUILD_EMOJIS_AND_STICKERS,
    flags.GUILD_INTEGRATIONS,
    flags.GUILD_WEBHOOKS,
    flags.GUILD_VOICE_STATES,
    flags.GUILD_MESSAGES,
    flags.GUILD_MESSAGE_REACTIONS,
    flags.GUILD_MESSAGE_TYPING,
    flags.DIRECT_MESSAGES,
    flags.DIRECT_MESSAGE_REACTIONS,
    flags.DIRECT_MESSAGE_TYPING
]

const client = new Client({ intents: intents });

client.cooldowns = new Collection();
client.commands = new Collection();

const commandFiles = fs.readdirSync('./bot/commandsSlash').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const command = require(`./commandsSlash/${file}`);
	client.commands.set(command.data.name, command);
}

process.env.UV_THREADPOOL_SIZE = 50;


start();

async function start() {
    try {
        //await texter.initTexts();
        await initClientCaches(client);

        await client.login();
    } catch (e) {
        console.log(e);
        await fct.waitAndReboot(3000);
    }
}

const eventFiles = fs.readdirSync('./bot/events').filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
	const event = require(`./events/${file}`);
	if (event.once) {
	    client.once(event.name, (...args) => event.execute(...args));
	} else {
		client.on(event.name, (...args) => event.execute(...args));
	}
}

function initClientCaches(client) {
    return new Promise(async function (resolve, reject) {
        try {
            client.appData = {};
            client.appData.statFlushCache = {};
            client.appData.botShardStat = { commands1h: 0, botInvites1h: 0, botKicks1h: 0, voiceMinutes1h: 0, textMessages1h: 0, roleAssignments1h: 0, rolesDeassignments1h: 0 };
            textModel.cache.load(client);
            settingModel.cache.load(client);

            resolve();
        } catch (e) { console.log(e); }
    });
}

process.on('SIGINT', () => {
    console.info('SIGINT signal received in Shard.');
});

process.on('SIGTERM', () => {
    console.info('SIGTERM signal received in Shard.');
});
