const { Pool } = require('pg');

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, max: 10, idleTimeoutMillis: 30000 })
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

    CREATE TABLE IF NOT EXISTS account_cache (
      id SERIAL PRIMARY KEY,
      key VARCHAR(50) UNIQUE NOT NULL,
      raw_data JSONB,
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

    CREATE TABLE IF NOT EXISTS congress_trades (
      id SERIAL PRIMARY KEY,
      member_name VARCHAR(200) NOT NULL,
      chamber VARCHAR(10),
      party VARCHAR(1),
      state VARCHAR(2),
      ticker VARCHAR(20),
      asset_name VARCHAR(500),
      asset_type VARCHAR(50),
      transaction_type VARCHAR(20),
      amount_range VARCHAR(50),
      amount_min BIGINT,
      amount_max BIGINT,
      transaction_date DATE,
      disclosure_date DATE,
      source VARCHAR(50),
      source_url TEXT,
      raw_data JSONB,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(member_name, ticker, transaction_date, transaction_type, amount_range)
    );

    CREATE INDEX IF NOT EXISTS idx_congress_member ON congress_trades(member_name);
    CREATE INDEX IF NOT EXISTS idx_congress_ticker ON congress_trades(ticker);
    CREATE INDEX IF NOT EXISTS idx_congress_date ON congress_trades(transaction_date DESC);
    CREATE INDEX IF NOT EXISTS idx_congress_type ON congress_trades(transaction_type);
    CREATE INDEX IF NOT EXISTS idx_congress_party ON congress_trades(party);
    CREATE INDEX IF NOT EXISTS idx_congress_chamber ON congress_trades(chamber);

    CREATE TABLE IF NOT EXISTS insider_trades (
      id SERIAL PRIMARY KEY,
      ticker VARCHAR(20) NOT NULL,
      company_name VARCHAR(500),
      insider_name VARCHAR(200) NOT NULL,
      title VARCHAR(100),
      trade_type VARCHAR(50),
      price DECIMAL,
      qty BIGINT,
      owned_after BIGINT,
      delta_own_pct DECIMAL,
      value DECIMAL,
      trade_date DATE,
      filing_date DATE,
      source VARCHAR(50),
      raw_data JSONB,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(ticker, insider_name, trade_date, trade_type, qty)
    );

    CREATE INDEX IF NOT EXISTS idx_insider_ticker ON insider_trades(ticker);
    CREATE INDEX IF NOT EXISTS idx_insider_name ON insider_trades(insider_name);
    CREATE INDEX IF NOT EXISTS idx_insider_date ON insider_trades(trade_date DESC);
    CREATE INDEX IF NOT EXISTS idx_insider_type ON insider_trades(trade_type);
    CREATE INDEX IF NOT EXISTS idx_insider_value ON insider_trades(value DESC);

    CREATE TABLE IF NOT EXISTS sp500_stocks (
      id SERIAL PRIMARY KEY,
      ticker VARCHAR(20) UNIQUE NOT NULL,
      company VARCHAR(300),
      sector VARCHAR(100),
      sub_industry VARCHAR(200),
      last_updated TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_sp500_ticker ON sp500_stocks(ticker);
    CREATE INDEX IF NOT EXISTS idx_sp500_sector ON sp500_stocks(sector);
  `);

  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'insider_trades_unique_key'
      ) THEN
        ALTER TABLE insider_trades
          ADD CONSTRAINT insider_trades_unique_key
          UNIQUE (ticker, insider_name, trade_date, trade_type, qty);
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS insider_scraper_runs (
      id SERIAL PRIMARY KEY,
      source VARCHAR(50),
      started_at TIMESTAMP DEFAULT NOW(),
      completed_at TIMESTAMP,
      records_found INTEGER DEFAULT 0,
      records_inserted INTEGER DEFAULT 0,
      records_updated INTEGER DEFAULT 0,
      error TEXT,
      duration_ms INTEGER
    );
  `);

  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'congress_trades_unique_key'
      ) THEN
        ALTER TABLE congress_trades
          ADD CONSTRAINT congress_trades_unique_key
          UNIQUE (member_name, ticker, transaction_date, transaction_type, amount_range);
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS scraper_runs (
      id SERIAL PRIMARY KEY,
      source VARCHAR(50),
      started_at TIMESTAMP DEFAULT NOW(),
      completed_at TIMESTAMP,
      records_found INTEGER DEFAULT 0,
      records_inserted INTEGER DEFAULT 0,
      records_updated INTEGER DEFAULT 0,
      error TEXT,
      duration_ms INTEGER
    );
  `);
}

async function query(sql, params) {
  if (!pool) return { rows: [] };
  return pool.query(sql, params);
}

module.exports = { pool, initDB, query };
