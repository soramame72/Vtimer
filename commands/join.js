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
      interaction.member?.voice?.channel ?? null;

    if (!voiceChannel) {
      return interaction.editReply({
        content: '❌ ボイスチャンネルを指定するか、ボイスチャンネルに参加してからコマンドを実行してください。',
      });
    }

    if (client.voiceConnections.has(guildId)) {
      const existing = client.voiceConnections.get(guildId);
      try { existing.connection.destroy(); } catch {}
      clearInterval(existing.keepInterval);
      client.voiceConnections.delete(guildId);
    }

    let connection;
    try {
      connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guildId,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: true,
      });
    } catch (e) {
      return interaction.editReply({ content: `❌ 接続に失敗しました: ${e.message}` });
    }

    const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });
    connection.subscribe(player);

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 10_000);
    } catch {
      try { connection.destroy(); } catch {}
      return interaction.editReply({ content: '❌ ボイスチャンネルへの接続に失敗しました。' });
    }

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        const state = client.voiceConnections.get(guildId);
        if (state) {
          clearInterval(state.keepInterval);
          client.voiceConnections.delete(guildId);
        }
        try { connection.destroy(); } catch {}
      }
    });

    const keepInterval = setInterval(() => {
      try {
        if (connection.state.status === VoiceConnectionStatus.Ready) {
          connection.setSpeaking(false);
        }
      } catch {}
    }, 20_000);

    client.voiceConnections.set(guildId, {
      connection,
      keepInterval,
      channelId: voiceChannel.id,
    });

    await interaction.editReply({
      content: `✅ **${voiceChannel.name}** に接続しました。\`/leave\` コマンドで退出します。`,
    });
  },
};
