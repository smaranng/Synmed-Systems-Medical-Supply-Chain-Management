const INVENTORY_API_URL = 'http://localhost:5204';

function toQueryStringValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return toQueryStringValue(value[0]);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.$oid === 'string') return record.$oid;
    if (typeof record.id === 'string') return record.id;
    if (typeof record.distributorID === 'string') return record.distributorID;
  }
  return '';
}

export interface MedicineSearchResult {
  productImageURL?: string;
  productID: string;
  distributorID?: string;
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
    /** MRP per pack — DB field name */
    mrpPerPack?: number;
    discountPercent?: number;
    /** Distributor selling price per pack */
    price?: number;
    pricePerUnit?: number;
    unitsPerPack?: number;
    packsPerBox?: number;
    /** e.g. 12 */
    gstRate?: number;
    /** e.g. "3004" */
    hsnCode?: string;
    /** e.g. "box" */
    orderUnit?: string;
    minimumOrderQuantity?: number;
    /** Promotional scheme — field names match DB exactly */
    scheme?: {
      buyQty: number;
      buyUnit: string;
      freeQty: number;
      freeUnit: string;
    };
  };

  stock?: {
    /** Primary stock field from DB */
    packsAvailable?: number;
    /** Legacy fallback */
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
  /** Resolved available stock returned by API — preferred source */
  availableStock: number;
  displayStock?: {
    unitsAvailable: number;
    reserved: number;
    sold: number;
    total: number;
  };

  distributor?: {
    id: string;
    distributorID: string;
    name: string;
    address?: string;
    phone?: string;
    email?: string;
  };
}

export const medicineService = {
  async searchMedicines(params: {
    keyword?: string;
    category?: string;
    sortBy?: string;
    sortOrder?: string;
    distributorID?: string;
  }): Promise<MedicineSearchResult[]> {
    const queryParams = new URLSearchParams();
    const keyword = toQueryStringValue(params.keyword).trim();
    const category = toQueryStringValue(params.category).trim();
    const sortBy = toQueryStringValue(params.sortBy).trim();
    const sortOrder = toQueryStringValue(params.sortOrder).trim();
    const distributorID = toQueryStringValue(params.distributorID).trim();

    if (keyword) queryParams.append('keyword', keyword);
    if (category && category !== 'ALL') queryParams.append('category', category);
    if (sortBy) queryParams.append('sortBy', sortBy);
    if (sortOrder) queryParams.append('sortOrder', sortOrder);
    if (distributorID) queryParams.append('distributorID', distributorID);

    const response = await fetch(`${INVENTORY_API_URL}/medicines/search?${queryParams.toString()}`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to search medicines' }));
      console.error('Search error:', error);
      throw new Error(error.error || 'Failed to search medicines');
    }
    return response.json();
  },

  async getMedicineDetails(productID: string, distributorID?: string): Promise<MedicineSearchResult> {
    const url = distributorID
      ? `${INVENTORY_API_URL}/medicines/${productID}/${distributorID}`
      : `${INVENTORY_API_URL}/medicines/${productID}`;
    console.log('Fetching medicine details:', url);

    const response = await fetch(url);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to get medicine details' }));
      console.error('Get details error:', error);
      throw new Error(error.error || 'Failed to get medicine details');
    }
    return response.json();
  },
};