import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  X, ChevronLeft, ChevronRight, Package, Clock,
  Truck, CheckCircle2, AlertTriangle,
  ShoppingCart, XCircle, RefreshCw, Search,
  TrendingUp, BoxIcon, Ban, Phone, MapPin,
  ArrowRight, Star,
} from 'lucide-react';
import {
  distributorOrderService,
  DistributorOrder,
  DistributorOrderStatus,
  DispatchResult,
} from '../services/orderService';
import { pharmacyService, PharmacyUser } from '../services/pharmacyService';
import { DispatchModal } from './DispatchModal';

// ─── Injected styles ──────────────────────────────────────────────────────────

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

  .dop-root { font-family: 'Sora', sans-serif; }
  .dop-mono { font-family: 'JetBrains Mono', monospace; }

  .dop-card {
    background: #ffffff;
    border: 1px solid #e8edf5;
    border-radius: 16px;
    box-shadow: 0 1px 3px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.04);
  }

  .dop-stat-card {
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 18px 20px;
    transition: box-shadow 0.2s;
  }
  .dop-stat-card:hover { box-shadow: 0 4px 20px rgba(15,23,42,0.08); }

  .dop-filter-btn {
    padding: 7px 16px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.18s ease;
    border: 1.5px solid transparent;
    font-family: 'Sora', sans-serif;
  }
  .dop-filter-btn.active {
    background: #0f172a;
    color: #f8fafc;
    border-color: #0f172a;
  }
  .dop-filter-btn:not(.active) {
    background: #f8fafc;
    color: #475569;
    border-color: #e2e8f0;
  }
  .dop-filter-btn:not(.active):hover {
    background: #f1f5f9;
    border-color: #cbd5e1;
    color: #1e293b;
  }

  .dop-table thead th {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: #94a3b8;
    padding: 14px 16px;
    background: #f8fafc;
    border-bottom: 1px solid #e8edf5;
  }
  .dop-table thead th:first-child { border-radius: 10px 0 0 0; }
  .dop-table thead th:last-child  { border-radius: 0 10px 0 0; }

  .dop-table tbody tr {
    border-bottom: 1px solid #f1f5f9;
    transition: background 0.15s;
  }
  .dop-table tbody tr:hover { background: #f8fafc; }
  .dop-table tbody td { padding: 14px 16px; vertical-align: middle; }

  .dop-pipeline { display: flex; align-items: center; gap: 4px; margin-top: 6px; }
  .dop-pip-dot  { width: 7px; height: 7px; border-radius: 50%; transition: background 0.2s; }
  .dop-pip-line { height: 2px; width: 14px; border-radius: 1px; }

  .dop-badge {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 4px 10px; border-radius: 999px;
    font-size: 11.5px; font-weight: 600;
    letter-spacing: 0.01em;
  }

  .dop-action-btn {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 6px 13px; border-radius: 8px;
    font-size: 12px; font-weight: 600;
    cursor: pointer; border: none;
    font-family: 'Sora', sans-serif;
    transition: all 0.18s; white-space: nowrap;
  }
  .dop-action-btn:disabled { opacity: 0.45; cursor: not-allowed; }

  .dop-action-accept {
    background: #ede9fe; color: #6d28d9;
  }
  .dop-action-accept:hover:not(:disabled) {
    background: #ddd6fe; color: #5b21b6;
  }

  .dop-action-dispatch {
    background: #e0f2fe; color: #0369a1;
  }
  .dop-action-dispatch:hover:not(:disabled) {
    background: #bae6fd; color: #075985;
  }

  .dop-action-view-dispatch {
    background: #eef2ff; color: #4338ca;
  }
  .dop-action-view-dispatch:hover:not(:disabled) {
    background: #e0e7ff; color: #3730a3;
  }

  .dop-action-reject {
    background: #fef2f2; color: #b91c1c;
  }
  .dop-action-reject:hover:not(:disabled) {
    background: #fee2e2; color: #991b1b;
  }

  .dop-modal-overlay {
    position: fixed; inset: 0;
    background: rgba(15,23,42,0.55);
    backdrop-filter: blur(6px);
    display: flex; align-items: center; justify-content: center;
    z-index: 50; padding: 16px;
    animation: dop-fade-in 0.18s ease;
  }
  .dop-modal {
    background: #fff;
    border-radius: 20px;
    box-shadow: 0 24px 80px rgba(15,23,42,0.2);
    width: 100%; max-width: 640px;
    max-height: 90vh; overflow-y: auto;
    animation: dop-slide-up 0.22s ease;
  }
  .dop-modal-sm { max-width: 460px; }

  @keyframes dop-fade-in  { from { opacity: 0 } to { opacity: 1 } }
  @keyframes dop-slide-up { from { transform: translateY(20px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }

  .dop-input {
    width: 100%; padding: 10px 14px;
    border: 1.5px solid #e2e8f0; border-radius: 10px;
    font-size: 13.5px; font-family: 'Sora', sans-serif;
    resize: none; outline: none;
    transition: border-color 0.18s, box-shadow 0.18s;
  }
  .dop-input:focus {
    border-color: #0f172a;
    box-shadow: 0 0 0 3px rgba(15,23,42,0.08);
  }

  .dop-btn {
    padding: 8px 20px; border-radius: 10px;
    font-size: 13px; font-weight: 600;
    cursor: pointer; transition: all 0.18s;
    font-family: 'Sora', sans-serif;
    display: inline-flex; align-items: center; gap: 6px;
  }
  .dop-btn-outline { background: #fff; color: #374151; border: 1.5px solid #e2e8f0; }
  .dop-btn-outline:hover { background: #f8fafc; border-color: #cbd5e1; }
  .dop-btn-danger  { background: #ef4444; color: #fff; border: none; }
  .dop-btn-danger:hover { background: #dc2626; }
  .dop-btn:disabled { opacity: 0.45; cursor: not-allowed; }

  .dop-search-wrap { position: relative; display: flex; align-items: center; }
  .dop-search-wrap svg { position: absolute; left: 12px; color: #94a3b8; pointer-events: none; }
  .dop-search-input {
    padding: 8px 14px 8px 36px;
    border: 1.5px solid #e2e8f0; border-radius: 10px;
    font-size: 13px; font-family: 'Sora', sans-serif;
    outline: none; width: 220px;
    transition: border-color 0.18s, box-shadow 0.18s, width 0.25s;
    background: #f8fafc;
  }
  .dop-search-input:focus {
    border-color: #0f172a;
    box-shadow: 0 0 0 3px rgba(15,23,42,0.07);
    background: #fff; width: 280px;
  }

  .dop-pharma-avatar {
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, #dbeafe, #bfdbfe);
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; font-weight: 700; color: #1d4ed8;
    flex-shrink: 0;
  }

  .dop-order-icon {
    width: 40px; height: 40px; border-radius: 12px;
    background: linear-gradient(135deg, #e0f2fe, #bae6fd);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }

  .dop-detail-section {
    background: #f8fafc; border: 1px solid #e8edf5;
    border-radius: 12px; padding: 16px;
  }

  .dop-item-card {
    background: #fff; border: 1px solid #e8edf5;
    border-radius: 12px; padding: 16px;
    transition: box-shadow 0.18s;
  }
  .dop-item-card:hover { box-shadow: 0 2px 12px rgba(15,23,42,0.07); }

  .dop-tax-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 5px 0; font-size: 12px; color: #64748b;
    border-bottom: 1px dashed #f1f5f9;
  }
  .dop-tax-row:last-child { border-bottom: none; }
  .dop-tax-row .val { font-weight: 600; color: #1e293b; }

  .dop-info-chip {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 3px 9px; border-radius: 7px;
    background: #f1f5f9; font-size: 11.5px; color: #475569;
    font-weight: 500;
  }

  .dop-pulse { animation: dop-pulse 1.5s ease-in-out infinite; }
  @keyframes dop-pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }

  .dop-empty {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; padding: 64px 24px; gap: 12px;
  }
  .dop-empty-icon {
    width: 64px; height: 64px; border-radius: 20px;
    background: #f1f5f9;
    display: flex; align-items: center; justify-content: center;
  }

  .dop-pagination-btn {
    display: flex; align-items: center; gap: 4px;
    padding: 7px 14px; border-radius: 8px;
    border: 1.5px solid #e2e8f0; font-size: 13px;
    background: #fff; color: #374151; cursor: pointer;
    transition: all 0.15s; font-family: 'Sora', sans-serif; font-weight: 500;
  }
  .dop-pagination-btn:hover:not(:disabled) { background: #f8fafc; border-color: #cbd5e1; }
  .dop-pagination-btn:disabled { opacity: 0.35; cursor: not-allowed; }

  .dop-page-num {
    width: 34px; height: 34px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 600; cursor: pointer;
    transition: all 0.15s; border: 1.5px solid transparent;
    font-family: 'Sora', sans-serif;
  }
  .dop-page-num.active { background: #0f172a; color: #fff; }
  .dop-page-num:not(.active) { color: #64748b; border-color: #e2e8f0; background: #fff; }
  .dop-page-num:not(.active):hover { background: #f8fafc; border-color: #cbd5e1; }

  @keyframes spin { to { transform: rotate(360deg); } }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(ds: string) {
  const d = new Date(ds);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} · ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function toNum(val: any): number {
  if (val == null) return 0;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return parseFloat(val) || 0;
  if (typeof val === 'object' && '$numberDecimal' in val) return parseFloat(val.$numberDecimal) || 0;
  return 0;
}

function timeAgo(ds: string) {
  const mins = Math.floor((Date.now() - new Date(ds).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs/24)}d ago`;
}

function formatAddress(addr: PharmacyUser['address']): string {
  if (!addr) return '';
  if (typeof addr === 'string') return addr;
  return [addr.line1, addr.line2, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ');
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_META: Record<DistributorOrderStatus, {
  label: string; bg: string; text: string; dot: string; icon: React.ReactNode;
}> = {
  PLACED:       { label: 'Order Placed', bg: '#eff6ff', text: '#1d4ed8', dot: '#3b82f6', icon: <ShoppingCart size={11}/> },
  ACCEPTED:     { label: 'Accepted',     bg: '#f5f3ff', text: '#6d28d9', dot: '#8b5cf6', icon: <CheckCircle2 size={11}/> },
  DISPATCHED:   { label: 'Dispatched',   bg: '#eef2ff', text: '#4338ca', dot: '#6366f1', icon: <Truck size={11}/> },
PICKED_UP: {
  label: 'Order Picked',
  bg: '#fae1f4',
  text: '#8f0371',
  dot: '#fc3ad3',
  icon: <Truck size={11}/>
},
  DELIVERED:    { label: 'Delivered',    bg: '#f0fdf4', text: '#15803d', dot: '#22c55e', icon: <CheckCircle2 size={11}/> },
  REJECTED:     { label: 'Rejected',     bg: '#fef2f2', text: '#b91c1c', dot: '#ef4444', icon: <XCircle size={11}/> },
  CANCELLED:    { label: 'Cancelled',    bg: '#fff7ed', text: '#c2410c', dot: '#f97316', icon: <XCircle size={11}/> },
  TIME_EXPIRED: { label: 'Timed Out',    bg: '#fefce8', text: '#92400e', dot: '#f59e0b', icon: <Clock size={11}/> },
};

function StatusBadge({ status }: { status: DistributorOrderStatus }) {
  const m = STATUS_META[status] ?? { label: status, bg: '#f1f5f9', text: '#64748b', dot: '#94a3b8', icon: null };
  return (
    <span className="dop-badge" style={{ background: m.bg, color: m.text }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background: m.dot, display:'inline-block', flexShrink:0 }} />
      {m.icon}{m.label}
    </span>
  );
}

function getItemSummary(order: DistributorOrder) {
  const units = order.items.reduce((s,i) => s + i.quantity, 0);
  return units > 0 ? `${units} unit${units!==1?'s':''}` : '';
}

// ─── Status Pipeline ──────────────────────────────────────────────────────────

const PIPELINE: DistributorOrderStatus[] = ['PLACED','ACCEPTED','DISPATCHED','PICKED_UP','DELIVERED'];
const PIPELINE_LABELS = ['Placed','Accepted','Dispatched','Picked Up','Delivered'];

function StatusPipeline({ status }: { status: DistributorOrderStatus }) {
  const idx        = PIPELINE.indexOf(status);
  const terminated = ['REJECTED','CANCELLED','TIME_EXPIRED'].includes(status);
  return (
    <div className="dop-pipeline">
      {PIPELINE.map((s, i) => {
        const done    = !terminated && i <= idx;
        const current = !terminated && i === idx;
        const color   = done ? (current ? '#3b82f6' : '#22c55e') : '#e2e8f0';
        return (
          <div key={s} style={{ display:'flex', alignItems:'center', gap:4 }}>
            <div className="dop-pip-dot" title={PIPELINE_LABELS[i]}
              style={{ background: color, boxShadow: current ? `0 0 0 3px ${color}33` : 'none' }} />
            {i < PIPELINE.length - 1 && (
              <div className="dop-pip-line"
                style={{ background: i < idx && !terminated ? '#22c55e' : '#e2e8f0' }} />
            )}
          </div>
        );
      })}
      {terminated && (
        <span style={{ fontSize:10, color: STATUS_META[status]?.text, fontWeight:600, marginLeft:4 }}>
          {STATUS_META[status]?.label}
        </span>
      )}
    </div>
  );
}

// ─── Tax Row ──────────────────────────────────────────────────────────────────

function TaxRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="dop-tax-row">
      <span>{label}</span>
      <span className="val dop-mono" style={{ color: accent }}>{value}</span>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, accent }: {
  label: string; value: number; icon: React.ReactNode; accent: string;
}) {
  return (
    <div className="dop-stat-card" style={{ display:'flex', alignItems:'center', gap:14 }}>
      <div style={{
        width:42, height:42, borderRadius:12, background: accent+'18',
        display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color: accent,
      }}>{icon}</div>
      <div>
        <div style={{ fontSize:22, fontWeight:700, color:'#0f172a', lineHeight:1 }}>{value}</div>
        <div style={{ fontSize:12, color:'#94a3b8', marginTop:3, fontWeight:500 }}>{label}</div>
      </div>
    </div>
  );
}

// ─── Pharmacy Cell ────────────────────────────────────────────────────────────

function PharmacyCell({ pharma }: { pharma: PharmacyUser | undefined }) {
  if (!pharma) {
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {[80,60,50].map(w => (
          <div key={w} className="dop-pulse"
            style={{ height:11, borderRadius:6, background:'#e2e8f0', width:w }} />
        ))}
      </div>
    );
  }
  const initial = pharma.name ? pharma.name[0].toUpperCase() : '?';
  const addr    = formatAddress(pharma.address);

  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
      <div className="dop-pharma-avatar">{initial}</div>
      <div style={{ minWidth:0 }}>
        <div style={{ fontWeight:600, color:'#1e293b', fontSize:13, marginBottom:5 }}>
          {pharma.name ?? '—'}
        </div>
        {pharma.phone && (
          <div className="dop-info-chip" style={{ marginBottom:4 }}>
            <Phone size={10} color="#6366f1" />
            {pharma.phone}
          </div>
        )}
        {addr && (
          <div style={{ display:'flex', alignItems:'flex-start', gap:4, marginTop:3 }}>
            <MapPin size={10} color="#94a3b8" style={{ marginTop:2, flexShrink:0 }} />
            <span style={{ fontSize:11, color:'#94a3b8', lineHeight:1.4 }}>{addr}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Dispatch Info Modal ──────────────────────────────────────────────────────

interface DispatchInfoModalProps {
  order: DistributorOrder;
  onClose: () => void;
}

function DispatchInfoModal({ order, onClose }: DispatchInfoModalProps) {
  // Change the state type
const [data, setData] = useState<DispatchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
  (async () => {
    try {
      const doc = await distributorOrderService.getDelivery(order._id);

      // ── Remap flat delivery doc → { driver, vehicle, delivery } ──
      setData({
        order: order,
        driver: {
          driverID:        doc.driverID,
          name:            doc.driverName  ?? doc.driverID,
          phone:           doc.driverPhone ?? '',
          avgRating:       doc.driverRatingAtDispatch ?? 0,
          distanceKm:      doc.distanceKm  ?? null,
          allocationScore: doc.allocationScore ?? 0,
        },
        vehicle: {
          vehicleID:     doc.vehicleID,
          vehicleNumber: doc.vehicleNumber ?? doc.vehicleID,
          vehicleType:   doc.vehicleType   ?? '',
        },
        delivery: doc,
      });
    } catch (e: any) {
      setError(e.message ?? 'Failed to load dispatch info');
    } finally {
      setLoading(false);
    }
  })();
}, [order._id]);

  const cardStyle: React.CSSProperties = {
    background: '#f8fafc', borderRadius: 12, padding: '14px 16px',
    border: '1.5px solid #e2e8f0',
  };

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <p style={{ margin: '0 0 10px', fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94a3b8' }}>
      {children}
    </p>
  );

  return (
    <div className="dop-modal-overlay" style={{ zIndex: 60 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="dop-modal dop-modal-sm">

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 22px 16px',
          background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)',
          borderBottom: '1.5px solid #c7d2fe',
          borderRadius: '20px 20px 0 0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 11,
              background: 'white', border: '1.5px solid #a5b4fc',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
            }}>🚚</div>
            <div>
              <div style={{ fontWeight: 700, color: '#1e1b4b', fontSize: 15 }}>Dispatch Details</div>
              <div className="dop-mono" style={{ fontSize: 11, color: '#6366f1', marginTop: 1 }}>{order.orderNumber}</div>
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 30, height: 30, borderRadius: 7, border: '1.5px solid #c7d2fe',
            background: 'white', display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: 'pointer', color: '#6366f1',
          }}>
            <X size={14}/>
          </button>
        </div>

        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Loading */}
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[100, 80, 90].map((w, i) => (
                <div key={i} className="dop-pulse" style={{ height: 52, borderRadius: 12, background: '#f1f5f9', width: `${w}%` }}/>
              ))}
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '14px 16px', fontSize: 13, color: '#dc2626' }}>
              {error}
            </div>
          )}

          {/* Data */}
          {!loading && data && (() => {
            const { driver, vehicle, delivery } = data;

          if (!driver || !vehicle || !delivery) {
            return (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '14px 16px', fontSize: 13, color: '#dc2626' }}>
                Dispatch details are incomplete or in an unexpected format.
              </div>
            );
          }

            const avgRating      = toNum(driver.avgRating);
            const distanceKm     = driver.distanceKm != null ? toNum(driver.distanceKm) : null;
            const allocationScore = toNum(driver.allocationScore);
            const scorePct       = Math.round(allocationScore * 100);
            const scoreColor     = scorePct >= 75 ? '#22c55e' : scorePct >= 50 ? '#f59e0b' : '#f97316';

            return (
              <>
                {/* Driver */}
                <div style={cardStyle}>
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
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>📞 {driver.phone}</div>
                      )}
                    </div>
                    {/* Star rating */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                      <div style={{ display: 'flex', gap: 2 }}>
                        {[1,2,3,4,5].map(n => (
                          <Star key={n} size={11} fill={n <= Math.round(avgRating) ? '#f59e0b' : 'none'} color={n <= Math.round(avgRating) ? '#f59e0b' : '#e2e8f0'} />
                        ))}
                      </div>
                      <span className="dop-mono" style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                        {avgRating.toFixed(1)}
                      </span>
                    </div>
                  </div>

                  {distanceKm != null && (
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      marginTop: 12, paddingTop: 10, borderTop: '1px solid #f1f5f9',
                    }}>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>📍 Distance at dispatch</span>
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

                {/* Vehicle */}
                <div style={cardStyle}>
                  <SectionLabel>Assigned Vehicle</SectionLabel>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: 11, flexShrink: 0,
                      background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
                      border: '1.5px solid #fcd34d',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                    }}>🚗</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="dop-mono" style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', letterSpacing: '0.04em' }}>
                        {vehicle.vehicleNumber}
                      </div>
                      {vehicle.vehicleType && (
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{vehicle.vehicleType}</div>
                      )}
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 800, color: '#16a34a',
                      background: '#dcfce7', padding: '3px 9px', borderRadius: 999,
                      letterSpacing: '0.06em', textTransform: 'uppercase',
                    }}>
                      {order.status === 'DELIVERED' ? 'Delivered' : 'In Transit'}
                    </span>
                  </div>
                </div>

                {/* Allocation score */}
                <div style={cardStyle}>
                  <SectionLabel>Allocation Score</SectionLabel>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 6, borderRadius: 999, background: '#f1f5f9', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${scorePct}%`, borderRadius: 999,
                        background: `linear-gradient(90deg, ${scoreColor}aa, ${scoreColor})`,
                      }} />
                    </div>
                    <span className="dop-mono" style={{ fontSize: 12, fontWeight: 700, color: scoreColor, minWidth: 34, textAlign: 'right' }}>
                      {scorePct}%
                    </span>
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: 11, color: '#94a3b8' }}>
                    Composite of proximity (60 %) and driver rating (40 %)
                  </p>
                </div>

                {/* Delivery ID */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '9px 12px', borderRadius: 9,
                  background: '#f8fafc', border: '1px solid #e2e8f0',
                }}>
                  <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Delivery ID</span>
                  <code className="dop-mono" style={{ fontSize: 10, color: '#475569', letterSpacing: '0.04em' }}>
                    {delivery._id?.toString().slice(-14).toUpperCase()}
                  </code>
                </div>
              </>
            );
          })()}
        </div>

        <div style={{
          display: 'flex', justifyContent: 'flex-end',
          padding: '14px 22px', borderTop: '1px solid #f1f5f9',
          background: '#fafafa', borderRadius: '0 0 20px 20px',
        }}>
          <button className="dop-btn dop-btn-outline" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Order Detail Modal ───────────────────────────────────────────────────────

interface DetailModalProps {
  order: DistributorOrder;
  pharmacies: Record<string, PharmacyUser>;
  onClose: () => void;
  onCancel: (order: DistributorOrder) => void;
  onViewDispatch: (order: DistributorOrder) => void;
  updatingId: string | null;
}

function OrderDetailModal({ order, pharmacies, onClose, onCancel, onViewDispatch, updatingId }: DetailModalProps) {
  const canReject      = ['PLACED','ACCEPTED'].includes(order.status);
  const hasDispatch = ['DISPATCHED','PICKED_UP','DELIVERED'].includes(order.status);
  const pharma         = pharmacies[order.pharmaID];
  const addr           = formatAddress(pharma?.address);

  return (
    <div className="dop-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="dop-modal">
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'20px 24px 18px', borderBottom:'1px solid #f1f5f9',
          position:'sticky', top:0, background:'#fff', borderRadius:'20px 20px 0 0', zIndex:1,
        }}>
          <div>
            <div style={{ fontSize:16, fontWeight:700, color:'#0f172a' }}>Order Details</div>
            <div className="dop-mono" style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>{order.orderNumber}</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <StatusBadge status={order.status} />
            <button onClick={onClose} style={{
              width:32, height:32, borderRadius:8, border:'1.5px solid #e2e8f0',
              background:'#f8fafc', display:'flex', alignItems:'center',
              justifyContent:'center', cursor:'pointer', color:'#64748b',
            }}>
              <X size={15}/>
            </button>
          </div>
        </div>

        <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:18 }}>
          <div className="dop-detail-section">
            <div style={{ fontSize:10, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:'#94a3b8', marginBottom:10 }}>
              Pharmacy
            </div>
            <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
              <div className="dop-pharma-avatar" style={{ width:44, height:44, fontSize:17 }}>
                {pharma?.name ? pharma.name[0].toUpperCase() : '?'}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, color:'#0f172a', fontSize:15, marginBottom:6 }}>
                  {pharma?.name ?? order.pharmaID}
                </div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {pharma?.phone && (
                    <div className="dop-info-chip">
                      <Phone size={11} color="#6366f1"/> {pharma.phone}
                    </div>
                  )}
                  {addr && (
                    <div className="dop-info-chip">
                      <MapPin size={11} color="#f97316"/> {addr}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            {[
              { label:'Placed On',      value: formatDateTime(order.placedAt) },
              { label:'Grand Total',    value: `₹${toNum(order.grandTotal).toFixed(2)}`, large:true, accent:'#15803d' },
              { label:'Payment Status', value: `${order.paymentStatus}` },
            ].map(({ label, value, large, accent }) => (
              <div key={label} className="dop-detail-section">
                <div style={{ fontSize:10, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:'#94a3b8', marginBottom:5 }}>
                  {label}
                </div>
                <div style={{ fontSize: large ? 20 : 13, fontWeight: large ? 700 : 500, color: accent ?? '#1e293b' }}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          {/* Dispatch info banner */}
          {hasDispatch && (
            <div style={{
              background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)',
              border: '1.5px solid #c7d2fe', borderRadius: 12,
              padding: '14px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Truck size={18} color="#4338ca"/>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e1b4b' }}>
                    {order.status === 'DELIVERED' ? 'Order was delivered' : 'Order is in transit'}
                  </div>
                  <div style={{ fontSize: 11, color: '#6366f1', marginTop: 1 }}>
                    Driver & vehicle assigned
                  </div>
                </div>
              </div>
              <button
                className="dop-btn"
                style={{ background: '#4338ca', color: 'white', border: 'none', padding: '7px 14px', fontSize: 12 }}
                onClick={() => { onClose(); onViewDispatch(order); }}
              >
                View Dispatch
              </button>
            </div>
          )}

          <div>
            <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:'#94a3b8', marginBottom:10 }}>
              Order Items
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {order.items.map((item, idx) => (
                <div key={idx} className="dop-item-card">
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                    <div>
                      <div style={{ fontWeight:600, color:'#0f172a', fontSize:14 }}>{item.name}</div>
                      <div className="dop-mono" style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>{item.productID_Dtb}</div>
                    </div>
                    <div style={{ fontSize:16, fontWeight:700, color:'#0f172a' }}>
                      ₹{(toNum(item.totalAmount)).toFixed(2)}
                    </div>
                  </div>

                  <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
                    {[
                      { label:'Units', val: toNum(item.quantity) },
                      { label:'HSN',   val: item.hsnCode },
                      { label:'GST',   val: `${toNum(item.gstRate)}%` },
                      { label:'Disc',  val: `${toNum(item.discountPercent)}%`, accent:'#f97316' },
                    ].map(({ label, val, accent }) => (
                      <div key={label} style={{ padding:'4px 10px', borderRadius:8, background:'#f8fafc', border:'1px solid #e8edf5', display:'flex', gap:4, alignItems:'center' }}>
                        <span style={{ fontSize:10, color:'#94a3b8', fontWeight:600, textTransform:'uppercase' }}>{label}</span>
                        <span className="dop-mono" style={{ fontSize:12, fontWeight:600, color: accent ?? '#1e293b' }}>{val}</span>
                      </div>
                    ))}
                  </div>

                  {item.taxBreakdown && (
                    <div style={{ borderTop:'1px solid #f1f5f9', paddingTop:10 }}>
                      <TaxRow label="Gross"    value={`₹${toNum(item.taxBreakdown.gross).toFixed(2)}`} />
                      <TaxRow label="Discount" value={`-₹${toNum(item.taxBreakdown.discount).toFixed(2)}`} accent="#ef4444" />
                      <TaxRow label="Taxable"  value={`₹${toNum(item.taxBreakdown.taxable).toFixed(2)}`} />
                      <TaxRow label={`GST (${item.gstRate}%)`} value={`₹${toNum(item.taxBreakdown.gst).toFixed(2)}`} />
                      <TaxRow label="CGST"     value={`₹${toNum(item.taxBreakdown.cgst).toFixed(2)}`} />
                      <TaxRow label="SGST"     value={`₹${toNum(item.taxBreakdown.sgst).toFixed(2)}`} />
                    </div>
                  )}

                  <div style={{ display:'flex', gap:16, flexWrap:'wrap', marginTop:10, paddingTop:10, borderTop:'1px solid #f1f5f9' }}>
                    {item.mrpPerPack  != null && <span style={{ fontSize:12, color:'#64748b' }}>MRP/pack <strong style={{ color:'#1e293b' }}>₹{toNum(item.mrpPerPack).toFixed(2)}</strong></span>}
                    {item.price != null && <span style={{ fontSize:12, color:'#64748b' }}>Price/pack <strong style={{ color:'#1e293b' }}>₹{toNum(item.price).toFixed(2)}</strong></span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {order.status === 'DELIVERED' && order.paymentMode && (
            <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:12, padding:'14px 16px' }}>
              <div style={{ fontSize:10, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:'#15803d', marginBottom:8 }}>Payment</div>
              <div style={{ fontSize:13, color:'#166534' }}>Mode: <strong>{order.paymentMode}</strong></div>
              {order.transactionId && (
                <div className="dop-mono" style={{ fontSize:11, color:'#4ade80', marginTop:4 }}>Txn: {order.transactionId}</div>
              )}
            </div>
          )}

          {order.rejectionReason && (
            <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:12, padding:'14px 16px' }}>
              <div style={{ fontSize:10, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:'#b91c1c', marginBottom:6 }}>
                Rejection Reason
              </div>
              <div style={{ fontSize:13, color:'#991b1b' }}>{order.rejectionReason}</div>
            </div>
          )}
        </div>

        <div style={{
          display:'flex', justifyContent:'flex-end', gap:10,
          padding:'16px 24px', borderTop:'1px solid #f1f5f9',
          background:'#fafafa', borderRadius:'0 0 20px 20px',
        }}>
          {canReject && (
            <button className="dop-btn dop-btn-danger"
              onClick={() => { onClose(); onCancel(order); }}
              disabled={!!updatingId}>
              Reject Order
            </button>
          )}
          <button className="dop-btn dop-btn-outline" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Rejection Modal ──────────────────────────────────────────────────────────

interface CancelModalProps {
  order: DistributorOrder;
  pharmacies: Record<string, PharmacyUser>;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
  isLoading: boolean;
}

function CancelModal({ order, pharmacies, onConfirm, onClose, isLoading }: CancelModalProps) {
  const [reason, setReason] = useState('');
  const [error,  setError]  = useState('');
  const pharmaName = pharmacies[order.pharmaID]?.name ?? order.pharmaID;

  const handleSubmit = async () => {
    if (!reason.trim()) { setError('Please provide a cancellation reason.'); return; }
    await onConfirm(reason.trim());
  };

  return (
    <div className="dop-modal-overlay" style={{ zIndex:70 }}>
      <div className="dop-modal dop-modal-sm">
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'18px 22px 16px', borderBottom:'1px solid #f1f5f9' }}>
          <div style={{ width:40, height:40, borderRadius:12, background:'#fff7ed', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <AlertTriangle size={18} color="#f97316"/>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700, color:'#0f172a', fontSize:15 }}>Reject Order</div>
            <div className="dop-mono" style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>{order.orderNumber}</div>
          </div>
          <button onClick={onClose} style={{ width:30, height:30, borderRadius:7, border:'1.5px solid #e2e8f0', background:'#f8fafc', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#64748b' }}>
            <X size={14}/>
          </button>
        </div>
        <div style={{ padding:'18px 22px', display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:10, padding:'12px 14px', fontSize:13, color:'#9a3412' }}>
            Rejecting order from <strong>{pharmaName}</strong> — <strong>{getItemSummary(order)}</strong> worth{' '}
            <strong>₹{toNum(order.grandTotal).toFixed(2)}</strong>. This cannot be undone.
          </div>
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:6 }}>
              Rejection Reason <span style={{ color:'#ef4444' }}>*</span>
            </label>
            <textarea
              className="dop-input"
              value={reason}
              rows={3}
              placeholder="Describe why you're rejecting this order…"
              onChange={e => { setReason(e.target.value); setError(''); }}
            />
            {error && (
              <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:5, fontSize:12, color:'#ef4444' }}>
                <AlertTriangle size={12}/> {error}
              </div>
            )}
          </div>
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:10, padding:'14px 22px', borderTop:'1px solid #f1f5f9', background:'#fafafa', borderRadius:'0 0 20px 20px' }}>
          <button className="dop-btn dop-btn-outline" onClick={onClose} disabled={isLoading}>Back</button>
          <button className="dop-btn dop-btn-danger" onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Rejecting…' : 'Confirm Reject'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Filter config ────────────────────────────────────────────────────────────

