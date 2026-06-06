import { getToken } from './authService';

const ORDER_API_URL = 'http://localhost:5205';

// ─── Types ────────────────────────────────────────────────────────────────────

export type OrderStatus =
  | 'PLACED'
  | 'ACCEPTED'
  | 'DISPATCHED'
  | 'PICKED_UP'
  | 'DELIVERED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'TIME_EXPIRED';

export interface TaxBreakdown {
  gross: number;
  discount: number;
  taxable: number;
  gst: number;
  cgst: number;
  sgst: number;
}

export interface OrderItem {
  productID_Phm: string;
  productID_Dtb: string;
  name: string;
  quantity: number;
  price: number;
  discountPercent: number;
  gstRate: number;
  hsnCode?: string;
  mrpPerPack: number;
  taxBreakdown: TaxBreakdown;
  totalAmount: number | { $numberDecimal: string };
}

export interface TrackedOrder {
  _id: string;
  orderNumber: string;
  pharmaID: string;
  distributorID: string;
  items: OrderItem[];
  grandTotal: number;
  status: OrderStatus;
  paymentMode: string;
  transactionId?: string;
  paymentStatus?: string;
  otp?: string;
  eta?: string;
  placedAt: string;
  updatedAt: string;  
  deliveryID?: string;
  expiresAt: string;
  acceptedAt?: string;
  dispatchedAt?: string;
  deliveredAt?: string;
  rejectionReason?: string;
  cancellationReason?: string;
}

export interface TrackingStep {
  status: OrderStatus;
  label: string;
  description: string;
  timestamp?: string;
  completed: boolean;
  active: boolean;
  isFinal?: boolean;
  isError?: boolean;
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

const getAuthHeader = (): Record<string, string> => {
  const token = getToken();
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
};

/**
 * Decode the JWT payload client-side to extract userId.
 *
 * The backend does:  req.userId = jwt.verify(token, secret).userId
 * This reads the same field without re-verification, so pharmaID in the
 * URL always matches req.userId and the 403 auth check always passes.
 */
export function getPharmaIDFromToken(): string | null {
  const token = getToken();
  if (!token) return null;
  try {
    // JWT = header.payload.signature — payload is base64url-encoded JSON
    const payloadB64 = token.split('.')[1];
    const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json);
    return (payload.userId as string) ?? null;
  } catch (e) {
    console.error('[orderTracking] Failed to decode JWT payload:', e);
    return null;
  }
}

// ─── Amount / expiry helpers ──────────────────────────────────────────────────

export function resolveAmount(val: number | { $numberDecimal: string } | undefined): number {
  if (val == null) return 0;
  if (typeof val === 'object' && '$numberDecimal' in val) return parseFloat(val.$numberDecimal);
  return Number(val);
}

export function secondsUntilExpiry(order: TrackedOrder): number {
  return Math.floor((new Date(order.expiresAt).getTime() - Date.now()) / 1000);
}

// ─── Timeline builder ─────────────────────────────────────────────────────────

const TERMINAL_ERROR: OrderStatus[] = ['REJECTED', 'CANCELLED', 'TIME_EXPIRED'];
const FLOW: OrderStatus[] = ['PLACED', 'ACCEPTED', 'DISPATCHED','PICKED_UP', 'DELIVERED'];

const STEP_META: Record<OrderStatus, { label: string; description: string }> = {
  PLACED:       { label: 'Order Placed',   description: 'Awaiting distributor confirmation' },
  ACCEPTED:     { label: 'Accepted',        description: 'Distributor confirmed your order' },
  DISPATCHED:   { label: 'Dispatched',      description: 'Order is on the way' },
  PICKED_UP:    { label: 'Picked Up',       description: 'Order has been picked up by the driver' },
  DELIVERED:    { label: 'Delivered',       description: 'Order successfully delivered' },
  REJECTED:     { label: 'Rejected',        description: 'Distributor rejected this order' },
  CANCELLED:    { label: 'Cancelled',       description: 'This order was cancelled' },
  TIME_EXPIRED: { label: 'Expired',         description: 'Distributor did not respond in time' },
};

const TIMESTAMP_KEY: Partial<Record<OrderStatus, keyof TrackedOrder>> = {
  PLACED:     'placedAt',
  ACCEPTED:   'acceptedAt',
  DISPATCHED: 'dispatchedAt',
  DELIVERED:  'deliveredAt',
};

