import { OrderStatus, PaymentStatus, OrderType } from './common';
import { Medicine } from './medicine';

export interface Order {
  id: string;
  orderNumber: string;
  customerId?: string;
  pharmacyId: string;
  distributorId?: string;
  orderType: OrderType;
  status: OrderStatus;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  paymentMethod?: string;
  notes?: string;
  expectedDelivery?: Date;
  actualDelivery?: Date;
  createdAt: Date;
  updatedAt: Date;
  items?: OrderItem[];
  shipment?: Shipment;
}

export interface OrderItem {
  id: string;
  orderId: string;
  medicineId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  batchNumber?: string;
  expiryDate?: Date;
  medicine?: Medicine;
  createdAt: Date;
}

export interface CreateOrderInput {
  customerId?: string;
  pharmacyId: string;
  orderType: OrderType;
  items: CreateOrderItemInput[];
  paymentMethod?: string;
  notes?: string;
}

export interface CreateOrderItemInput {
  medicineId: string;
  quantity: number;
  unitPrice: number;
}

export interface Cart {
  items: CartItem[];
  totalAmount: number;
  selectedPharmacyId?: string;
}

export interface CartItem {
  medicine: Medicine;
  quantity: number;
  price: number;
  pharmacyId: string;
}

export interface Shipment {
  id: string;
  orderId: string;
  trackingNumber: string;
  driverId?: string;
  vehicleId?: string;
  status: string;
  currentLatitude?: number;
  currentLongitude?: number;
  estimatedDelivery?: Date;
  actualDelivery?: Date;
  deliveryNotes?: string;
  createdAt: Date;
  updatedAt: Date;
  trackingUpdates?: TrackingUpdate[];
}

export interface TrackingUpdate {
  id: string;
  shipmentId: string;
  latitude: number;
  longitude: number;
  status: string;
  notes?: string;
  recordedAt: Date;
}
