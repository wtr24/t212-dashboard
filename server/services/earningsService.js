const { query } = require('../models/db');
const cache = require('./cache');

async function upsertEarning(data) {
  const {
    ticker, company, report_date, report_time, fiscal_quarter, fiscal_year,
    eps_estimate, eps_actual, eps_surprise, eps_surprise_pct,
    revenue_estimate, revenue_actual, revenue_surprise_pct,
    guidance_eps_low, guidance_eps_high, analyst_count, status, source
  } = data;
  await query(
    `INSERT INTO earnings_calendar
      (ticker,company,report_date,report_time,fiscal_quarter,fiscal_year,
       eps_estimate,eps_actual,eps_surprise,eps_surprise_pct,
       revenue_estimate,revenue_actual,revenue_surprise_pct,
       guidance_eps_low,guidance_eps_high,analyst_count,status,source,updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,NOW())
     ON CONFLICT (ticker, report_date) DO UPDATE SET
       company=COALESCE(EXCLUDED.company,earnings_calendar.company),
       report_time=COALESCE(EXCLUDED.report_time,earnings_calendar.report_time),
       fiscal_quarter=COALESCE(EXCLUDED.fiscal_quarter,earnings_calendar.fiscal_quarter),
       fiscal_year=COALESCE(EXCLUDED.fiscal_year,earnings_calendar.fiscal_year),
       eps_estimate=COALESCE(EXCLUDED.eps_estimate,earnings_calendar.eps_estimate),
       eps_actual=COALESCE(EXCLUDED.eps_actual,earnings_calendar.eps_actual),
       eps_surprise=COALESCE(EXCLUDED.eps_surprise,earnings_calendar.eps_surprise),
       eps_surprise_pct=COALESCE(EXCLUDED.eps_surprise_pct,earnings_calendar.eps_surprise_pct),
       revenue_estimate=COALESCE(EXCLUDED.revenue_estimate,earnings_calendar.revenue_estimate),
       revenue_actual=COALESCE(EXCLUDED.revenue_actual,earnings_calendar.revenue_actual),
       status=CASE WHEN EXCLUDED.status='reported' THEN 'reported' ELSE earnings_calendar.status END,
       source=COALESCE(EXCLUDED.source,earnings_calendar.source),
       updated_at=NOW()`,
    [ticker,company,report_date,report_time||'TNS',fiscal_quarter,fiscal_year,
     eps_estimate,eps_actual,eps_surprise,eps_surprise_pct,
     revenue_estimate,revenue_actual,revenue_surprise_pct,
     guidance_eps_low,guidance_eps_high,analyst_count,status||'upcoming',source]
  );
}

async function updateActuals(ticker, reportDate, epsActual, revenueActual) {
  const epsEst = await query(
    'SELECT eps_estimate FROM earnings_calendar WHERE ticker=$1 AND report_date=$2',
    [ticker, reportDate]
  ).then(r => r.rows[0]?.eps_estimate).catch(() => null);

  const surprise = epsEst != null && epsActual != null ? epsActual - epsEst : null;
  const surprisePct = epsEst && surprise != null ? (surprise / Math.abs(epsEst)) * 100 : null;

  await query(
    `UPDATE earnings_calendar SET
       eps_actual=$3, eps_surprise=$4, eps_surprise_pct=$5,
       revenue_actual=COALESCE($6,revenue_actual),
       status='reported', updated_at=NOW()
     WHERE ticker=$1 AND report_date=$2`,
    [ticker, reportDate, epsActual, surprise, surprisePct, revenueActual]
  ).catch(() => {});
}

async function upsertAnalystTarget(data) {
  const { ticker, analyst_firm, rating, price_target, previous_target, target_date } = data;
  await query(
    `INSERT INTO earnings_analyst_targets (ticker,analyst_firm,rating,price_target,previous_target,target_date)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (ticker,analyst_firm,target_date) DO UPDATE SET
       rating=EXCLUDED.rating, price_target=EXCLUDED.price_target, previous_target=EXCLUDED.previous_target`,
    [ticker, analyst_firm, rating, price_target, previous_target, target_date]
  ).catch(() => {});
}

function getWeekBounds() {
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return [mon.toISOString().split('T')[0], sun.toISOString().split('T')[0]];
}

async function getEarningsToday() {
  const today = new Date().toISOString().split('T')[0];
  const { rows } = await query(
    'SELECT * FROM earnings_calendar WHERE report_date=$1 ORDER BY report_time,ticker',
    [today]
  ).catch(() => ({ rows: [] }));
  return rows;
}

async function getEarningsThisWeek() {
  const [mon, sun] = getWeekBounds();
  const { rows } = await query(
    'SELECT * FROM earnings_calendar WHERE report_date BETWEEN $1 AND $2 ORDER BY report_date,report_time,ticker',
    [mon, sun]
  ).catch(() => ({ rows: [] }));
  return rows;
}

async function getEarningsThisMonth() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  const { rows } = await query(
    'SELECT * FROM earnings_calendar WHERE report_date BETWEEN $1 AND $2 ORDER BY report_date,ticker',
    [start, end]
  ).catch(() => ({ rows: [] }));
  return rows;
}

async function getHistoricalEarnings(ticker) {
  const { rows } = await query(
    'SELECT * FROM earnings_calendar WHERE ticker=$1 ORDER BY report_date DESC',
    [ticker.toUpperCase()]
  ).catch(() => ({ rows: [] }));
  return rows;
}

async function getPastEarnings(weeksBack = 8) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - weeksBack * 7);
  const today = new Date().toISOString().split('T')[0];
  const { rows } = await query(
    `SELECT * FROM earnings_calendar WHERE report_date BETWEEN $1 AND $2 ORDER BY report_date DESC`,
    [cutoff.toISOString().split('T')[0], today]
  ).catch(() => ({ rows: [] }));
  return rows;
}

async function getMyPortfolioEarnings() {
  const { rows } = await query(
    `SELECT ec.* FROM earnings_calendar ec
     INNER JOIN positions p ON ec.ticker = REGEXP_REPLACE(p.ticker,'_[A-Z_]+$','')
     ORDER BY ec.report_date`
  ).catch(() => ({ rows: [] }));
  return rows;
}

async function getScraperStatus() {
  const { rows } = await query(
    'SELECT COUNT(*) as total, MIN(report_date) as earliest, MAX(report_date) as latest FROM earnings_calendar'
  ).catch(() => ({ rows: [] }));
  return rows[0] || { total: 0 };
}

module.exports = {
  upsertEarning, updateActuals, upsertAnalystTarget,
  getEarningsToday, getEarningsThisWeek, getEarningsThisMonth,
  getHistoricalEarnings, getPastEarnings, getMyPortfolioEarnings, getScraperStatus
};
