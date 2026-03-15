const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leave')
    .setDescription('ボイスチャンネルから退出します'),

  async execute(interaction, client) {
    const guildId = interaction.guildId;

    if (!client.voiceConnections.has(guildId)) {
      return interaction.reply({
        content: '❌ 現在どのボイスチャンネルにも接続していません。',
        flags: 64,
      });
    }

    const { connection, keepInterval } = client.voiceConnections.get(guildId);
    clearInterval(keepInterval);
    connection.destroy();
    client.voiceConnections.delete(guildId);

    await interaction.reply({ content: '👋 ボイスチャンネルから退出しました。', flags: 64 });
  },
};
