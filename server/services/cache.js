const { createClient } = require('redis');

let client = null;
let connected = false;

async function getClient() {
  if (connected) return client;
  client = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
  client.on('error', () => { connected = false; });
  try {
    await client.connect();
    connected = true;
  } catch {
    connected = false;
  }
  return client;
}

async function get(key) {
  try {
    const c = await getClient();
    if (!connected) return null;
    return await c.get(key);
  } catch { return null; }
}

async function setEx(key, ttl, value) {
  try {
    const c = await getClient();
    if (!connected) return;
    await c.setEx(key, ttl, value);
  } catch {}
}

async function del(key) {
  try {
    const c = await getClient();
    if (!connected) return;
    await c.del(key);
  } catch {}
}

module.exports = { get, setEx, del };
