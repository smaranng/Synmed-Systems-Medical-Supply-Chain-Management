import { authService } from './authService';

const ORDER_API_URL = 'http://localhost:5202';

export interface OrderItemPayload {
  productID: string;
  name: string;
  price: number;
  quantity: number;
  pharmaID: string;
  type?: string;
  isPrescriptionRequired?: boolean;
  prescriptionPath?: string;

}

export interface OrderResponse {
  orders: Array<{ 
    _id: string;
    orderNumber: string; 
    status: string; 
    pharmaID: string; 
    customerId: string; 
    totalAmount: number;
    items: OrderItemPayload[];
    createdAt: string;
    updatedAt: string;
  }>;
}

export interface Order {
  _id: string;
  orderNumber: string;
  status: string;
  customerId: string;
  pharmaID: string;
  items: OrderItemPayload[];
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  isFavourite?: boolean;
  placedAt?: string;
  approvedAt?: string;
  cancellationReason?: string;
  cancellationAmount?: number;
  cancellationFeePercentage?: number;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationFeePaid?: boolean;
}

export interface CancellationResponse {
  requiresPayment: boolean;
  cancellationFeePercentage?: number;
  cancellationAmount?: number;
  totalAmount?: number;
  minutesElapsed?: number;
  order?: Order;
}

const authHeader = () => authService.getAuthHeader();

export const orderService = {
  async confirmOrder(items: OrderItemPayload[]): Promise<OrderResponse> {
    const res = await fetch(`${ORDER_API_URL}/orders/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader() as Record<string, string>),
      },
      body: JSON.stringify({ items }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to place order' }));
      throw new Error(err.error || 'Failed to place order');
    }

    return res.json();
  },

  async getCustomerOrders(): Promise<Order[]> {
    const res = await fetch(`${ORDER_API_URL}/orders/customer`, {
      headers: {
        ...(authHeader() as Record<string, string>),
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to fetch orders' }));
      throw new Error(err.error || 'Failed to fetch orders');
    }

    const data = await res.json();
    console.log('Orders received from API:', data); // Debug log
    return data;
  },

  async getOrder(orderId: string): Promise<Order> {
    const res = await fetch(`${ORDER_API_URL}/orders/${orderId}`, {
      headers: {
        ...(authHeader() as Record<string, string>),
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to fetch order' }));
      throw new Error(err.error || 'Failed to fetch order');
    }

    return res.json();
  },

  async toggleFavourite(orderId: string, isFavourite: boolean): Promise<Order> {
    const res = await fetch(`${ORDER_API_URL}/orders/${orderId}/favourite`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader() as Record<string, string>),
      },
      body: JSON.stringify({ isFavourite }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update favourite status' }));
      throw new Error(err.error || 'Failed to update favourite status');
    }

    return res.json();
  },

  async checkOrderExpiry(orderId: string): Promise<Order> {
    const res = await fetch(`${ORDER_API_URL}/orders/${orderId}/check-expiry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader() as Record<string, string>),
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to check order expiry' }));
      throw new Error(err.error || 'Failed to check order expiry');
    }

    return res.json();
  },

  // Customer cancel order
  async cancelOrder(orderId: string): Promise<CancellationResponse> {
    const res = await fetch(`${ORDER_API_URL}/orders/${orderId}/customer-cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader() as Record<string, string>),
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to cancel order' }));
      throw new Error(err.error || 'Failed to cancel order');
    }

    return res.json();
  },

  // Confirm cancellation payment
  async confirmCancellationPayment(
    orderId: string,
    cancellationAmount: number,
    cancellationFeePercentage: number
  ): Promise<Order> {
    const res = await fetch(`${ORDER_API_URL}/orders/${orderId}/confirm-cancellation-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader() as Record<string, string>),
      },
      body: JSON.stringify({
        cancellationAmount,
        cancellationFeePercentage,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to confirm cancellation payment' }));
      throw new Error(err.error || 'Failed to confirm cancellation payment');
    }

    return res.json();
  },

  // Pharmacy methods
  async getPharmacyOrders(pharmaID: string, status?: string): Promise<Order[]> {
    const params = status ? `?status=${encodeURIComponent(status)}` : '';
    const res = await fetch(`${ORDER_API_URL}/orders/pharmacy/${pharmaID}${params}`, {
      headers: {
        ...(authHeader() as Record<string, string>),
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to fetch pharmacy orders' }));
      throw new Error(err.error || 'Failed to fetch pharmacy orders');
    }

    return res.json();
  },

  async updateOrderStatus(orderId: string, status: string): Promise<Order> {
    const res = await fetch(`${ORDER_API_URL}/orders/${orderId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader() as Record<string, string>),
      },
      body: JSON.stringify({ status }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update order status' }));
      throw new Error(err.error || 'Failed to update order status');
    }

    return res.json();
  },

  async getOrdersNeedingAction(pharmaID: string): Promise<Order[]> {
    const res = await fetch(`${ORDER_API_URL}/orders/pharmacy/${pharmaID}/action-required`, {
      headers: {
        ...(authHeader() as Record<string, string>),
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to fetch orders needing action' }));
      throw new Error(err.error || 'Failed to fetch orders needing action');
    }

    return res.json();
  },
};