type FilterKey = 'all' | 'active' | 'delivered' | 'cancelled';
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',       label: 'All Orders' },
  { key: 'active',    label: 'Active' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled / Rejected' },
];

function applyFilter(orders: DistributorOrder[], filter: FilterKey) {
  switch (filter) {
    case 'active':    return orders.filter(o => ['PLACED','ACCEPTED','DISPATCHED'].includes(o.status));
    case 'delivered': return orders.filter(o => o.status === 'DELIVERED');
    case 'cancelled': return orders.filter(o => ['CANCELLED','REJECTED','TIME_EXPIRED'].includes(o.status));
    default:          return orders;
  }
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 9;

export default function DistributorOrdersPage() {
  const { user } = useAuth();

  const [orders,              setOrders]              = useState<DistributorOrder[]>([]);
  const [loading,             setLoading]             = useState(true);
  const [error,               setError]               = useState<string | null>(null);
  const [updatingId,          setUpdatingId]          = useState<string | null>(null);
  const [selectedOrder,       setSelectedOrder]       = useState<DistributorOrder | null>(null);
  const [cancelTarget,        setCancelTarget]        = useState<DistributorOrder | null>(null);
  const [dispatchTarget,      setDispatchTarget]      = useState<DistributorOrder | null>(null);
  const [dispatchInfoTarget,  setDispatchInfoTarget]  = useState<DistributorOrder | null>(null); // ← NEW
  const [filter,              setFilter]              = useState<FilterKey>('all');
  const [currentPage,         setCurrentPage]         = useState(1);
  const [pharmacies,          setPharmacies]          = useState<Record<string, PharmacyUser>>({});
  const [search,              setSearch]              = useState('');

  useEffect(() => {
    if (!user?.id) return;
    loadOrders();
  }, [user?.id]);

  useEffect(() => {
    if (orders.length === 0) return;
    const uniqueIds = [...new Set(orders.map(o => o.pharmaID))];
    uniqueIds.forEach(async (id) => {
      if (pharmacies[id]) return;
      const data = await pharmacyService.getPharmacyById(id);
      if (data) setPharmacies(prev => ({ ...prev, [id]: data }));
    });
  }, [orders]);

  const loadOrders = async () => {
    try {
      setLoading(true); setError(null);
      const data = await distributorOrderService.getOrdersByDistributor(user!.id);
      setOrders(data);
      setCurrentPage(1);
    } catch (err: any) {
      setError(err?.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (order: DistributorOrder, newStatus: 'ACCEPTED') => {
    try {
      setUpdatingId(order._id);
      const updated = await distributorOrderService.updateStatus(order._id, newStatus);
      setOrders(prev => prev.map(o => o._id === updated._id ? updated : o));
      if (selectedOrder?._id === updated._id) setSelectedOrder(updated);
    } catch (err: any) {
      alert(err?.message || `Failed to update order status`);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleReject = async (reason: string) => {
    if (!cancelTarget) return;
    try {
      setUpdatingId(cancelTarget._id);
      const updated = await distributorOrderService.rejectOrder(cancelTarget._id, reason);
      setOrders(prev => prev.map(o => o._id === updated._id ? updated : o));
      if (selectedOrder?._id === updated._id) setSelectedOrder(updated);
      setCancelTarget(null);
    } catch (err: any) {
      alert(err?.message || 'Failed to reject order');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDispatchSuccess = (result: DispatchResult) => {
    const updated = result.order as DistributorOrder;
    setOrders(prev => prev.map(o => o._id === updated._id ? updated : o));
    if (selectedOrder?._id === updated._id) setSelectedOrder(updated);
    setDispatchTarget(null);
  };

  const stats = {
    total:     orders.length,
    active:    orders.filter(o => ['PLACED','ACCEPTED','DISPATCHED'].includes(o.status)).length,
    delivered: orders.filter(o => o.status === 'DELIVERED').length,
    cancelled: orders.filter(o => ['CANCELLED','REJECTED','TIME_EXPIRED'].includes(o.status)).length,
  };

  const sorted      = [...orders].sort((a,b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime());
  const afterFilter = applyFilter(sorted, filter);
  const afterSearch = search.trim()
    ? afterFilter.filter(o =>
        o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
        (pharmacies[o.pharmaID]?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        o.pharmaID.toLowerCase().includes(search.toLowerCase()) ||
        o.items.some(i => i.name.toLowerCase().includes(search.toLowerCase()))
      )
    : afterFilter;

  const totalPages = Math.ceil(afterSearch.length / ITEMS_PER_PAGE);
  const paginated  = afterSearch.slice((currentPage-1)*ITEMS_PER_PAGE, currentPage*ITEMS_PER_PAGE);

  return (
    <>
      <style>{STYLES}</style>
      <div className="dop-root" style={{ display:'flex', flexDirection:'column', gap:20 }}>

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
          <StatCard label="Total Orders"       value={stats.total}     icon={<Package size={20}/>}    accent="#3b82f6"/>
          <StatCard label="Active"             value={stats.active}    icon={<TrendingUp size={20}/>} accent="#8b5cf6"/>
          <StatCard label="Delivered"          value={stats.delivered} icon={<BoxIcon size={20}/>}    accent="#22c55e"/>
          <StatCard label="Cancelled/Rejected" value={stats.cancelled} icon={<Ban size={20}/>}        accent="#f97316"/>
        </div>

        {/* Main card */}
        <div className="dop-card">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 24px 16px', borderBottom:'1px solid #f1f5f9', flexWrap:'wrap', gap:12 }}>
            <div>
              <div style={{ fontSize:17, fontWeight:700, color:'#0f172a' }}>Purchase Orders</div>
              <div style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>
                {afterSearch.length} order{afterSearch.length!==1?'s':''}
                {filter!=='all' ? ` · ${FILTERS.find(f=>f.key===filter)?.label}` : ''}
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div className="dop-search-wrap">
                <Search size={14}/>
                <input
                  className="dop-search-input"
                  placeholder="Search orders, pharmacies…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                />
              </div>
              <button
                className="dop-btn dop-btn-outline"
                onClick={loadOrders}
                disabled={loading}
                style={{ display:'flex', alignItems:'center', gap:6 }}
              >
                <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}/>
                {loading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ margin:'16px 24px 0', padding:'12px 14px', borderRadius:10, background:'#fef2f2', border:'1px solid #fecaca', fontSize:13, color:'#b91c1c' }}>
              {error}
            </div>
          )}

          {/* Filters */}
          <div style={{ display:'flex', gap:8, padding:'16px 24px 0', flexWrap:'wrap' }}>
            {FILTERS.map(f => (
              <button
                key={f.key}
                className={`dop-filter-btn ${filter===f.key?'active':''}`}
                onClick={() => { setFilter(f.key); setCurrentPage(1); }}
              >
                {f.label}
                {f.key !== 'all' && (
                  <span style={{
                    marginLeft:6, fontSize:10, fontWeight:700,
                    background: filter===f.key ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                    color: filter===f.key ? '#fff' : '#64748b',
                    padding:'1px 6px', borderRadius:999,
                  }}>
                    {f.key==='active' ? stats.active : f.key==='delivered' ? stats.delivered : stats.cancelled}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Table */}
          <div style={{ overflowX:'auto', padding:'16px 24px 0' }}>
            <table className="dop-table" style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign:'left' }}>Order</th>
                  <th style={{ textAlign:'left' }}>Pharmacy</th>
                  <th style={{ textAlign:'left' }}>Items</th>
                  <th style={{ textAlign:'right' }}>Total</th>
                  <th style={{ textAlign:'left' }}>Status</th>
                  <th style={{ textAlign:'center', minWidth:140 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 4 }).map((_,i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((_,j) => (
                        <td key={j}>
                          <div className="dop-pulse" style={{ height:13, borderRadius:6, background:'#f1f5f9', width: j===0?'80%':j===3?'50%':'70%' }}/>
                        </td>
                      ))}
                    </tr>
                  ))
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="dop-empty">
                        <div className="dop-empty-icon"><Package size={28} color="#cbd5e1"/></div>
                        <div style={{ fontWeight:600, color:'#64748b', fontSize:14 }}>No orders found</div>
                        <div style={{ fontSize:12, color:'#94a3b8' }}>
                          {search ? 'Try a different search term' : 'Orders will appear here once placed'}
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : paginated.map(order => {
                  const isUpdating  = updatingId === order._id;
                  const canReject   = ['PLACED','ACCEPTED'].includes(order.status);
                  const hasDispatch = ['DISPATCHED','DELIVERED'].includes(order.status);

                  return (
                    <tr key={order._id}>
                      <td>
                        <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                          <div className="dop-order-icon">
                            <Package size={18} color="#0284c7"/>
                          </div>
                          <div>
                            <div className="dop-mono" style={{ fontSize:12, fontWeight:600, color:'#1e293b' }}>
                              {order.orderNumber}
                            </div>
                            <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>{timeAgo(order.placedAt)}</div>
                            <StatusPipeline status={order.status}/>
                          </div>
                        </div>
                      </td>

                      <td style={{ maxWidth:220 }}>
                        <PharmacyCell pharma={pharmacies[order.pharmaID]}/>
                      </td>

                      <td>
                        <div style={{ fontSize:13, fontWeight:500, color:'#374151' }}>
                          {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                        </div>
                      </td>

                      <td style={{ textAlign:'right' }}>
                        <div className="dop-mono" style={{ fontSize:14, fontWeight:700, color:'#0f172a' }}>
                          ₹{Number(order.grandTotal).toFixed(2)}
                        </div>
                      </td>

                      <td><StatusBadge status={order.status}/></td>

                      <td>
                        <div style={{ display:'flex', flexDirection:'column', gap:6, alignItems:'stretch' }}>
                          <button
                            className="dop-btn dop-btn-outline"
                            style={{ padding:'6px 12px', fontSize:12, justifyContent:'center' }}
                            onClick={() => setSelectedOrder(order)}
                          >
                            View Details
                          </button>

                          {order.status === 'PLACED' && (
                            <button
                              className="dop-action-btn dop-action-accept"
                              style={{ justifyContent:'center' }}
                              onClick={() => handleStatusUpdate(order, 'ACCEPTED')}
                              disabled={isUpdating}
                            >
                              {isUpdating
                                ? <span className="dop-pulse">Accepting…</span>
                                : <><CheckCircle2 size={12}/> Accept Order</>
                              }
                            </button>
                          )}

                          {order.status === 'ACCEPTED' && (
                            <button
                              className="dop-action-btn dop-action-dispatch"
                              style={{ justifyContent:'center' }}
                              onClick={() => setDispatchTarget(order)}
                              disabled={isUpdating}
                            >
                              <Truck size={12}/> Dispatch <ArrowRight size={11}/>
                            </button>
                          )}

                          {/* ── View Dispatch — DISPATCHED / DELIVERED ── */}
                          {hasDispatch && (
                            <button
                              className="dop-action-btn dop-action-view-dispatch"
                              style={{ justifyContent:'center' }}
                              onClick={() => setDispatchInfoTarget(order)}
                            >
                              <Truck size={12}/> View Dispatch
                            </button>
                          )}

                          {canReject && (
                            <button
                              className="dop-action-btn dop-action-reject"
                              style={{ justifyContent:'center' }}
                              onClick={() => setCancelTarget(order)}
                              disabled={isUpdating}
                            >
                              <XCircle size={12}/> Reject
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && afterSearch.length > 0 && (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 24px 20px', flexWrap:'wrap', gap:12 }}>
              <div style={{ fontSize:12, color:'#94a3b8' }}>
                Showing{' '}
                <strong style={{ color:'#475569' }}>
                  {paginated.length > 0 ? (currentPage-1)*ITEMS_PER_PAGE+1 : 0}–{Math.min(currentPage*ITEMS_PER_PAGE, afterSearch.length)}
                </strong>{' '}
                of <strong style={{ color:'#475569' }}>{afterSearch.length}</strong> orders
              </div>
              {totalPages > 1 && (
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <button className="dop-pagination-btn" onClick={() => setCurrentPage(p => Math.max(1,p-1))} disabled={currentPage===1}>
                    <ChevronLeft size={14}/> Prev
                  </button>
                  {Array.from({ length: totalPages }, (_,i) => i+1).map(p => (
                    <button key={p} className={`dop-page-num ${p===currentPage?'active':''}`} onClick={() => setCurrentPage(p)}>
                      {p}
                    </button>
                  ))}
                  <button className="dop-pagination-btn" onClick={() => setCurrentPage(p => Math.min(totalPages,p+1))} disabled={currentPage===totalPages}>
                    Next <ChevronRight size={14}/>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Modals ── */}
        {selectedOrder && (
          <OrderDetailModal
            order={selectedOrder}
            pharmacies={pharmacies}
            onClose={() => setSelectedOrder(null)}
            onCancel={order => { setSelectedOrder(null); setCancelTarget(order); }}
            onViewDispatch={order => setDispatchInfoTarget(order)}
            updatingId={updatingId}
          />
        )}

        {cancelTarget && (
          <CancelModal
            order={cancelTarget}
            pharmacies={pharmacies}
            onConfirm={handleReject}
            onClose={() => setCancelTarget(null)}
            isLoading={updatingId === cancelTarget._id}
          />
        )}

        {dispatchTarget && (
          <DispatchModal
  order={dispatchTarget}
  onSuccess={handleDispatchSuccess}
  onClose={() => setDispatchTarget(null)}
/>
        )}

        {/* ── NEW: Dispatch Info Modal ── */}
        {dispatchInfoTarget && (
          <DispatchInfoModal
            order={dispatchInfoTarget}
            onClose={() => setDispatchInfoTarget(null)}
          />
        )}
      </div>
    </>
  );
}