export function buildTimeline(order: TrackedOrder): TrackingStep[] {
  const isError = TERMINAL_ERROR.includes(order.status);

  if (isError) {
    const errorStep: TrackingStep = {
      status:      order.status,
      label:       STEP_META[order.status].label,
      description: order.rejectionReason || order.cancellationReason || STEP_META[order.status].description,
      timestamp:   order.updatedAt,
      completed:   true,
      active:      true,
      isFinal:     true,
      isError:     true,
    };
    const flowSteps = FLOW.map<TrackingStep>(s => ({
      status:      s,
      label:       STEP_META[s].label,
      description: STEP_META[s].description,
      timestamp:   TIMESTAMP_KEY[s] ? (order[TIMESTAMP_KEY[s]!] as string | undefined) : undefined,
      completed:   false,
      active:      false,
    }));
    return [...flowSteps, errorStep];
  }

  const currentIdx = FLOW.indexOf(order.status);
  return FLOW.map<TrackingStep>((s, idx) => ({
    status:      s,
    label:       STEP_META[s].label,
    description: STEP_META[s].description,
    timestamp:   TIMESTAMP_KEY[s] ? (order[TIMESTAMP_KEY[s]!] as string | undefined) : undefined,
    completed:   idx < currentIdx || order.status === 'DELIVERED',
    active:      idx === currentIdx,
    isFinal:     s === 'DELIVERED' && order.status === 'DELIVERED',
  }));
}

// ─── Fetch wrappers with logging ──────────────────────────────────────────────

async function apiGet<T>(path: string): Promise<T> {
  const url = `${ORDER_API_URL}${path}`;
  console.log('[orderTracking] GET', url);
  const res = await fetch(url, { headers: getAuthHeader() });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    console.error(`[orderTracking] GET ${url} → ${res.status}`, body);
    throw new Error(body?.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const url = `${ORDER_API_URL}${path}`;
  const res = await fetch(url, {
    method:  'POST',
    headers: getAuthHeader(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    console.error(`[orderTracking] POST ${url} → ${res.status}`, errBody);
    throw new Error(errBody?.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const url = `${ORDER_API_URL}${path}`;
  const res = await fetch(url, {
    method:  'PUT',
    headers: getAuthHeader(),
    body:    JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    console.error(`[orderTracking] PUT ${url} → ${res.status}`, errBody);
    throw new Error(errBody?.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function fetchOrder(orderId: string): Promise<TrackedOrder> {
  return apiGet(`/distributor-orders/${orderId}`);
}

export function fetchOrdersByPharma(pharmaID: string): Promise<TrackedOrder[]> {
  return apiGet(`/distributor-orders/pharma/${pharmaID}`);
}

export function checkOrderExpiry(orderId: string): Promise<TrackedOrder> {
  return apiPost(`/distributor-orders/${orderId}/check-expiry`);
}

export function cancelOrder(orderId: string, cancellationReason?: string): Promise<TrackedOrder> {
  return apiPut(`/distributor-orders/${orderId}/status`, {
    status: 'CANCELLED',
    cancellationReason,
  });
}

// ─── Polling ──────────────────────────────────────────────────────────────────

export const TERMINAL_STATUSES = new Set<OrderStatus>([
  'DELIVERED', 'REJECTED', 'CANCELLED', 'TIME_EXPIRED',
]);

export function pollOrder(
  orderId: string,
  onUpdate: (order: TrackedOrder) => void,
  intervalMs = 30_000,
  maxAttempts = 200,
): () => void {
  let attempts = 0;
  let stopped  = false;
  let timerId: ReturnType<typeof setTimeout>;

  const tick = async () => {
    if (stopped) return;
    try {
      const order = await fetchOrder(orderId);
      onUpdate(order);
      if (TERMINAL_STATUSES.has(order.status)) return;
    } catch (e) {
      console.warn('[orderTracking] pollOrder error:', e);
    }
    attempts++;
    if (attempts < maxAttempts && !stopped) {
      timerId = setTimeout(tick, intervalMs);
    }
  };

  tick();
  return () => { stopped = true; clearTimeout(timerId); };
}