import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { TitanBotError, ErrorTypes, replyUserError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import {
    initializeJoinToCreate,
    getConfiguration,
    updateChannelConfig,
    hasManageGuildPermission,
    logConfigurationChange
} from '../../services/joinToCreateService.js';

const SIZES = [
    { option: 'solo',  label: 'Solo',  limit: 1, template: "{username}'s Solo" },
    { option: 'duo',   label: 'Duo',   limit: 2, template: "{username}'s Duo" },
    { option: 'trio',  label: 'Trio',  limit: 3, template: "{username}'s Trio" },
    { option: 'squad', label: 'Squad', limit: 4, template: "{username}'s Squad" },
];

const builder = new SlashCommandBuilder()
    .setName("squadlink")
    .setDescription("Turn your existing Solo, Duo, Trio and Squad voice channels into Join to Create channels.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false);

for (const size of SIZES) {
    builder.addChannelOption((option) =>
        option
            .setName(size.option)
            .setDescription(`Your existing ${size.label} voice channel.`)
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildVoice)
    );
}

export default {
    data: builder,
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
            const current = await getConfiguration(client, guildId);
            const existing = Array.isArray(current.triggerChannels) ? current.triggerChannels : [];
            const results = [];

            for (const size of SIZES) {
                const channel = interaction.options.getChannel(size.option);
                const settings = {
                    nameTemplate: size.template,
                    userLimit: size.limit,
                    bitrate: channel.bitrate || 64000,
                    categoryId: channel.parentId || null
                };

                if (existing.includes(channel.id)) {
                    await updateChannelConfig(client, guildId, channel.id, {
                        nameTemplate: settings.nameTemplate,
                        userLimit: settings.userLimit,
                        bitrate: settings.bitrate,
                        categoryId: settings.categoryId
                    });
                } else {
                    await initializeJoinToCreate(client, guildId, channel.id, settings);
                }

                results.push(`${channel} → rooms for ${size.limit}`);
            }

            await logConfigurationChange(client, guildId, interaction.user.id, 'Linked Solo/Duo/Trio/Squad channels', {
                channels: SIZES.map((s) => interaction.options.getChannel(s.option).id)
            });

            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [successEmbed('✅ Channels Linked', results.join('\n'))]
            });

        } catch (error) {
            let message = 'Something went wrong. Please check the bot permissions and try again.';
            if (error instanceof TitanBotError) {
                message = error.userMessage || message;
            } else {
                logger.error('Error in squadlink command:', error);
            }
            return replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message });
        }
    }
};
