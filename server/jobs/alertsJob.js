const { query } = require('../models/db');
const { generateMasterSignal } = require('../services/decisionEngine');
const cache = require('../services/cache');
const https = require('https');

const DISCORD_WEBHOOK = process.env.DISCORD_EARNINGS_WEBHOOK;
const SIGNAL_COLORS = { 'STRONG BUY': 3066993, 'BUY': 5763719, 'HOLD': 16776960, 'SELL': 15105570, 'STRONG SELL': 15158332 };

async function postDiscordAlert(embed) {
  if (!DISCORD_WEBHOOK) return;
  return new Promise(resolve => {
    const body = JSON.stringify({ embeds: [embed] });
    try {
      const url = new URL(DISCORD_WEBHOOK);
      const req = https.request({ hostname: url.hostname, path: url.pathname + url.search, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, () => resolve());
      req.on('error', () => resolve());
      req.setTimeout(8000, () => { req.destroy(); resolve(); });
      req.write(body);
      req.end();
    } catch { resolve(); }
  });
}

async function checkAlerts() {
  try {
    const [portfolioRes, watchlistRes] = await Promise.allSettled([
      query('SELECT DISTINCT ticker FROM positions WHERE ticker IS NOT NULL'),
      query("SELECT value as ticker FROM app_settings WHERE key='watchlist'").catch(() => ({ rows: [] })),
    ]);

    const tickers = new Set();
    (portfolioRes.value?.rows || []).forEach(r => tickers.add(r.ticker));

    // Parse watchlist from settings
    try {
      const wl = watchlistRes.value?.rows?.[0]?.ticker;
      if (wl) JSON.parse(wl).forEach(t => tickers.add(t));
    } catch {}

    for (const ticker of tickers) {
      try {
        const prevKey = 'alert:prev:' + ticker;
        const countKey = 'alert:count:' + ticker + ':' + new Date().toISOString().split('T')[0];
        const prevJson = await cache.get(prevKey).catch(() => null);
        const countStr = await cache.get(countKey).catch(() => null);
        const alertCount = parseInt(countStr || '0');

        if (alertCount >= 3) continue; // max 3 alerts per ticker per day

        const signal = await generateMasterSignal(ticker);
        const prev = prevJson ? JSON.parse(prevJson) : null;

        const alerts = [];

        // Signal change alert
        if (prev && prev.signal !== signal.signal) {
          alerts.push({
            title: `🔄 Signal Change: ${ticker}`,
            description: `${prev.signal} → **${signal.signal}** (${signal.confidence}% confidence)`,
            type: 'SIGNAL_CHANGE',
          });
        }

        // RSI extreme
        if (signal.rsi !== null) {
          const prevRsi = prev?.rsi;
          if (signal.rsi < 30 && (!prevRsi || prevRsi >= 30)) {
            alerts.push({ title: `📉 Oversold: ${ticker}`, description: `RSI dropped to ${signal.rsi.toFixed(0)} — oversold territory`, type: 'RSI_OVERSOLD' });
          }
          if (signal.rsi > 70 && (!prevRsi || prevRsi <= 70)) {
            alerts.push({ title: `📈 Overbought: ${ticker}`, description: `RSI hit ${signal.rsi.toFixed(0)} — overbought territory`, type: 'RSI_OVERBOUGHT' });
          }
        }

        // Near support/resistance
        if (signal.targets?.support && signal.price?.price) {
          const distPct = (signal.price.price - signal.targets.support) / signal.price.price * 100;
          if (distPct < 2 && distPct > 0 && (!prev?.nearSupport)) {
            alerts.push({ title: `🎯 Near Support: ${ticker}`, description: `Price within ${distPct.toFixed(1)}% of key support $${signal.targets.support.toFixed(2)}`, type: 'NEAR_SUPPORT' });
          }
        }

        // Send alerts (batch into one message if multiple)
        if (alerts.length > 0 && DISCORD_WEBHOOK) {
          const mainAlert = alerts[0];
          const embed = {
            color: SIGNAL_COLORS[signal.signal] || 8421504,
            title: mainAlert.title,
            description: mainAlert.description,
            fields: [
              { name: 'Signal', value: `${signal.signal} (${signal.confidence}%)`, inline: true },
              { name: 'Action', value: signal.action, inline: true },
              { name: 'Risk', value: signal.riskLevel, inline: true },
              ...(signal.bullEvidence.slice(0, 2).map(e => ({ name: '✅ Bull', value: e.fact, inline: false }))),
              ...(signal.bearEvidence.slice(0, 1).map(e => ({ name: '⚠️ Bear', value: e.fact, inline: false }))),
            ],
            footer: { text: `T212 Portfolio Pro · ${ticker}` },
            timestamp: new Date().toISOString(),
          };
          await postDiscordAlert(embed);
          await cache.setEx(countKey, 86400, String(alertCount + 1)).catch(() => {});
        }

        // Save current state for next check
        await cache.setEx(prevKey, 86400, JSON.stringify({ signal: signal.signal, confidence: signal.confidence, rsi: signal.rsi, nearSupport: false })).catch(() => {});
        await new Promise(r => setTimeout(r, 1000)); // throttle
      } catch {}
    }
  } catch (e) {
    console.error('[alerts]', e.message);
  }
}

let alertsInterval = null;

function scheduleAlertsJob() {
  if (alertsInterval) return;
  // Run every 10 minutes (not every 5 to be gentle on quota)
  alertsInterval = setInterval(async () => {
    const { nyseOpen } = require('../services/macroService').getMarketStatus();
    if (nyseOpen) {
      console.log('[alerts] Running alert check...');
      checkAlerts().catch(e => console.error('[alerts]', e.message));
    }
  }, 10 * 60 * 1000);
  console.log('[alerts] Alert job scheduled (every 10min, market hours only)');
}

module.exports = { scheduleAlertsJob, checkAlerts };
