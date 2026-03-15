require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const keepAlive = require('./utils/keepAlive');

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

const commandsPath = path.join(__dirname, 'commands');
fs.readdirSync(commandsPath)
  .filter((f) => f.endsWith('.js'))
  .forEach((file) => {
    const command = require(path.join(commandsPath, file));
    client.commands.set(command.data.name, command);
  });

client.once('ready', () => {
  console.log(`✅ ${client.user.tag} でログインしました`);
  keepAlive();
});

client.on('messageDelete', (message) => {
  for (const [key, state] of client.activeCountdowns.entries()) {
    if (state.messageId === message.id) {
      clearInterval(state.interval);
      client.activeCountdowns.delete(key);
      console.log(`[countdown] 削除により停止: ${key}`);
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
      if (interaction.deferred) {
        await interaction.editReply(msg);
      } else if (!interaction.replied) {
        await interaction.reply(msg);
      }
    } catch (e) {
      console.error('[interactionCreate] エラー応答の送信に失敗:', e.message);
    }
  }
});

client.on('error', (error) => {
  console.error('[client error]', error.message);
});

process.on('unhandledRejection', (error) => {
  console.error('[unhandledRejection]', error?.message ?? error);
});

client.login(process.env.DISCORD_TOKEN);
