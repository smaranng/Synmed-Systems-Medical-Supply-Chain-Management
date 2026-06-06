// types/vehicles-drivers.types.ts

export type VehicleType = "Truck"; // Delivery trucks only
export type VehicleOwnership = "Distributor" | "Driver";
export type VehicleStatus = "Active" | "Maintenance" | "Inactive";
export type DriverStatus = "Available" | "On Delivery" | "Inactive";
export type AssignmentStatus = "Pending" | "In Progress" | "Completed" | "Cancelled";

export interface Vehicle {
  id: string;
  registrationNumber: string;
  vehicleType: VehicleType;
  capacity: number; // in kg or liters
  ownership: VehicleOwnership;
  driverId?: string; // assigned driver if owned by distributor
  status: VehicleStatus;
  insuranceExpiry: string; // ISO date string
  permitExpiry: string; // ISO date string
  fuelType?: "Petrol" | "Diesel" | "Electric" | "CNG";
  model?: string;
  year?: number;
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  email: string;
  licenseNumber: string;
  licenseExpiry: string; // ISO date string
  hasOwnVehicle: boolean;
  vehicleId?: string; // if has own vehicle
  assignedVehicleId?: string; // if operating distributor vehicle
  status: DriverStatus;
  currentOrders: string[]; // order IDs
  rating: number; // 0-5
  totalDeliveries: number;
  address?: string;
  emergencyContact?: string;
  joiningDate?: string;
  bankAccountNumber?: string;
  ifscCode?: string;
  aadharNumber?: string;
  profilePhoto?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Assignment {
  id: string;
  orderId: string;
  driverId: string;
  vehicleId: string;
  assignedAt: string; // ISO date string
  assignedBy: string; // user ID who assigned
  status: AssignmentStatus;
  customerName: string;
  customerId: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryPincode: string;
  estimatedDelivery: string; // ISO date string
  actualDelivery?: string; // ISO date string
  distance?: number; // in km
  items: AssignmentItem[];
  notes?: string;
  deliveryProof?: string; // image URL
  customerSignature?: string; // image URL or data
  cancelledBy?: string;
  cancellationReason?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AssignmentItem {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  batchNumber?: string;
}

export interface DeliveryRoute {
  id: string;
  name: string;
  driverId: string;
  vehicleId: string;
  date: string;
  assignments: string[]; // assignment IDs in order
  status: "Planned" | "In Progress" | "Completed";
  totalDistance: number;
  estimatedDuration: number; // in minutes
  actualDuration?: number;
  startedAt?: string;
  completedAt?: string;
}

export interface VehicleMaintenanceLog {
  id: string;
  vehicleId: string;
  maintenanceType: "Routine" | "Repair" | "Inspection" | "Other";
  description: string;
  cost: number;
  performedAt: string;
  performedBy: string;
  nextDueDate?: string;
  invoiceNumber?: string;
  attachments?: string[];
}

export interface DriverPerformance {
  driverId: string;
  period: "daily" | "weekly" | "monthly";
  startDate: string;
  endDate: string;
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  cancelledDeliveries: number;
  averageDeliveryTime: number; // in minutes
  rating: number;
  customerFeedback: number; // count
  onTimeDeliveryRate: number; // percentage
  distanceCovered: number; // in km
}

// API Request/Response types
export interface CreateVehicleRequest {
  registrationNumber: string;
  vehicleType: VehicleType;
  capacity: number;
  ownership: VehicleOwnership;
  driverId?: string;
  insuranceExpiry: string;
  permitExpiry: string;
  fuelType?: string;
  model?: string;
  year?: number;
}

export interface UpdateVehicleRequest extends Partial<CreateVehicleRequest> {
  status?: VehicleStatus;
}

export interface CreateDriverRequest {
  name: string;
  phone: string;
  email: string;
  licenseNumber: string;
  licenseExpiry: string;
  hasOwnVehicle: boolean;
  vehicleId?: string;
  address?: string;
  emergencyContact?: string;
  bankAccountNumber?: string;
  ifscCode?: string;
  aadharNumber?: string;
}

export interface UpdateDriverRequest extends Partial<CreateDriverRequest> {
  status?: DriverStatus;
  assignedVehicleId?: string;
}

export interface CreateAssignmentRequest {
  orderId: string;
  driverId: string;
  vehicleId: string;
  customerName: string;
  customerId: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryPincode: string;
  estimatedDelivery: string;
  items: AssignmentItem[];
  notes?: string;
}

export interface UpdateAssignmentRequest {
  status?: AssignmentStatus;
  actualDelivery?: string;
  deliveryProof?: string;
  customerSignature?: string;
  cancellationReason?: string;
  notes?: string;
}

export interface AssignDriverToVehicleRequest {
  driverId: string;
  vehicleId: string;
}

export interface VehiclesDriversFilters {
  search?: string;
  status?: string;
  ownership?: VehicleOwnership;
  vehicleType?: VehicleType;
  hasOwnVehicle?: boolean;
  sortBy?: "name" | "rating" | "deliveries" | "date";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}