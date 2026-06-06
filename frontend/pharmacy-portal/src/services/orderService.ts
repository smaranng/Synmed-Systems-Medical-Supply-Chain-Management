import { getToken } from './authService';

const ORDER_API_URL = 'http://localhost:5202';
const ORDER_API_FALLBACK_URL = 'http://localhost:4003';
const USER_API_URL = 'http://localhost:5203';

const getOrderApiCandidates = () => [ORDER_API_URL, ORDER_API_FALLBACK_URL];

const fetchOrderApi = async (path: string, init?: RequestInit): Promise<Response> => {
  const candidates = getOrderApiCandidates();
  let lastError: any = null;
  let lastResponse: Response | null = null;

  for (const base of candidates) {
    try {
      const response = await fetch(`${base}${path}`, init);

      // If route does not exist on this runtime, try the next candidate.
      if (response.status === 404 || response.status === 405) {
        lastResponse = response;
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastResponse) {
    return lastResponse;
  }

  throw lastError || new Error('Order API is not reachable');
};

export type OrderStatus =
  | 'PLACED'
  | 'PLACED & APPROVED'
  | 'APPROVED'
  | 'COMPLETED'
  | 'REJECTED'
  | 'TIME_EXPIRED'
  | 'CANCELLED';

export interface OrderItem {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
  subQuantity?: number; // For sub-units if applicable
  prescriptionRequired: boolean;
  prescriptionPath?: string;
  pricePerUnit: number;
  discountPercent: number;
  gstRate: number;
  hsnCode: string;
  mrp: number;
  taxBreakdown?: {
    gross: number;
    discount: number;
    taxable: number;  
    gst: number;
    cgst: number;
    sgst: number;
  };
}

export interface Order {
  _id: string;
  orderNumber: string;
  customerId: string;
  pharmaID: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  paymentMode: string;
  placedAt: string;
  updatedAt?: string;
  expiresAt?: string;
  cancellationReason?: string;
  cancellationAmount?: number;
}

export interface CustomerDetails {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  username?: string;
}

export interface StockHistoryEntry {
  _id: string;
  pharmaID: string;
  productID: string;
  batchCode: string;
  type: 'STOCK_IN' | 'STOCK_OUT';
  source: 'CUSTOMER_ORDER' | 'DISTRIBUTOR_PURCHASE';
  referenceID?: string;
  orderID?: string;
  quantity?: {
    units?: number;
    subUnits?: number;
  };
  balanceAfter?: {
    unitsAvailable?: number;
    subUnitsAvailable?: number;
    totalSubUnits?: number;
  };
  createdAt: string;
  eventDate: string;
}

export const orderService = {
  async getOrders(pharmaID: string, status?: OrderStatus | OrderStatus[]): Promise<Order[]> {
    try {
      const url = new URL(`${ORDER_API_URL}/orders/pharmacy/${pharmaID}`);
      if (status) {
        if (Array.isArray(status)) {
          status.forEach(s => url.searchParams.append('status', s));
        } else {
          url.searchParams.append('status', status);
        }
      }

      const token = getToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      console.log('🌐 Fetching orders from:', url.toString());
      console.log('🔑 Using pharmacy ID:', pharmaID);

      const pathWithQuery = `${url.pathname}${url.search}`;
      const res = await fetchOrderApi(pathWithQuery, {
        headers,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to fetch orders' }));
        console.error('❌ Order fetch error:', err);
        throw new Error(err.error || 'Failed to fetch orders');
      }

      const data = await res.json();
      console.log('✅ Orders fetched successfully:', data.length, 'orders');
      return data;
    } catch (error) {
      console.error('❌ Failed to fetch orders:', error);
      throw error;
    }
  },

  async getCustomerDetails(customerId: string): Promise<CustomerDetails | null> {
    try {
      const token = getToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`${USER_API_URL}/users/${customerId}`, {
        headers,
      });

      if (!res.ok) {
        return null;
      }

      return res.json();
    } catch (err) {
      console.error('Failed to fetch customer details', err);
      return null;
    }
  },

  async updateStatus(orderId: string, status: OrderStatus, extra?: { paymentMode?: string; transactionId?: string; rejectionReason?: string }): Promise<Order> {
    try {
      const token = getToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetchOrderApi(`/orders/${orderId}/status`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status, ...extra }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to update status' }));
        throw new Error(err.error || 'Failed to update status');
      }

      return res.json();
    } catch (error) {
      console.error('❌ Failed to update order status:', error);
      throw error;
    }
  },

  async completeOrder(orderId: string, payload?: { paymentMode?: string; transactionId?: string }): Promise<Order> {
    try {
      const token = getToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetchOrderApi(`/api/orders/${orderId}/complete`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload || {}),
      });

      if (!res.ok) {
        // Fallback for older server.js deployments that only support /orders/:id/status
        if (res.status === 404 || res.status === 405) {
          return this.updateStatus(orderId, 'COMPLETED', payload);
        }

        const err = await res.json().catch(() => ({ error: 'Failed to complete order' }));
        throw new Error(err.error || 'Failed to complete order');
      }

      const result = await res.json();
      return result.order as Order;
    } catch (error) {
      console.error('❌ Failed to complete order:', error);
      throw error;
    }
  },

  async getStockHistory(pharmaID?: string, limit = 100): Promise<StockHistoryEntry[]> {
    try {
      const token = getToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const url = new URL(`${ORDER_API_URL}/api/stock-history`);
      if (pharmaID) {
        url.searchParams.append('pharmaID', pharmaID);
      }
      url.searchParams.append('limit', String(limit));

      const res = await fetchOrderApi(`${url.pathname}${url.search}`, { headers });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to fetch stock history' }));
        throw new Error(err.error || 'Failed to fetch stock history');
      }

      const body = await res.json();
      return (body.data || []) as StockHistoryEntry[];
    } catch (error) {
      console.error('❌ Failed to fetch stock history:', error);
      throw error;
    }
  },

  async refreshInventory(pharmaID: string): Promise<any[]> {
    try {
      const token = getToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetchOrderApi(`/api/inventory/${pharmaID}`, { headers });
      if (!res.ok) {
        // Fallback for older server.js deployments where this proxy route does not exist.
        if (res.status === 404 || res.status === 405) {
          const directRes = await fetch(`http://localhost:5201/inventory/pharmacy/${pharmaID}`, { headers });
          if (!directRes.ok) {
            const directErr = await directRes.json().catch(() => ({ error: 'Failed to refresh inventory' }));
            throw new Error(directErr.error || 'Failed to refresh inventory');
          }

          const directBody = await directRes.json();
          return directBody || [];
        }

        const err = await res.json().catch(() => ({ error: 'Failed to refresh inventory' }));
        throw new Error(err.error || 'Failed to refresh inventory');
      }

      const body = await res.json();
      return body.data || [];
    } catch (error) {
      console.error('❌ Failed to refresh inventory:', error);
      throw error;
    }
  },
};