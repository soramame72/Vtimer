const {
  SlashCommandBuilder,
  AttachmentBuilder,
  ChannelType,
} = require('discord.js');
const { generateCountdownImage, DESIGN_LABELS } = require('../utils/imageGenerator');

const UPDATE_INTERVAL_MS = 1_000;
const RATE_LIMIT_MS = 1_500;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('countdown')
    .setDescription('指定した時刻までのカウントダウンを開始します')
    .addStringOption((o) =>
      o
        .setName('time')
        .setDescription('目標時刻 (例: 20:30)')
        .setRequired(true)
    )
    .addChannelOption((o) =>
      o
        .setName('channel')
        .setDescription('カウントダウンを送信するテキストチャンネル')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addIntegerOption((o) =>
      o
        .setName('design')
        .setDescription('デザイン番号 (1〜10)')
        .setMinValue(1)
        .setMaxValue(10)
        .setRequired(false)
    ),

  async execute(interaction, client) {
    const timeStr = interaction.options.getString('time');
    const targetChannel = interaction.options.getChannel('channel');
    const designIndex = (interaction.options.getInteger('design') ?? 1) - 1;

    const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (!timeMatch) {
      return interaction.reply({
        content: '❌ 時刻の形式が正しくありません。`HH:MM` の形式で入力してください（例: `20:30`）',
        flags: 64,
      });
    }

    const [, hStr, mStr] = timeMatch;
    const targetH = parseInt(hStr, 10);
    const targetM = parseInt(mStr, 10);

    if (targetH > 23 || targetM > 59) {
      return interaction.reply({ content: '❌ 無効な時刻です。', flags: 64 });
    }

    await interaction.deferReply({ flags: 64 });

    const guildId = interaction.guildId;
    const countdownKey = `${guildId}_${targetChannel.id}`;

    if (client.activeCountdowns.has(countdownKey)) {
      clearInterval(client.activeCountdowns.get(countdownKey).interval);
      client.activeCountdowns.delete(countdownKey);
    }

    function getTargetDate() {
      const now = new Date();
      const target = new Date(now);
      target.setHours(targetH, targetM, 0, 0);
      if (target <= now) target.setDate(target.getDate() + 1);
      return target;
    }

    function getRemainingSeconds() {
      return Math.round((getTargetDate() - Date.now()) / 1000);
    }

    const imageBuffer = await generateCountdownImage(getRemainingSeconds(), timeStr, designIndex);
    const attachment = new AttachmentBuilder(imageBuffer, { name: 'countdown.png' });
    const countdownMessage = await targetChannel.send({ files: [attachment] });

    await interaction.editReply({
      content: `✅ <#${targetChannel.id}> でカウントダウンを開始しました！　デザイン: **${DESIGN_LABELS[designIndex]}**`,
    });

    let lastUpdate = 0;
    let isUpdating = false;

    async function updateCountdown() {
      const remaining = getRemainingSeconds();

      if (remaining <= 0) {
        clearInterval(state.interval);
        client.activeCountdowns.delete(countdownKey);
        try {
          const buf = await generateCountdownImage(0, timeStr, designIndex);
          const att = new AttachmentBuilder(buf, { name: 'countdown.png' });
          await countdownMessage.edit({ files: [att] });
        } catch {}
        return;
      }

      const now = Date.now();
      if (isUpdating || now - lastUpdate < RATE_LIMIT_MS) return;

      isUpdating = true;
      lastUpdate = now;
      try {
        const buf = await generateCountdownImage(remaining, timeStr, designIndex);
        const att = new AttachmentBuilder(buf, { name: 'countdown.png' });
        await countdownMessage.edit({ files: [att] });
      } catch (e) {
        if (e.status === 429) {
          const retryAfter = (e.headers?.get?.('retry-after') ?? 2);
          lastUpdate = Date.now() + Number(retryAfter) * 1000;
        } else {
          console.error('[countdown] メッセージの更新に失敗:', e.message);
        }
      } finally {
        isUpdating = false;
      }
    }

    const interval = setInterval(updateCountdown, UPDATE_INTERVAL_MS);
    const state = { interval, messageId: countdownMessage.id, channelId: targetChannel.id };
    client.activeCountdowns.set(countdownKey, state);
  },
};
