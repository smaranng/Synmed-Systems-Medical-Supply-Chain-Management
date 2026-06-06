import { getToken } from './authService';

const ORDER_API_URL = 'http://localhost:5202';
const ORDER_API_FALLBACK_URL = 'http://localhost:4003';

const getOrderApiCandidates = () => [ORDER_API_URL, ORDER_API_FALLBACK_URL];

const fetchOrderApi = async (path: string, init?: RequestInit): Promise<Response> => {
  const candidates = getOrderApiCandidates();
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

  if (lastResponse) {
    return lastResponse;
  }

  throw lastError || new Error('Order API is not reachable');
};

export interface OfflineOrderItem {
  productID: string;
  name: string;
  price: number;
  quantity: number;
  subQuantity?: number;
  pharmaID: string;
  prescriptionRequired?: boolean;
  prescriptionPath?: string;
  pricePerUnit?: number;
}

export interface CustomerDetailsForm {
  name: string;
  doctorName: string;
  mobileNumber: string;
  email?: string;
}

export interface OfflineOrderPayload {
  items: OfflineOrderItem[];
  customerDetails: CustomerDetailsForm;
}

export interface OfflineOrder {
  _id: string;
  orderNumber: string;
  pharmacyId: string;
  customerId: string; // CUSTOMER_PHARMA
  customerName: string;
  doctorName: string;
  mobileNumber: string;
  email?: string;
  items: OfflineOrderItem[];
  totalAmount: number;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  paymentMode?: 'CASH' | 'ONLINE';
  transactionId?: string;
  createdAt: string;
  updatedAt: string;
}

export const offlineOrderService = {
  async createOfflineOrder(payload: OfflineOrderPayload, pharmacyId: string): Promise<OfflineOrder> {
    try {
      const token = getToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetchOrderApi(`/orders/offline/create`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...payload, pharmacyId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to create offline order' }));
        throw new Error(err.error || 'Failed to create offline order');
      }

      return res.json();
    } catch (error: any) {
      console.error('❌ Failed to create offline order:', error);
      throw error;
    }
  },

  async completeOfflineOrder(
    orderId: string,
    paymentMode: 'CASH' | 'ONLINE',
    transactionId?: string,
    pharmacyId?: string
  ): Promise<OfflineOrder> {
    try {
      const token = getToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetchOrderApi(`/orders/offline/${orderId}/complete`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ paymentMode, transactionId, pharmacyId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to complete offline order' }));
        throw new Error(err.error || 'Failed to complete offline order');
      }

      return res.json();
    } catch (error: any) {
      console.error('❌ Failed to complete offline order:', error);
      throw error;
    }
  },

  async getOfflineOrder(orderId: string): Promise<OfflineOrder> {
    try {
      const token = getToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetchOrderApi(`/orders/offline/${orderId}`, { headers });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to fetch offline order' }));
        throw new Error(err.error || 'Failed to fetch offline order');
      }

      return res.json();
    } catch (error: any) {
      console.error('❌ Failed to fetch offline order:', error);
      throw error;
    }
  },

  async getPharmacyOfflineOrders(pharmacyId: string): Promise<OfflineOrder[]> {
    try {
      const token = getToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetchOrderApi(`/orders/offline/pharmacy/${pharmacyId}`, { headers });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to fetch offline orders' }));
        throw new Error(err.error || 'Failed to fetch offline orders');
      }

      return res.json();
    } catch (error: any) {
      console.error('❌ Failed to fetch offline orders:', error);
      throw error;
    }
  },
};
