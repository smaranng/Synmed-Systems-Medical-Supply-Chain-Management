export type OrderStatus = 'pending' | 'processing' | 'in-transit' | 'out-for-delivery' | 'delivered' | 'cancelled';

export interface Hub {
  id: string;
  name: string;
  location: string;
  timestamp: string;
  status: 'completed' | 'current' | 'pending';
  latitude?: number;
  longitude?: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  distributorName: string;
  medicineCount: number;
  status: OrderStatus;
  orderDate: string;
  estimatedDelivery: string;
  totalAmount: number;
  hubs: Hub[];
  currentLocation?: {
    latitude: number;
    longitude: number;
  };
  destination?: {
    latitude: number;
    longitude: number;
    address: string;
  };
}
