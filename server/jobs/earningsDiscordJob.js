const cron = require('node-cron');
const { query } = require('../models/db');
const { sendEarningsToDiscord } = require('../services/discordEarnings');

let currentJob = null;

async function runEarningsDiscordJob() {
  console.log('[discord earnings] Starting daily send...');
  try {
    const { rows } = await query(`
      SELECT
        ec.*,
        CASE WHEN p.ticker IS NOT NULL THEN true ELSE false END as in_portfolio
      FROM earnings_calendar ec
      LEFT JOIN positions p ON p.ticker = ec.ticker
      WHERE ec.report_date = CURRENT_DATE
      ORDER BY
        CASE WHEN p.ticker IS NOT NULL THEN 0 ELSE 1 END,
        CASE ec.ai_signal WHEN 'BUY' THEN 0 WHEN 'HOLD' THEN 1 WHEN 'SELL' THEN 2 ELSE 3 END,
        ec.ai_confidence DESC NULLS LAST,
        ec.ticker ASC
    `).catch(() => ({ rows: [] }));

    if (!rows.length) {
      console.log('[discord earnings] No earnings today, skipping');
      return { sent: 0 };
    }

    console.log(`[discord earnings] Sending ${rows.length} earnings to Discord`);
    await sendEarningsToDiscord(rows);

    await query(
      `INSERT INTO app_settings (key, value, updated_at) VALUES ('discord_earnings_last_sent', NOW()::text, NOW())
       ON CONFLICT (key) DO UPDATE SET value = NOW()::text, updated_at = NOW()`
    ).catch(() => {});

    console.log(`[discord earnings] Done — ${rows.length} earnings sent`);
    return { sent: rows.length };
  } catch (e) {
    console.error('[discord earnings] Failed:', e.message);
    throw e;
  }
}

async function scheduleEarningsDiscordJob() {
  if (currentJob) { currentJob.stop(); currentJob = null; }

  const r = await query(
    `SELECT value FROM app_settings WHERE key IN ('earnings_discord_time', 'earnings_discord_enabled')`
  ).catch(() => ({ rows: [] }));

  const settings = {};
  for (const row of r.rows) settings[row.key] = row.value;

  if (settings.earnings_discord_enabled === 'false') {
    console.log('[discord earnings] Disabled, not scheduling');
    return;
  }

  const time = settings.earnings_discord_time || '07:00';
  const [hour, min] = time.split(':').map(Number);
  const pattern = `${min} ${hour} * * 1-5`;

  currentJob = cron.schedule(pattern, () => {
    runEarningsDiscordJob().catch(e => console.error('[discord earnings] Cron failed:', e.message));
  }, { timezone: 'Europe/London' });

  console.log(`[discord earnings] Scheduled ${time} Mon-Fri London time (${pattern})`);
}

module.exports = { runEarningsDiscordJob, scheduleEarningsDiscordJob };
