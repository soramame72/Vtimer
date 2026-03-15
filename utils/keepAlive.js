const express = require('express');
const fetch = require('node-fetch');

function keepAlive() {
  const app = express();

  app.get('/', (_, res) => res.send('Bot is alive!'));
  app.get('/health', (_, res) => res.json({ status: 'ok', uptime: process.uptime() }));

  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`🌐 Keep-alive server: port ${port}`));

  const selfUrl = process.env.RENDER_URL;
  if (!selfUrl) {
    console.warn('⚠️  RENDER_URL が設定されていません。自己pingは無効です。');
    return;
  }

  setInterval(async () => {
    try {
      await fetch(`${selfUrl}/health`);
      console.log(`[keepAlive] ping OK - ${new Date().toISOString()}`);
    } catch (e) {
      console.error('[keepAlive] ping failed:', e.message);
    }
  }, 4 * 60 * 1000);
}

module.exports = keepAlive;
