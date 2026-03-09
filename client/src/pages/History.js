import { useState } from 'react';
import { motion } from 'framer-motion';
import { useApi } from '../hooks/useApi';
import { Search } from 'lucide-react';

export default function History() {
  const { data: histData, loading } = useApi('/portfolio/history');
  const { data: txData } = useApi('/portfolio/transactions');
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const orders = Array.isArray(histData) ? histData : [];
  const { transactions = [], netDeposits = 0 } = txData || {};

  const filtered = orders.filter(o =>
    (!filter || o.ticker?.toLowerCase().includes(filter.toLowerCase())) &&
    (typeFilter === 'ALL' || (o.type === typeFilter || o.side === typeFilter))
  );

  const FilterPill = ({ label, val }) => (
    <button onClick={() => setTypeFilter(val)} style={{ padding: '5px 14px', borderRadius: 20, border: `1px solid ${typeFilter === val ? 'var(--accent)' : 'var(--border)'}`, background: typeFilter === val ? 'var(--accent-dim)' : 'transparent', color: typeFilter === val ? 'var(--accent)' : 'var(--text-3)', fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}>
      {label}
    </button>
  );

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Order History</h2>
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ padding: '16px 24px', flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 6 }}>Net Deposits</div>
          <div className="mono" style={{ fontSize: 22, color: 'var(--accent)', fontWeight: 500 }}>£{netDeposits.toFixed(2)}</div>
        </motion.div>
        <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} style={{ padding: '16px 24px', flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 6 }}>Total Orders</div>
          <div className="mono" style={{ fontSize: 22, color: 'var(--text)', fontWeight: 500 }}>{orders.length}</div>
        </motion.div>
      </div>

      <div className="card" style={{ marginBottom: 24, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center', background: 'var(--surface-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '7px 14px' }}>
            <Search size={13} color="var(--text-3)" />
            <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter by ticker..." style={{ background: 'none', border: 'none', color: 'var(--text)', fontSize: 13, outline: 'none', width: '100%' }} />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <FilterPill label="All" val="ALL" />
            <FilterPill label="Buy" val="BUY" />
            <FilterPill label="Sell" val="SELL" />
          </div>
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>Loading orders...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>No orders found</div>
            <div style={{ fontSize: 12 }}>Add your T212 API key to see real data.</div>
          </div>
        ) : (
          filtered.map((o, i) => {
            const isBuy = o.type === 'BUY' || o.side === 'BUY';
            return (
              <motion.div key={o.orderId || i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 20px', borderBottom: '1px solid var(--border)', fontSize: 13, transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: isBuy ? 'var(--gain-dim)' : 'var(--loss-dim)', color: isBuy ? 'var(--gain)' : 'var(--loss)', fontWeight: 700, minWidth: 44, textAlign: 'center' }}>{isBuy ? 'BUY' : 'SELL'}</span>
                <span style={{ fontWeight: 600, minWidth: 70, fontFamily: 'DM Mono, monospace' }}>{o.ticker}</span>
                <span className="mono" style={{ color: 'var(--text-2)' }}>×{(o.quantity || o.filledQuantity || 0).toFixed(4)}</span>
                <span className="mono" style={{ color: 'var(--text-2)' }}>@ £{(o.price || o.averagePrice || 0).toFixed(2)}</span>
                <span className="mono" style={{ marginLeft: 'auto', color: 'var(--text-3)', fontSize: 12 }}>{o.dateCreated || o.filledAt ? new Date(o.dateCreated || o.filledAt).toLocaleDateString('en-GB') : '—'}</span>
              </motion.div>
            );
          })
        )}
      </div>

      {transactions.length > 0 && (
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14, color: 'var(--text-2)' }}>Cash Transactions</h3>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {transactions.map((t, i) => {
              const isDeposit = t.type?.toLowerCase().includes('deposit');
              return (
                <div key={t.transactionId || i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 20px', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                  <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: isDeposit ? 'var(--gain-dim)' : 'var(--warning-dim)', color: isDeposit ? 'var(--gain)' : 'var(--warning)', fontWeight: 600 }}>{t.type}</span>
                  <span className="mono" style={{ color: isDeposit ? 'var(--gain)' : 'var(--text-2)', fontWeight: 500 }}>{isDeposit ? '+' : '-'}£{Math.abs(t.amount || 0).toFixed(2)}</span>
                  <span style={{ color: 'var(--text-3)', marginLeft: 'auto', fontSize: 12 }}>{t.transactedAt ? new Date(t.transactedAt).toLocaleDateString('en-GB') : '—'}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
