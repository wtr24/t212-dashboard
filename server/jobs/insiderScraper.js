const openinsider = require('../scrapers/insiderOpenInsider');
const { seedIfEmpty } = require('../scrapers/insiderSeed');
const { invalidateCache } = require('../services/insiderService');
const cache = require('../services/cache');

async function runAllScrapers() {
  const results = { openinsider: null, seeded: 0 };

  try {
    results.openinsider = await openinsider.run();
    console.log(`[insider] OpenInsider: found=${results.openinsider.found} inserted=${results.openinsider.inserted} updated=${results.openinsider.updated}`);
  } catch (e) {
    console.error('[insider] OpenInsider failed:', e.message);
    results.openinsider = { error: e.message };
  }

  const { seeded } = await seedIfEmpty().catch(() => ({ seeded: 0 }));
  if (seeded > 0) {
    console.log(`[insider] Seeded ${seeded} sample trades`);
    results.seeded = seeded;
  }

  await invalidateCache().catch(() => {});
  await cache.setEx('insider:last_run', 86400, Date.now().toString());
  await cache.del('insider:scraping');
  return results;
}

async function scheduleIfDue() {
  const isRunning = await cache.get('insider:scraping').catch(() => null);
  if (isRunning) return { status: 'already_running' };
  const lastRun = await cache.get('insider:last_run').catch(() => null);
  if (lastRun && Date.now() - parseInt(lastRun) < 5 * 60 * 1000) return { status: 'skipped' };
  return triggerScrape();
}

async function triggerScrape() {
  const isRunning = await cache.get('insider:scraping').catch(() => null);
  if (isRunning) return { status: 'already_running' };
  await cache.setEx('insider:scraping', 120, '1');
  return runAllScrapers();
}

module.exports = { runAllScrapers, scheduleIfDue, triggerScrape };
