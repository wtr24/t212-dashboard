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

    CREATE TABLE IF NOT EXISTS earnings_calendar (
      id SERIAL PRIMARY KEY,
      ticker VARCHAR(20) NOT NULL,
      company VARCHAR(200),
      report_date DATE NOT NULL,
      report_time VARCHAR(10) DEFAULT 'TNS',
      fiscal_quarter VARCHAR(10),
      fiscal_year INT,
      eps_estimate DECIMAL,
      eps_actual DECIMAL,
      eps_surprise DECIMAL,
      eps_surprise_pct DECIMAL,
      revenue_estimate BIGINT,
      revenue_actual BIGINT,
      revenue_surprise_pct DECIMAL,
      guidance_eps_low DECIMAL,
      guidance_eps_high DECIMAL,
      analyst_count INT,
      status VARCHAR(20) DEFAULT 'upcoming',
      source VARCHAR(50),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(ticker, report_date)
    );
    CREATE INDEX IF NOT EXISTS idx_earnings_date ON earnings_calendar(report_date);
    CREATE INDEX IF NOT EXISTS idx_earnings_ticker ON earnings_calendar(ticker);
    CREATE INDEX IF NOT EXISTS idx_earnings_status ON earnings_calendar(status);

    CREATE TABLE IF NOT EXISTS earnings_analyst_targets (
      id SERIAL PRIMARY KEY,
      ticker VARCHAR(20) NOT NULL,
      analyst_firm VARCHAR(100),
      rating VARCHAR(20),
      price_target DECIMAL,
      previous_target DECIMAL,
      target_date DATE,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(ticker, analyst_firm, target_date)
    );
    CREATE INDEX IF NOT EXISTS idx_analyst_ticker ON earnings_analyst_targets(ticker);

    CREATE TABLE IF NOT EXISTS earnings_ai_news (
      id SERIAL PRIMARY KEY,
      ticker VARCHAR(20),
      headline TEXT,
      source VARCHAR(100),
      sentiment VARCHAR(20),
      published_at TIMESTAMP,
      url TEXT,
      relevance_score INT,
      earnings_date DATE,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_earnings_news_ticker ON earnings_ai_news(ticker, earnings_date);

    CREATE TABLE IF NOT EXISTS app_settings (
      key VARCHAR(100) PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE earnings_calendar ADD COLUMN IF NOT EXISTS ai_signal VARCHAR(20);
    ALTER TABLE earnings_calendar ADD COLUMN IF NOT EXISTS ai_confidence INT;
    ALTER TABLE earnings_calendar ADD COLUMN IF NOT EXISTS ai_beat_probability INT;
    ALTER TABLE earnings_calendar ADD COLUMN IF NOT EXISTS ai_summary TEXT;
    ALTER TABLE earnings_calendar ADD COLUMN IF NOT EXISTS ai_sentiment VARCHAR(20);
    ALTER TABLE earnings_calendar ADD COLUMN IF NOT EXISTS ai_news_sentiment VARCHAR(20);
    ALTER TABLE earnings_calendar ADD COLUMN IF NOT EXISTS ai_analyst_trend VARCHAR(20);
    ALTER TABLE earnings_calendar ADD COLUMN IF NOT EXISTS ai_key_factors JSONB;
    ALTER TABLE earnings_calendar ADD COLUMN IF NOT EXISTS ai_risks JSONB;
    ALTER TABLE earnings_calendar ADD COLUMN IF NOT EXISTS ai_generated_at TIMESTAMP;
    ALTER TABLE earnings_calendar ADD COLUMN IF NOT EXISTS ai_model VARCHAR(50);
    CREATE INDEX IF NOT EXISTS idx_earnings_ai_generated ON earnings_calendar(ai_generated_at);

    INSERT INTO app_settings (key, value) VALUES
      ('earnings_ai_run_time', '07:00'),
      ('earnings_ai_enabled', 'true'),
      ('earnings_ai_last_run', NULL),
      ('earnings_ai_last_run_count', '0'),
      ('earnings_discord_time', '07:00'),
      ('earnings_discord_enabled', 'true'),
      ('discord_earnings_last_sent', NULL)
    ON CONFLICT (key) DO NOTHING;

    CREATE TABLE IF NOT EXISTS gemini_usage (
      id SERIAL PRIMARY KEY,
      model VARCHAR(50) NOT NULL,
      date DATE NOT NULL DEFAULT CURRENT_DATE,
      requests_today INT DEFAULT 0,
      tokens_used INT DEFAULT 0,
      last_request_at TIMESTAMP,
      UNIQUE(model, date)
    );
    CREATE INDEX IF NOT EXISTS idx_gemini_usage_date ON gemini_usage(model, date);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS technical_analysis (
      id SERIAL PRIMARY KEY,
      ticker VARCHAR(20) NOT NULL,
      analysed_at TIMESTAMP DEFAULT NOW(),
      current_price DECIMAL, prev_close DECIMAL, open_price DECIMAL,
      day_high DECIMAL, day_low DECIMAL, week_52_high DECIMAL, week_52_low DECIMAL,
      price_vs_52w_pct DECIMAL,
      ma_20 DECIMAL, ma_50 DECIMAL, ma_200 DECIMAL, ema_12 DECIMAL, ema_26 DECIMAL,
      price_vs_ma50_pct DECIMAL, price_vs_ma200_pct DECIMAL, ma50_vs_ma200_pct DECIMAL,
      golden_cross BOOLEAN, death_cross BOOLEAN, trend VARCHAR(20),
      rsi_14 DECIMAL, rsi_signal VARCHAR(20),
      macd DECIMAL, macd_signal DECIMAL, macd_histogram DECIMAL, macd_trend VARCHAR(20),
      stoch_k DECIMAL, stoch_d DECIMAL, stoch_signal VARCHAR(20),
      atr_14 DECIMAL, atr_pct DECIMAL,
      bollinger_upper DECIMAL, bollinger_mid DECIMAL, bollinger_lower DECIMAL,
      bollinger_width DECIMAL, bollinger_position VARCHAR(20),
      volume_today BIGINT, volume_avg_20d BIGINT, volume_ratio DECIMAL,
      volume_trend VARCHAR(20), obv BIGINT, obv_trend VARCHAR(20),
      support_1 DECIMAL, support_2 DECIMAL, resistance_1 DECIMAL, resistance_2 DECIMAL,
      nearest_support DECIMAL, nearest_resistance DECIMAL,
      distance_to_support_pct DECIMAL, distance_to_resistance_pct DECIMAL,
      technical_score INT, technical_grade VARCHAR(5), technical_signal VARCHAR(20),
      bull_signals INT, bear_signals INT, neutral_signals INT,
      signal_details JSONB,
      UNIQUE(ticker)
    );
    CREATE INDEX IF NOT EXISTS idx_ta_ticker ON technical_analysis(ticker);
    CREATE INDEX IF NOT EXISTS idx_ta_analysed ON technical_analysis(analysed_at);
    CREATE INDEX IF NOT EXISTS idx_ta_score ON technical_analysis(technical_score DESC);

    ALTER TABLE earnings_calendar ADD COLUMN IF NOT EXISTS market_cap BIGINT;
    ALTER TABLE earnings_calendar ADD COLUMN IF NOT EXISTS analyst_strong_buy INT;
    ALTER TABLE earnings_calendar ADD COLUMN IF NOT EXISTS analyst_buy INT;
    ALTER TABLE earnings_calendar ADD COLUMN IF NOT EXISTS analyst_hold INT;
    ALTER TABLE earnings_calendar ADD COLUMN IF NOT EXISTS analyst_sell INT;
    ALTER TABLE earnings_calendar ADD COLUMN IF NOT EXISTS analyst_strong_sell INT;
    ALTER TABLE earnings_calendar ADD COLUMN IF NOT EXISTS eps_estimate_low DECIMAL;
    ALTER TABLE earnings_calendar ADD COLUMN IF NOT EXISTS eps_estimate_high DECIMAL;
    ALTER TABLE earnings_calendar ADD COLUMN IF NOT EXISTS revenue_estimate_low BIGINT;
    ALTER TABLE earnings_calendar ADD COLUMN IF NOT EXISTS revenue_estimate_high BIGINT;
    ALTER TABLE earnings_calendar ADD COLUMN IF NOT EXISTS analyst_target_price DECIMAL;
    ALTER TABLE earnings_calendar ADD COLUMN IF NOT EXISTS analyst_recommendation VARCHAR(20);
    ALTER TABLE earnings_calendar ADD COLUMN IF NOT EXISTS pe_ratio DECIMAL;
    ALTER TABLE earnings_calendar ADD COLUMN IF NOT EXISTS profit_margin DECIMAL;
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

    CREATE TABLE IF NOT EXISTS api_usage (
      api_name VARCHAR(50) NOT NULL,
      date DATE NOT NULL DEFAULT CURRENT_DATE,
      requests_today INT DEFAULT 0,
      last_request_at TIMESTAMP,
      PRIMARY KEY (api_name, date)
    );

    CREATE TABLE IF NOT EXISTS trading_journal (
      id SERIAL PRIMARY KEY,
      ticker VARCHAR(20) NOT NULL,
      action VARCHAR(10) NOT NULL,
      entry_price DECIMAL,
      quantity DECIMAL,
      entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
      exit_price DECIMAL,
      exit_date DATE,
      thesis TEXT,
      signal_at_entry VARCHAR(20),
      confidence_at_entry INT,
      evidence_at_entry JSONB,
      stop_loss DECIMAL,
      target_price DECIMAL,
      outcome VARCHAR(20),
      pnl DECIMAL,
      pnl_pct DECIMAL,
      notes TEXT,
      tags VARCHAR(100)[],
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_journal_ticker ON trading_journal(ticker);
    CREATE INDEX IF NOT EXISTS idx_journal_date ON trading_journal(entry_date DESC);
  `);
}

async function query(sql, params) {
  if (!pool) return { rows: [] };
  return pool.query(sql, params);
}

module.exports = { pool, initDB, query };
