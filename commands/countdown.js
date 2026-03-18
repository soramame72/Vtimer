const {
  SlashCommandBuilder,
  AttachmentBuilder,
  ChannelType,
} = require('discord.js');
const { generateCountdownImage, DESIGN_LABELS } = require('../utils/imageGenerator');
const { toRomaji } = require('../utils/toRomaji');

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

function toHMS(totalSec) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('countdown')
    .setDescription('Countdown until the VC duration reaches the specified time')
    .addChannelOption((o) =>
      o.setName('vc').setDescription('Target voice channel')
        .addChannelTypes(ChannelType.GuildVoice).setRequired(true)
    )
    .addStringOption((o) =>
      o.setName('time').setDescription('Target duration H:MM:SS  e.g. 2:00:00')
        .setRequired(true)
    )
    .addChannelOption((o) =>
      o.setName('channel').setDescription('Text channel to post the countdown')
        .addChannelTypes(ChannelType.GuildText).setRequired(true)
    )
    .addStringOption((o) =>
      o.setName('elapsed')
        .setDescription('Current VC elapsed time H:MM:SS  e.g. 0:21:12  (required if bot was not tracking)')
        .setRequired(false)
    )
    .addIntegerOption((o) =>
      o.setName('design')
        .setDescription('Design 1-10: 1=Dark 2=Cyber 3=Sunset 4=Space 5=Matrix 6=Ocean 7=Fire 8=Aurora 9=Retro 10=Light')
        .setMinValue(1).setMaxValue(10).setRequired(false)
    )
    .addStringOption((o) =>
      o.setName('notify_at')
        .setDescription('Remaining time to send mention  e.g. 0:30:00')
        .setRequired(false)
    )
    .addMentionableOption((o) =>
      o.setName('mention')
        .setDescription('User or role to mention at notify_at and on finish')
        .setRequired(false)
    ),

  async execute(interaction, client) {
    await interaction.deferReply({ flags: 64 });

    const vcChannel     = interaction.options.getChannel('vc');
    const timeStr       = interaction.options.getString('time');
    const targetChannel = interaction.options.getChannel('channel');
    const elapsedStr    = interaction.options.getString('elapsed');
    const designIndex   = (interaction.options.getInteger('design') ?? 1) - 1;
    const notifyAtStr   = interaction.options.getString('notify_at');
    const mentionable   = interaction.options.getMentionable('mention');

    const targetTotalSec = parseHMS(timeStr);
    if (!targetTotalSec || targetTotalSec <= 0) {
      return interaction.editReply({ content: '❌ Invalid format. Use `H:MM:SS`  e.g. `2:00:00`' });
    }

    let notifyAtSec = null;
    if (notifyAtStr) {
      notifyAtSec = parseHMS(notifyAtStr);
      if (!notifyAtSec) {
        return interaction.editReply({ content: '❌ notify_at format invalid. Use `H:MM:SS`' });
      }
    }

    let currentElapsedSec;

    if (elapsedStr) {
      currentElapsedSec = parseHMS(elapsedStr);
      if (currentElapsedSec === null) {
        return interaction.editReply({ content: '❌ elapsed format invalid. Use `H:MM:SS`  e.g. `0:21:12`' });
      }
      const fakeStart = Date.now() - currentElapsedSec * 1000;
      client.vcSessionStart.set(`${interaction.guildId}_${vcChannel.id}`, fakeStart);
    } else {
      const sessionKey = `${interaction.guildId}_${vcChannel.id}`;
      const sessionStart = client.vcSessionStart.get(sessionKey);

      if (sessionStart) {
        currentElapsedSec = Math.round((Date.now() - sessionStart) / 1000);
      } else {
        const humans = vcChannel.members?.filter((m) => !m.user.bot);
        if (humans?.size > 0) {
          client.vcSessionStart.set(sessionKey, Date.now());
          currentElapsedSec = 0;
        } else {
          return interaction.editReply({ content: `❌ No one is in **${vcChannel.name}**. If the session started before the bot, use the \`elapsed\` option.` });
        }
      }
    }

    if (currentElapsedSec >= targetTotalSec) {
      return interaction.editReply({
        content: `❌ Already exceeded target \`${timeStr}\` (current elapsed: ${toHMS(currentElapsedSec)}).`,
      });
    }

    const remainingAtStart = targetTotalSec - currentElapsedSec;
    const endEpoch = Date.now() + remainingAtStart * 1000;

    const getRemainingSeconds = () => Math.max(0, Math.round((endEpoch - Date.now()) / 1000));
    const getElapsedSeconds   = () => targetTotalSec - getRemainingSeconds();

    const guildId      = interaction.guildId;
    const countdownKey = `${guildId}_${targetChannel.id}`;

    if (client.activeCountdowns.has(countdownKey)) {
      clearInterval(client.activeCountdowns.get(countdownKey).interval);
      client.activeCountdowns.delete(countdownKey);
    }

    const vcDisplayName = toRomaji(vcChannel.name);

    const imageBuffer = await generateCountdownImage({
      remaining: getRemainingSeconds(),
      elapsed:   getElapsedSeconds(),
      target:    timeStr,
      vcName:    vcDisplayName,
      designIndex,
    });

    const countdownMessage = await targetChannel.send({
      files: [new AttachmentBuilder(imageBuffer, { name: 'countdown.png' })],
    });

    await interaction.editReply({
      content: [
        `✅ Countdown started in <#${targetChannel.id}>`,
        `VC: **${vcChannel.name}**  |  Target: \`${timeStr}\`  |  Current elapsed: ${toHMS(currentElapsedSec)}  |  Design: **${DESIGN_LABELS[designIndex]}**`,
        notifyAtSec && mentionable ? `🔔 Mention at remaining: \`${notifyAtStr}\`` : '',
        `Delete the message to stop.`,
      ].filter(Boolean).join('\n'),
    });

    let lastUpdate = 0;
    let isUpdating = false;
    let notified   = false;

    async function updateCountdown() {
      const remaining = getRemainingSeconds();

      if (notifyAtSec && !notified && remaining <= notifyAtSec) {
        notified = true;
        try {
          await targetChannel.send({
            content: `${mentionable} ⏰ **${toHMS(notifyAtSec)}** remaining in **${vcChannel.name}**!`,
          });
        } catch (e) {
          console.error('[countdown] mention failed:', e.message);
        }
      }

      if (remaining <= 0) {
        clearInterval(state.interval);
        client.activeCountdowns.delete(countdownKey);
        try {
          const buf = await generateCountdownImage({
            remaining: 0, elapsed: targetTotalSec,
            target: timeStr, vcName: vcDisplayName, designIndex,
          });
          await countdownMessage.edit({ files: [new AttachmentBuilder(buf, { name: 'countdown.png' })] });
          if (mentionable) {
            await targetChannel.send({
              content: `${mentionable} 🎉 **${vcChannel.name}** reached the target \`${timeStr}\`!`,
            });
          }
        } catch {}
        return;
      }

      const now = Date.now();
      if (isUpdating || now - lastUpdate < RATE_LIMIT_MS) return;
      isUpdating = true;
      lastUpdate = now;

      try {
        const buf = await generateCountdownImage({
          remaining, elapsed: getElapsedSeconds(),
          target: timeStr, vcName: vcDisplayName, designIndex,
        });
        await countdownMessage.edit({ files: [new AttachmentBuilder(buf, { name: 'countdown.png' })] });
      } catch (e) {
        if (e.code === 10008 || e.message?.includes('Unknown Message')) {
          clearInterval(state.interval);
          client.activeCountdowns.delete(countdownKey);
        } else if (e.status === 429) {
          lastUpdate = Date.now() + Number(e.headers?.get?.('retry-after') ?? 2) * 1000;
        } else {
          console.error('[countdown] update failed:', e.message);
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
