const CART_API_URL = "http://localhost:5204/cart";
//const USER_API_URL = "http://localhost:5203";*/
const ORDER_API_URL = "http://localhost:5205";

import { getToken } from './authService';

export interface TaxBreakdown {
  gross: number;
  discount: number;
  taxable: number;   // toFixed(2)
  gst: number;       // toFixed(2)
  cgst: number;      // toFixed(2)
  sgst: number;      // toFixed(2)
}
/*
export interface CartItem {
  productID: string;
  name: string;
  price: number;
  quantity: number;
  distributorID: string;
  batchCode: string;
  prescriptionRequired: boolean;
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
*/
export interface DistributorDetails {
  distributorID: string;
  name: string;
   address?: string | { line1?: string; line2?: string; city?: string; state?: string; pincode?: string };
  phone: string;
  email: string;
  logo?: string | null;
  licenseNumber?: string;
  city?: string | null;
  area?: string | null;
  gstRegistered?: string;   // "Yes" | "No"
  gstIN?: string;
}

interface SuggestedOrderItem {
  name: string;
  price: number;
  quantity: number;
  discountPercent: number;
  gstRate: number;
  hsnCode: string;
  mrpPerPack: number;
  taxBreakdown: TaxBreakdown;
  productID_Dtb: string;
  productID_Phm: string;
  totalAmount: { $numberDecimal: string } | number;
}

interface SuggestedOrder {
  _id?: { $oid: string } | string;
  orderNumber: string;
  pharmaID: string;
  distributorID: string;
  items: SuggestedOrderItem[];
  status: string;
  grandTotal: number;

}


const getAuthHeader = (): Record<string, string> => {
  const token = getToken();
  console.log('🔑 Token available:', !!token);
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
};

export const cartService = {
  async placeOrder(order: Partial<SuggestedOrder>): Promise<void> {
    const payload = {
      distributorID: order.distributorID,
      orderNumber: order.orderNumber,
      pharmaID: order.pharmaID,
      grandTotal: order.grandTotal,
    
      items: order.items?.map(item => ({
        productID_Phm:   item.productID_Phm,   // ← what the API validates
        productID_Dtb:   item.productID_Dtb,   // kept for distributor inventory lookup
        name:            item.name,
        quantity:        item.quantity,
        price:           item.price,
        discountPercent: item.discountPercent,
        gstRate:         item.gstRate,
        hsnCode:         item.hsnCode,
        mrpPerPack:      item.mrpPerPack,
        taxBreakdown:    item.taxBreakdown,
        totalAmount:     item.totalAmount,
      })),
    };

    const res = await fetch(`${ORDER_API_URL}/distributor-orders/place`, {
      method:  'POST',
      headers: getAuthHeader(),
      body:    JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      // API returns { error: '...' }, not { message: '...' }
      throw new Error(err?.error ?? `Order ${order.orderNumber} failed: ${res.status}`);
    }
  },
    async getCart() {
    const res = await fetch(`${CART_API_URL}`, {
      headers: getAuthHeader(),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Failed to fetch cart' }));
      throw new Error(error.error || 'Failed to fetch cart');
    }

    return res.json();
  },
};

  /*async addToCart(item: CartItem) {
    const res = await fetch(`${CART_API_URL}/add`, 
      {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(item),
      }
    );

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Failed to add to cart' }));
      throw new Error(error.error || 'Failed to add to cart');
    }

    return res.json();
  },



  async updateQuantity(itemId: string, quantity: number) {
    const res = await fetch(`${CART_API_URL}/update`, 
     {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({ productID: itemId, quantity }),
      }
    );

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Failed to update quantity' }));
      throw new Error(error.error || 'Failed to update quantity');
    }

    return res.json();
  },

  async removeItem(itemId: string) {
    const res = await fetch(`${CART_API_URL}/remove/${itemId}`, {
      method: "DELETE",
      headers: getAuthHeader(),
       
      }
    );

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Failed to remove item' }));
      throw new Error(error.error || 'Failed to remove item');
    }

    return res.json();
  },

  async clearCart() {
    const res = await fetch(`${CART_API_URL}/clear`, {
      method: "DELETE",
      headers: getAuthHeader(),
       
      }
    );

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Failed to clear cart' }));
      throw new Error(error.error || 'Failed to clear cart');
    }

    return res.json();
  },

  
   * Enriches each cart item in the DB with tax fields computed by CartPage.
   * Called once when user clicks "Proceed to Checkout", before navigation.
   * Writes mrp, discountPercent, gstRate, hsnCode, and full taxBreakdown to each item.
   
  async enrichCartForCheckout(items: CartItemEnrichPayload[]) {
    const res = await fetch(`${CART_API_URL}/enrich`, 
     {
        method: 'PUT',
        headers: getAuthHeader(),
        body: JSON.stringify(items),
      }
    );

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Failed to enrich cart' }));
      throw new Error(error.error || 'Failed to enrich cart');
    }

    return res.json();
  },

  
   * Confirm order — sends enriched items (with taxBreakdown) and per-pharmacy
   * taxSummaryByPharma to the order service.
   
  async confirmOrder(
    items: CartItemWithTax[],
    taxSummaryByPharma: Record<string, TaxSummary>
  ) {
    const res = await fetch(`${ORDER_API_URL}/orders/confirm`, {
      method: "POST",
      headers: getAuthHeader(),
      body: JSON.stringify({ items, taxSummaryByPharma }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Failed to place order' }));
      throw new Error(error.error || 'Failed to place order');
    }

    return res.json();
  },

  async fetchProductDetails(productID: string, distributorID: string): Promise<any> {
    const res = await fetch(
      `http://localhost:5204/medicines/search?distributorID=${encodeURIComponent(distributorID)}`,
      { headers: getAuthHeader() }
    );
    if (!res.ok) throw new Error('Failed to fetch product details');
    const results = await res.json();
    const product = results.find((p: any) => p.productID === productID);
    if (!product) throw new Error(`Product ${productID} not found in distributor ${distributorID}`);
    return product;
  },

  async fetchDistributorDetails(distributorID: string): Promise<DistributorDetails> {
    try {
      const res = await fetch(`${USER_API_URL}/distributor/${distributorID}`, { headers: getAuthHeader() });

      if (res.status === 404) {
        throw new Error(`Distributor not found: ${distributorID}`);
      }

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Failed to fetch distributor' }));
        throw new Error(error.error || `Failed to fetch distributor (${res.status})`);
      }

      const distributor = await res.json();

      if (!distributor.distributorID || !distributor.name) {
        throw new Error('Invalid distributor data received');
      }

      return distributor;
    } catch (error) {
      console.error(`Error fetching distributor ${distributorID}:`, error);
      throw error;
    }
  },
};
*/
 