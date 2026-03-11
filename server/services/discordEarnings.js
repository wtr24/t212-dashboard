const https = require('https');

const WEBHOOK = process.env.DISCORD_EARNINGS_WEBHOOK
  || 'https://discord.com/api/webhooks/1479759008784060448/ArMyvxpZcT5zHRmloO1Po0prGSm_3bYXo9Nq0iOFVMYvuYYR5H21T2QvUA2ku6AHeiay';

const SIGNALS = {
  BUY:     { emoji: '🟢', label: 'BUY',        color: 0x10b981, bar: '█████████░' },
  HOLD:    { emoji: '🟡', label: 'HOLD',       color: 0xf59e0b, bar: '█████░░░░░' },
  SELL:    { emoji: '🔴', label: 'SELL',       color: 0xef4444, bar: '██░░░░░░░░' },
  PENDING: { emoji: '⏳', label: 'AI PENDING', color: 0x6366f1, bar: '░░░░░░░░░░' },
};

const TIME_LABELS = {
  'Pre-Mkt':  { emoji: '🌅', label: 'Before Market Open' },
  'BMO':      { emoji: '🌅', label: 'Before Market Open' },
  'After-Hrs':{ emoji: '🌆', label: 'After Market Close' },
  'AMC':      { emoji: '🌆', label: 'After Market Close' },
  'TBD':      { emoji: '🕐', label: 'Time TBD' },
  'TNS':      { emoji: '🕐', label: 'Time TBD' },
};

const SENTIMENT = { POSITIVE: '📈', NEGATIVE: '📉', MIXED: '↕️', NEUTRAL: '➡️' };

const sleep = ms => new Promise(r => setTimeout(r, ms));

