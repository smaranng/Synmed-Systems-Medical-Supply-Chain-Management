export type UserRole = 'CUSTOMER' | 'PHARMACY' | 'distributor' | 'ADMIN';

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

export type ShipmentStatus = 'PREPARING' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'RETURNED';

export type OrderType = 'CUSTOMER_ORDER' | 'PHARMACY_PROCUREMENT' | 'ICN_EXCHANGE' | 'AUTO_REORDER';

export type NotificationType = 'ORDER_UPDATE' | 'STOCK_ALERT' | 'DELIVERY_UPDATE' | 'SYSTEM_ALERT' | 'PROMOTION';

export type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type MedicineCategory = 'TABLET' | 'CAPSULE' | 'SYRUP' | 'INJECTION' | 'CREAM' | 'DROPS';

export type AddressType = 'HOME' | 'BUSINESS' | 'BILLING' | 'SHIPPING';

export type ICNStatus = 'OPEN' | 'MATCHED' | 'COMPLETED' | 'CANCELLED';

export type UrgencyLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Location {
  latitude: number;
  longitude: number;
}

export interface Address {
  id: string;
  userId: string;
  type: AddressType;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  latitude?: number;
  longitude?: number;
  isDefault: boolean;
  createdAt: Date;
}
