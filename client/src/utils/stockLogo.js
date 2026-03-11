import { useState } from 'react';

const TICKER_COLORS = [
  '#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444',
  '#06b6d4','#ec4899','#84cc16','#f97316','#6366f1',
];

function tickerColor(ticker) {
  let h = 0;
  for (let i = 0; i < ticker.length; i++) h = ticker.charCodeAt(i) + ((h << 5) - h);
  return TICKER_COLORS[Math.abs(h) % TICKER_COLORS.length];
}

function initials(ticker) {
  return ticker.replace(/[^A-Z]/g, '').slice(0, 2) || ticker.slice(0, 2).toUpperCase();
}

const SIZE_MAP = { sm: 24, md: 32, lg: 48, xl: 64 };

export function StockLogo({ ticker, size = 'md', style = {} }) {
  const px = SIZE_MAP[size] || SIZE_MAP.md;
  const [src, setSrc] = useState(`https://assets.parqet.com/logos/symbol/${ticker}?format=svg`);
  const [failed, setFailed] = useState(false);

  const handleError = () => {
    if (src.includes('parqet')) {
      setSrc(`https://financialmodelingprep.com/image-stock/${ticker}.png`);
    } else {
      setFailed(true);
    }
  };

  const base = {
    width: px, height: px, borderRadius: px * 0.22,
    flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', ...style,
  };

  if (failed) {
    return (
      <div style={{ ...base, background: tickerColor(ticker), color: '#fff', fontSize: px * 0.36, fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>
        {initials(ticker)}
      </div>
    );
  }

  return (
    <div style={{ ...base, background: 'rgba(255,255,255,0.06)' }}>
      <img
        src={src}
        alt={ticker}
        onError={handleError}
        style={{ width: '100%', height: '100%', objectFit: 'contain', padding: px * 0.1 }}
      />
    </div>
  );
}

export { tickerColor, initials };
