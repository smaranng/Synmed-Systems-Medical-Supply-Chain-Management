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

export type IcnType = 'EXCHANGE' | 'REQUEST';
export type IcnStatus = 'OPEN' | 'ACCEPTED' | 'COMPLETED' | 'CANCELLED' | 'TIME_EXPIRED';

export interface IcnBatchDetail {
  batchCode: string;
  expiryDate: string | null;
  quantity: number;
  mrp: number;
  discount: number;
  unitsAvailable?: number;
  subUnitsAvailable?: number;
  daysToExpiry?: number | null;
  closeToExpiry?: boolean;
}

export interface IcnSnapshot {
  totalUnitsAvailable: number;
  totalSubUnitsAvailable: number;
  nearestExpiry: string | null;
  threshold: number;
  isLowStock: boolean;
  isCloseToExpiry: boolean;
}

export interface IcnExchange {
  _id: string;
  type: IcnType;
  genericKey?: string;
  productID: string;
  sourceProductID?: string;
  destinationProductID?: string;
  medicineName?: string | null;
  composition?: string | null;
  sourcePharmacyID: string;
  destinationPharmacyID: string | null;
  acceptedByPharmacyID?: string | null;
  batchDetails: IcnBatchDetail[];
  transferredBatchDetails?: IcnBatchDetail[];
  postedSnapshot?: IcnSnapshot;
  quantityRequested: number | null;
  status: IcnStatus;
  expiresAt?: string;
  acceptedAt?: string;
  cancelledAt?: string;
  completedAt?: string;
  cancellationReason?: string;
  paymentMode?: 'CASH' | 'ONLINE' | string;
  transactionId?: string;
  createdAt: string;
  updatedAt: string;
}

type IcnSocketMessage = {
  type?: string;
  data?: {
    exchangeId?: string;
    exchange?: IcnExchange;
  };
};

function buildOrderWsUrl(token: string) {
  const envWsHost = (import.meta as any).env?.VITE_ORDER_SERVICE_WS as string | undefined;
  const defaultHost = 'localhost:5202';
  const host = envWsHost || defaultHost;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${host}/ws/orders?token=${encodeURIComponent(token)}`;
}

export const icnService = {
  async postExchange(payload: {
    genericKey: string;
    unitsToExchange: number;
    productID?: string;
    batchDetails?: IcnBatchDetail[];
  }): Promise<IcnExchange> {
    const token = getToken();
    const res = await fetchOrderApi('/icn/post-exchange', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to post ICN exchange' }));
      throw new Error(err.error || 'Failed to post ICN exchange');
    }

    const data = await res.json();
    return data.data;
  },

  async postRequest(payload: { genericKey: string; quantityRequested: number; productID?: string }): Promise<IcnExchange> {
    const token = getToken();
    const res = await fetchOrderApi('/icn/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create ICN request' }));
      throw new Error(err.error || 'Failed to create ICN request');
    }

    const data = await res.json();
    return data.data;
  },

  async getExchanges(params?: { status?: IcnStatus; type?: IcnType; mine?: boolean }): Promise<IcnExchange[]> {
    const token = getToken();
    const query = new URLSearchParams();

    if (params?.status) query.set('status', params.status);
    if (params?.type) query.set('type', params.type);
    if (params?.mine !== undefined) query.set('mine', String(params.mine));

    const suffix = query.toString() ? `?${query.toString()}` : '';

    const res = await fetchOrderApi(`/icn/exchanges${suffix}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to fetch ICN exchanges' }));
      throw new Error(err.error || 'Failed to fetch ICN exchanges');
    }

    const data = await res.json();
    return data.data || [];
  },

  async acceptExchange(exchangeId: string): Promise<IcnExchange> {
    const token = getToken();
    const res = await fetchOrderApi('/icn/accept', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ exchangeId }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to accept ICN exchange' }));
      throw new Error(err.error || 'Failed to accept ICN exchange');
    }

    const data = await res.json();
    return data.data;
  },

  async cancelExchange(exchangeId: string, reason: string): Promise<IcnExchange> {
    const token = getToken();
    const res = await fetchOrderApi('/icn/cancel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ exchangeId, reason }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to cancel ICN exchange' }));
      throw new Error(err.error || 'Failed to cancel ICN exchange');
    }

    const data = await res.json();
    return data.data;
  },

  async completeExchange(payload: { exchangeId: string; paymentMode: 'CASH' | 'ONLINE'; transactionId?: string }): Promise<IcnExchange> {
    const token = getToken();
    const res = await fetchOrderApi('/icn/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to complete ICN exchange' }));
      throw new Error(err.error || 'Failed to complete ICN exchange');
    }

    const data = await res.json();
    return data.data;
  },

  async checkExchangeExpiry(exchangeId: string): Promise<IcnExchange> {
    const token = getToken();
    const res = await fetchOrderApi(`/icn/${exchangeId}/check-expiry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to check ICN exchange expiry' }));
      throw new Error(err.error || 'Failed to check ICN exchange expiry');
    }

    const data = await res.json();
    return data.data;
  },

  subscribeToIcnUpdates(onUpdate: (message: IcnSocketMessage) => void): () => void {
    const token = getToken();
    if (!token) return () => {};

    let closedByClient = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (closedByClient) return;

      socket = new WebSocket(buildOrderWsUrl(token));

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as IcnSocketMessage;
          if (payload?.type === 'icn_update') {
            onUpdate(payload);
          }
        } catch {
          // Ignore malformed socket payloads.
        }
      };

      socket.onclose = () => {
        if (closedByClient) return;
        reconnectTimer = setTimeout(connect, 2500);
      };
    };

    connect();

    return () => {
      closedByClient = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (socket) {
        socket.close();
      }
    };
  },
};
