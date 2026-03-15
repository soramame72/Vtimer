const {
  SlashCommandBuilder,
  AttachmentBuilder,
  ChannelType,
} = require('discord.js');
const { generateCountdownImage, DESIGN_LABELS } = require('../utils/imageGenerator');

const UPDATE_INTERVAL_MS = 1_000;
const RATE_LIMIT_MS = 1_500;

function parseDuration(str) {
  const match = str.match(/^(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
  if (!match || str.trim() === '') return null;
  const d = parseInt(match[1] || 0);
  const h = parseInt(match[2] || 0);
  const m = parseInt(match[3] || 0);
  const s = parseInt(match[4] || 0);
  const total = d * 86400 + h * 3600 + m * 60 + s;
  return total > 0 ? total : null;
}

function parseTargetTime(str) {
  const match = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const h = parseInt(match[1]);
  const m = parseInt(match[2]);
  const s = parseInt(match[3] || 0);
  if (h > 23 || m > 59 || s > 59) return null;
  return { h, m, s };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('countdown')
    .setDescription('カウントダウンを開始します')
    .addStringOption((o) =>
      o
        .setName('time')
        .setDescription('目標時刻 (例: 20:30) または残り時間 (例: 1h30m, 90m, 100h, 2d12h)')
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

    let getTargetEpoch;
    let displayLabel;

    const targetTime = parseTargetTime(timeStr);
    if (targetTime) {
      const { h, m, s } = targetTime;
      displayLabel = timeStr;
      getTargetEpoch = () => {
        const now = new Date();
        const target = new Date(now);
        target.setHours(h, m, s, 0);
        if (target <= now) target.setDate(target.getDate() + 1);
        return target.getTime();
      };
    } else {
      const durationSec = parseDuration(timeStr);
      if (!durationSec) {
        return interaction.reply({
          content: '❌ 形式が正しくありません。\n時刻: `20:30` / 残り時間: `1h30m` `90m` `2d12h` `100h`',
          flags: 64,
        });
      }
      displayLabel = timeStr;
      const endEpoch = Date.now() + durationSec * 1000;
      getTargetEpoch = () => endEpoch;
    }

    await interaction.deferReply({ flags: 64 });

    const guildId = interaction.guildId;
    const countdownKey = `${guildId}_${targetChannel.id}`;

    if (client.activeCountdowns.has(countdownKey)) {
      clearInterval(client.activeCountdowns.get(countdownKey).interval);
      client.activeCountdowns.delete(countdownKey);
    }

    const getRemainingSeconds = () =>
      Math.max(0, Math.round((getTargetEpoch() - Date.now()) / 1000));

    const imageBuffer = await generateCountdownImage(getRemainingSeconds(), displayLabel, designIndex);
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
          const buf = await generateCountdownImage(0, displayLabel, designIndex);
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
        const buf = await generateCountdownImage(remaining, displayLabel, designIndex);
        const att = new AttachmentBuilder(buf, { name: 'countdown.png' });
        await countdownMessage.edit({ files: [att] });
      } catch (e) {
        if (e.code === 10008 || e.message?.includes('Unknown Message')) {
          console.log(`[countdown] メッセージが削除されたため停止: ${countdownKey}`);
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
