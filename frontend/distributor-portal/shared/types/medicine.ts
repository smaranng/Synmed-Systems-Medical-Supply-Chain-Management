import { MedicineCategory } from './common';

export interface Medicine {
  id: string;
  name: string;
  genericName?: string;
  manufacturer: string;
  category: MedicineCategory;
  dosage?: string;
  form?: string;
  description?: string;
  requiresPrescription: boolean;
  activeIngredients?: Record<string, any>;
  storageConditions?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MedicineWithStock extends Medicine {
  stock?: number;
  price?: number;
  availablePharmacies?: PharmacyAvailability[];
}

export interface PharmacyAvailability {
  pharmacyId: string;
  pharmacyName: string;
  distance: number;
  stock: number;
  price: number;
  is24Hours: boolean;
}

export interface Inventory {
  id: string;
  medicineId: string;
  pharmacyId: string;
  quantity: number;
  reservedQuantity: number;
  batchNumber?: string;
  expiryDate?: Date;
  costPrice: number;
  sellingPrice: number;
  reorderLevel: number;
  maxStockLevel: number;
  lastUpdated: Date;
  createdAt: Date;
  medicine?: Medicine;
}

export interface StockUpdate {
  medicineId: string;
  pharmacyId: string;
  quantity: number;
  batchNumber?: string;
  expiryDate?: Date;
  costPrice?: number;
  sellingPrice?: number;
}

export interface SearchQuery {
  keyword?: string;
  category?: MedicineCategory;
  location?: {
    latitude: number;
    longitude: number;
  };
  radius?: number;
  requiresPrescription?: boolean;
  page?: number;
  limit?: number;
}
