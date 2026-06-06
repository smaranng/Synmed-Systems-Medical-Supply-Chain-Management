// MyOrders.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildTimeline,
  cancelOrder,
  checkOrderExpiry,
  fetchOrder,
  fetchOrdersByPharma,
  getPharmaIDFromToken,
  OrderStatus,
  pollOrder,
  resolveAmount,
  secondsUntilExpiry,
  TERMINAL_STATUSES,
  TrackedOrder,
  TrackingStep,
} from '../services/ordertrackingService';
import { distributorService } from '../services/distributorService';
import { getToken } from '../services/authService';
import LiveDriverMap, { DriverLocation } from './LiveDriverMap';


// ─── Delivery info type ───────────────────────────────────────────────────────

interface DeliveryInfo {
  deliveryID:              string;
  orderNumber:             string;
  driverID:                string;
  driverName:              string;
  driverPhone:             string;
  driverRating?:           number;
  vehicleID:               string;
  vehicleNumber:           string;
  vehicleType:             string;
  otp?:                    string;
  distanceKm?:             number | null;
  allocationScore?:        number;
  /** Destination coordinates returned by the deliveries endpoint */
  destinationLat?:         number | null;
  destinationLng?:         number | null;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

const BASE = 'http://localhost:5205';

async function fetchDelivery(orderId: string): Promise<DeliveryInfo> {
  const token = getToken();
  const res = await fetch(`${BASE}/distributor-orders/${orderId}/delivery`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Could not fetch delivery info (${res.status})`);
  return res.json();
}

async function fetchDeliveryWithRetry(
  orderId: string,
  retries = 4,
  delayMs = 2500,
): Promise<DeliveryInfo> {
  let lastErr: Error = new Error('unknown');
  for (let i = 0; i < retries; i++) {
    try {
      return await fetchDelivery(orderId);
    } catch (err) {
      lastErr = err as Error;
      if (i < retries - 1) await new Promise(r => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw lastErr;
}

const WS_BASE = 'wss://elease-unmodern-michel.ngrok-free.dev';

// ─── useDriverLocation hook ───────────────────────────────────────────────────

function useDriverLocation(orderNumber: string | null): DriverLocation | null {
  const [loc, setLoc] = useState<DriverLocation | null>(null);
  const wsRef         = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!orderNumber) return;
    const token = getToken();
    if (!token) return;

    const ws = new WebSocket(
      `${WS_BASE}/ws/distributor-orders?token=${token}`,
      ['ngrok-skip-browser-warning'],
    );
    wsRef.current = ws;

    ws.onopen = () => ws.send(JSON.stringify({ type: 'subscribe_location', orderNumber }));

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'location_update' && msg.orderNumber === orderNumber) {
          setLoc({
            lat:               msg.lat,
            lng:               msg.lng,
            timestamp:         msg.timestamp,
            speedKmh:          msg.speedKmh          ?? null,
            distanceCoveredKm: msg.distanceCoveredKm ?? null,
          });
        }
      } catch { /* ignore parse errors */ }
    };

    ws.onerror = (e) => console.warn('Location WS error:', e);

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'unsubscribe_location' }));
      }
      ws.close();
    };
  }, [orderNumber]);

  return loc;
}

// ─── payOrder ─────────────────────────────────────────────────────────────────

async function payOrder(orderId: string): Promise<TrackedOrder> {
  const res = await fetch(`${BASE}/distributor-orders/${orderId}/pay`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Payment failed');
  }
  return res.json();
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmt(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function formatETA(dateStr?: string) {
  if (!dateStr) return '';
  const date     = new Date(dateStr);
  const now      = new Date();
  const time     = date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  const tomorrow = new Date();
  tomorrow.setDate(now.getDate() + 1);
  if (date.toDateString() === now.toDateString())      return `Arriving today by ${time}`;
  if (date.toDateString() === tomorrow.toDateString()) return `Arriving tomorrow by ${time}`;
  const day = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return `Arriving by ${day}, ${time}`;
}

function fmtCurrency(n: number) {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtCountdown(secs: number): string {
  if (secs <= 0) return '00:00:00';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
}

// ─── Colour tokens ────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  PLACED:       '#019bdd',
  ACCEPTED:     '#0ea5e9',
  DISPATCHED:   '#8b5cf6',
  PICKED_UP:    '#f59e0b',
  DELIVERED:    '#22c55e',
  REJECTED:     '#ef4444',
  CANCELLED:    '#f97316',
  TIME_EXPIRED: '#94a3b8',
};

const STATUS_BG: Record<string, string> = {
  PLACED:       '#e0f2fe',
  ACCEPTED:     '#e0f7fe',
  DISPATCHED:   '#ede9fe',
  PICKED_UP:    '#fef3c7',
  DELIVERED:    '#dcfce7',
  REJECTED:     '#fee2e2',
  CANCELLED:    '#fff7ed',
  TIME_EXPIRED: '#f1f5f9',
};

const STATUS_LABELS: Record<string, string> = {
  PLACED:       'Placed',
  ACCEPTED:     'Accepted',
  DISPATCHED:   'Out for Delivery',
  PICKED_UP:    'Picked Up',
  DELIVERED:    'Delivered',
  REJECTED:     'Rejected',
  CANCELLED:    'Cancelled',
  TIME_EXPIRED: 'Expired',
};

// ─── List column widths ───────────────────────────────────────────────────────

const LIST_COLS = '2fr 1.5fr 80px 130px 110px 100px';

// ─── StatusPill ───────────────────────────────────────────────────────────────

function StatusPill({ status, small }: { status: string; small?: boolean }) {
  const color = STATUS_COLOR[status] ?? '#64748b';
  const bg    = STATUS_BG[status]    ?? '#f1f5f9';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: small ? '2px 8px' : '4px 12px',
      borderRadius: 999, fontSize: small ? 10 : 11,
      fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
      color, background: bg, border: `1.5px solid ${color}33`, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: small ? 5 : 6, height: small ? 5 : 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ─── DriverCard ───────────────────────────────────────────────────────────────

function DriverCard({ deliveryInfo, isDelivered }: { deliveryInfo: DeliveryInfo; isDelivered: boolean }) {
  const raw = deliveryInfo.driverRating;

  let rating: number | null = null;
  if (typeof raw === 'number' && !isNaN(raw)) {
    rating = raw;
  } else if (typeof raw === 'string') {
    const p = parseFloat(raw);
    rating  = !isNaN(p) ? p : null;
  } else if (raw && typeof raw === 'object' && '$numberDecimal' in raw) {
    const p = parseFloat((raw as any).$numberDecimal);
    rating  = !isNaN(p) ? p : null;
  }

  const fullStars = rating ? Math.floor(rating) : 0;
  const hasHalf   = rating ? rating - fullStars >= 0.5 : false;

  return (
    <div style={{
      marginLeft: 46, marginBottom: 16,
      borderRadius: 14, overflow: 'hidden',
      border: '1.5px solid #ede9fe',
      boxShadow: '0 4px 18px rgba(139,92,246,0.10)',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 16px',
        background: 'linear-gradient(135deg,#f5f3ff,#ede9fe)',
        borderBottom: '1.5px solid #ede9fe',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 20 }}>{isDelivered ? '✅' : '🚚'}</span>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#6d28d9' }}>
            {isDelivered ? 'Delivered by' : 'Driver Assigned'}
          </p>
          <p style={{ margin: 0, fontSize: 10, color: '#7c3aed' }}>
            {isDelivered ? 'Delivery complete' : 'Your order is on its way'}
          </p>
        </div>
        {!isDelivered && (
          <span style={{
            fontSize: 9, fontWeight: 800, color: '#7c3aed',
            background: '#ede9fe', padding: '3px 9px', borderRadius: 999,
            letterSpacing: '0.07em', animation: 'ot-pulse-opacity 2s ease-in-out infinite',
          }}>● LIVE</span>
        )}
      </div>

      {/* Body */}
      <div style={{ background: 'white', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Driver row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <span style={{ fontSize: 18, color: 'white' }}>👤</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {deliveryInfo.driverName || 'Driver'}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
              {[0, 1, 2, 3, 4].map(i => {
                if (i < fullStars) return <span key={i} style={{ color: '#f59e0b', fontSize: 12 }}>★</span>;
                if (i === fullStars && hasHalf) {
                  return (
                    <span key={i} style={{ position: 'relative', display: 'inline-block', fontSize: 12, color: '#e2e8f0' }}>
                      ★
                      <span style={{ position: 'absolute', left: 0, top: 0, width: '50%', overflow: 'hidden', color: '#f59e0b' }}>★</span>
                    </span>
                  );
                }
                return <span key={i} style={{ color: '#e2e8f0', fontSize: 12 }}>★</span>;
              })}
              <span style={{ fontSize: 11, color: '#64748b', marginLeft: 4 }}>
                {rating !== null ? rating.toFixed(1) : 'No rating'}
              </span>
            </div>
          </div>
          {deliveryInfo.driverPhone && (
            <a
              href={`tel:${deliveryInfo.driverPhone}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '7px 12px', borderRadius: 9,
                background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)',
                color: 'white', textDecoration: 'none',
                fontSize: 12, fontWeight: 700, flexShrink: 0,
                boxShadow: '0 2px 8px rgba(139,92,246,0.30)',
              }}
            >
              📞 Call
            </a>
          )}
        </div>

        <div style={{ height: 1, background: '#f1f5f9' }} />

        {/* Vehicle row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9,
            background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <span style={{ fontSize: 18 }}>🚛</span>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Vehicle</p>
            <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
              {deliveryInfo.vehicleType || 'Vehicle'}
              <span style={{
                marginLeft: 8, fontSize: 11, fontWeight: 700,
                background: '#f1f5f9', color: '#475569',
                padding: '2px 9px', borderRadius: 6, fontFamily: 'monospace', letterSpacing: '0.06em',
              }}>
                {deliveryInfo.vehicleNumber}
              </span>
            </p>
          </div>
        </div>

        {deliveryInfo.driverPhone && (
          <>
            <div style={{ height: 1, background: '#f1f5f9' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 9,
                background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <span style={{ fontSize: 16 }}>📱</span>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Phone</p>
                <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
                  {deliveryInfo.driverPhone}
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── DetailTimeline ───────────────────────────────────────────────────────────

function DetailTimeline({
  steps, order, deliveryInfo, driverLocation,
}: {
  steps:          TrackingStep[];
  order:          TrackedOrder;
  deliveryInfo:   DeliveryInfo | null;
  driverLocation: DriverLocation | null;
}) {
  const isPickedUp = order.status === 'PICKED_UP';

  const showDriver = deliveryInfo &&
    ['DISPATCHED', 'PICKED_UP', 'DELIVERED'].includes(order.status);

  // ── Derive destination from deliveryInfo ────────────────────────────────────
  const destination = (
    deliveryInfo?.destinationLat != null &&
    deliveryInfo?.destinationLng != null
  )
    ? { lat: deliveryInfo.destinationLat, lng: deliveryInfo.destinationLng }
    : null;

  const normaliseStep = (step: TrackingStep): TrackingStep => {
    if (isPickedUp && step.status === 'DISPATCHED') {
      return { ...step, active: false, completed: true };
    }
    return step;
  };

  return (
    <div style={{ position: 'relative', padding: '4px 0' }}>
      {steps.map((rawStep, idx) => {
        const step   = normaliseStep(rawStep);
        const isLast = idx === steps.length - 1;

        const isDispatchStep = step.status === 'DISPATCHED';

        const color = step.isError
          ? '#ef4444'
          : step.completed || step.active
            ? STATUS_COLOR[step.status] ?? '#019bdd'
            : '#cbd5e1';

        return (
          <React.Fragment key={`${step.status}-${idx}`}>
            <div style={{ display: 'flex', gap: 16, position: 'relative' }}>
              {!isLast && (
                <div style={{
                  position: 'absolute', left: 14, top: 30, bottom: 0, width: 2,
                  background: step.completed ? color : '#e2e8f0',
                  transition: 'background 0.4s',
                }} />
              )}
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: step.completed || step.active ? color : 'white',
                border: `2.5px solid ${color}`,
                flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 1,
                boxShadow: step.active ? `0 0 0 5px ${color}22` : 'none',
                transition: 'all 0.3s',
              }}>
                {step.isFinal && !step.isError && (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 7l3.5 3.5L12 3" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {step.isError && (
                  <span style={{ color: 'white', fontWeight: 900, fontSize: 14, lineHeight: 1 }}>×</span>
                )}
                {step.active && !step.isFinal && !step.isError && (
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'white', animation: 'ot-pulse 1.6s ease-in-out infinite' }} />
                )}
              </div>
              <div style={{ paddingBottom: isDispatchStep && showDriver ? 14 : 28, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{
                    fontWeight: step.active || step.completed ? 700 : 500,
                    fontSize: 13.5,
                    color: step.active || step.completed ? '#0f172a' : '#94a3b8',
                  }}>
                    {step.label}
                  </span>
                  {step.active && <StatusPill status={step.status} small />}
                </div>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: step.active || step.completed ? '#475569' : '#cbd5e1' }}>
                  {step.description}
                </p>
                {step.timestamp && (
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>
                    {fmt(step.timestamp)}
                  </p>
                )}
              </div>
            </div>

            {/* Driver card + map injected after DISPATCHED step */}
            {isDispatchStep && showDriver && deliveryInfo && (
              <>
                <DriverCard
                  deliveryInfo={deliveryInfo}
                  isDelivered={order.status === 'DELIVERED'}
                />
                <LiveDriverMap
                  driverLocation={order.status === 'DELIVERED' ? null : driverLocation}
                  orderStatus={order.status}
                  destination={destination}
                />
              </>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── CountdownBanner ──────────────────────────────────────────────────────────

function CountdownBanner({ order, onExpired }: { order: TrackedOrder; onExpired: () => void }) {
  const [secs, setSecs] = useState(() => Math.max(0, secondsUntilExpiry(order)));
  const firedRef        = useRef(false);

  useEffect(() => {
    if (secs <= 0) {
      if (!firedRef.current) { firedRef.current = true; onExpired(); }
      return;
    }
    const id = setInterval(() => {
      setSecs(s => {
        const next = s - 1;
        if (next <= 0 && !firedRef.current) { firedRef.current = true; clearInterval(id); onExpired(); }
        return Math.max(0, next);
      });
    }, 1000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (secs <= 0) return null;
  const urgent = secs < 3600;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '12px 16px', borderRadius: 12,
      background: urgent ? '#fff7ed' : '#f0fdf4',
      border: `1.5px solid ${urgent ? '#f97316' : '#22c55e'}44`, marginBottom: 20,
    }}>
      <span style={{ fontSize: 22 }}>{urgent ? '⏳' : '🕐'}</span>
      <div>
        <p style={{ margin: 0, fontSize: 10, color: '#64748b', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Distributor must accept within
        </p>
        <p style={{ margin: '2px 0 0', fontFamily: 'monospace', fontSize: 22, fontWeight: 800, color: urgent ? '#ea580c' : '#16a34a', letterSpacing: '0.06em', lineHeight: 1 }}>
          {fmtCountdown(secs)}
        </p>
      </div>
    </div>
  );
}

// ─── OtpBox ───────────────────────────────────────────────────────────────────

function OtpBox({ otp }: { otp: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(otp).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{ margin: '16px 0', borderRadius: 14, overflow: 'hidden', border: '2px dashed #f59e0b', background: 'linear-gradient(135deg,#fef9c3,#fef3c7)' }}>
      <div style={{ padding: '10px 16px', background: 'rgba(245,158,11,0.12)', borderBottom: '1.5px dashed #fcd34d', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>🔐</span>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Delivery OTP — Show to Driver
        </p>
      </div>
      <div style={{ padding: '14px 16px', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: 38, fontWeight: 900, color: '#b45309', fontFamily: 'monospace', letterSpacing: '0.28em', textShadow: '0 2px 4px rgba(180,83,9,0.15)' }}>
          {otp}
        </p>
        <p style={{ margin: '8px 0 0', fontSize: 11, color: '#78350f', fontWeight: 600 }}>
          Mention this OTP to your delivery driver to confirm receipt
        </p>
        <button onClick={handleCopy} style={{ marginTop: 10, padding: '6px 18px', background: copied ? '#22c55e' : 'white', color: copied ? 'white' : '#92400e', border: `1.5px solid ${copied ? '#22c55e' : '#f59e0b'}`, borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}>
          {copied ? '✓ Copied!' : '📋 Copy OTP'}
        </button>
      </div>
    </div>
  );
}

// ─── PayButton ────────────────────────────────────────────────────────────────

function PayButton({ order, onPaid }: { order: TrackedOrder; onPaid: (updated: TrackedOrder) => void }) {
  const [paying,      setPaying]      = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handlePay = async () => {
    setPaying(true);
    try {
      const updated = await payOrder(order._id);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);
      onPaid(updated);
    } catch (e: unknown) {
      alert((e as Error).message);
    } finally {
      setPaying(false);
    }
  };

  if (showSuccess) {
    return (
      <div style={{
        marginTop: 20, padding: '20px 16px',
        background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)',
        border: '1.5px solid #86efac', borderRadius: 14,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        animation: 'ot-fadein 0.35s ease',
      }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,#22c55e,#16a34a)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(34,197,94,0.35)', animation: 'ot-pop 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M4 12l5.5 5.5L20 6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#15803d' }}>Payment Successful!</p>
        <p style={{ margin: 0, fontSize: 12, color: '#16a34a', fontWeight: 600 }}>{fmtCurrency(order.grandTotal)} paid</p>
        {order.transactionId && (
          <p style={{ margin: 0, fontSize: 10, color: '#64748b', fontFamily: 'monospace', background: '#f0fdf4', padding: '4px 10px', borderRadius: 6 }}>
            Txn: {order.transactionId}
          </p>
        )}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 20 }}>
      <button onClick={handlePay} disabled={paying} style={{ width: '100%', padding: '14px 20px', background: paying ? '#94a3b8' : 'linear-gradient(135deg,#019bdd 0%,#0284c7 100%)', color: 'white', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: paying ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: paying ? 'none' : '0 4px 16px rgba(1,155,221,0.30)', transition: 'all 0.25s', letterSpacing: '0.01em' }}>
        {paying ? (
          <>
            <div style={{ ...spinnerStyle, width: 18, height: 18, border: '2.5px solid rgba(255,255,255,0.4)', borderTopColor: 'white' }} />
            Processing…
          </>
        ) : (
          <>💳 Pay {fmtCurrency(order.grandTotal)}</>
        )}
      </button>
      <p style={{ margin: '8px 0 0', fontSize: 11, color: '#94a3b8', textAlign: 'center', fontWeight: 500 }}>
        Pay on delivery — amount will be marked as received by distributor
      </p>
    </div>
  );
}

// ─── PaidBadge ────────────────────────────────────────────────────────────────

function PaidBadge({ transactionId, amount }: { transactionId?: string; amount: number }) {
  return (
    <div style={{ marginTop: 20, padding: '16px', background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', border: '1.5px solid #86efac', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg,#22c55e,#16a34a)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M3 9l4 4 8-8" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: '#15803d' }}>Payment Complete — {fmtCurrency(amount)}</p>
        {transactionId && (
          <p style={{ margin: '3px 0 0', fontSize: 11, color: '#64748b', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Txn: {transactionId}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── DetailedBill ─────────────────────────────────────────────────────────────

function DetailedBill({ order }: { order: TrackedOrder }) {
  type RichItem = {
    name: string; qty: number; mrp: number; disc: number; price: number; gstRate: number;
    taxableAmt: number; cgst: number; sgst: number; lineTotal: number;
  };

  const richItems: RichItem[] = order.items.map(item => {
    const lineTotal  = resolveAmount(item.totalAmount);
    const gstRate    = item.gstRate ?? 0;
    const disc       = item.discountPercent ?? 0;
    const taxableAmt = item.taxBreakdown?.taxable != null
      ? resolveAmount(item.taxBreakdown.taxable)
      : lineTotal / (1 + gstRate / 100);
    const cgst       = item.taxBreakdown?.cgst != null
      ? resolveAmount(item.taxBreakdown.cgst)
      : (lineTotal - taxableAmt) / 2;
    const sgst       = item.taxBreakdown?.sgst != null
      ? resolveAmount(item.taxBreakdown.sgst)
      : cgst;
    return { name: item.name, qty: item.quantity, mrp: resolveAmount(item.mrpPerPack), disc, price: resolveAmount(item.price), gstRate, taxableAmt, cgst, sgst, lineTotal };
  });

  const subtotal   = richItems.reduce((s, i) => s + i.taxableAmt, 0);
  const totalGst   = richItems.reduce((s, i) => s + i.cgst + i.sgst, 0);
  const grandTotal = order.grandTotal;

  const buckets = new Map<number, { rate: number; taxable: number; cgst: number; sgst: number; total: number }>();
  richItems.forEach(i => {
    if (!buckets.has(i.gstRate)) buckets.set(i.gstRate, { rate: i.gstRate, taxable: 0, cgst: 0, sgst: 0, total: 0 });
    const b = buckets.get(i.gstRate)!;
    b.taxable += i.taxableAmt; b.cgst += i.cgst; b.sgst += i.sgst; b.total += i.cgst + i.sgst;
  });
  const gstRows = Array.from(buckets.values()).sort((a, b) => a.rate - b.rate);

  const TH = ({ children, right, center }: { children: React.ReactNode; right?: boolean; center?: boolean }) => (
    <th style={{ padding: '8px 10px', textAlign: right ? 'right' : center ? 'center' : 'left', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: '#64748b', textTransform: 'uppercase', background: '#f8fafc', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' }}>{children}</th>
  );

  const TD = ({ children, right, center, bold, small, muted }: { children: React.ReactNode; right?: boolean; center?: boolean; bold?: boolean; small?: boolean; muted?: boolean }) => (
    <td style={{ padding: '9px 10px', textAlign: right ? 'right' : center ? 'center' : 'left', fontSize: small ? 11 : 12, fontWeight: bold ? 700 : 400, color: muted ? '#64748b' : undefined, borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' }}>{children}</td>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Line items */}
      <div>
        <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: '#0f172a' }}>Line Items</p>
        <div style={{ overflowX: 'auto', borderRadius: 10, border: '1.5px solid #e2e8f0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
            <thead>
              <tr><TH>Medicine</TH><TH right>MRP</TH><TH center>Disc</TH><TH right>Price</TH><TH center>Qty</TH><TH right>Total</TH><TH right>Taxable</TH></tr>
            </thead>
            <tbody>
              {richItems.map((item, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                  <TD><span style={{ fontWeight: 600 }}>{item.name}</span></TD>
                  <TD right muted>{fmtCurrency(item.mrp)}</TD>
                  <TD center><span style={{ fontSize: 10, fontWeight: 700, background: '#fef9c3', color: '#92400e', padding: '2px 7px', borderRadius: 6 }}>{item.disc}%</span></TD>
                  <TD right>{fmtCurrency(item.price)}</TD>
                  <TD center>{item.qty}</TD>
                  <TD right bold>~{fmtCurrency(item.lineTotal)}</TD>
                  <TD right bold>{fmtCurrency(item.taxableAmt)}</TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* GST summary */}
      <div>
        <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: '#0f172a' }}>GST Summary</p>
        <div style={{ borderRadius: 10, border: '1.5px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr><TH>GST Slab</TH><TH right>Taxable Value</TH><TH right>CGST</TH><TH right>SGST</TH><TH right>Total Tax</TH></tr>
            </thead>
            <tbody>
              {gstRows.map((b, i) => (
                <tr key={b.rate} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                  <td style={{ padding: '9px 10px', fontSize: 12, borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ fontWeight: 700, color: '#475569' }}>{b.rate}%</span>
                    <span style={{ marginLeft: 6, fontSize: 10, color: '#94a3b8' }}>({b.rate / 2}% CGST + {b.rate / 2}% SGST)</span>
                  </td>
                  <TD right>{fmtCurrency(b.taxable)}</TD>
                  <TD right>{fmtCurrency(b.cgst)}</TD>
                  <TD right>{fmtCurrency(b.sgst)}</TD>
                  <TD right bold>{fmtCurrency(b.total)}</TD>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                <td style={{ padding: '9px 10px', fontSize: 12, fontWeight: 700 }}>Total</td>
                <td style={{ padding: '9px 10px', textAlign: 'right', fontSize: 12, fontWeight: 700 }}>{fmtCurrency(subtotal)}</td>
                <td style={{ padding: '9px 10px', textAlign: 'right', fontSize: 12, fontWeight: 700 }}>{fmtCurrency(totalGst / 2)}</td>
                <td style={{ padding: '9px 10px', textAlign: 'right', fontSize: 12, fontWeight: 700 }}>{fmtCurrency(totalGst / 2)}</td>
                <td style={{ padding: '9px 10px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#475569' }}>{fmtCurrency(totalGst)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Bill summary */}
      <div style={{ borderRadius: 10, border: '1.5px solid #e2e8f0', overflow: 'hidden' }}>
        <p style={{ margin: 0, padding: '10px 16px', fontSize: 12, fontWeight: 700, color: '#0f172a', background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>Bill Summary</p>
        {[
          ['Subtotal (taxable value)', fmtCurrency(subtotal)],
          ['Total GST (CGST + SGST)',  fmtCurrency(totalGst)],
        ].map(([label, val]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid #f1f5f9', fontSize: 12 }}>
            <span style={{ color: '#64748b' }}>{label}</span>
            <span style={{ fontWeight: 600, color: '#1e293b' }}>{val}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '13px 16px', background: '#f0f9ff', borderTop: '2px solid #bae6fd' }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Grand Total</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#019bdd' }}>{fmtCurrency(grandTotal)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── OrderDetail (drawer body) ────────────────────────────────────────────────

function OrderDetail({
  orderId, onOrderUpdate, onClose,
}: {
  orderId: string; onOrderUpdate: (o: TrackedOrder) => void; onClose: () => void;
}) {
  const [order,           setOrder]           = useState<TrackedOrder | null>(null);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState<string | null>(null);
  const [cancelling,      setCancelling]      = useState(false);
  const [cancelReason,    setCancelReason]    = useState('');
  const [showCancel,      setShowCancel]      = useState(false);
  const [activeTab,       setActiveTab]       = useState<'tracking' | 'details' | 'items'>('tracking');
  const [distributorName, setDistributorName] = useState<string>('');
  const [deliveryInfo,    setDeliveryInfo]    = useState<DeliveryInfo | null>(null);

  const stopPollRef     = useRef<(() => void) | null>(null);
  const deliveryInfoRef = useRef<DeliveryInfo | null>(null);

  // ── Derive deliveryID for the WS hook from deliveryInfo ────────────────────
  const deliveryID  = deliveryInfo?.orderNumber ?? null;
  const isDelivered = order?.status === 'DELIVERED';
  const driverLocation = useDriverLocation(isDelivered ? null : deliveryID);

  const handleUpdate = useCallback((updated: TrackedOrder) => {
    setOrder(updated);
    onOrderUpdate(updated);
    if (TERMINAL_STATUSES.has(updated.status)) stopPollRef.current?.();
  }, [onOrderUpdate]);

  const fetchDeliveryInfo = useCallback((id: string) => {
    fetchDeliveryWithRetry(id, 4, 2500)
      .then(info => {
        deliveryInfoRef.current = info;
        setDeliveryInfo(info);
      })
      .catch(err => console.warn('Delivery fetch failed after retries:', err.message));
  }, []);

  useEffect(() => {
    setLoading(true); setError(null);
    setShowCancel(false); setCancelReason('');
    setDistributorName(''); setDeliveryInfo(null);
    deliveryInfoRef.current = null;
    stopPollRef.current?.();

    fetchOrder(orderId)
      .then(o => {
        setOrder(o); setLoading(false);

        distributorService.getDistributorById(o.distributorID)
          .then(d => setDistributorName(d?.companyName ?? o.distributorID))
          .catch(() => setDistributorName(o.distributorID));

        if (['DISPATCHED', 'PICKED_UP', 'DELIVERED'].includes(o.status)) {
          fetchDeliveryInfo(orderId);
        }

        if (!TERMINAL_STATUSES.has(o.status)) {
          stopPollRef.current = pollOrder(orderId, (updated) => {
            handleUpdate(updated);
            if (
              ['DISPATCHED', 'PICKED_UP', 'DELIVERED'].includes(updated.status) &&
              !deliveryInfoRef.current
            ) {
              fetchDeliveryInfo(orderId);
            }
          }, 30_000);
        }
      })
      .catch(e => { setError(e.message); setLoading(false); });

    return () => { stopPollRef.current?.(); };
  }, [orderId, handleUpdate]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCountdownExpired = useCallback(async () => {
    try { handleUpdate(await checkOrderExpiry(orderId)); }
    catch (e) { console.error('Expiry check failed:', e); }
  }, [orderId, handleUpdate]);

  const handleCancel = async () => {
    if (!order) return;
    setCancelling(true);
    try { handleUpdate(await cancelOrder(order._id, cancelReason || undefined)); setShowCancel(false); }
    catch (e: unknown) { alert((e as Error).message); }
    finally { setCancelling(false); }
  };

  const TABS = [
    { key: 'tracking' as const, label: 'Tracking' },
    { key: 'details'  as const, label: 'Details'  },
    { key: 'items'    as const, label: 'Bill'      },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '18px 20px 0', borderBottom: '1.5px solid #f1f5f9', background: 'white', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {loading || !order ? (
              <div style={{ height: 22, width: 160, background: '#f1f5f9', borderRadius: 6, marginBottom: 6 }} />
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{order.orderNumber}</h2>
                  <StatusPill status={order.status} />
                  {!TERMINAL_STATUSES.has(order.status) && (
                    <span style={{ fontSize: 9, color: '#16a34a', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', background: '#dcfce7', padding: '2px 7px', borderRadius: 999 }}>
                      • LIVE
                    </span>
                  )}
                </div>
                <p style={{ margin: '3px 0 0', fontSize: 11, color: '#94a3b8' }}>Placed {fmt(order.placedAt)}</p>
              </>
            )}
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#f1f5f9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 12 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="#64748b" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {!loading && !error && order && (
          <div style={{ display: 'flex' }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ flex: 1, padding: '8px 0', border: 'none', borderBottom: `2.5px solid ${activeTab === t.key ? '#019bdd' : 'transparent'}`, background: 'transparent', color: activeTab === t.key ? '#019bdd' : '#64748b', fontWeight: activeTab === t.key ? 700 : 500, fontSize: 12.5, cursor: 'pointer', letterSpacing: '0.02em', transition: 'all 0.18s' }}>
                {t.label}
                {t.key === 'items' && (
                  <span style={{ marginLeft: 5, fontSize: 10, fontWeight: 700, background: activeTab === t.key ? '#019bdd' : '#e2e8f0', color: activeTab === t.key ? 'white' : '#64748b', padding: '1px 5px', borderRadius: 999 }}>
                    {order.items.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 240, gap: 14 }}>
            <div style={spinnerStyle} />
            <p style={{ color: '#94a3b8', fontSize: 13 }}>Loading order…</p>
          </div>
        )}
        {!loading && (error || !order) && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 240, gap: 8 }}>
            <span style={{ fontSize: 36 }}>📦</span>
            <p style={{ color: '#64748b', fontSize: 13, textAlign: 'center' }}>{error ?? 'Order not found'}</p>
          </div>
        )}
        {!loading && !error && order && (
          <>
            {order.status === 'PLACED' && activeTab === 'tracking' && (
              <CountdownBanner order={order} onExpired={handleCountdownExpired} />
            )}

            {activeTab === 'tracking' && (
              <DetailTimeline
                steps={buildTimeline(order)}
                order={order}
                deliveryInfo={deliveryInfo}
                driverLocation={driverLocation}
              />
            )}

            {activeTab === 'details' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {order.otp && ['DISPATCHED', 'PICKED_UP'].includes(order.status) && (
                  <OtpBox otp={order.otp} />
                )}
                {([
                  ['Distributor',    distributorName || order.distributorID],
                  ['Payment Mode',   order.paymentMode?.replace(/_/g, ' ')],
                  ['Items',          `${order.items.length} Item${order.items.length !== 1 ? 's' : ''}`],
                  ['Grand Total',    fmtCurrency(order.grandTotal)],
                  ['Payment Status', order.paymentStatus?.replace(/_/g, ' ')],
                  order.eta                ? ['Est. Delivery',   formatETA(order.eta)]          : null,
                  order.transactionId      ? ['Transaction ID',  order.transactionId]            : null,
                  order.rejectionReason    ? ['Rejection Reason', order.rejectionReason]         : null,
                  order.cancellationReason ? ['Cancel Reason',    order.cancellationReason]      : null,
                ] as ([string, string] | null)[]).filter(Boolean).map(([label, val]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, flexShrink: 0 }}>{label}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', textAlign: 'right', wordBreak: 'break-all' }}>{val}</span>
                  </div>
                ))}
                {order.status === 'PICKED_UP' && order.paymentStatus !== 'PAID' && (
                  <PayButton order={order} onPaid={handleUpdate} />
                )}
                {order.paymentStatus === 'PAID' && (
                  <PaidBadge transactionId={order.transactionId} amount={order.grandTotal} />
                )}
                {['PLACED', 'ACCEPTED'].includes(order.status) && (
                  <div style={{ marginTop: 20 }}>
                    {!showCancel ? (
                      <button onClick={() => setShowCancel(true)} style={{ width: '100%', padding: '10px', border: '1.5px solid #fca5a5', borderRadius: 8, background: 'white', color: '#ef4444', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                        Cancel Order
                      </button>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                          Reason for cancellation <span style={{ fontWeight: 400, color: '#94a3b8' }}>(optional)</span>
                        </p>
                        <textarea rows={3} placeholder="e.g. Ordered by mistake" value={cancelReason} onChange={e => setCancelReason(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 13, resize: 'none', outline: 'none', fontFamily: 'inherit' }} />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={handleCancel} disabled={cancelling} style={{ flex: 1, padding: '10px', background: cancelling ? '#fca5a5' : '#ef4444', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: cancelling ? 'not-allowed' : 'pointer' }}>
                            {cancelling ? 'Cancelling…' : 'Confirm Cancel'}
                          </button>
                          <button onClick={() => { setShowCancel(false); setCancelReason(''); }} style={{ padding: '10px 16px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                            Keep
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'items' && <DetailedBill order={order} />}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Filter groups ────────────────────────────────────────────────────────────

const FILTER_GROUPS: { label: string; statuses: OrderStatus[] | null }[] = [
  { label: 'All',       statuses: null },
  { label: 'Active',    statuses: ['PLACED', 'ACCEPTED', 'DISPATCHED'] },
  { label: 'Delivered', statuses: ['DELIVERED'] },
  { label: 'Issues',    statuses: ['REJECTED', 'CANCELLED', 'TIME_EXPIRED'] },
];

// ─── OrderRow ─────────────────────────────────────────────────────────────────

function OrderRow({ order, onTrack, distributorName }: { order: TrackedOrder; onTrack: (id: string) => void; distributorName: string }) {
  const [hovered, setHovered] = useState(false);
  const isActive = !TERMINAL_STATUSES.has(order.status);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: 'grid', gridTemplateColumns: LIST_COLS, alignItems: 'center', padding: '13px 24px', background: hovered ? '#f8fbff' : 'white', borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3, flexWrap: 'wrap' }}>
          {isActive && (
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#16a34a', background: '#dcfce7', padding: '2px 6px', borderRadius: 999 }}>LIVE</span>
          )}
          <span style={{ fontWeight: 700, fontSize: 13.5, color: '#0f172a' }}>{order.orderNumber}</span>
          <StatusPill status={order.status} small />
        </div>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>{fmtDate(order.placedAt)}</span>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{distributorName}</div>
      <div style={{ textAlign: 'center', fontWeight: 700 }}>{order.items.length}</div>
      <span style={{ fontWeight: 700, fontSize: 13.5, color: '#0f172a', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', textAlign: 'right' }}>
        {fmtCurrency(order.grandTotal)}
      </span>
      <div style={{ textAlign: 'center' }}>
        <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600, background: '#f1f5f9', padding: '4px 9px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', display: 'inline-block', marginLeft: 10 }}>
          {(order.paymentMode ?? 'N/A').replace(/_/g, ' ')}
        </span>
      </div>
      <div style={{ textAlign: 'right' }}>
        <button onClick={() => onTrack(order._id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8, background: hovered ? '#019bdd' : 'white', color: hovered ? 'white' : '#019bdd', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.18s', whiteSpace: 'nowrap' }}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="6.5" cy="6.5" r="2" fill="currentColor" />
          </svg>
          Track
        </button>
      </div>
    </div>
  );
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

function Drawer({ open, orderId, onOrderUpdate, onClose }: {
  open: boolean; orderId: string | null;
  onOrderUpdate: (o: TrackedOrder) => void; onClose: () => void;
}) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(2px)', opacity: open ? 1 : 0, pointerEvents: open ? 'all' : 'none', transition: 'opacity 0.25s', zIndex: 100 }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 520, maxWidth: '96vw', background: 'white', boxShadow: '-8px 0 40px rgba(0,0,0,0.12)', transform: open ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.3s cubic-bezier(0.32,0.72,0,1)', zIndex: 101, display: 'flex', flexDirection: 'column' }}>
        {open && orderId && <OrderDetail key={orderId} orderId={orderId} onOrderUpdate={onOrderUpdate} onClose={onClose} />}
      </div>
    </>
  );
}

// ─── MyOrders (page root) ─────────────────────────────────────────────────────

export function MyOrders() {
  const [orders,         setOrders]         = useState<TrackedOrder[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);
  const [trackedId,      setTrackedId]      = useState<string | null>(null);
  const [filterGroup,    setFilterGroup]    = useState('All');
  const [searchQ,        setSearchQ]        = useState('');
  const [distributorMap, setDistributorMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const pharmaID = getPharmaIDFromToken();
    if (!pharmaID) { setError('Not logged in — please sign in and try again.'); setLoading(false); return; }
    fetchOrdersByPharma(pharmaID)
      .then(data => { setOrders(data); setLoading(false); })
      .catch(e   => { setError(e.message); setLoading(false); });
  }, []);

  const handleOrderUpdate = useCallback((updated: TrackedOrder) => {
    setOrders(prev => prev.map(o => o._id === updated._id ? updated : o));
  }, []);

  const visibleOrders = orders.filter(o => {
    const group = FILTER_GROUPS.find(g => g.label === filterGroup);
    if (group?.statuses && !group.statuses.includes(o.status)) return false;
    if (searchQ) {
      const q = searchQ.toLowerCase();
      return (
        o.orderNumber.toLowerCase().includes(q) ||
        distributorMap[o.distributorID]?.toLowerCase().includes(q) ||
        o.items.some(i => i.name.toLowerCase().includes(q))
      );
    }
    return true;
  });

  useEffect(() => {
    if (!orders.length) return;
    const uniqueIds = [...new Set(orders.map(o => o.distributorID))];
    async function loadDistributors() {
      const results = await Promise.all(
        uniqueIds.map(async id => {
          try {
            const d = await distributorService.getDistributorById(id);
            return { id, name: d?.companyName ?? id };
          } catch { return { id, name: id }; }
        }),
      );
      const map: Record<string, string> = {};
      results.forEach(r => { map[r.id] = r.name; });
      setDistributorMap(map);
    }
    loadDistributors();
  }, [orders]);

  const countFor = (statuses: OrderStatus[] | null) =>
    statuses ? orders.filter(o => statuses.includes(o.status)).length : orders.length;

  return (
    <>
      <style>{`
        @keyframes ot-pulse         { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.6)} }
        @keyframes ot-pulse-opacity { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes ot-spin          { to{transform:rotate(360deg)} }
        @keyframes ot-fadein        { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ot-pop           { 0%{transform:scale(0)} 60%{transform:scale(1.15)} 100%{transform:scale(1)} }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', fontFamily: "'Segoe UI', system-ui, sans-serif", background: '#f8fafc', minHeight: '100vh' }}>
        {/* Header */}
        <div style={{ background: 'white', borderBottom: '1.5px solid #e2e8f0', padding: '22px 28px 0', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>My Orders</h1>
              <p style={{ margin: '3px 0 0', fontSize: 13, color: '#94a3b8' }}>
                {loading ? 'Loading…' : `${orders.length} order${orders.length !== 1 ? 's' : ''} total`}
              </p>
            </div>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#94a3b8', pointerEvents: 'none' }}>🔍</span>
              <input
                placeholder="Search orders, medicines…"
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                style={{ paddingLeft: 34, paddingRight: 14, height: 38, border: '1.5px solid #e2e8f0', borderRadius: 9, fontSize: 13, outline: 'none', width: 240, fontFamily: 'inherit', color: '#1e293b', transition: 'border-color 0.18s', background: '#f8fafc' }}
                onFocus={e  => (e.target.style.borderColor = '#019bdd')}
                onBlur={e   => (e.target.style.borderColor = '#e2e8f0')}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 2 }}>
            {FILTER_GROUPS.map(g => {
              const active = filterGroup === g.label;
              const count  = countFor(g.statuses);
              return (
                <button key={g.label} onClick={() => setFilterGroup(g.label)} style={{ padding: '8px 16px', borderRadius: '8px 8px 0 0', border: active ? '1.5px solid #e2e8f0' : '1.5px solid transparent', borderBottom: active ? '1.5px solid white' : '1.5px solid transparent', background: active ? 'white' : 'transparent', color: active ? '#019bdd' : '#64748b', fontWeight: active ? 700 : 500, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, marginBottom: -1, transition: 'all 0.15s' }}>
                  {g.label}
                  {count > 0 && <span style={{ background: active ? '#019bdd' : '#e2e8f0', color: active ? 'white' : '#64748b', borderRadius: 999, padding: '1px 7px', fontSize: 10, fontWeight: 700, minWidth: 18, textAlign: 'center' }}>{count}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Column headers */}
        {!loading && !error && visibleOrders.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: LIST_COLS, padding: '8px 24px', background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
            {[
              { label: 'Order',       align: 'left'   as const },
              { label: 'Distributor', align: 'left'   as const },
              { label: 'Items',       align: 'center' as const },
              { label: 'Amount',      align: 'right'  as const },
              { label: 'Payment',     align: 'center' as const },
              { label: '',            align: 'right'  as const },
            ].map(({ label, align }) => (
              <span key={label} style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: align }}>
                {label}
              </span>
            ))}
          </div>
        )}

        {/* Order list */}
        <div style={{ flex: 1, background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', animation: 'ot-fadein 0.3s ease' }}>
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 280, gap: 14 }}>
              <div style={spinnerStyle} /><p style={{ color: '#94a3b8', fontSize: 13 }}>Fetching orders…</p>
            </div>
          )}
          {!loading && error && (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <p style={{ fontSize: 36, marginBottom: 8 }}>⚠️</p>
              <p style={{ color: '#ef4444', fontSize: 13, fontWeight: 600 }}>{error}</p>
              <p style={{ color: '#94a3b8', fontSize: 12, marginTop: 6 }}>Check the browser console for details.</p>
            </div>
          )}
          {!loading && !error && visibleOrders.length === 0 && (
            <div style={{ textAlign: 'center', padding: 80 }}>
              <p style={{ fontSize: 40 }}>📭</p>
              <p style={{ color: '#64748b', fontSize: 14, marginTop: 10, fontWeight: 600 }}>
                {searchQ ? 'No orders match your search' : 'No orders in this category'}
              </p>
              {searchQ && (
                <button onClick={() => setSearchQ('')} style={{ marginTop: 12, padding: '6px 16px', border: '1.5px solid #e2e8f0', borderRadius: 8, background: 'white', color: '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Clear search
                </button>
              )}
            </div>
          )}
          {!loading && !error && visibleOrders.map(order => (
            <OrderRow key={order._id} order={order} onTrack={setTrackedId} distributorName={distributorMap[order.distributorID] ?? order.distributorID} />
          ))}
        </div>
      </div>

      <Drawer open={trackedId !== null} orderId={trackedId} onOrderUpdate={handleOrderUpdate} onClose={() => setTrackedId(null)} />
    </>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const spinnerStyle: React.CSSProperties = {
  width: 32, height: 32, borderRadius: '50%',
  border: '3px solid #e2e8f0', borderTopColor: '#019bdd',
  animation: 'ot-spin 0.8s linear infinite',
};

export default MyOrders;