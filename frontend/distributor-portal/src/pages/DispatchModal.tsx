import React, { useState, useEffect, useCallback } from 'react';
import { distributorOrderService, DispatchResult } from '../services/orderService';
// ─── Types ────────────────────────────────────────────────────────────────────


interface DispatchModalProps {
  order: {
    _id:           string;
    orderNumber:   string;
    distributorID: string;
    pharmaID:      string;
    grandTotal:    number;
    items:         { name: string }[];
  };
   onSuccess: (result: DispatchResult) => void;
  onClose:   () => void;
}

// ─── toNum — safely coerces number | string | Decimal128 object ───────────────

function toNum(val: unknown): number {
  if (val == null) return 0;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return parseFloat(val) || 0;
  if (typeof val === 'object' && '$numberDecimal' in (val as object))
    return parseFloat((val as { $numberDecimal: string }).$numberDecimal) || 0;
  return 0;
}

// ─── Small helpers ─────────────────────────────────────────────────────────────

function StarRating({ value }: { value: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <svg key={n} width="13" height="13" viewBox="0 0 12 12">
          <polygon
            points="6,1 7.5,4.5 11,4.5 8.5,7 9.5,11 6,9 2.5,11 3.5,7 1,4.5 4.5,4.5"
            fill={n <= Math.round(value) ? '#f59e0b' : '#e2e8f0'}
          />
        </svg>
      ))}
      <span style={{ fontSize: 11, color: '#64748b', marginLeft: 2, fontWeight: 600 }}>
        {value.toFixed(1)}
      </span>
    </span>
  );
}

/** Visual 0–100 bar for the allocation score */
function ScoreBar({ score }: { score: number }) {
  const pct   = Math.round(score * 100);
  const color = pct >= 75 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#f97316';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        flex: 1, height: 6, borderRadius: 999,
        background: '#f1f5f9', overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: 999,
          background: `linear-gradient(90deg, ${color}aa, ${color})`,
          transition: 'width 0.6s cubic-bezier(0.22,1,0.36,1)',
        }} />
      </div>
      <span style={{
        fontSize: 11, fontWeight: 700, color,
        minWidth: 30, textAlign: 'right', fontFamily: 'monospace',
      }}>
        {pct}%
      </span>
    </div>
  );
}

/** Chip used in the success header strip */
function InfoChip({
  icon, label, value, accent = '#0f172a',
}: {
  icon: string; label: string; value: string; accent?: string;
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
      padding: '10px 16px', borderRadius: 10,
      background: 'rgba(255,255,255,0.12)',
      border: '1px solid rgba(255,255,255,0.2)',
      minWidth: 80,
    }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 800, color: 'white' }}>{value}</span>
      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        {label}
      </span>
    </div>
  );
}

/** Section label inside modal body */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      margin: '0 0 10px',
      fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
      textTransform: 'uppercase', color: '#94a3b8',
    }}>
      {children}
    </p>
  );
}

// ─── DispatchModal ─────────────────────────────────────────────────────────────

