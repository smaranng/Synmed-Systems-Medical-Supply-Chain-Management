import { getToken } from './authService';
import { medicineService } from './medicineService';

const INVENTORY_API_URL = 'http://localhost:5201';

// ================= TYPES =================

export interface Medicine {
  productImageURL?: string;
  productID: string;
  pharmaID?: string;
  batchCode?: string;

  medicineName: string;
  composition?: string;
  description?: string;
  manufacturer?: string;

  category?: {
    primaryCategory?: string;
    therapeuticClass?: string;
    dosageForm?: string;
  };

  packaging?: {
    quantityDescription?: string;
    mrp?: number;
    discountPercent?: number;
    price?: number;
    pricePerUnit?: number;
    gstRate?: number;
    hsnCode?: string;
  };

  stock?: {
    unitsAvailable?: number;
    threshold?: number;
    allowSubQuantity?: boolean;
    baseQuantity?: number;
    totalSubUnits?: number;
  };
  storageCondition?: string;
  prescriptionRequired?: boolean;
  manufacturedDate?: string;
  expiryDate?: string;
  warranty?: string;
  lastUpdated?: string;

  // Backend computed fields
  id?: string; // productID alias
  _id?: string; // MongoDB ID
  reservedStock?: number;
  availableStock?: number;

   pharmacy?: {
    id: string;
    pharmaID: string;
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    timings?: {
      Monday?: { open: string; close: string };
      Tuesday?: { open: string; close: string };
      Wednesday?: { open: string; close: string };
      Thursday?: { open: string; close: string };
      Friday?: { open: string; close: string };
      Saturday?: { open: string; close: string };
      Sunday?: { open: string; close: string };
    };
  };
}

export interface InventoryStats {
  totalItems: number;
  lowStock: number;
  expiringSoon: number;
  totalValue: number;
  expired: number;
}

// ================= AUTH HEADER =================

const getAuthHeader = (): Record<string, string> => {
  const token = getToken();
  console.log('🔑 Token available:', !!token);
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
};

// Auth header WITHOUT Content-Type (for FormData — browser sets it with boundary automatically)
const getAuthHeaderForUpload = (): Record<string, string> => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// ================= API =================

