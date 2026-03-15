const { SlashCommandBuilder, ChannelType } = require('discord.js');
const {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState,
  createAudioPlayer,
  NoSubscriberBehavior,
} = require('@discordjs/voice');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('join')
    .setDescription('ボイスチャンネルに接続して居座ります')
    .addChannelOption((o) =>
      o
        .setName('channel')
        .setDescription('接続するボイスチャンネル（省略時: あなたが参加中のチャンネル）')
        .addChannelTypes(ChannelType.GuildVoice)
        .setRequired(false)
    ),

  async execute(interaction, client) {
    await interaction.deferReply({ flags: 64 });

    const guild = interaction.guild;
    const guildId = guild.id;

    const voiceChannel =
      interaction.options.getChannel('channel') ??
      interaction.member.voice?.channel;

    if (!voiceChannel) {
      return interaction.editReply({
        content: '❌ ボイスチャンネルを指定するか、ボイスチャンネルに参加してからコマンドを実行してください。',
      });
    }

    if (client.voiceConnections.has(guildId)) {
      const existing = client.voiceConnections.get(guildId);
      existing.connection.destroy();
      clearInterval(existing.keepInterval);
      client.voiceConnections.delete(guildId);
    }

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guildId,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: true,
    });

    const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });
    connection.subscribe(player);

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 10_000);
    } catch {
      connection.destroy();
      return interaction.editReply({ content: '❌ ボイスチャンネルへの接続に失敗しました。' });
    }

    const joinedAt = Date.now();

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        if (client.voiceConnections.has(guildId)) {
          const state = client.voiceConnections.get(guildId);
          clearInterval(state.keepInterval);
          client.voiceConnections.delete(guildId);
        }
        connection.destroy();
      }
    });

    const keepInterval = setInterval(() => {
      if (connection.state.status === VoiceConnectionStatus.Ready) {
        connection.setSpeaking(false);
      }
    }, 20_000);

    client.voiceConnections.set(guildId, {
      connection,
      keepInterval,
      channelId: voiceChannel.id,
      joinedAt,
    });

    await interaction.editReply({
      content: `✅ **${voiceChannel.name}** に接続しました。\`/leave\` コマンドで退出します。`,
    });
  },
};
