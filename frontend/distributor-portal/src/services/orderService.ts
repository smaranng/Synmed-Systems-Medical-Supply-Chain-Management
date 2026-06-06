import { getToken } from './authService';

const ORDER_API_URL = 'http://localhost:5205';
const ORDER_API_FALLBACK_URL = 'http://localhost:4003';

const fetchOrderApi = async (path: string, init?: RequestInit): Promise<Response> => {
  const candidates = [ORDER_API_URL, ORDER_API_FALLBACK_URL];
  let lastError: any = null;
  let lastResponse: Response | null = null;

  for (const base of candidates) {
    try {
      const response = await fetch(`${base}${path}`, init);
      if (response.status === 404 || response.status === 405) {
        lastResponse = response;
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastResponse) return lastResponse;
  throw lastError || new Error('Order API is not reachable');
};

// ─── Types ─────────────────────────────────────────────────────────────────────

export type DistributorOrderStatus =
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

export interface DistributorOrderItem {
  productID_Dtb: string;
  productID_Phm: string;
  name: string;
  price: number;
  quantity: number;
  discountPercent: number;
  gstRate: number;
  hsnCode: string;
  mrpPerPack?: number;
  taxBreakdown?: TaxBreakdown;
  totalAmount?: number;
}

export interface DistributorOrder {
  _id: string;
  orderNumber: string;
  pharmaID: string;
  distributorID: string;
  items: DistributorOrderItem[];
  grandTotal: number;
  status: DistributorOrderStatus;
  paymentMode?: string;
  paymentStatus: 'PENDING' | 'COMPLETED' | 'FAILED' | 'PAID';
  transactionId?: string;
  rejectionReason?: string;
  cancellationReason?: string;
  placedAt: string;
  updatedAt?: string;
  expiresAt?: string;
  deliveredAt?: string;
  // Set by the dispatch endpoint
  driverID?: string;
  vehicleID?: string;
  deliveryId?: string;
}

// Returned by POST /distributor-orders/:id/dispatch
export interface DispatchResult {
  order: DistributorOrder;
  driver: {
    driverID:        string;
    name:            string;
    phone:           string;
    avgRating:       number;
    distanceKm:      number | null;  // km from distributor warehouse at dispatch time
    allocationScore: number;         // composite score 0–1 (proximity 60% + rating 40%)
  };
  vehicle: {
    vehicleID:     string;
    vehicleNumber: string;
    vehicleType:   string;
  };
 delivery: {
  _id:                    string;
  orderId:                string;
  driverID:               string;
  driverName:             string;
  driverPhone:            string;
  driverRatingAtDispatch: number;
  vehicleID:              string;
  vehicleNumber:          string;
  vehicleType:            string;
  distanceKm:             number | null;
  allocationScore:        number;
  status:                 string;
  createdAt:              string;
  updatedAt:              string;
};
}

// ─── Service ───────────────────────────────────────────────────────────────────

function authHeaders(): HeadersInit {
  const token = getToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export const distributorOrderService = {
  /** Fetch all purchase orders for a distributor */
  async getOrdersByDistributor(
    distributorID: string,
    status?: DistributorOrderStatus | DistributorOrderStatus[]
  ): Promise<DistributorOrder[]> {
    const url = new URL(`${ORDER_API_URL}/distributor-orders/distributor/${distributorID}`);
    if (status) {
      const arr = Array.isArray(status) ? status : [status];
      arr.forEach(s => url.searchParams.append('status', s));
    }
    const pathWithQuery = `${url.pathname}${url.search}`;
    const res = await fetchOrderApi(pathWithQuery, { headers: authHeaders() });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to fetch orders' }));
      throw new Error(err.error || 'Failed to fetch orders');
    }
    return res.json();
  },

  /** Fetch all purchase orders sent BY a pharmacy */
  async getOrdersByPharma(
    pharmaID: string,
    status?: DistributorOrderStatus | DistributorOrderStatus[]
  ): Promise<DistributorOrder[]> {
    const url = new URL(`${ORDER_API_URL}/distributor-orders/pharma/${pharmaID}`);
    if (status) {
      const arr = Array.isArray(status) ? status : [status];
      arr.forEach(s => url.searchParams.append('status', s));
    }
    const pathWithQuery = `${url.pathname}${url.search}`;
    const res = await fetchOrderApi(pathWithQuery, { headers: authHeaders() });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to fetch pharmacy orders' }));
      throw new Error(err.error || 'Failed to fetch pharmacy orders');
    }
    return res.json();
  },

  /** Place a new purchase order from pharmacy → distributor */
  async placeOrder(payload: {
    pharmaID: string;
    distributorID: string;
    items: Omit<DistributorOrderItem, 'taxBreakdown'>[];
  }): Promise<DistributorOrder> {
    const res = await fetchOrderApi('/distributor-orders/place', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to place order' }));
      throw new Error(err.error || 'Failed to place order');
    }
    return res.json();
  },

  /** Generic status update — used for ACCEPTED, DELIVERED, REJECTED, CANCELLED.
   *  Do NOT use for DISPATCHED — call dispatchWithAllocation() instead. */
  async updateStatus(
    orderId: string,
    status: Exclude<DistributorOrderStatus, 'DISPATCHED'>,
    extra?: {
      rejectionReason?: string;
      cancellationReason?: string;
      paymentMode?: string;
      transactionId?: string;
    }
  ): Promise<DistributorOrder> {
    const res = await fetchOrderApi(`/distributor-orders/${orderId}/status`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ status, ...extra }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update status' }));
      throw new Error(err.error || 'Failed to update status');
    }
    return res.json();
  },

  /** Accept an order as the distributor */
  async acceptOrder(orderId: string): Promise<DistributorOrder> {
    return this.updateStatus(orderId, 'ACCEPTED');
  },

  /**
   * Dispatch an order with automatic driver + vehicle allocation.
   *
   * Calls POST /distributor-orders/:id/dispatch which:
   *   1. Finds the best available driver scored by proximity (60%) + rating (40%)
   *   2. Resolves a free vehicle (driver's own vehicle first, then any free one)
   *   3. Locks both atomically in the DB
   *   4. Creates a deliveries record with distanceKm + allocationScore
   *   5. Transitions the order to DISPATCHED
   *
   * Returns the updated order plus the assigned driver & vehicle details.
   * The DispatchModal calls this internally — you normally don't need to
   * call it directly from the page.
   */
  async dispatchWithAllocation(orderId: string): Promise<DispatchResult> {
    const res = await fetchOrderApi(`/distributor-orders/${orderId}/dispatch`, {
      method: 'POST',
      headers: authHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to dispatch order' }));
      throw new Error(err.error || 'Failed to dispatch order');
    }
    return res.json();
  },

  /** Mark as delivered (and optionally record payment) */
  async deliverOrder(
    orderId: string,
    paymentMode?: string,
    transactionId?: string
  ): Promise<DistributorOrder> {
    return this.updateStatus(orderId, 'DELIVERED', { paymentMode, transactionId });
  },

  /** Reject by distributor */
  async rejectOrder(orderId: string, rejectionReason: string): Promise<DistributorOrder> {
    return this.updateStatus(orderId, 'REJECTED', { rejectionReason });
  },

  /** Cancel by pharmacy */
  async cancelOrder(orderId: string, cancellationReason?: string): Promise<DistributorOrder> {
    return this.updateStatus(orderId, 'CANCELLED', { cancellationReason });
  },

  /** Fetch the delivery record (driver + vehicle info) for a dispatched order */
  async getDelivery(orderId: string): Promise<{
     _id:                    string;   // ← add this
  orderId:                string;   // ← add this
  orderNumber:                string;   // ← add this
  driverID:               string;
  driverName:             string;
  driverPhone:            string;
  driverRatingAtDispatch: number;   // ← add this
  vehicleID:              string;
  vehicleNumber:          string;
  vehicleType:            string;
  distanceKm:             number | null;
  allocationScore:        number;
  status:                 string;
  createdAt:              string;
  updatedAt:              string;   // ← add this too (present in DB doc)
}>{
    const res = await fetchOrderApi(`/distributor-orders/${orderId}/delivery`, {
      headers: authHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to fetch delivery' }));
      throw new Error(err.error || 'Failed to fetch delivery');
    }
    return res.json();
  },
};