export const inventoryService = {

  // 📦 Get Inventory List
  async getInventory(pharmaID: string): Promise<Medicine[]> {
    console.log('📦 Fetching inventory for pharmaID:', pharmaID);

    const res = await fetch(
      `${INVENTORY_API_URL}/inventory/pharmacy/${pharmaID}`,
      { headers: getAuthHeader() }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error('❌ Inventory Fetch Error:', res.status, text);
      throw new Error(`Failed to fetch inventory: ${res.status} ${text}`);
    }

    const data = await res.json();
    console.log('✅ Inventory fetched:', data.length, 'items');
    return data;
  },

  // 📊 Get Inventory Stats
  async getStats(pharmaID: string): Promise<InventoryStats> {
    console.log('📊 Fetching stats for pharmaID:', pharmaID);

    const res = await fetch(
      `${INVENTORY_API_URL}/inventory/pharmacy/${pharmaID}/stats`,
      { headers: getAuthHeader() }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error('❌ Stats Fetch Error:', res.status, text);
      throw new Error(`Failed to fetch stats: ${res.status} ${text}`);
    }

    const data = await res.json();
    console.log('✅ Stats fetched:', data);
    return data;
  },

  async searchMedicines(params: {
    keyword?: string;
    category?: string;
    sortBy?: string;
    sortOrder?: string;
    pharmaID?: string;
  }): Promise<Medicine[]> {
    const queryParams = new URLSearchParams();

    if (params.keyword) queryParams.append('keyword', params.keyword);
    if (params.category && params.category !== 'ALL') queryParams.append('category', params.category);
    if (params.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);
    if (params.pharmaID) queryParams.append('pharmaID', params.pharmaID);

    const response = await fetch(`${INVENTORY_API_URL}/medicines/search?${queryParams.toString()}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to search medicines' }));
      console.error('❌ Search error:', error);
      throw new Error(error.error || 'Failed to search medicines');
    }

    const data = await response.json();
    return data;
  },

  // Get medicine details by ID
  // Backend route: GET /medicines/:productID/:pharmaID
  // pharmaID is a required path param — NOT a query param
  async getMedicineDetails(productID: string, pharmaID?: string): Promise<Medicine> {
    const url = pharmaID
      ? `${INVENTORY_API_URL}/medicines/${productID}/${pharmaID}`  // ✅ path param
      : `${INVENTORY_API_URL}/medicines/${productID}`;

    console.log('🔍 Fetching medicine details:', url);

    const response = await fetch(url);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to get medicine details' }));
      console.error('❌ Get details error:', error);
      throw new Error(error.error || 'Failed to get medicine details');
    }

    const data = await response.json();
    return data;
  },

  async getNextProductID(pharmaID: string): Promise<string> {
    const response = await fetch(
      `${INVENTORY_API_URL}/inventory/pharmacy/${pharmaID}/next-product-id`,
      { headers: getAuthHeader() }
    );
    if (!response.ok) { throw new Error('Failed to fetch next product ID'); }
    const data = await response.json();
    return data.nextProductID;
  },

  // ➕ Add Medicine
  async addMedicine(pharmaID: string, productID: string, data: Partial<Medicine>): Promise<Medicine> {
    console.log('➕ Adding medicine for pharmaID:', pharmaID);
    console.log('📝 Medicine data:', data);

    const res = await fetch(
      `${INVENTORY_API_URL}/inventory/pharmacy/${pharmaID}/${productID}`,
      {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(data),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error('❌ Add Error:', res.status, text);
      throw new Error(`Failed to add item: ${res.status} ${text}`);
    }

    const result = await res.json();
    console.log('✅ Medicine added:', result);
    return result;
  },

  // ✏️ Update Medicine by productID
  async updateMedicine(pharmaID: string, productID: string, data: Partial<Medicine>): Promise<Medicine> {
    console.log('✏️ Updating medicine:', productID);
    console.log('📝 Update data:', data);

    const res = await fetch(
      `${INVENTORY_API_URL}/inventory/pharmacy/${pharmaID}/${productID}`,
      {
        method: 'PUT',
        headers: getAuthHeader(),
        body: JSON.stringify(data),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error('❌ Update Error:', res.status, text);
      throw new Error(`Failed to update item: ${res.status} ${text}`);
    }

    const result = await res.json();
    console.log('✅ Medicine updated:', result);
    return result;
  },

  // 🗑️ Delete Medicine by productID
  async deleteMedicine(productID: string, pharmaID: string): Promise<void> {
    console.log('🗑️ Deleting medicine:', productID);

    const res = await fetch(
      `${INVENTORY_API_URL}/inventory/pharmacy/${pharmaID}/${productID}`,
      {
        method: 'DELETE',
        headers: getAuthHeader(),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error('❌ Delete Error:', res.status, text);
      throw new Error(`Failed to delete item: ${res.status} ${text}`);
    }

    console.log('✅ Medicine deleted');
  },

  // ================= PRODUCT IMAGE =================

  // 🖼️ Upload product image (first time — POST)
  async uploadProductImage(
    pharmaID: string,
    productID: string,
    file: File
  ): Promise<string> {
    console.log('🖼️ Uploading product image for:', productID);

    const formData = new FormData();
    formData.append('image', file);

    const res = await fetch(
      `${INVENTORY_API_URL}/inventory/pharmacy/${pharmaID}/${productID}/image`,
      {
        method: 'POST',
        headers: getAuthHeaderForUpload(),
        body: formData,
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error('❌ Image Upload Error:', res.status, text);
      throw new Error(`Failed to upload image: ${res.status} ${text}`);
    }

    const data = await res.json();
    console.log('✅ Image uploaded:', data.productImageURL);
    // Full URL for immediate display
    return `${INVENTORY_API_URL}${data.productImageURL}`;
  },

  // 🔄 Replace existing product image (PUT)
  async updateProductImage(
    pharmaID: string,
    productID: string,
    file: File
  ): Promise<string> {
    console.log('🔄 Replacing product image for:', productID);

    const formData = new FormData();
    formData.append('image', file);

    const res = await fetch(
      `${INVENTORY_API_URL}/inventory/pharmacy/${pharmaID}/${productID}/image`,
      {
        method: 'PUT',
        headers: getAuthHeaderForUpload(),
        body: formData,
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error('❌ Image Update Error:', res.status, text);
      throw new Error(`Failed to update image: ${res.status} ${text}`);
    }

    const data = await res.json();
    console.log('✅ Image updated:', data.productImageURL);
    return `${INVENTORY_API_URL}${data.productImageURL}`;
  },

  // ❌ Delete product image
  async deleteProductImage(pharmaID: string, productID: string): Promise<void> {
    console.log('❌ Deleting product image for:', productID);

    const res = await fetch(
      `${INVENTORY_API_URL}/inventory/pharmacy/${pharmaID}/${productID}/image`,
      {
        method: 'DELETE',
        headers: getAuthHeader(),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error('❌ Image Delete Error:', res.status, text);
      throw new Error(`Failed to delete image: ${res.status} ${text}`);
    }

    console.log('✅ Image deleted');
  },

  // 🚀 Smart image handler: uploads if no existing image, replaces if one exists
  async saveProductImage(
    pharmaID: string,
    productID: string,
    file: File,
    hasExistingImage: boolean
  ): Promise<string> {
    return hasExistingImage
      ? this.updateProductImage(pharmaID, productID, file)
      : this.uploadProductImage(pharmaID, productID, file);
  },
};