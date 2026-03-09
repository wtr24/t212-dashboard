const { Pool } = require('pg');

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

async function initDB() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS positions (
      id SERIAL PRIMARY KEY,
      ticker VARCHAR(20) UNIQUE NOT NULL,
      quantity DECIMAL,
      avg_price DECIMAL,
      current_price DECIMAL,
      pnl DECIMAL,
      pnl_pct DECIMAL,
      market_value DECIMAL,
      raw_data JSONB,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS community_sentiment (
      id SERIAL PRIMARY KEY,
      ticker VARCHAR(20) UNIQUE NOT NULL,
      bullish_pct DECIMAL,
      bearish_pct DECIMAL,
      neutral_pct DECIMAL,
      raw_data JSONB,
      scraped_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ai_analysis (
      id SERIAL PRIMARY KEY,
      ticker VARCHAR(20) UNIQUE NOT NULL,
      outlook VARCHAR(20),
      confidence INTEGER,
      reason TEXT,
      risk_level VARCHAR(10),
      raw_data JSONB,
      analysed_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS dividends (
      id SERIAL PRIMARY KEY,
      ticker VARCHAR(20),
      amount DECIMAL,
      currency VARCHAR(10),
      paid_date DATE,
      raw_data JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      order_id VARCHAR(100) UNIQUE,
      ticker VARCHAR(20),
      order_type VARCHAR(20),
      quantity DECIMAL,
      price DECIMAL,
      value DECIMAL,
      status VARCHAR(20),
      filled_at TIMESTAMP,
      raw_data JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      transaction_id VARCHAR(100) UNIQUE,
      type VARCHAR(50),
      amount DECIMAL,
      currency VARCHAR(10),
      reference VARCHAR(200),
      transacted_at TIMESTAMP,
      raw_data JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS pies (
      id SERIAL PRIMARY KEY,
      pie_id VARCHAR(100) UNIQUE,
      name VARCHAR(200),
      value DECIMAL,
      return_pct DECIMAL,
      raw_data JSONB,
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS job_runs (
      id SERIAL PRIMARY KEY,
      job_name VARCHAR(100),
      status VARCHAR(20),
      records_affected INTEGER,
      error_message TEXT,
      ran_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

async function query(sql, params) {
  if (!pool) return { rows: [] };
  return pool.query(sql, params);
}

module.exports = { pool, initDB, query };
