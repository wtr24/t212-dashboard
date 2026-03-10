const house = require('../scrapers/congressHouseEFTS');
const senate = require('../scrapers/congressSenateEFTS');
const { seedIfEmpty } = require('../scrapers/congressSeed');
const { invalidateCache } = require('../services/congressService');
const cache = require('../services/cache');

async function runAllScrapers() {
  const results = { house: null, senate: null, seeded: 0 };

  try {
    results.house = await house.run();
    console.log(`[congress] House EFTS: found=${results.house.found} inserted=${results.house.inserted}`);
  } catch (e) {
    console.error('[congress] House EFTS failed:', e.message);
    results.house = { error: e.message };
  }

  try {
    results.senate = await senate.run();
    console.log(`[congress] Senate EFTS: found=${results.senate.found} inserted=${results.senate.inserted}`);
  } catch (e) {
    console.error('[congress] Senate EFTS failed:', e.message);
    results.senate = { error: e.message };
  }

  const { seeded } = await seedIfEmpty().catch(() => ({ seeded: 0 }));
  if (seeded > 0) {
    console.log(`[congress] Seeded ${seeded} sample trades`);
    results.seeded = seeded;
  }

  await invalidateCache().catch(() => {});
  await cache.set('congress:last_run', Date.now().toString(), 3600);
  return results;
}

async function scheduleIfDue() {
  const lastRun = await cache.get('congress:last_run').catch(() => null);
  if (lastRun && Date.now() - parseInt(lastRun) < 5 * 60 * 1000) return;
  return runAllScrapers();
}

module.exports = { runAllScrapers, scheduleIfDue };