export function DispatchModal({
  order,
  onSuccess,
  onClose,
  
}: DispatchModalProps) {
  const [phase,    setPhase]    = useState<'confirm' | 'loading' | 'success' | 'error'>('confirm');
  const [result,   setResult]   = useState<DispatchResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // ── API call ───────────────────────────────────────────────────────────────
  const handleDispatch = useCallback(async () => {
  setPhase('loading');
  try {
    const data = await distributorOrderService.dispatchWithAllocation(order._id);
    setResult(data);
    setPhase('success');
  } catch (err: unknown) {
    setErrorMsg((err as Error).message ?? 'Dispatch failed. Please try again.');
    setPhase('error');
  }
}, [order._id]);

  const handleSuccessClose = () => {
    if (result) onSuccess(result);
    onClose();
  };

  // ── Shared styles ──────────────────────────────────────────────────────────
  const cardStyle: React.CSSProperties = {
    background: '#f8fafc', borderRadius: 12, padding: '14px 16px',
    border: '1.5px solid #e2e8f0',
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes dm-fadein  { from{opacity:0} to{opacity:1} }
        @keyframes dm-slidein { from{transform:translateY(26px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes dm-spin    { to{transform:rotate(360deg)} }
        @keyframes dm-check   { from{stroke-dashoffset:30} to{stroke-dashoffset:0} }
        @keyframes dm-ping    { 0%{transform:scale(1);opacity:.7} 80%,100%{transform:scale(2.4);opacity:0} }
        @keyframes dm-bar     { from{width:0} to{width:var(--bar-w)} }
        @keyframes dm-pulse   { 0%,100%{opacity:1} 50%{opacity:.45} }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={phase !== 'loading' ? onClose : undefined}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(15,23,42,0.60)',
          backdropFilter: 'blur(4px)',
          animation: 'dm-fadein 0.18s ease',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20,
        }}
      >
        {/* Card */}
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: 460,
            background: 'white', borderRadius: 20,
            boxShadow: '0 28px 70px rgba(0,0,0,0.22)',
            animation: 'dm-slidein 0.26s cubic-bezier(0.32,0.72,0,1)',
            overflow: 'hidden',
          }}
        >

          {/* ══════════════════════════════════════════════════════════════════
              CONFIRM PHASE
          ══════════════════════════════════════════════════════════════════ */}
          {phase === 'confirm' && (
            <>
              {/* Header */}
              <div style={{
                padding: '22px 24px 18px',
                background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
                borderBottom: '1.5px solid #bbf7d0',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 46, height: 46, borderRadius: 13,
                    background: 'white', border: '1.5px solid #86efac',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22, flexShrink: 0,
                  }}>🚚</div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#14532d' }}>
                      Dispatch Order
                    </h2>
                    <p style={{ margin: 0, fontSize: 12, color: '#16a34a', fontWeight: 600, fontFamily: 'monospace' }}>
                      {order.orderNumber}
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ padding: '20px 24px' }}>
                {/* Order summary */}
                <div style={{
                  ...cardStyle,
                  display: 'grid', gridTemplateColumns: '1fr 1fr',
                  gap: 0, marginBottom: 20, padding: 0, overflow: 'hidden',
                }}>
                  {[
                    { label: 'Items',       value: `${order.items.length} item${order.items.length !== 1 ? 's' : ''}` },
                    { label: 'Grand Total', value: `₹${order.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, accent: '#0369a1' },
                  ].map(({ label, value, accent }, i) => (
                    <div key={label} style={{
                      padding: '14px 16px',
                      borderRight: i === 0 ? '1px solid #e2e8f0' : 'none',
                    }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                        {label}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: accent ?? '#0f172a' }}>{value}</div>
                    </div>
                  ))}
                </div>

                {/* Algorithm explanation */}
                <div style={{ marginBottom: 22 }}>
                  <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    Allocation algorithm
                  </p>
                  {[
                    { icon: '📍', title: 'Proximity score (60 %)', desc: 'Closest available driver to your warehouse wins more weight' },
                    { icon: '⭐', title: 'Rating score (40 %)',    desc: 'Only drivers with rating > 3.2 are considered' },
                    { icon: '📋', title: 'Daily cap check',        desc: 'Skip drivers who hit their maxDeliveriesPerDay today' },
                    { icon: '🔒', title: 'Atomic lock',            desc: 'Driver + vehicle locked simultaneously to prevent race conditions' },
                  ].map(({ icon, title, desc }) => (
                    <div key={title} style={{ display: 'flex', gap: 10, marginBottom: 9 }}>
                      <span style={{ fontSize: 15, lineHeight: '20px', flexShrink: 0 }}>{icon}</span>
                      <div>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#1e293b' }}>{title}</span>
                        <span style={{ fontSize: 12, color: '#64748b' }}> — {desc}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={onClose}
                    style={{
                      flex: 1, padding: '11px', border: '1.5px solid #e2e8f0',
                      borderRadius: 10, background: 'white', color: '#64748b',
                      fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDispatch}
                    style={{
                      flex: 2, padding: '11px', border: 'none', borderRadius: 10,
                      background: 'linear-gradient(135deg, #16a34a, #22c55e)',
                      color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      boxShadow: '0 4px 14px rgba(34,197,94,0.38)',
                    }}
                  >
                    <span style={{ fontSize: 16 }}>🚀</span> Confirm Dispatch
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              LOADING PHASE
          ══════════════════════════════════════════════════════════════════ */}
          {phase === 'loading' && (
            <div style={{
              padding: '60px 24px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
            }}>
              {/* Rings */}
              <div style={{ position: 'relative', width: 64, height: 64 }}>
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  border: '3px solid #dcfce7', borderTopColor: '#22c55e',
                  animation: 'dm-spin 0.75s linear infinite',
                }} />
                <div style={{
                  position: 'absolute', inset: 10, borderRadius: '50%',
                  border: '2px solid #bbf7d0', borderTopColor: '#4ade80',
                  animation: 'dm-spin 1.1s linear infinite reverse',
                }} />
                <div style={{
                  position: 'absolute', inset: '50%', transform: 'translate(-50%,-50%)',
                  fontSize: 18,
                }}>🚚</div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                  Allocating driver & vehicle…
                </p>
                <p style={{ margin: '5px 0 0', fontSize: 12, color: '#94a3b8' }}>
                  Scoring by proximity + rating
                </p>
              </div>

              {/* Fake progress steps */}
              {['Fetching distributor location', 'Scoring nearby drivers', 'Locking vehicle'].map((step, i) => (
                <div key={step} style={{
                  display: 'flex', alignItems: 'center', gap: 10, opacity: 0.6,
                  animation: `dm-pulse 1.4s ${i * 0.3}s ease-in-out infinite`,
                }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: '#22c55e',
                  }} />
                  <span style={{ fontSize: 12, color: '#64748b' }}>{step}</span>
                </div>
              ))}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              SUCCESS PHASE
          ══════════════════════════════════════════════════════════════════ */}
          {phase === 'success' && result && (() => {
            const { driver, vehicle, delivery } = result;

            // Safely coerce Decimal128 / string / number fields
            const avgRating      = toNum(driver.avgRating);
            const distanceKm     = driver.distanceKm != null ? toNum(driver.distanceKm) : null;
            const allocationScore = toNum(driver.allocationScore);

            const distLabel = distanceKm != null ? `${distanceKm.toFixed(1)} km` : 'N/A';

            return (
              <>
                {/* Green hero header */}
                <div style={{
                  padding: '26px 24px 22px',
                  background: 'linear-gradient(135deg, #14532d 0%, #16a34a 60%, #22c55e 100%)',
                  position: 'relative', overflow: 'hidden',
                }}>
                

                  {/* Check circle */}
                  <div style={{
                    width: 52, height: 52, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.18)',
                    border: '2px solid rgba(255,255,255,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 14px', position: 'relative', zIndex: 1,
                  }}>
                    <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                      <path
                        d="M5 13l5.5 5.5L21 8"
                        stroke="white" strokeWidth="2.8"
                        strokeLinecap="round" strokeLinejoin="round"
                        strokeDasharray="30"
                        style={{ animation: 'dm-check 0.5s 0.1s ease forwards', strokeDashoffset: 30 }}
                      />
                    </svg>
                  </div>

                  <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800, color: 'white', textAlign: 'center' }}>
                    Order Dispatched!
                  </h2>
                  <p style={{ margin: '0 0 18px', fontSize: 12, color: 'rgba(255,255,255,0.75)', textAlign: 'center' }}>
                    Driver & vehicle successfully allocated
                  </p>

                  
                </div>

                <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>

                  {/* Allocation score bar */}
                  <div style={{ ...cardStyle }}>
                    <SectionLabel>Allocation score</SectionLabel>
                    <ScoreBar score={allocationScore} />
                    <p style={{ margin: '8px 0 0', fontSize: 11, color: '#94a3b8' }}>
                      Composite of proximity (60 %) and driver rating (40 %)
                    </p>
                  </div>

                  {/* Driver card */}
                  <div style={{ ...cardStyle }}>
                    <SectionLabel>Assigned Driver</SectionLabel>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 42, height: 42, borderRadius: 11, flexShrink: 0,
                        background: 'linear-gradient(135deg, #dbeafe, #bfdbfe)',
                        border: '1.5px solid #93c5fd',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                      }}>👤</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                          {driver.name || driver.driverID}
                        </div>
                        {driver.phone && (
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                            📞 {driver.phone}
                          </div>
                        )}
                      </div>
                      <StarRating value={avgRating} />
                    </div>

                    {/* Distance row */}
                    {distanceKm != null && (
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        marginTop: 12, paddingTop: 10, borderTop: '1px solid #f1f5f9',
                      }}>
                        <span style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span>📍</span> Distance from warehouse
                        </span>
                        <span style={{
                          fontSize: 12, fontWeight: 700, color: '#0f172a',
                          background: '#f0fdf4', padding: '3px 10px', borderRadius: 999,
                          border: '1px solid #bbf7d0',
                        }}>
                          {distanceKm.toFixed(2)} km
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Vehicle card */}
                  <div style={{ ...cardStyle }}>
                    <SectionLabel>Assigned Vehicle</SectionLabel>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 42, height: 42, borderRadius: 11, flexShrink: 0,
                        background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
                        border: '1.5px solid #fcd34d',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                      }}>🚗</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', fontFamily: 'monospace', letterSpacing: '0.04em' }}>
                          {vehicle.vehicleNumber}
                        </div>
                        {vehicle.vehicleType && (
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                            {vehicle.vehicleType}
                          </div>
                        )}
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 800, color: '#16a34a',
                        background: '#dcfce7', padding: '3px 9px', borderRadius: 999,
                        letterSpacing: '0.06em', textTransform: 'uppercase',
                      }}>
                        Reserved
                      </span>
                    </div>
                  </div>

                  {/* Delivery ID */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '9px 12px', borderRadius: 9,
                    background: '#f8fafc', border: '1px solid #e2e8f0',
                  }}>
                    <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Delivery ID</span>
                    <code style={{ fontSize: 10, color: '#475569', fontFamily: 'monospace', letterSpacing: '0.04em' }}>
                      {delivery._id?.toString().slice(-14).toUpperCase()}
                    </code>
                  </div>

                  <button
                    onClick={handleSuccessClose}
                    style={{
                      width: '100%', padding: '12px',
                      background: '#0f172a', color: 'white',
                      border: 'none', borderRadius: 10,
                      fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      marginTop: 2,
                    }}
                  >
                    Done
                  </button>
                </div>
              </>
            );
          })()}

          {/* ══════════════════════════════════════════════════════════════════
              ERROR PHASE
          ══════════════════════════════════════════════════════════════════ */}
          {phase === 'error' && (
            <>
              <div style={{
                padding: '28px 24px 20px',
                background: 'linear-gradient(135deg, #fef2f2, #fee2e2)',
                borderBottom: '1.5px solid #fecaca',
                textAlign: 'center',
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: '50%',
                  background: 'white', border: '2px solid #fca5a5',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 14px', fontSize: 24,
                }}>⚠️</div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#7f1d1d' }}>
                  Dispatch Failed
                </h2>
              </div>
              <div style={{ padding: '20px 24px' }}>
                <div style={{
                  background: '#fef2f2', borderRadius: 10, padding: '12px 14px',
                  border: '1.5px solid #fecaca', marginBottom: 20,
                }}>
                  <p style={{ margin: 0, fontSize: 13, color: '#dc2626', fontWeight: 600 }}>
                    {errorMsg}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={onClose}
                    style={{
                      flex: 1, padding: '11px', border: '1.5px solid #e2e8f0',
                      borderRadius: 10, background: 'white', color: '#475569',
                      fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Close
                  </button>
                  <button
                    onClick={() => setPhase('confirm')}
                    style={{
                      flex: 1, padding: '11px', border: '1.5px solid #e2e8f0',
                      borderRadius: 10, background: '#f8fafc', color: '#0f172a',
                      fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </>
  );
}