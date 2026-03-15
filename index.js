require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const keepAlive = require('./utils/keepAlive');
const { preloadFonts } = require('./utils/imageGenerator');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();
client.activeCountdowns = new Map();
client.voiceConnections = new Map();
client.vcSessionStart = new Map();

const commandsPath = path.join(__dirname, 'commands');
fs.readdirSync(commandsPath)
  .filter((f) => f.endsWith('.js'))
  .forEach((file) => {
    const command = require(path.join(commandsPath, file));
    client.commands.set(command.data.name, command);
  });

client.on('voiceStateUpdate', (oldState, newState) => {
  const guildId = newState.guildId ?? oldState.guildId;

  if (newState.channelId) {
    const key = `${guildId}_${newState.channelId}`;
    const channel = newState.channel;
    const humanMembers = channel?.members?.filter((m) => !m.user.bot) ?? new Map();

    if (humanMembers.size === 1 && !client.vcSessionStart.has(key)) {
      client.vcSessionStart.set(key, Date.now());
      console.log(`[vc] セッション開始: ${key}`);
    }
  }

  if (oldState.channelId) {
    const key = `${guildId}_${oldState.channelId}`;
    const channel = oldState.channel;
    const humanMembers = channel?.members?.filter((m) => !m.user.bot) ?? new Map();

    if (humanMembers.size === 0) {
      client.vcSessionStart.delete(key);
      console.log(`[vc] セッション終了: ${key}`);
    }
  }
});

client.on('messageDelete', (message) => {
  for (const [key, state] of client.activeCountdowns.entries()) {
    if (state.messageId === message.id) {
      clearInterval(state.interval);
      client.activeCountdowns.delete(key);
      break;
    }
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction, client);
  } catch (error) {
    console.error('[interactionCreate] エラー:', error.message);
    const msg = { content: 'コマンドの実行中にエラーが発生しました。', flags: 64 };
    try {
      if (interaction.deferred) await interaction.editReply(msg);
      else if (!interaction.replied) await interaction.reply(msg);
    } catch {}
  }
});

client.on('error', (e) => console.error('[client error]', e.message));
process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e?.message ?? e));

client.once('ready', async () => {
  console.log(`✅ ${client.user.tag} でログインしました`);
  await preloadFonts();
  console.log('[font] プリロード完了');

  for (const guild of client.guilds.cache.values()) {
    for (const channel of guild.channels.cache.values()) {
      if (!channel.isVoiceBased?.()) continue;
      const humans = channel.members?.filter((m) => !m.user.bot);
      if (humans?.size > 0) {
        const key = `${guild.id}_${channel.id}`;
        client.vcSessionStart.set(key, Date.now());
        console.log(`[vc] 起動時セッション検出: ${key}`);
      }
    }
  }

  keepAlive();
});

client.login(process.env.DISCORD_TOKEN);
