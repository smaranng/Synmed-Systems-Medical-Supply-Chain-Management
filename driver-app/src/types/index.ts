// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface Driver {
  distributorName?: string;
  companyName?: string;
  driverID: string;
  name: string;
  username: string;
  phone: string;
  distributorID: string;
  licenseNumber: string | null;
  licenseExpiry: string | null;
  vehicleID: string | null;
  vehicleNumber: string | null;
  vehicleType: string | null;
  isActive: boolean;
  role: 'driver';
}

// ─── Pharma Order (pharma_to_distributor_orders) ──────────────────────────────
export interface PharmaOrderItem {
  productID_Phm?: string;
  productID_Dtb?: string;
  name: string;
  quantity: number;
  price: number;
  discountPercent?: number;
  gstRate?: number;
  hsnCode?: string;
  mrpPerPack?: number;
  totalAmount?: number;  // ← added: used in DeliveryDetailScreen Medicines list
}

export interface PharmaOrder {
  orderNumber: string;
  pharmaID: string;
  distributorID: string;
  companyName: string;
  pharmaName: string;
  pharmaAddress: string;
  distributorAddress: string;
  items: PharmaOrderItem[];
  taxBreakdown?: {
    gross: number;
    discount: number;
    taxable: number;
    gst: number;
    cgst: number;
    sgst: number;
  };
  totalAmount?: number;
  grandTotal?: number;
  status: string;
  paymentMode?: string;
  paymentStatus?: string;
  placedAt?: string;
  acceptedAt?: string;   // ← added: used in DeliveryDetailScreen Timeline
  expiresAt?: string;    // ← added: used in DeliveryDetailScreen Timeline
  eta?: string;
}

// ─── Deliveries ───────────────────────────────────────────────────────────────
export type DeliveryStatus =
  | 'DISPATCHED'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'FAILED'
  | 'CANCELLED';

export interface Delivery {
  _id: string;
  orderNumber: string;
  orderId: string;
  distributorID: string;
  companyName: string;
  pharmaName: string;
  pharmaAddress: string;
  distributorAddress: string;
  pharmaID: string;
  driverID: string;
  driverName: string;
  driverPhone: string;
  driverRatingAtDispatch?: number;  // ← added: used in DeliveryDetailScreen Driver section
  vehicleNumber: string;
  vehicleType: string;
  distributorLocation: { lat: number; lng: number };
  pharmaLat?:         number | null;
  pharmaLng?:         number | null;
  driverLocation?: { lat: number; lng: number };
  distanceKm: number; 
  allocationScore: number;
  status: DeliveryStatus;
  createdAt: string;
  updatedAt: string;
  deliveredAt?: string;
  orderDetails?: PharmaOrder | null;
}

export interface DeliveryItem {
  name: string;
  quantity: number;
  unit: string;
}
