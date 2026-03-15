const { SlashCommandBuilder, ChannelType } = require('discord.js');
const {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState,
  createAudioPlayer,
  AudioPlayerStatus,
  NoSubscriberBehavior,
} = require('@discordjs/voice');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('join')
    .setDescription('Join a voice channel and stay')
    .addChannelOption((o) =>
      o
        .setName('channel')
        .setDescription('Target voice channel (default: your current VC)')
        .addChannelTypes(ChannelType.GuildVoice)
        .setRequired(false)
    ),

  async execute(interaction, client) {
    await interaction.deferReply({ flags: 64 });

    const guild = interaction.guild;
    const guildId = guild.id;

    const voiceChannel =
      interaction.options.getChannel('channel') ??
      interaction.member?.voice?.channel ?? null;

    if (!voiceChannel) {
      return interaction.editReply({
        content: '❌ Specify a voice channel or join one first.',
      });
    }

    if (client.voiceConnections.has(guildId)) {
      const existing = client.voiceConnections.get(guildId);
      clearInterval(existing.keepInterval);
      try { existing.connection.destroy(); } catch {}
      client.voiceConnections.delete(guildId);
    }

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guildId,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: true,
    });

    const player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
    });
    connection.subscribe(player);

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
    } catch (e) {
      try { connection.destroy(); } catch {}
      return interaction.editReply({ content: `❌ Failed to connect: ${e.message}` });
    }

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
        console.log('[voice] reconnected');
      } catch {
        console.log('[voice] disconnected, destroying');
        const state = client.voiceConnections.get(guildId);
        if (state) {
          clearInterval(state.keepInterval);
          client.voiceConnections.delete(guildId);
        }
        try { connection.destroy(); } catch {}
      }
    });

    connection.on('error', (e) => {
      console.error('[voice connection error]', e.message);
    });

    const keepInterval = setInterval(() => {
      try {
        if (
          connection.state.status === VoiceConnectionStatus.Ready &&
          player.state.status === AudioPlayerStatus.Idle
        ) {
          connection.setSpeaking(false);
        }
      } catch {}
    }, 15_000);

    client.voiceConnections.set(guildId, {
      connection,
      keepInterval,
      channelId: voiceChannel.id,
    });

    await interaction.editReply({
      content: `✅ Joined **${voiceChannel.name}**. Use \`/leave\` to disconnect.`,
    });
  },
};
