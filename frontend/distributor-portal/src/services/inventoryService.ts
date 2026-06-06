import { getToken } from './authService';

const INVENTORY_API_URL = 'http://localhost:5204';

// ================= TYPES =================

export interface Scheme {
  buyQty?: number;
  buyUnit?: string;
  freeQty?: number;
  freeUnit?: string;
}

export interface PurchaseTier {
  orderUnit: 'box' | 'pack' | string;
  minimumOrderQuantity?: number;
}

export interface Medicine {
  productImageURL?: string;
  productID: string;
  distributorID?: string;
  batchCode?: string;

  medicineName: string;
  composition?: string;
  description?: string;
  manufacturer?: string;

  category?: {
    primaryCategory?: string;
    therapeuticClass?: string;
    dosageForm?: string;         // absent for Medical Devices / Personal Care / FMCG
  };

  packaging?: {
    quantityDescription?: string;

    // ── Pricing ──────────────────────────────────────────────────────────
    price?: number;
    mrpPerPack?: number;
    pricePerBox?: number;    // ← ADD
    mrpPerBox?: number;   
    discountPercent?: number;

    /** units+packs & unitsOnly dosage forms (Tablet, Capsule, Gloves, Mask…) */
    unitsPerPack?: number;
    /** units+packs, packsOnly & packSize dosage forms */
    packsPerBox?: number;
    /** packSize dosage forms only (Syrup, Injection, Cream…) — numeric volume/weight */
    packSize?: number;
    /** Unit for packSize: 'ml' | 'g' | 'doses' | 'mg' | 'L' */
    packSizeUnit?: string;

    // ── Purchase tiers (replaces old flat orderUnit / minimumOrderQuantity) ──
    purchase?: PurchaseTier[];

    // ── Scheme ────────────────────────────────────────────────────────────
    scheme?: Scheme;

    // ── GST (only when distributor is GST-registered) ────────────────────
    gstRate?: number;
    hsnCode?: string;
  };

  stock?: {
    packsAvailable?: number;
    threshold?: number;
  };

  storageCondition?: string;
  prescriptionRequired?: boolean;
  manufacturedDate?: string;
  expiryDate?: string;
  warranty?: string;    // Medical Devices only (e.g. "2 Years")
  lastUpdated?: string;

  // ── Backend-computed / MongoDB fields ───────────────────────────────────
  id?: string;            // alias for productID
  _id?: string;           // MongoDB ObjectId string
  reservedStock?: number;
  availableStock?: number;
}

export interface InventoryStats {
  totalItems: number;
  lowStock: number;
  expiringSoon: number;
  totalValue: number;
  expired: number;
}

// ================= AUTH HELPERS =================

const getAuthHeader = (): Record<string, string> => {
  const token = getToken();
  console.log('🔑 Token available:', !!token);
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
};

// No Content-Type for FormData — browser sets it with the multipart boundary
const getAuthHeaderForUpload = (): Record<string, string> => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// ================= SERVICE =================

export const inventoryService = {

  // ── Get Inventory List ──────────────────────────────────────────────────
  async getInventory(distributorID: string): Promise<Medicine[]> {
    console.log('📦 Fetching inventory for distributorID:', distributorID);

    const res = await fetch(
      `${INVENTORY_API_URL}/inventory/distributor/${distributorID}`,
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

  // ── Get Inventory Stats ─────────────────────────────────────────────────
  async getStats(distributorID: string): Promise<InventoryStats> {
    console.log('📊 Fetching stats for distributorID:', distributorID);

    const res = await fetch(
      `${INVENTORY_API_URL}/inventory/distributor/${distributorID}/stats`,
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

  // ── Get Next Auto-Incremented Product ID ────────────────────────────────
  async getNextProductID(distributorID: string): Promise<string> {
    const res = await fetch(
      `${INVENTORY_API_URL}/inventory/distributor/${distributorID}/next-product-id`,
      { headers: getAuthHeader() }
    );
    if (!res.ok) throw new Error('Failed to fetch next product ID');
    const data = await res.json();
    return data.nextProductID;
  },

  // ── Add Medicine ────────────────────────────────────────────────────────
  async addMedicine(
    distributorID: string,
    productID: string,
    data: Partial<Medicine>
  ): Promise<Medicine> {
    console.log('➕ Adding medicine for distributorID:', distributorID);
    console.log('📝 Medicine data:', data);

    const res = await fetch(
      `${INVENTORY_API_URL}/inventory/distributor/${distributorID}/${productID}`,
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

  // ── Update Medicine ─────────────────────────────────────────────────────
  async updateMedicine(
    distributorID: string,
    productID: string,
    data: Partial<Medicine>
  ): Promise<Medicine> {
    console.log('✏️ Updating medicine:', productID);
    console.log('📝 Update data:', data);

    const res = await fetch(
      `${INVENTORY_API_URL}/inventory/distributor/${distributorID}/${productID}`,
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

  // ── Delete Medicine ─────────────────────────────────────────────────────
  async deleteMedicine(productID: string, distributorID: string): Promise<void> {
    console.log('🗑️ Deleting medicine:', productID);

    const res = await fetch(
      `${INVENTORY_API_URL}/inventory/distributor/${distributorID}/${productID}`,
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

  // ── Upload Product Image (first time — POST) ────────────────────────────
  async uploadProductImage(
    distributorID: string,
    productID: string,
    file: File
  ): Promise<string> {
    console.log('🖼️ Uploading product image for:', productID);

    const formData = new FormData();
    formData.append('image', file);

    const res = await fetch(
      `${INVENTORY_API_URL}/inventory/distributor/${distributorID}/${productID}/image`,
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
    return `${INVENTORY_API_URL}${data.productImageURL}`;
  },

  // ── Replace Existing Product Image (PUT) ────────────────────────────────
  async updateProductImage(
    distributorID: string,
    productID: string,
    file: File
  ): Promise<string> {
    console.log('🔄 Replacing product image for:', productID);

    const formData = new FormData();
    formData.append('image', file);

    const res = await fetch(
      `${INVENTORY_API_URL}/inventory/distributor/${distributorID}/${productID}/image`,
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

  // ── Delete Product Image ─────────────────────────────────────────────────
  async deleteProductImage(distributorID: string, productID: string): Promise<void> {
    console.log('❌ Deleting product image for:', productID);

    const res = await fetch(
      `${INVENTORY_API_URL}/inventory/distributor/${distributorID}/${productID}/image`,
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

  // ── Smart Image Handler: POST first time, PUT if replacing ──────────────
  async saveProductImage(
    distributorID: string,
    productID: string,
    file: File,
    hasExistingImage: boolean
  ): Promise<string> {
    return hasExistingImage
      ? this.updateProductImage(distributorID, productID, file)
      : this.uploadProductImage(distributorID, productID, file);
  },
};