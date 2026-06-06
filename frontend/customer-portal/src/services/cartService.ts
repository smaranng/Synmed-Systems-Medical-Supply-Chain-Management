import { authService } from "./authService";
const CART_API_URL = "http://localhost:5201/cart";
const USER_API_URL = "http://localhost:5203";
const ORDER_API_URL = "http://localhost:5202";

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

export const cartService = {
  async addToCart(item: CartItem) {
    const res = await fetch(`${CART_API_URL}/add`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authService.getAuthHeader(),
      },
      body: JSON.stringify(item),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Failed to add to cart' }));
      throw new Error(error.error || 'Failed to add to cart');
    }

    return res.json();
  },

  async getCart() {
    const res = await fetch(`${CART_API_URL}`, {
      headers: {
        ...authService.getAuthHeader(),
      },
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Failed to fetch cart' }));
      throw new Error(error.error || 'Failed to fetch cart');
    }

    return res.json();
  },

  async updateQuantity(itemId: string, quantity: number) {
    const res = await fetch(`${CART_API_URL}/update`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...authService.getAuthHeader(),
      },
      body: JSON.stringify({ productID: itemId, quantity }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Failed to update quantity' }));
      throw new Error(error.error || 'Failed to update quantity');
    }

    return res.json();
  },

  async removeItem(itemId: string) {
    const res = await fetch(`${CART_API_URL}/remove/${itemId}`, {
      method: "DELETE",
      headers: {
        ...authService.getAuthHeader(),
      },
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Failed to remove item' }));
      throw new Error(error.error || 'Failed to remove item');
    }

    return res.json();
  },

  async clearCart() {
    const res = await fetch(`${CART_API_URL}/clear`, {
      method: "DELETE",
      headers: {
        ...authService.getAuthHeader(),
      },
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Failed to clear cart' }));
      throw new Error(error.error || 'Failed to clear cart');
    }

    return res.json();
  },

  /**
   * Enriches each cart item in the DB with tax fields computed by CartPage.
   * Called once when user clicks "Proceed to Checkout", before navigation.
   * Writes mrp, discountPercent, gstRate, hsnCode, and full taxBreakdown to each item.
   */
  async enrichCartForCheckout(items: CartItemEnrichPayload[]) {
    const res = await fetch(`${CART_API_URL}/enrich`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...authService.getAuthHeader(),
      },
      body: JSON.stringify({ items }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Failed to enrich cart' }));
      throw new Error(error.error || 'Failed to enrich cart');
    }

    return res.json();
  },

  /**
   * Confirm order — sends enriched items (with taxBreakdown) and per-pharmacy
   * taxSummaryByPharma to the order service.
   */
  async confirmOrder(
    items: CartItemWithTax[],
    taxSummaryByPharma: Record<string, TaxSummary>
  ) {
    const res = await fetch(`${ORDER_API_URL}/orders/confirm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authService.getAuthHeader(),
      },
      body: JSON.stringify({ items, taxSummaryByPharma }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Failed to place order' }));
      throw new Error(error.error || 'Failed to place order');
    }

    return res.json();
  },

  async fetchProductDetails(productID: string, pharmaID: string): Promise<any> {
    const res = await fetch(
      `http://localhost:5201/medicines/search?pharmaID=${encodeURIComponent(pharmaID)}`,
      { 
        headers: { 
          ...authService.getAuthHeader(),
        } 
      }
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

    const formData = new FormData();
    formData.append('prescription', file);
    formData.append('productID', productID);

    const res = await fetch(`${CART_API_URL}/upload-prescription`, {
      method: 'POST',
      headers: { 
        ...authService.getAuthHeader(),
      },
      body: formData,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || 'Upload failed');
    }

    return res.json();
  },

  async uploadBulkPrescription(file: File) {
    if (!file) throw new Error('File is required');

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Please upload only image files (JPG, PNG, GIF, WEBP)');
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) throw new Error('File size must be less than 5MB');

    const formData = new FormData();
    formData.append('prescription', file);

    const res = await fetch(`${CART_API_URL}/upload-bulk-prescription`, {
      method: 'POST',
      headers: { 
        ...authService.getAuthHeader(),
      },
      body: formData,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || 'Upload failed');
    }

    return res.json();
  },
};