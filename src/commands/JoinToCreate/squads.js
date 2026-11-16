import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { TitanBotError, ErrorTypes, replyUserError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import {
    initializeJoinToCreate,
    hasManageGuildPermission,
    logConfigurationChange
} from '../../services/joinToCreateService.js';

const PRESETS = [
    { name: '➕ Solo',  limit: 1, template: "{username}'s Solo" },
    { name: '➕ Duo',   limit: 2, template: "{username}'s Duo" },
    { name: '➕ Trio',  limit: 3, template: "{username}'s Trio" },
    { name: '➕ Squad', limit: 4, template: "{username}'s Squad" },
];

export default {
    data: new SlashCommandBuilder()
        .setName("squads")
        .setDescription("Create Solo, Duo, Trio and Squad Join to Create channels.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addChannelOption((option) =>
            option
                .setName("category")
                .setDescription("Category to create the channels in.")
                .addChannelTypes(ChannelType.GuildCategory)
        ),
    category: "utility",

    async execute(interaction, config, client) {
        try {
            if (!hasManageGuildPermission(interaction.member)) {
                throw new TitanBotError(
                    'User lacks ManageGuild permission',
                    ErrorTypes.PERMISSION,
                    'You need **Manage Server** permission to use this command.'
                );
            }

            await InteractionHelper.safeDefer(interaction, { flags: 64 });

            const guildId = interaction.guild.id;
            let category = interaction.options.getChannel('category');

            if (!category) {
                category = await interaction.guild.channels.create({
                    name: 'Join to Create',
                    type: ChannelType.GuildCategory
                });
            }

            const created = [];

            for (const preset of PRESETS) {
                const channel = await interaction.guild.channels.create({
                    name: preset.name,
                    type: ChannelType.GuildVoice,
                    parent: category.id,
                    userLimit: 0,
                    bitrate: 64000,
                    permissionOverwrites: [
                        {
                            id: interaction.guild.id,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
                        },
                    ],
                });

                await initializeJoinToCreate(client, guildId, channel.id, {
                    nameTemplate: preset.template,
                    userLimit: preset.limit,
                    bitrate: 64000,
                    categoryId: category.id
                });

                created.push(`${channel} → limit ${preset.limit}`);
            }

            await logConfigurationChange(client, guildId, interaction.user.id, 'Created Solo/Duo/Trio/Squad channels', {
                categoryId: category.id
            });

            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [successEmbed('✅ Squad Channels Created', created.join('\n'))]
            });

        } catch (error) {
            let message = 'Something went wrong. Please check the bot permissions and try again.';
            if (error instanceof TitanBotError) {
                message = error.userMessage || message;
            } else {
                logger.error('Error in squads command:', error);
            }
            return replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message });
        }
    }
};