function formatRevenue(num) {
  if (!num) return '—';
  if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(0)}M`;
  return `$${Number(num).toLocaleString()}`;
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function buildSingleEarningEmbed(e) {
  const sig = SIGNALS[e.ai_signal] || SIGNALS.PENDING;
  const timeInfo = TIME_LABELS[e.report_time] || TIME_LABELS.TBD;
  const logoUrl = `https://assets.parqet.com/logos/symbol/${e.ticker}?format=png`;

  const fields = [
    {
      name: '📊 EPS Estimate',
      value: e.eps_estimate != null ? `$${Number(e.eps_estimate).toFixed(2)}` : '—',
      inline: true,
    },
    {
      name: '💰 Rev Estimate',
      value: formatRevenue(e.revenue_estimate),
      inline: true,
    },
  ];

  if (e.ai_beat_probability != null) {
    fields.push({
      name: '🎯 Beat Probability',
      value: `${sig.bar} **${e.ai_beat_probability}%**`,
      inline: false,
    });
  }

  if (e.ai_summary) {
    const sentEmoji = SENTIMENT[e.ai_sentiment] || '🤖';
    const summary = e.ai_summary.slice(0, 200) + (e.ai_summary.length > 200 ? '...' : '');
    fields.push({ name: `${sentEmoji} AI Analysis`, value: `> ${summary}`, inline: false });
  }

  const factors = Array.isArray(e.ai_key_factors) ? e.ai_key_factors : (typeof e.ai_key_factors === 'string' ? JSON.parse(e.ai_key_factors || '[]') : []);
  const risks = Array.isArray(e.ai_risks) ? e.ai_risks : (typeof e.ai_risks === 'string' ? JSON.parse(e.ai_risks || '[]') : []);

  if (factors.length) fields.push({ name: '✅ Key Catalysts', value: factors.slice(0, 3).map(f => `• ${f}`).join('\n'), inline: true });
  if (risks.length) fields.push({ name: '⚠️ Key Risks', value: risks.slice(0, 2).map(r => `• ${r}`).join('\n'), inline: true });

  const footerText = e.ai_signal && e.ai_generated_at
    ? `Gemini AI · ${new Date(e.ai_generated_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
    : 'AI analysis pending · run from dashboard';

  return {
    color: sig.color,
    author: { name: `${e.ticker} · ${e.company || ''}`, icon_url: logoUrl },
    title: `${sig.emoji} ${sig.label}${e.ai_confidence ? `  ${e.ai_confidence}% confidence` : ''}`,
    description: `${timeInfo.emoji} **${timeInfo.label}**${e.fiscal_quarter ? `  ·  ${e.fiscal_quarter}` : ''}${e.in_portfolio ? '  ⭐ **YOUR HOLDING**' : ''}`,
    fields,
    footer: { text: footerText },
    timestamp: new Date().toISOString(),
  };
}

function buildDailySummaryEmbed(earnings, date) {
  const bmo = earnings.filter(e => ['Pre-Mkt', 'BMO'].includes(e.report_time));
  const amc = earnings.filter(e => ['After-Hrs', 'AMC'].includes(e.report_time));
  const withAI = earnings.filter(e => e.ai_signal);
  const buys = earnings.filter(e => e.ai_signal === 'BUY').length;
  const sells = earnings.filter(e => e.ai_signal === 'SELL').length;
  const holds = earnings.filter(e => e.ai_signal === 'HOLD').length;
  const myStocks = earnings.filter(e => e.in_portfolio);

  let desc = `**${earnings.length} companies** reporting today\n`;
  if (myStocks.length) {
    desc += `⭐ **Your holdings:** ${myStocks.map(e => e.ticker).join(', ')}\n`;
  }
  desc += `\n🌅 Before Open: **${bmo.length}**  ·  🌆 After Close: **${amc.length}**`;

  return {
    color: 0x3b82f6,
    title: `📅 Earnings Calendar · ${formatDate(date)}`,
    description: desc,
    fields: [
      {
        name: `🤖 AI Signals (${withAI.length}/${earnings.length} analysed)`,
        value: `🟢 Buy: **${buys}**  ·  🟡 Hold: **${holds}**  ·  🔴 Sell: **${sells}**`,
        inline: false,
      },
    ],
    footer: { text: 'T212 Portfolio Dashboard · Powered by Gemini AI' },
    timestamp: new Date().toISOString(),
  };
}

function postToWebhook(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const url = new URL(WEBHOOK);
    const opts = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    };
    const req = https.request(opts, res => {
      let d = '';
      res.on('data', c => { d += c; });
      res.on('end', () => {
        if (res.statusCode === 204 || res.statusCode === 200) resolve(true);
        else reject(new Error(`Discord ${res.statusCode}: ${d.slice(0, 200)}`));
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Discord webhook timeout')); });
    req.write(body);
    req.end();
  });
}

function sortEarnings(earnings) {
  const sigOrder = { BUY: 0, HOLD: 1, SELL: 2 };
  const timeOrder = { 'Pre-Mkt': 0, 'BMO': 0, 'After-Hrs': 1, 'AMC': 1, 'TBD': 2, 'TNS': 2 };
  return [...earnings].sort((a, b) => {
    if (a.in_portfolio !== b.in_portfolio) return a.in_portfolio ? -1 : 1;
    const sA = sigOrder[a.ai_signal] ?? 3;
    const sB = sigOrder[b.ai_signal] ?? 3;
    if (sA !== sB) return sA - sB;
    const tA = timeOrder[a.report_time] ?? 2;
    const tB = timeOrder[b.report_time] ?? 2;
    if (tA !== tB) return tA - tB;
    return (b.ai_confidence || 0) - (a.ai_confidence || 0);
  });
}

async function sendEarningsToDiscord(earnings) {
  if (!earnings.length) { console.log('[discord] No earnings to send'); return; }

  const today = new Date().toISOString().split('T')[0];
  const sorted = sortEarnings(earnings);

  await postToWebhook({ embeds: [buildDailySummaryEmbed(sorted, today)] });
  await sleep(1500);

  const portfolio = sorted.filter(e => e.in_portfolio);
  const bmo = sorted.filter(e => !e.in_portfolio && ['Pre-Mkt', 'BMO'].includes(e.report_time));
  const amc = sorted.filter(e => !e.in_portfolio && ['After-Hrs', 'AMC'].includes(e.report_time));
  const other = sorted.filter(e => !e.in_portfolio && !['Pre-Mkt', 'BMO', 'After-Hrs', 'AMC'].includes(e.report_time));

  async function sendBatches(items, headerContent) {
    for (let i = 0; i < items.length; i += 10) {
      const batch = items.slice(i, i + 10);
      const payload = { embeds: batch.map(buildSingleEarningEmbed) };
      if (i === 0 && headerContent) payload.content = headerContent;
      await postToWebhook(payload);
      if (i + 10 < items.length) await sleep(1500);
    }
  }

  if (portfolio.length) { await sendBatches(portfolio, '⭐ **YOUR PORTFOLIO EARNINGS TODAY**'); await sleep(1500); }
  if (bmo.length) { await sendBatches(bmo, '🌅 **BEFORE MARKET OPEN**'); await sleep(1500); }
  if (amc.length) { await sendBatches(amc, '🌆 **AFTER MARKET CLOSE**'); await sleep(1500); }
  if (other.length) { await sendBatches(other, '🕐 **TIME TBD**'); }

  console.log(`[discord] Sent ${earnings.length} earnings (${portfolio.length} portfolio, ${bmo.length} BMO, ${amc.length} AMC)`);
}

module.exports = { sendEarningsToDiscord, buildSingleEarningEmbed, buildDailySummaryEmbed, postToWebhook };
