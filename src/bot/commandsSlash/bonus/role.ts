import guildModel from '../../models/guild/guildModel.js';
import guildMemberModel from '../../models/guild/guildMemberModel.js';
import guildRoleModel from '../../models/guild/guildRoleModel.js';
import statFlushCache from '../../statFlushCache.js';
import { oneLine, stripIndent } from 'common-tags';
import {
  PermissionFlagsBits,
  Events,
  GatewayOpcodes,
  type ChatInputCommandInteraction,
  type Role,
  type Client,
  type InteractionEditReplyOptions,
  type GuildMember,
  type Guild,
} from 'discord.js';
import { DiscordSnowflake } from '@sapphire/snowflake';
import { registerSubCommand } from 'bot/util/commandLoader.js';

export const currentJobs = new Set();

registerSubCommand({
  name: 'role',
  execute: async (interaction) => {
    await guildModel.cache.load(interaction.guild);

    if (currentJobs.has(interaction.guild.id)) {
      return await interaction.reply({
        content: 'This server already has a mass role operation running.',
        ephemeral: true,
      });
    }

    const role = interaction.options.getRole('role', true);
    if (
      !interaction.channel ||
      !interaction.member.permissionsIn(interaction.channel).has(PermissionFlagsBits.ManageGuild)
    ) {
      return await interaction.reply({
        content: 'You need the permission to manage the server in order to use this command.',
        ephemeral: true,
      });
    }

    const change = interaction.options.getInteger('change', true);

    currentJobs.add(interaction.guild.id);
    // backup removes after 1h
    const clean = () => {
      let rm;
      try {
        rm = currentJobs.delete(interaction.guild.id);
      } catch (e) {
        interaction.client.logger.debug('Guild left before bonus role job sweep');
      }
      if (rm)
        interaction.client.logger.warn(
          `role bonus job removed during sweep from guild ${interaction.guild.id}`,
        );
    };
    setTimeout(clean, 36e5);

    if (interaction.options.getBoolean('use-beta'))
      return await betaSystem(interaction, role, change);
    else return await oldSystem(interaction, role, change);
  },
});

async function oldSystem(
  interaction: ChatInputCommandInteraction<'cached'>,
  role: Role,
  changeAmount: number,
) {
  await interaction.deferReply();
  await guildRoleModel.cache.load(role);

  const members = await interaction.guild.members.fetch({
    withPresences: false,
  });

  interaction.client.logger.debug(`Old role give to ${members.size} members`);

  await interaction.editReply({
    content: `Applying \`${changeAmount}\` XP...`,
    allowedMentions: { parse: [] },
  });

  let affected = 0;
  for (const _member of members) {
    const member = _member[1];
    if (member.roles.cache.has(role.id)) {
      await guildMemberModel.cache.load(member);
      await statFlushCache.addBonus(member, changeAmount);
      affected++;
    }
  }
  currentJobs.delete(interaction.guild.id);

  interaction.client.logger.debug(`Old role give affected ${affected} members`);

  await interaction.editReply({
    content: oneLine`Successfully gave \`${changeAmount}\` bonus XP 
      to \`${affected}\` member${affected == 1 ? '' : 's'} with role ${role}`,
    allowedMentions: { parse: [] },
  });
}

async function betaSystem(
  interaction: ChatInputCommandInteraction<'cached'>,
  role: Role,
  changeAmount: number,
) {
  await guildRoleModel.cache.load(role);

  // DJS GuildMemberManager.fetch()
  // https://github.com/discordjs/discord.js/blob/ff85481d3e7cd6f7c5e38edbe43b27b104e82fba/packages/discord.js/src/managers/GuildMemberManager.js#L493

  await interaction.reply({
    content: `Processing ${interaction.guild.memberCount} members`,
    ephemeral: true,
  });

  const nonce = DiscordSnowflake.generate().toString();

  interaction.guild.shard.send({
    op: GatewayOpcodes.RequestGuildMembers,
    d: {
      guild_id: interaction.guild.id,
      presences: false,
      query: '', // required to be empty string in order to fetch all
      nonce,
      limit: 0,
    },
  });

  interaction.client.logger.debug(
    `New role give to guild with member count ${interaction.guild.memberCount}`,
  );

  const members = await getApplicableMembers(
    role.id,
    nonce,
    interaction.client,
    (c) => interaction.editReply(c),
    interaction.guild.memberCount,
  );
  console.debug(`${members.size} Members found`);

  await interaction.followUp({
    content: 'Applying XP...',
    ephemeral: true,
  });

  let affected = 0;
  for (const member of members) {
    await statFlushCache.directlyAddBonus(
      member,
      interaction.guild,
      interaction.client,
      changeAmount,
    );

    affected++;
    if (affected % 2000 === 0) {
      await interaction.editReply({
        content: stripIndent`
          Processing \`${members.size}\` members...
          \`\`\`yml
          ${progressBar(affected, members.size)}
          \`\`\`
        `,
      });
    }
  }

  currentJobs.delete(interaction.guild.id);

  interaction.client.logger.debug(`New role give affected ${affected} members`);

  await interaction.followUp({
    content: oneLine`Successfully gave \`${changeAmount}\` bonus XP
      to \`${affected}\` member${affected == 1 ? '' : 's'} with role ${role}`,
    allowedMentions: { parse: [] },
    ephemeral: true,
  });
}

// not sure how to use async/await here so just promise-based
async function getApplicableMembers(
  roleId: string,
  nonce: string,
  client: Client,
  reply: (opt: InteractionEditReplyOptions) => unknown,
  memberCount: number,
): Promise<Set<string>> {
  return new Promise((resolve) => {
    const applicableMembers = new Set<string>();
    let i = 0;

    const handler = async (
      members: Map<string, GuildMember>,
      _guild: Guild,
      chunk: { index: number; count: number; nonce?: string },
    ) => {
      if (chunk.nonce !== nonce) return;
      i++;

      if (i === 1) console.debug(`Max ${chunk.count}`);

      if (i % 20 === 0) {
        reply({
          content: stripIndent`
            Processing \`${memberCount}\` members...
            \`\`\`yml
            ${progressBar(i, chunk.count)}
            \`\`\`
          `,
        });
      }

      for (const member of members.values()) {
        if (member.roles.cache.has(roleId)) {
          applicableMembers.add(member.id);
          console.debug(`Added ${member.id}`);
        }
      }

      if (members.size < 1_000 || i === chunk.count) {
        client.removeListener(Events.GuildMembersChunk, handler);
        client.decrementMaxListeners();

        console.debug('Final: ', applicableMembers.size);
        resolve(applicableMembers);
      }
    };
    client.incrementMaxListeners();
    client.on(Events.GuildMembersChunk, handler);
  });
}

function progressBar(index: number, max: number, len = 40) {
  const fraction = index / max;
  const progress = Math.ceil(len * fraction);
  return `${'■'.repeat(progress)}${'□'.repeat(len - progress)} ${
    Math.round(fraction * 1_000) / 10
  }%`;
}

export default { currentJobs };
