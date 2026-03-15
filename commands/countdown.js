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

function formatHMS(totalSec) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('countdown')
    .setDescription('VCの継続時間が指定した時間になるまでカウントダウンします')
    .addChannelOption((o) =>
      o
        .setName('vc')
        .setDescription('対象のボイスチャンネル')
        .addChannelTypes(ChannelType.GuildVoice)
        .setRequired(true)
    )
    .addStringOption((o) =>
      o
        .setName('time')
        .setDescription('目標の継続時間 (時間:分:秒) 例: 1:30:00 / 495:19:19')
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

    const vcChannel    = interaction.options.getChannel('vc');
    const timeStr      = interaction.options.getString('time');
    const targetChannel = interaction.options.getChannel('channel');
    const designIndex  = (interaction.options.getInteger('design') ?? 1) - 1;

    const targetTotalSec = parseHMS(timeStr);
    if (targetTotalSec === null || targetTotalSec <= 0) {
      return interaction.editReply({
        content: '❌ 形式が正しくありません。`時間:分:秒` で入力してください。\n例: `1:30:00` `495:19:19` `4545:00:00`',
      });
    }

    const sessionKey = `${interaction.guildId}_${vcChannel.id}`;
    const sessionStart = client.vcSessionStart.get(sessionKey);

    if (!sessionStart) {
      return interaction.editReply({
        content: `❌ **${vcChannel.name}** は現在誰も参加していないか、セッションが記録されていません。`,
      });
    }

    const elapsedSec = Math.round((Date.now() - sessionStart) / 1000);

    if (elapsedSec >= targetTotalSec) {
      return interaction.editReply({
        content: `❌ **${vcChannel.name}** はすでに目標時間 \`${timeStr}\` を超過しています（継続時間: ${formatHMS(elapsedSec)}）。`,
      });
    }

    const endEpoch = sessionStart + targetTotalSec * 1000;
    const getRemainingSeconds = () => Math.max(0, Math.round((endEpoch - Date.now()) / 1000));

    const guildId = interaction.guildId;
    const countdownKey = `${guildId}_${targetChannel.id}`;

    if (client.activeCountdowns.has(countdownKey)) {
      clearInterval(client.activeCountdowns.get(countdownKey).interval);
      client.activeCountdowns.delete(countdownKey);
    }

    const imageBuffer = await generateCountdownImage(
      getRemainingSeconds(), timeStr, designIndex, vcChannel.name
    );
    const countdownMessage = await targetChannel.send({
      files: [new AttachmentBuilder(imageBuffer, { name: 'countdown.png' })],
    });

    await interaction.editReply({
      content: `✅ **${vcChannel.name}** の継続時間カウントダウンを <#${targetChannel.id}> で開始しました！\n目標: \`${timeStr}\` / 現在の継続: ${formatHMS(elapsedSec)} / デザイン: **${DESIGN_LABELS[designIndex]}**\nメッセージを削除するとカウントダウンが停止します。`,
    });

    let lastUpdate = 0;
    let isUpdating = false;

    async function updateCountdown() {
      const remaining = getRemainingSeconds();

      if (remaining <= 0) {
        clearInterval(state.interval);
        client.activeCountdowns.delete(countdownKey);
        try {
          const buf = await generateCountdownImage(0, timeStr, designIndex, vcChannel.name);
          await countdownMessage.edit({
            files: [new AttachmentBuilder(buf, { name: 'countdown.png' })],
          });
        } catch {}
        return;
      }

      const now = Date.now();
      if (isUpdating || now - lastUpdate < RATE_LIMIT_MS) return;

      isUpdating = true;
      lastUpdate = now;
      try {
        const buf = await generateCountdownImage(remaining, timeStr, designIndex, vcChannel.name);
        await countdownMessage.edit({
          files: [new AttachmentBuilder(buf, { name: 'countdown.png' })],
        });
      } catch (e) {
        if (e.code === 10008 || e.message?.includes('Unknown Message')) {
          clearInterval(state.interval);
          client.activeCountdowns.delete(countdownKey);
        } else if (e.status === 429) {
          lastUpdate = Date.now() + Number(e.headers?.get?.('retry-after') ?? 2) * 1000;
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
