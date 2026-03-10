const quiver = require('../scrapers/congressQuiver');
const house = require('../scrapers/congressHouseEFTS');
const senate = require('../scrapers/congressSenateEFTS');
const { seedIfEmpty } = require('../scrapers/congressSeed');
const { invalidateCache } = require('../services/congressService');
const cache = require('../services/cache');

async function runAllScrapers() {
  const results = { quiver: null, house: null, senate: null, seeded: 0 };

  try {
    results.quiver = await quiver.run();
    console.log(`[congress] Quiverquant: found=${results.quiver.found} inserted=${results.quiver.inserted} updated=${results.quiver.updated}`);
  } catch (e) {
    console.error('[congress] Quiverquant failed:', e.message);
    results.quiver = { error: e.message };

    try {
      results.house = await house.run();
      console.log(`[congress] House EFTS fallback: found=${results.house.found}`);
    } catch (e2) {
      results.house = { error: e2.message };
    }

    try {
      results.senate = await senate.run();
      console.log(`[congress] Senate EFTS fallback: found=${results.senate.found}`);
    } catch (e3) {
      results.senate = { error: e3.message };
    }
  }

  const { seeded } = await seedIfEmpty().catch(() => ({ seeded: 0 }));
  if (seeded > 0) {
    console.log(`[congress] Seeded ${seeded} sample trades`);
    results.seeded = seeded;
  }

  await invalidateCache().catch(() => {});
  await cache.setEx('congress:last_run', 86400, Date.now().toString());
  await cache.del('congress:scraping');
  return results;
}

async function scheduleIfDue() {
  const isRunning = await cache.get('congress:scraping').catch(() => null);
  if (isRunning) return { status: 'already_running' };
  const lastRun = await cache.get('congress:last_run').catch(() => null);
  if (lastRun && Date.now() - parseInt(lastRun) < 5 * 60 * 1000) return { status: 'skipped' };
  return triggerScrape();
}

async function triggerScrape() {
  const isRunning = await cache.get('congress:scraping').catch(() => null);
  if (isRunning) return { status: 'already_running' };
  await cache.setEx('congress:scraping', 120, '1');
  return runAllScrapers();
}

module.exports = { runAllScrapers, scheduleIfDue, triggerScrape };
