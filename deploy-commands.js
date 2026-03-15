require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');

fs.readdirSync(commandsPath)
  .filter((f) => f.endsWith('.js'))
  .forEach((file) => {
    const command = require(path.join(commandsPath, file));
    commands.push(command.data.toJSON());
  });

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`${commands.length} 件のコマンドを登録中...`);

    const route = process.env.GUILD_ID
      ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
      : Routes.applicationCommands(process.env.CLIENT_ID);

    await rest.put(route, { body: commands });
    console.log('✅ コマンドの登録が完了しました');
  } catch (error) {
    console.error(error);
  }
})();
