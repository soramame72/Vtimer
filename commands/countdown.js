const {
  SlashCommandBuilder,
  AttachmentBuilder,
  ChannelType,
} = require('discord.js');
const { generateCountdownImage, DESIGN_LABELS } = require('../utils/imageGenerator');

const UPDATE_INTERVAL_MS = 1_000;
const RATE_LIMIT_MS = 1_500;

function parseHMS(str) {
  const match = str.trim().match(/^(\d+):(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const s = parseInt(match[3], 10);
  if (m > 59 || s > 59) return null;
  return h * 3600 + m * 60 + s;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('countdown')
    .setDescription('カウントダウンを開始します')
    .addStringOption((o) =>
      o
        .setName('time')
        .setDescription('時間:分:秒 の形式で入力 (例: 1:30:00 / 495:19:19 / 4545:00:00)')
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
    await interaction.deferReply({ flags: 64 });

    const timeStr = interaction.options.getString('time');
    const targetChannel = interaction.options.getChannel('channel');
    const designIndex = (interaction.options.getInteger('design') ?? 1) - 1;

    const totalSeconds = parseHMS(timeStr);
    if (totalSeconds === null || totalSeconds <= 0) {
      return interaction.editReply({
        content: '❌ 形式が正しくありません。`時間:分:秒` で入力してください。\n例: `1:30:00` `495:19:19` `4545:00:00`',
      });
    }

    const guildId = interaction.guildId;
    const countdownKey = `${guildId}_${targetChannel.id}`;

    if (client.activeCountdowns.has(countdownKey)) {
      clearInterval(client.activeCountdowns.get(countdownKey).interval);
      client.activeCountdowns.delete(countdownKey);
    }

    const endEpoch = Date.now() + totalSeconds * 1000;
    const getRemainingSeconds = () => Math.max(0, Math.round((endEpoch - Date.now()) / 1000));

    const imageBuffer = await generateCountdownImage(getRemainingSeconds(), timeStr, designIndex);
    const attachment = new AttachmentBuilder(imageBuffer, { name: 'countdown.png' });
    const countdownMessage = await targetChannel.send({ files: [attachment] });

    await interaction.editReply({
      content: `✅ <#${targetChannel.id}> でカウントダウンを開始しました！　デザイン: **${DESIGN_LABELS[designIndex]}**\nメッセージを削除するとカウントダウンが停止します。`,
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
        if (e.code === 10008 || e.message?.includes('Unknown Message')) {
          clearInterval(state.interval);
          client.activeCountdowns.delete(countdownKey);
        } else if (e.status === 429) {
          const retryAfter = Number(e.headers?.get?.('retry-after') ?? 2);
          lastUpdate = Date.now() + retryAfter * 1000;
        } else {
          console.error('[countdown] 更新失敗:', e.message);
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
