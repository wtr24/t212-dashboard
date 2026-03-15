import { useState, useEffect } from 'react';
import { BookOpen, Plus, X, Check, TrendingUp, TrendingDown } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5002';
const sigColor = s => ({ 'STRONG BUY': '#10b981', 'BUY': '#22d3ee', 'HOLD': '#f59e0b', 'SELL': '#f97316', 'STRONG SELL': '#ef4444' }[s] || '#94a3b8');

function SignalBadge({ signal, confidence }) {
  const c = sigColor(signal);
  return <span style={{ padding: '2px 8px', borderRadius: 5, background: c + '20', border: `1px solid ${c}40`, color: c, fontSize: 11, fontWeight: 700 }}>{signal}{confidence ? ` ${confidence}%` : ''}</span>;
}

function NewTradeModal({ onClose, onSave }) {
  const [ticker, setTicker] = useState('');
  const [signal, setSignal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ action: 'BUY', entry_price: '', quantity: '', thesis: '', stop_loss: '', target_price: '', entry_date: new Date().toISOString().split('T')[0] });

  const loadSignal = async (t) => {
    if (!t.trim()) return;
    setLoading(true);
    try {
      const r = await axios.get(API + '/api/decisions/' + t.toUpperCase());
      setSignal(r.data);
    } catch {}
    setLoading(false);
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!ticker) return;
    try {
      await axios.post(API + '/api/journal', {
        ...form,
        ticker: ticker.toUpperCase(),
        entry_price: parseFloat(form.entry_price) || null,
        quantity: parseFloat(form.quantity) || null,
        stop_loss: parseFloat(form.stop_loss) || null,
        target_price: parseFloat(form.target_price) || null,
        signal_at_entry: signal?.signal,
        confidence_at_entry: signal?.confidence,
        evidence_at_entry: signal ? { bull: signal.bullEvidence?.slice(0,3), bear: signal.bearEvidence?.slice(0,3) } : null,
      });
      onSave();
      onClose();
    } catch {}
  };

  const inp = (extra = {}) => ({ padding: '8px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f1f5f9', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box', ...extra });
  const lbl = { fontSize: 11, color: '#64748b', fontWeight: 600, letterSpacing: 1, marginBottom: 5 };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, width: 640, maxHeight: '90vh', overflowY: 'auto', padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: '#f1f5f9', fontWeight: 700 }}>New Trade Entry</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        {/* Ticker + Signal Load */}
        <div style={{ marginBottom: 16 }}>
          <div style={lbl}>TICKER</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && loadSignal(ticker)} placeholder="e.g. AAPL" style={{ ...inp(), fontFamily: 'JetBrains Mono', flex: 1 }} />
            <button onClick={() => loadSignal(ticker)} disabled={loading} style={{ padding: '8px 16px', borderRadius: 8, background: '#3b82f6', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
              {loading ? 'Loading…' : 'Load Signal'}
            </button>
          </div>
        </div>

        {/* Decision engine signal preview */}
        {signal && (
          <div style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.04)', borderRadius: 10, border: `1px solid ${sigColor(signal.signal)}30`, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <SignalBadge signal={signal.signal} confidence={signal.confidence} />
              <span style={{ fontSize: 12, color: '#64748b' }}>{signal.action}</span>
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Top reasons:</div>
            {signal.bullEvidence?.slice(0, 2).map((e, i) => <div key={i} style={{ fontSize: 12, color: '#10b981', marginBottom: 3 }}>✓ {e.fact}</div>)}
            {signal.bearEvidence?.slice(0, 1).map((e, i) => <div key={i} style={{ fontSize: 12, color: '#f59e0b', marginBottom: 3 }}>⚠ {e.fact}</div>)}
            {signal.targets?.resistance && (
              <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, fontFamily: 'JetBrains Mono', color: '#64748b' }}>
                {signal.targets.stopLoss && <span style={{ color: '#ef4444' }}>Suggested stop: ${signal.targets.stopLoss.toFixed(2)}</span>}
                {signal.targets.resistance && <span>Target: ${signal.targets.resistance.toFixed(2)}</span>}
                {signal.targets.riskReward && <span style={{ color: '#f59e0b' }}>R/R {signal.targets.riskReward}:1</span>}
              </div>
            )}
          </div>
        )}

        {/* Trade form */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <div style={lbl}>ACTION</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {['BUY', 'SELL'].map(a => (
                <button key={a} onClick={() => set('action', a)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${form.action === a ? (a === 'BUY' ? '#10b981' : '#ef4444') : 'rgba(255,255,255,0.1)'}`, background: form.action === a ? (a === 'BUY' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)') : 'rgba(255,255,255,0.04)', color: form.action === a ? (a === 'BUY' ? '#10b981' : '#ef4444') : '#94a3b8', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>{a}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={lbl}>ENTRY DATE</div>
            <input type="date" value={form.entry_date} onChange={e => set('entry_date', e.target.value)} style={inp()} />
          </div>
          <div>
            <div style={lbl}>ENTRY PRICE</div>
            <input type="number" value={form.entry_price} onChange={e => set('entry_price', e.target.value)} placeholder="0.00" style={{ ...inp(), fontFamily: 'JetBrains Mono' }} />
          </div>
          <div>
            <div style={lbl}>QUANTITY</div>
            <input type="number" value={form.quantity} onChange={e => set('quantity', e.target.value)} placeholder="0" style={{ ...inp(), fontFamily: 'JetBrains Mono' }} />
          </div>
          <div>
            <div style={lbl}>STOP LOSS</div>
            <input type="number" value={form.stop_loss} onChange={e => set('stop_loss', e.target.value)} placeholder={signal?.targets?.stopLoss?.toFixed(2) || '0.00'} style={{ ...inp(), fontFamily: 'JetBrains Mono' }} />
          </div>
          <div>
            <div style={lbl}>TARGET PRICE</div>
            <input type="number" value={form.target_price} onChange={e => set('target_price', e.target.value)} placeholder={signal?.targets?.resistance?.toFixed(2) || '0.00'} style={{ ...inp(), fontFamily: 'JetBrains Mono' }} />
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={lbl}>TRADE THESIS (why you agree/disagree with the signal)</div>
          <textarea value={form.thesis} onChange={e => set('thesis', e.target.value)} rows={3} placeholder="My reasoning for this trade..." style={{ ...inp(), resize: 'vertical', fontFamily: 'inherit' }} />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
          <button onClick={handleSave} disabled={!ticker} style={{ padding: '10px 20px', borderRadius: 8, background: '#3b82f6', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: !ticker ? 0.5 : 1 }}>Save Trade</button>
        </div>
      </div>
    </div>
  );
}

function TradeCard({ trade, onUpdate }) {
  const isOpen = !trade.exit_price;
  const pnlColor = (trade.pnl || 0) >= 0 ? '#10b981' : '#ef4444';
  const sigC = sigColor(trade.signal_at_entry);
  const [closing, setClosing] = useState(false);
  const [closeForm, setCloseForm] = useState({ exit_price: '', exit_date: new Date().toISOString().split('T')[0], notes: '' });

  const handleClose = async () => {
    const exitPrice = parseFloat(closeForm.exit_price);
    if (!exitPrice) return;
    const pnl = (exitPrice - parseFloat(trade.entry_price)) * parseFloat(trade.quantity) * (trade.action === 'BUY' ? 1 : -1);
    const pnl_pct = ((exitPrice - parseFloat(trade.entry_price)) / parseFloat(trade.entry_price) * 100) * (trade.action === 'BUY' ? 1 : -1);
    await axios.put(API + '/api/journal/' + trade.id, {
      exit_price: exitPrice, exit_date: closeForm.exit_date, notes: closeForm.notes,
      outcome: pnl >= 0 ? 'WIN' : 'LOSS', pnl, pnl_pct,
    }).catch(() => {});
    setClosing(false);
    onUpdate();
  };

  return (
    <div style={{ padding: '18px 20px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${isOpen ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.05)'}`, borderRadius: 12, marginBottom: 12, borderLeft: `3px solid ${isOpen ? '#3b82f6' : pnlColor}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={`https://assets.parqet.com/logos/symbol/${trade.ticker}?format=svg`} alt="" style={{ width: 24, height: 24, borderRadius: 4 }} onError={e => { e.target.style.display = 'none'; }} />
          <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 15, color: '#f1f5f9' }}>{trade.ticker}</span>
          <span style={{ padding: '2px 8px', borderRadius: 5, background: trade.action === 'BUY' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', color: trade.action === 'BUY' ? '#10b981' : '#ef4444', fontSize: 11, fontWeight: 700 }}>{trade.action}</span>
          {trade.signal_at_entry && <SignalBadge signal={trade.signal_at_entry} confidence={trade.confidence_at_entry} />}
          {isOpen && <span style={{ padding: '1px 8px', borderRadius: 10, background: 'rgba(59,130,246,0.12)', color: '#3b82f6', fontSize: 10, fontWeight: 700 }}>OPEN</span>}
          {!isOpen && trade.outcome && <span style={{ padding: '1px 8px', borderRadius: 10, background: trade.outcome === 'WIN' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', color: trade.outcome === 'WIN' ? '#10b981' : '#ef4444', fontSize: 10, fontWeight: 700 }}>{trade.outcome}</span>}
        </div>
        <div style={{ textAlign: 'right' }}>
          {!isOpen && trade.pnl != null && (
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 16, fontWeight: 700, color: pnlColor }}>
              {(trade.pnl >= 0 ? '+' : '') + '£' + Math.abs(parseFloat(trade.pnl)).toFixed(2)}
              <span style={{ fontSize: 12, marginLeft: 6 }}>{(trade.pnl_pct >= 0 ? '+' : '')}{parseFloat(trade.pnl_pct).toFixed(1)}%</span>
            </div>
          )}
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{new Date(trade.entry_date).toLocaleDateString('en-GB')}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, fontSize: 12, fontFamily: 'JetBrains Mono', color: '#64748b', marginBottom: 10, flexWrap: 'wrap' }}>
        <span>Entry: <span style={{ color: '#f1f5f9' }}>${parseFloat(trade.entry_price || 0).toFixed(2)}</span></span>
        {trade.exit_price && <span>Exit: <span style={{ color: '#f1f5f9' }}>${parseFloat(trade.exit_price).toFixed(2)}</span></span>}
        {trade.quantity && <span>Qty: <span style={{ color: '#f1f5f9' }}>{trade.quantity}</span></span>}
        {trade.stop_loss && <span>Stop: <span style={{ color: '#ef4444' }}>${parseFloat(trade.stop_loss).toFixed(2)}</span></span>}
        {trade.target_price && <span>Target: <span style={{ color: '#10b981' }}>${parseFloat(trade.target_price).toFixed(2)}</span></span>}
      </div>

      {trade.thesis && <div style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic', marginBottom: 10 }}>"{trade.thesis}"</div>}

      {trade.evidence_at_entry?.bull?.slice(0, 2).map((e, i) => (
        <div key={i} style={{ fontSize: 11, color: '#10b981', marginBottom: 3 }}>✓ {e.fact}</div>
      ))}

      {isOpen && (
        <div style={{ marginTop: 10 }}>
          {!closing ? (
            <button onClick={() => setClosing(true)} style={{ padding: '6px 14px', borderRadius: 7, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', cursor: 'pointer', fontSize: 12 }}>Close Trade</button>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input type="number" value={closeForm.exit_price} onChange={e => setCloseForm(f => ({ ...f, exit_price: e.target.value }))} placeholder="Exit price" style={{ padding: '6px 10px', borderRadius: 7, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#f1f5f9', fontSize: 12, width: 120, fontFamily: 'JetBrains Mono' }} />
              <input type="date" value={closeForm.exit_date} onChange={e => setCloseForm(f => ({ ...f, exit_date: e.target.value }))} style={{ padding: '6px 10px', borderRadius: 7, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#f1f5f9', fontSize: 12 }} />
              <button onClick={handleClose} style={{ padding: '6px 14px', borderRadius: 7, background: '#10b981', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><Check size={12} /> Confirm</button>
              <button onClick={() => setClosing(false)} style={{ padding: '6px 10px', borderRadius: 7, background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Journal() {
  const [trades, setTrades] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [filter, setFilter] = useState('all');

  const load = async () => {
    try {
      const r = await axios.get(API + '/api/journal');
      setTrades(r.data || []);
    } catch {}
  };

  useEffect(() => { load(); }, []);

  const filtered = trades.filter(t => {
    if (filter === 'open') return !t.exit_price;
    if (filter === 'closed') return !!t.exit_price;
    if (filter === 'wins') return t.outcome === 'WIN';
    if (filter === 'losses') return t.outcome === 'LOSS';
    return true;
  });

  const closed = trades.filter(t => t.exit_price && t.pnl != null);
  const wins = closed.filter(t => parseFloat(t.pnl) > 0);
  const totalPnl = closed.reduce((s, t) => s + parseFloat(t.pnl || 0), 0);

  const card = (extra = {}) => ({ padding: '16px 20px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, ...extra });

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 10 }}>
          <BookOpen size={20} color="#3b82f6" /> Trading Journal
        </h1>
        <button onClick={() => setShowNew(true)} style={{ padding: '9px 18px', borderRadius: 10, background: '#3b82f6', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> New Trade
        </button>
      </div>

      {/* Stats */}
      {closed.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total P&L', value: (totalPnl >= 0 ? '+£' : '-£') + Math.abs(totalPnl).toFixed(2), color: totalPnl >= 0 ? '#10b981' : '#ef4444' },
            { label: 'Win Rate', value: closed.length ? Math.round(wins.length / closed.length * 100) + '%' : '—', color: '#3b82f6' },
            { label: 'Total Trades', value: trades.length, color: '#94a3b8' },
            { label: 'Open Positions', value: trades.filter(t => !t.exit_price).length, color: '#f59e0b' },
          ].map(({ label, value, color }) => (
            <div key={label} style={card({ textAlign: 'center' })}>
              <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>{label}</div>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 20, fontWeight: 700, color }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[['all', 'All'], ['open', 'Open'], ['closed', 'Closed'], ['wins', 'Wins'], ['losses', 'Losses']].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} style={{ padding: '6px 14px', borderRadius: 8, background: filter === k ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${filter === k ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.08)'}`, color: filter === k ? '#3b82f6' : '#64748b', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>{l}</button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#475569', alignSelf: 'center' }}>{filtered.length} trades</span>
      </div>

      {/* Trades */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#475569' }}>
          <BookOpen size={40} style={{ marginBottom: 16, opacity: 0.3 }} />
          <div style={{ fontSize: 15 }}>No trades yet</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>Click "New Trade" to log your first entry with decision engine pre-fill</div>
        </div>
      ) : filtered.map(t => <TradeCard key={t.id} trade={t} onUpdate={load} />)}

      {showNew && <NewTradeModal onClose={() => setShowNew(false)} onSave={load} />}
    </div>
  );
}
