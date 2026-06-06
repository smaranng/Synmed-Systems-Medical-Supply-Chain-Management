const USER_API_URL = "http://localhost:5203";
const PHARMA_OFFLINE_CART_KEY = "pharma_offline_purchase_cart";

// Stored at add-time (SearchPage sends these)
export interface CartItem {
  productID: string;
  name: string;
  batchCode?: string;
  price: number;
  quantity: number;
  subQuantity?: number; 
  pharmaID: string;
  prescriptionRequired?: boolean;
  prescriptionPath?: string;
  pricePerUnit?: number;  
}

export interface TaxBreakdown {
  gross: number;
  discount: number;
  taxable: number;   // toFixed(2)
  gst: number;       // toFixed(2)
  cgst: number;      // toFixed(2)
  sgst: number;      // toFixed(2)
}

export interface TaxSummary {
  discount: number;
  net: number;
  taxable: number;
  gst: number;
  cgst: number;
  sgst: number;
}

// CartItem + tax fields written by PUT /cart/enrich at checkout time
export interface CartItemWithTax extends CartItem {
  mrp: number;
  discountPercent: number;
  gstRate: number;
  hsnCode?: string;
  taxBreakdown: TaxBreakdown;
}

// Payload sent to PUT /cart/enrich
export interface CartItemEnrichPayload {
  productID: string;
  mrp: number;
  discountPercent: number;
  gstRate: number;
  hsnCode?: string;
  taxBreakdown: TaxBreakdown;
}

export interface PharmacyDetails {
  pharmaID: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  logo?: string | null;
  licenseNumber?: string;
  city?: string | null;
  area?: string | null;
  gstRegistered?: string;   // "Yes" | "No"
  gstIN?: string;
}

// Helper function to get cart from localStorage
function getLocalCart(): CartItem[] {
  try {
    const stored = localStorage.getItem(PHARMA_OFFLINE_CART_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Failed to parse cart from localStorage:", error);
    return [];
  }
}

// Helper function to save cart to localStorage
function saveLocalCart(items: CartItem[]): void {
  try {
    localStorage.setItem(PHARMA_OFFLINE_CART_KEY, JSON.stringify(items));
  } catch (error) {
    console.error("Failed to save cart to localStorage:", error);
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read prescription file'));
    reader.readAsDataURL(file);
  });
}

export const pharma_cartService = {
  async addToCart(item: CartItem) {
    const cart = getLocalCart();
    
    // Check if item already exists and update quantity
    const existingIndex = cart.findIndex((i) => i.productID === item.productID);
    if (existingIndex >= 0) {
      cart[existingIndex].quantity += item.quantity;
      if (item.subQuantity !== undefined && item.subQuantity > 0) {
        cart[existingIndex].subQuantity = (cart[existingIndex].subQuantity ?? 0) + item.subQuantity;
      }
    } else {
      cart.push(item);
    }
    
    saveLocalCart(cart);
    return { success: true, items: cart };
  },

  async getCart() {
    const cart = getLocalCart();
    return { items: cart };
  },

  async updateQuantity(itemId: string, quantity: number) {
    const cart = getLocalCart();
    const item = cart.find((i) => i.productID === itemId);
    if (item) {
      item.quantity = quantity;
    }
    saveLocalCart(cart);
    return { success: true, items: cart };
  },

  async removeItem(itemId: string) {
    const cart = getLocalCart();
    const filtered = cart.filter((i) => i.productID !== itemId);
    saveLocalCart(filtered);
    return { success: true, items: filtered };
  },

  async clearCart() {
    saveLocalCart([]);
    return { success: true };
  },

  async fetchProductDetails(productID: string, pharmaID: string): Promise<any> {
    const res = await fetch(
      `http://localhost:5201/medicines/search?pharmaID=${encodeURIComponent(pharmaID)}`,
      { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
    );
    if (!res.ok) throw new Error('Failed to fetch product details');
    const results = await res.json();
    const product = results.find((p: any) => p.productID === productID);
    if (!product) throw new Error(`Product ${productID} not found in pharmacy ${pharmaID}`);
    return product;
  },

  async fetchPharmacyDetails(pharmaID: string): Promise<PharmacyDetails> {
    try {
      const res = await fetch(`${USER_API_URL}/pharmacy/${pharmaID}`);

      if (res.status === 404) {
        throw new Error(`Pharmacy not found: ${pharmaID}`);
      }

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Failed to fetch pharmacy' }));
        throw new Error(error.error || `Failed to fetch pharmacy (${res.status})`);
      }

      const pharmacy = await res.json();

      if (!pharmacy.pharmaID || !pharmacy.name) {
        throw new Error('Invalid pharmacy data received');
      }

      return pharmacy;
    } catch (error) {
      console.error(`Error fetching pharmacy ${pharmaID}:`, error);
      throw error;
    }
  },

  async uploadPrescription(productID: string, file: File) {
    if (!productID) throw new Error('Product ID is required');
    if (!file) throw new Error('File is required');

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Please upload only image files (JPG, PNG, GIF, WEBP)');
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) throw new Error('File size must be less than 5MB');

    const dataUrl = await readFileAsDataUrl(file);
    const cart = getLocalCart();
    const idx = cart.findIndex((i) => i.productID === productID);
    if (idx >= 0) {
      cart[idx].prescriptionPath = dataUrl;
      saveLocalCart(cart);
    }

    return { success: true, prescriptionPath: dataUrl };
  },

  async markPrescriptionShownAtPharmacy(productID: string) {
    if (!productID) throw new Error('Product ID is required');

    const cart = getLocalCart();
    const idx = cart.findIndex((i) => i.productID === productID);
    if (idx >= 0) {
      cart[idx].prescriptionPath = 'PRESCRIPTION_SHOWN_AT_PHARMACY';
      saveLocalCart(cart);
    }

    return { success: true, prescriptionPath: 'PRESCRIPTION_SHOWN_AT_PHARMACY' };
  },

  async uploadBulkPrescription(file: File) {
    if (!file) throw new Error('File is required');

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Please upload only image files (JPG, PNG, GIF, WEBP)');
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) throw new Error('File size must be less than 5MB');

    const dataUrl = await readFileAsDataUrl(file);
    return { success: true, prescriptionPath: dataUrl };
  },
};