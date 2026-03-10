import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart } from 'lightweight-charts';
import axios from 'axios';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:5002/api';

const TIMEFRAMES = [
  { label: '1D', range: '1d' },
  { label: '5D', range: '5d' },
  { label: '1M', range: '1mo' },
  { label: '3M', range: '3mo' },
  { label: '1Y', range: '1y' },
  { label: 'ALL', range: '5y' },
];

const CHART_THEME = {
  background: { type: 'solid', color: 'transparent' },
  layout: { textColor: '#475569', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' },
  grid: { vertLines: { color: 'rgba(255,255,255,0.04)' }, horzLines: { color: 'rgba(255,255,255,0.04)' } },
  crosshair: { mode: 1, vertLine: { color: 'rgba(59,130,246,0.5)', style: 0, labelBackgroundColor: '#3b82f6' }, horzLine: { color: 'rgba(59,130,246,0.5)', style: 0, labelBackgroundColor: '#3b82f6' } },
  rightPriceScale: { borderColor: 'rgba(255,255,255,0.06)', textColor: '#475569' },
  timeScale: { borderColor: 'rgba(255,255,255,0.06)', timeVisible: true, secondsVisible: false },
};

export default function TradingChart({ ticker = 'SPY', height = 380, onQuoteUpdate }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const mainSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const resizeObserverRef = useRef(null);

  const [chartType, setChartType] = useState('candlestick');
  const [timeframe, setTimeframe] = useState('1mo');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quote, setQuote] = useState(null);

  const buildMainSeries = useCallback((chart, type) => {
    if (mainSeriesRef.current) { try { chart.removeSeries(mainSeriesRef.current); } catch {} }
    if (type === 'candlestick') {
      mainSeriesRef.current = chart.addCandlestickSeries({
        upColor: '#10b981', downColor: '#ef4444',
        borderUpColor: '#10b981', borderDownColor: '#ef4444',
        wickUpColor: '#10b981', wickDownColor: '#ef4444',
        priceScaleId: 'right',
      });
    } else if (type === 'area') {
      mainSeriesRef.current = chart.addAreaSeries({
        topColor: 'rgba(59,130,246,0.25)', bottomColor: 'rgba(59,130,246,0)',
        lineColor: '#3b82f6', lineWidth: 2, crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4, crosshairMarkerBackgroundColor: '#3b82f6',
        priceScaleId: 'right',
      });
    } else {
      mainSeriesRef.current = chart.addLineSeries({
        color: '#3b82f6', lineWidth: 2, crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4, crosshairMarkerBackgroundColor: '#3b82f6',
        priceScaleId: 'right',
      });
    }
    return mainSeriesRef.current;
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      ...CHART_THEME,
      width: containerRef.current.clientWidth,
      height: height - 60,
      handleScroll: true,
      handleScale: true,
    });
    chartRef.current = chart;

    volumeSeriesRef.current = chart.addHistogramSeries({
      color: 'rgba(59,130,246,0.2)',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });

    buildMainSeries(chart, 'candlestick');

    resizeObserverRef.current = new ResizeObserver(entries => {
      if (entries[0] && chartRef.current) {
        chartRef.current.applyOptions({ width: entries[0].contentRect.width });
      }
    });
    resizeObserverRef.current.observe(containerRef.current);

    return () => {
      resizeObserverRef.current?.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [height, buildMainSeries]);

  useEffect(() => {
    if (!chartRef.current || !ticker) return;
    setLoading(true);
    setError(null);

    const series = buildMainSeries(chartRef.current, chartType);

    axios.get(`${BASE}/stocks/history/${ticker}?range=${timeframe}`)
      .then(res => {
        const data = res.data || [];
        if (!data.length) { setError('No data'); setLoading(false); return; }

        const mainData = chartType === 'candlestick'
          ? data.map(d => ({ time: d.time, open: d.open, high: d.high, low: d.low, close: d.close }))
          : data.map(d => ({ time: d.time, value: d.close }));

        series.setData(mainData);

        volumeSeriesRef.current?.setData(data.map(d => ({
          time: d.time,
          value: d.volume,
          color: d.close >= d.open ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)',
        })));

        chartRef.current.timeScale().fitContent();
        setLoading(false);
      })
      .catch(() => { setError('Failed to load data'); setLoading(false); });
  }, [ticker, timeframe, chartType, buildMainSeries]);

  useEffect(() => {
    if (!ticker) return;
    axios.get(`${BASE}/stocks/quote/${ticker}`)
      .then(res => {
        setQuote(res.data);
        if (onQuoteUpdate) onQuoteUpdate(res.data);
      })
      .catch(() => {});
  }, [ticker, onQuoteUpdate]);

  const isPos = (quote?.changePct || 0) >= 0;

  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14 }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>{ticker}</span>
          {quote && (
            <>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 22, fontWeight: 500, color: '#f1f5f9' }}>${(quote.price || 0).toFixed(2)}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: isPos ? '#10b981' : '#ef4444' }}>
                {isPos ? '+' : ''}{(quote.changePct || 0).toFixed(2)}%
              </span>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {['candlestick', 'line', 'area'].map(t => (
            <button key={t} onClick={() => setChartType(t)}
              style={{ padding: '4px 10px', borderRadius: 7, border: `1px solid ${chartType === t ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.07)'}`, background: chartType === t ? 'rgba(59,130,246,0.12)' : 'transparent', color: chartType === t ? '#3b82f6' : '#475569', fontSize: 11, fontWeight: 500, cursor: 'pointer', textTransform: 'capitalize' }}>
              {t}
            </button>
          ))}
          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.08)' }} />
          {TIMEFRAMES.map(tf => (
            <button key={tf.range} onClick={() => setTimeframe(tf.range)}
              style={{ padding: '4px 8px', borderRadius: 7, border: `1px solid ${timeframe === tf.range ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.07)'}`, background: timeframe === tf.range ? 'rgba(59,130,246,0.12)' : 'transparent', color: timeframe === tf.range ? '#3b82f6' : '#475569', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'JetBrains Mono' }}>
              {tf.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ position: 'relative' }}>
        {(loading || error) && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, background: 'rgba(8,13,26,0.8)', borderRadius: '0 0 14px 14px' }}>
            {loading
              ? <div style={{ width: 28, height: 28, border: '2px solid rgba(59,130,246,0.3)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              : <span style={{ color: '#ef4444', fontSize: 13 }}>{error}</span>
            }
          </div>
        )}
        <div ref={containerRef} style={{ width: '100%', height: height - 60 }} />
      </div>
    </div>
  );
}
