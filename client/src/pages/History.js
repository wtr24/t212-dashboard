import { useState } from 'react';
import { motion } from 'framer-motion';
import { useApi } from '../hooks/useApi';

export default function History() {
  const { data: histData, loading } = useApi('/portfolio/history');
  const { data: txData } = useApi('/portfolio/transactions');
  const [filter, setFilter] = useState('');
  const orders = Array.isArray(histData) ? histData : [];
  const { transactions = [], netDeposits = 0 } = txData || {};

  const filtered = orders.filter(o => !filter || o.ticker?.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Order History</h2>
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div className="glass" style={{ padding: '16px 24px', flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Net Deposits</div>
          <div className="mono" style={{ fontSize: 22, color: 'var(--accent)' }}>£{netDeposits.toFixed(2)}</div>
        </div>
        <div className="glass" style={{ padding: '16px 24px', flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Total Orders</div>
          <div className="mono" style={{ fontSize: 22, color: 'var(--text)' }}>{orders.length}</div>
        </div>
      </div>

      <div className="glass" style={{ marginBottom: 24 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center' }}>
          <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter by ticker..." style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 12px', color: 'var(--text)', fontSize: 13, outline: 'none' }} />
        </div>
        {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Loading...</div> : (
          filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>No orders found. Add your T212 API key to see real data.</div>
          ) : (
            filtered.map((o, i) => {
              const isBuy = o.type === 'BUY' || o.side === 'BUY';
              return (
                <motion.div key={o.orderId || i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 20px', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                  <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: isBuy ? 'rgba(0,255,136,0.1)' : 'rgba(255,50,87,0.1)', color: isBuy ? 'var(--accent)' : 'var(--danger)', border: `1px solid ${isBuy ? 'rgba(0,255,136,0.2)' : 'rgba(255,50,87,0.2)'}`, fontWeight: 700, minWidth: 40, textAlign: 'center' }}>{isBuy ? 'BUY' : 'SELL'}</span>
                  <span style={{ fontWeight: 600, minWidth: 60 }}>{o.ticker}</span>
                  <span className="mono" style={{ color: 'var(--muted)' }}>Qty: {(o.quantity || o.filledQuantity || 0).toFixed(4)}</span>
                  <span className="mono" style={{ color: 'var(--muted)' }}>@ £{(o.price || o.averagePrice || 0).toFixed(2)}</span>
                  <span className="mono" style={{ marginLeft: 'auto', color: 'var(--muted)' }}>{o.dateCreated || o.filledAt ? new Date(o.dateCreated || o.filledAt).toLocaleDateString('en-GB') : '—'}</span>
                </motion.div>
              );
            })
          )
        )}
      </div>

      {transactions.length > 0 && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Transactions</h3>
          <div className="glass">
            {transactions.map((t, i) => {
              const isDeposit = t.type?.toLowerCase().includes('deposit');
              return (
                <div key={t.transactionId || i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 20px', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                  <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: isDeposit ? 'rgba(0,255,136,0.1)' : 'rgba(255,184,0,0.1)', color: isDeposit ? 'var(--accent)' : 'var(--warning)', border: `1px solid ${isDeposit ? 'rgba(0,255,136,0.2)' : 'rgba(255,184,0,0.2)'}` }}>{t.type}</span>
                  <span className="mono" style={{ color: isDeposit ? 'var(--accent)' : 'var(--muted)' }}>{isDeposit ? '+' : '-'}£{Math.abs(t.amount || 0).toFixed(2)}</span>
                  <span style={{ color: 'var(--muted)', marginLeft: 'auto', fontSize: 12 }}>{t.transactedAt ? new Date(t.transactedAt).toLocaleDateString('en-GB') : '—'}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
