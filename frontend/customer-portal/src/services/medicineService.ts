const INVENTORY_API_URL = 'http://localhost:5201';

export interface MedicineSearchResult {
  // Core identifiers
  productImageURL?: string;
  productID: string;
  pharmaID?: string;
  batchCode?: string;

  medicineName: string;
  composition?: string;
  warranty?: string;
  description?: string;
  manufacturer?: string;

  category?: {
    primaryCategory?: string;
    productType?: string;
    therapeuticClass?: string;
    dosageForm?: string;
  };

  packaging?: {
    quantityDescription?: string;
    mrp?: number;
    discountPercent?: number;
    price?: number;
    pricePerUnit?: number;
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
  lastUpdated?: string;
  reservedStock?: number;
  availableStock: number;
 displayStock?: {
  unitsAvailable: number;
  reserved: number;
  reservedSubUnits: number;
  sold: number;
  soldSubUnits: number;
  total: number;
};
  // Pharmacy details
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
export interface CheckAvailabilityPayload {
  medicineNames: string[];
  pharmacies: { id: string; distance: number }[];
}

export interface CheckAvailabilityResponse {
  results: any[];
}

export const medicineService = {
  // Search medicines across all pharmacies or from specific pharmacy
  async searchMedicines(params: {
    keyword?: string;
    category?: string;
    sortBy?: string;
    sortOrder?: string;
    pharmaID?: string;
  }): Promise<MedicineSearchResult[]> {
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
  async getMedicineDetails(productID: string, pharmaID?: string): Promise<MedicineSearchResult> {
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
  async checkAvailability(payload: CheckAvailabilityPayload): Promise<CheckAvailabilityResponse> {
    console.log("🔍 Checking medicine availability:", payload);

    const response = await fetch(`${INVENTORY_API_URL}/pharmacies/check-medicine-availability`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        error: "Failed to check availability",
      }));

      console.error("❌ Availability error:", error);
      throw new Error(error.error || "Failed to check availability");
    }

    return response.json();
  }
};