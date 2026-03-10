import { useState } from 'react';
import { motion } from 'framer-motion';
import { useApi } from '../hooks/useApi';
import { Search, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';

export default function History() {
  const { data: histData, loading } = useApi('/portfolio/history');
  const { data: txData } = useApi('/portfolio/transactions');
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const orders = Array.isArray(histData) ? histData : [];
  const { transactions = [], netDeposits = 0 } = txData || {};

  const filtered = orders.filter(o =>
    (!filter || o.ticker?.toLowerCase().includes(filter.toLowerCase())) &&
    (typeFilter === 'ALL' || o.type === typeFilter)
  );

  const FilterPill = ({ label, val }) => (
    <button onClick={() => setTypeFilter(val)}
      style={{ padding: '5px 14px', borderRadius: 20, border: `1px solid ${typeFilter === val ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.08)'}`, background: typeFilter === val ? 'rgba(59,130,246,0.12)' : 'transparent', color: typeFilter === val ? '#3b82f6' : '#475569', fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}>
      {label}
    </button>
  );

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24, color: '#f1f5f9' }}>Order History</h2>
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {[['Net Deposits', `£${netDeposits.toFixed(2)}`, '#3b82f6'], ['Total Orders', orders.length, '#94a3b8']].map(([label, val, color]) => (
          <motion.div key={label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            style={{ padding: '16px 24px', flex: 1, minWidth: 160, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14 }}>
            <div style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, marginBottom: 6 }}>{label}</div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 22, color, fontWeight: 500 }}>{val}</div>
          </motion.div>
        ))}
      </div>

      <div style={{ marginBottom: 24, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 10, alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '7px 14px' }}>
            <Search size={13} color="#475569" />
            <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter by ticker..." style={{ background: 'none', border: 'none', color: '#f1f5f9', fontSize: 13, outline: 'none', width: '100%', fontFamily: 'Outfit' }} />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <FilterPill label="All" val="ALL" />
            <FilterPill label="Buy" val="BUY" />
            <FilterPill label="Sell" val="SELL" />
          </div>
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#475569' }}>Loading orders...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#475569' }}>
            <div style={{ fontWeight: 600, marginBottom: 4, color: '#94a3b8' }}>No orders found</div>
            <div style={{ fontSize: 12 }}>Add your T212 API key to see real data.</div>
          </div>
        ) : (
          filtered.map((o, i) => {
            const isBuy = o.type === 'BUY';
            const qty = parseFloat(o.quantity || o.filledQuantity || o.orderedQuantity || 0);
            const price = parseFloat(o.price || o.limitPrice || o.stopPrice || 0);
            const total = qty * price;
            const ticker = (o.ticker || '').replace(/_[A-Z]{2}_EQ$/, '').replace(/_[A-Z]+$/, '');
            return (
              <motion.div key={o.id || o.orderId || i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13, transition: 'background 0.12s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.boxShadow = 'inset 2px 0 0 #3b82f6'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.boxShadow = 'none'; }}>
                {isBuy
                  ? <ArrowUpCircle size={16} color="#10b981" strokeWidth={2} />
                  : <ArrowDownCircle size={16} color="#ef4444" strokeWidth={2} />
                }
                <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 20, background: isBuy ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', color: isBuy ? '#10b981' : '#ef4444', fontWeight: 700, minWidth: 44, textAlign: 'center' }}>{isBuy ? 'BUY' : 'SELL'}</span>
                <span style={{ fontWeight: 700, minWidth: 70, fontFamily: 'JetBrains Mono', color: '#3b82f6' }}>{ticker || o.ticker || '—'}</span>
                <span style={{ fontFamily: 'JetBrains Mono', color: '#94a3b8' }}>×{qty > 0 ? qty.toFixed(4) : 'N/A'}</span>
                <span style={{ fontFamily: 'JetBrains Mono', color: '#94a3b8' }}>@ £{price > 0 ? price.toFixed(2) : 'N/A'}</span>
                {total > 0 && <span style={{ fontFamily: 'JetBrains Mono', color: isBuy ? '#10b981' : '#ef4444', fontWeight: 600 }}>£{total.toFixed(2)}</span>}
                {o.status && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: o.status === 'FILLED' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', color: o.status === 'FILLED' ? '#10b981' : '#f59e0b', fontWeight: 600 }}>{o.status}</span>}
                <span style={{ marginLeft: 'auto', fontFamily: 'JetBrains Mono', color: '#475569', fontSize: 12, whiteSpace: 'nowrap' }}>
                  {o.dateCreated || o.dateModified ? new Date(o.dateCreated || o.dateModified).toLocaleDateString('en-GB') : '—'}
                </span>
              </motion.div>
            );
          })
        )}
      </div>

      {transactions.length > 0 && (
        <div>
          <h3 style={{ fontSize: 11, fontWeight: 600, marginBottom: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Cash Transactions</h3>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
            {transactions.map((t, i) => {
              const isDeposit = t.type?.toLowerCase().includes('deposit');
              return (
                <div key={t.transactionId || i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13 }}>
                  <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 20, background: isDeposit ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)', color: isDeposit ? '#10b981' : '#f59e0b', fontWeight: 600 }}>{t.type}</span>
                  <span style={{ fontFamily: 'JetBrains Mono', color: isDeposit ? '#10b981' : '#94a3b8', fontWeight: 500 }}>{isDeposit ? '+' : '-'}£{Math.abs(t.amount || 0).toFixed(2)}</span>
                  <span style={{ color: '#475569', marginLeft: 'auto', fontSize: 12, fontFamily: 'JetBrains Mono' }}>{t.transactedAt ? new Date(t.transactedAt).toLocaleDateString('en-GB') : '—'}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
