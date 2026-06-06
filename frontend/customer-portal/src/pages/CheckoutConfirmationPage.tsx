import { Button } from '../components/ui/Button';
import {
  Card,
  CardContent,
} from '../components/ui/Card';
import {
  MapPin,
  ShoppingCart,
  AlertCircle,
  AlertTriangle,
  Check,
  XCircle,
  CheckCircle,
  Phone,
  MapPinned,
} from 'lucide-react';
import { useNotification } from '../context/NotificationContext';
import { cartService } from '../services/cartService';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { orderService } from '../services/orderService';
import { useCartContext } from '../context/CartContext';

interface CartItem {
  productID: string;
  name: string;
  price: number;
  quantity: number;
  subQuantity?: number;       // ← sub-unit count
  pharmaID: string;
  addedAt?: string;
  prescriptionRequired?: boolean;
  prescriptionPath?: string;
}

interface PharmacyDetails {
  pharmaID: string;
  name: string;
  address: string;
  phone: string;
  email: string;
}

interface EnrichedCartItem extends CartItem {
  pharmacy?: PharmacyDetails;
  availableStock?: number;
  pricePerSubUnit?: number;   // ← selling price per individual sub-unit
  dosageForm?: string;     
  availableSubUnits?: number;  // ← total available sub-units for this item
}

interface StockValidationResult {
  success: boolean;
  outOfStockItems?: EnrichedCartItem[];
  errorMessage?: string;
}

// ─── Line-total helpers (mirrors CartPage) ────────────────────────────────────
function lineSellingPrice(item: EnrichedCartItem): number {
  return (item.price ?? 0) * (item.quantity ?? 0)
    + (item.pricePerSubUnit ?? 0) * (item.subQuantity ?? 0);
}

// ─── Dosage-form label map ────────────────────────────────────────────────────
const DOSAGE_LABELS: Record<string, { packUnit: string; subUnit: string | null }> = {
  tablet:   { packUnit: "Strip",  subUnit: "Tablet"  },
  capsule:  { packUnit: "Strip",  subUnit: "Capsule" },
  syrup:    { packUnit: "Bottle", subUnit: null       },
  injection:{ packUnit: "Vial",   subUnit: null       },
  cream:    { packUnit: "Tube",   subUnit: null       },
  ointment: { packUnit: "Tube",   subUnit: null       },
  drops:    { packUnit: "Bottle", subUnit: null       },
  sachet:   { packUnit: "Box",    subUnit: "Sachet"  },
  gloves:   { packUnit: "Box",    subUnit: "Piece"   },
  mask:     { packUnit: "Box",    subUnit: "Piece"   },
};

function getDosageLabels(dosageForm?: string): { packUnit: string; subUnit: string | null } {
  const key = (dosageForm ?? "").toLowerCase().trim();
  return DOSAGE_LABELS[key] ?? { packUnit: "Unit", subUnit: "Sub-unit" };
}

// ─────────────────────────────────────────────────────────────────────────────
export default function CheckoutConfirmationPage() {
  const [items, setItems] = useState<EnrichedCartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [sliderValue, setSliderValue] = useState(0);
  const [orderError, setOrderError] = useState<{
    outOfStockItems: EnrichedCartItem[];
    errorMessage: string;
  } | null>(null);
  const navigate = useNavigate();
  const { refreshNotifications } = useNotification();
  const { refetchCart } = useCartContext();

  useEffect(() => { loadCart(); }, []);

  // Progress animation — runs when showSuccess becomes true
  useEffect(() => {
    if (showSuccess && sliderValue === 0) {
      let progress = 0;
      const interval = setInterval(() => {
        progress += 5;
        setSliderValue(progress);
        if (progress >= 100) clearInterval(interval);
      }, 75);
      return () => clearInterval(interval);
    }
  }, [showSuccess]);

  const loadCart = async () => {
    try {
      setLoading(true);
      const response = await cartService.getCart();
      const cartItems = response.items || [];

      if (cartItems.length === 0) { setItems([]); return; }

      const uniquePharmaIDs = [...new Set(cartItems.map((item: CartItem) => item.pharmaID))];

      // Fetch pharmacy details + live product details in parallel
      const [pharmacyResults, productResults] = await Promise.all([
        Promise.all(
          uniquePharmaIDs.map(async (pharmaID) => {
            try {
              const pharmacy = await cartService.fetchPharmacyDetails(pharmaID);
              return { pharmaID, pharmacy };
            } catch {
              return {
                pharmaID,
                pharmacy: { pharmaID, name: `Pharmacy ${pharmaID}`, address: 'Address not available', phone: 'N/A', email: 'N/A' },
              };
            }
          })
        ),
        // FIX: fetch live product to get pricePerSubUnit for each cart item
        Promise.all(
          cartItems.map(async (item: CartItem) => {
            try {
              const product = await cartService.fetchProductDetails(item.productID, item.pharmaID);
              return { productID: item.productID, product };
            } catch {
              return { productID: item.productID, product: null };
            }
          })
        ),
      ]);

      const pharmacyMap = new Map<string, PharmacyDetails>();
      pharmacyResults.forEach(({ pharmaID, pharmacy }) => {
        if (pharmacy) pharmacyMap.set(pharmaID as string, pharmacy);
      });

      const productMap = new Map<string, any>();
      productResults.forEach(({ productID, product }) => {
        if (product) productMap.set(productID, product);
      });

      const enrichedItems: EnrichedCartItem[] = cartItems.map((item: CartItem) => {
        const liveProduct     = productMap.get(item.productID);
       
        return {
          ...item,
          pharmacy: pharmacyMap.get(item.pharmaID),
          pricePerSubUnit: liveProduct?.packaging?.pricePerUnit ?? undefined,
          dosageForm: liveProduct?.category?.dosageForm ?? undefined,
        };
      });

      setItems(enrichedItems);
    } catch (error) {
      console.error('Checkout - Failed to load cart:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMedicineInitial = (name: string) => name.charAt(0).toUpperCase();

  // FIX: validate against total units needed (packs + sub-units converted to packs)
  const validateStockAvailability = async (orderItems: EnrichedCartItem[]): Promise<StockValidationResult> => {
    try {
      const outOfStockItems: EnrichedCartItem[] = [];

      // FIX: use VITE env var instead of hardcoded localhost
      const inventoryBase = import.meta.env.VITE_INVENTORY_SERVICE_URL ?? 'http://localhost:5201';

     for (const item of orderItems) {
  const response = await fetch(
    `${inventoryBase}/medicines/search?pharmaID=${item.pharmaID}&keyword=${encodeURIComponent(item.name)}`
  );

  if (!response.ok) {
    console.error(`Failed to fetch stock for ${item.name}`);
    continue;
  }

  const products = await response.json();
  const product = products.find((p: any) => p.productID === item.productID);

  if (!product) {
    outOfStockItems.push({ ...item, availableStock: 0 });
  } else {
    const availablePacks = product.availableStock ?? 0;
    const availableSubUnits = product.stock?.totalSubUnits ?? 0;
    
    const requestedPacks = item.quantity ?? 0;
    const requestedSubUnits = item.subQuantity ?? 0;
    
    // Validate packs
    const hasEnoughPacks = requestedPacks <= availablePacks;
    
    // Validate sub-units (if requested)
    const hasEnoughSubUnits = requestedSubUnits === 0 || requestedSubUnits <= availableSubUnits;
    
    if (!hasEnoughPacks || !hasEnoughSubUnits) {
      outOfStockItems.push({ ...item, availableStock: availablePacks });
    }
  }
} 
      if (outOfStockItems.length > 0) {
        const errorMessage = outOfStockItems.length === 1
          ? `${outOfStockItems[0].name} is out of stock or has insufficient quantity.`
          : `${outOfStockItems.length} items are out of stock or have insufficient quantity.`;
        return { success: false, outOfStockItems, errorMessage };
      }

      return { success: true };
    } catch (error) {
      console.error('Stock validation error:', error);
      return {
        success: false,
        outOfStockItems: [],
        errorMessage: 'Failed to validate stock availability. Please try again.',
      };
    }
  };

  const handleConfirm = async () => {
    try {
      setSubmitting(true);
      setOrderError(null);

      const stockValidation = await validateStockAvailability(items);

      if (!stockValidation.success) {
        setOrderError({
          outOfStockItems: stockValidation.outOfStockItems || [],
          errorMessage: stockValidation.errorMessage || 'Some items are out of stock',
        });
        setSliderValue(-1);
        setShowSuccess(true);
        return;
      }

      setSliderValue(0);
      setShowSuccess(true);

      const orderItems = items.map(({
      pharmacy,
      dosageForm,
      pricePerSubUnit,
      availableStock,
      addedAt,
      ...rest
    }) => rest);

      await orderService.confirmOrder(orderItems);
      await refreshNotifications();
      await refetchCart();
    } catch (error: any) {
      console.error('Order placement failed:', error);
      setOrderError({
        outOfStockItems: [],
        errorMessage: error?.message || 'Failed to place order. Please try again.',
      });
      setSliderValue(-1);
      setShowSuccess(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => { navigate('/dashboard/cart'); };

  const handleRemoveItem = async (productID: string) => {
  try {
    await cartService.removeItem(productID);
    await refetchCart();
  } catch (error) {
    console.error('Failed to remove item:', error);
  }
};

  // Group items by pharmacy
  const itemsByPharmacy = items.reduce((acc, item) => {
    if (!acc[item.pharmaID]) acc[item.pharmaID] = [];
    acc[item.pharmaID].push(item);
    return acc;
  }, {} as Record<string, EnrichedCartItem[]>);

  // FIX: all totals use lineSellingPrice so sub-unit costs are included
  const totalItems = items.reduce((sum, item) => {
    const packs = item.quantity ?? 0;
    return sum + (packs > 0 ? packs : ((item.subQuantity ?? 0) > 0 ? 1 : 0));
  }, 0);
  const subtotal = items.reduce((sum, item) => sum + lineSellingPrice(item), 0);
  const total    = subtotal;

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-black mb-2">Confirm Your Order</h1>
          <p className="text-gray-600">Review your order details before confirming.</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-lg text-gray-600">Loading order details...</div>
        </div>
      </div>
    );
  }

  if (items.length === 0) { navigate('/dashboard/cart'); return null; }

  if (showSuccess) {
    const isProcessing = sliderValue >= 0 && sliderValue < 100;
    const isSuccess    = sliderValue === 100;
    const isError      = sliderValue === -1;

    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">

          {isProcessing && (
            <div className="bg-white p-8 text-center space-y-6 animate-fade-in">
              <div className="flex justify-center">
                <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
              </div>
              <h2 className="text-xl font-bold text-green-600">Processing your order...</h2>
              <input
                type="range" min="0" max="100" value={sliderValue} disabled
                className="w-full h-3 rounded-lg appearance-none accent-green-600"
                style={{ background: `linear-gradient(to right, #16a34a ${sliderValue}%, #e5e7eb ${sliderValue}%)` }}
              />
            </div>
          )}

          {isSuccess && (
            <div className="bg-green-600 p-8 text-white text-center space-y-6 animate-fade-in">
              <Check className="w-12 h-12 mx-auto" strokeWidth={2} />
              <h2 className="text-2xl font-bold">Order Confirmed!</h2>
              <p className="text-sm opacity-90">We will notify you once pharmacies respond.</p>
              <button
                onClick={() => navigate('/dashboard/orders', { state: { refresh: true } })}
                className="mt-4 w-full bg-white text-green-600 font-bold py-3 rounded-lg hover:bg-gray-100 transition"
              >
                OK
              </button>
            </div>
          )}

         {isError && (
  <div className="bg-white p-8 text-center space-y-6 animate-fade-in">
    <div className="flex justify-center">
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
        <XCircle className="w-10 h-10 text-red-600" strokeWidth={2} />
      </div>
    </div>
    <h2 className="text-2xl font-bold text-red-600">Order Failed</h2>
    <div className="text-left space-y-3">
      <p className="text-sm text-gray-700">{orderError?.errorMessage || 'Unable to place order'}</p>
      {orderError?.outOfStockItems && orderError.outOfStockItems.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
          <p className="text-xs font-semibold text-red-800 mb-2">Out of Stock Items:</p>
          {orderError.outOfStockItems.map((item) => (
            <div key={item.productID} className="flex items-start gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium">{item.name}</p>
                <p className="text-red-600">
                  {(() => {
                    const { packUnit, subUnit } = getDosageLabels(item.dosageForm);
                    const requestedPacks = item.quantity ?? 0;
                    const requestedSub = item.subQuantity ?? 0;
                    const availablePacks = item.availableStock ?? 0;
                    const availableSub = item.availableSubUnits ?? 0;
                    
                    // Build requested string
                    let requestedStr = `${requestedPacks} ${packUnit.toLowerCase()}${requestedPacks !== 1 ? 's' : ''}`;
                    if (requestedSub > 0 && subUnit) {
                      requestedStr += ` + ${requestedSub} ${subUnit.toLowerCase()}${requestedSub !== 1 ? 's' : ''}`;
                    }
                    
                    // Build available string
                    let availableStr;
                    if (availablePacks === 0 && availableSub === 0) {
                      availableStr = 'Out of Stock';
                    } else {
                      availableStr = `${availablePacks} ${packUnit.toLowerCase()}${availablePacks !== 1 ? 's' : ''}`;
                      if (availableSub > 0 && subUnit) {
                        availableStr += ` + ${availableSub} ${subUnit.toLowerCase()}${availableSub !== 1 ? 's' : ''}`;
                      }
                    }
                    
                    return `Requested: ${requestedStr} | ${availableStr}`;
                  })()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    <button
  onClick={async () => { 
    // Remove all out-of-stock items
    if (orderError?.outOfStockItems) {
      for (const item of orderError.outOfStockItems) {
        await handleRemoveItem(item.productID);
      }
    }
    setShowSuccess(false); 
    setSliderValue(0); 
    setOrderError(null); 
    navigate('/dashboard'); 
  }}
  className="w-full bg-red-600 text-white font-bold py-3 rounded-lg hover:bg-red-700 transition"
>
  Back to Home
</button>
  </div>
)}
        </div>

        <style>{`
          @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
          .animate-fade-in { animation: fadeIn 0.5s ease-in-out; }
        `}</style>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-black mb-2">Confirm Your Order</h1>
        <p className="text-gray-600">Please review your order details carefully before confirming.</p>
      </div>

      {/* Warning Alerts */}
      <Card className="border-orange-200 bg-orange-50">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-orange-800">
            <p className="font-semibold mb-1">Important Notice</p>
            <p>
              Once confirmed, this order will be sent to the respective pharmacies.
              Please ensure all details are correct before proceeding. You shall receive
              notifications when your order has been accepted by the pharmacies.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-orange-200 bg-yellow-50">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-orange-800">
            <p className="font-semibold mb-1">Time Sensitive</p>
            <p>Please ensure to pick up your medicines within 8 hours of ordering. Else, the order will be canceled.</p>
          </div>
        </CardContent>
      </Card>

      {/* Order Summary by Pharmacy */}
      <div className="space-y-6">
        {Object.entries(itemsByPharmacy).map(([pharmaID, pharmacyItems]) => {
          // FIX: pharmacy subtotal uses lineSellingPrice
          const pharmacyTotal = pharmacyItems.reduce((sum, item) => sum + lineSellingPrice(item), 0);

          return (
            <Card key={pharmaID} className="overflow-hidden border-2">
              {/* Pharmacy Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-white mb-1">
                        {pharmacyItems[0]?.pharmacy?.name || 'Loading pharmacy...'}
                      </h3>
                      {pharmacyItems[0]?.pharmacy && (
                        <div className="space-y-1 text-sm text-blue-100">
                          {pharmacyItems[0].pharmacy.address && pharmacyItems[0].pharmacy.address !== 'Address not available' && (
                            <p className="flex items-start gap-2">
                              <MapPinned className="w-4 h-4 text-white mt-0.5 flex-shrink-0" />
                              <span className="line-clamp-2">{pharmacyItems[0].pharmacy.address}</span>
                            </p>
                          )}
                          {pharmacyItems[0].pharmacy.phone && pharmacyItems[0].pharmacy.phone !== 'N/A' && (
                            <span className="flex items-center gap-1 text-xs">
                              <Phone className="w-3 h-3 text-white" />
                              {pharmacyItems[0].pharmacy.phone}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="bg-white/20 backdrop-blur px-3 py-1.5 rounded-lg flex-shrink-0">
                    <div className="text-xs text-blue-100 font-medium">
                      {pharmacyItems.length} {pharmacyItems.length === 1 ? 'Item' : 'Items'}
                    </div>
                  </div>
                </div>
              </div>

              <CardContent className="p-0">
                <div className="divide-y">
                  {pharmacyItems.map((item) => {
                    const hasPackQty = (item.quantity ?? 0) > 0;
                    const hasSubQty  = (item.subQuantity ?? 0) > 0;
                    const lineTot    = lineSellingPrice(item);

                    return (
                      <div key={item.productID} className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          {/* LEFT */}
                          <div className="flex gap-3 flex-1">
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-md">
                              <span className="text-white font-bold text-lg">{getMedicineInitial(item.name)}</span>
                            </div>
                            <div className="flex flex-col flex-1 min-w-0">
                              <h4 className="font-semibold text-gray-900 mb-1">{item.name}</h4>

                              {/* Use dosage-form-aware labels for pack and sub-unit display */}
                              {(() => {
                                const { packUnit, subUnit } = getDosageLabels(item.dosageForm);
                                const pl = (n: number, u: string) => `${u.toLowerCase()}${n !== 1 ? 's' : ''}`;
                                return (
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-gray-600 mb-2">
                                    {hasPackQty && (
                                      <span>
                                        ₹{item.price.toFixed(2)} × {item.quantity} {pl(item.quantity, packUnit)}
                                      </span>
                                    )}
                                    {hasPackQty && hasSubQty && <span className="text-gray-400">+</span>}
                                    {hasSubQty && subUnit && (
                                      <span className="text-indigo-700 font-medium">
                                        {item.pricePerSubUnit !== undefined
                                          ? `₹${item.pricePerSubUnit.toFixed(2)} × ${item.subQuantity} ${pl(item.subQuantity ?? 0, subUnit)}`
                                          : `${item.subQuantity} ${pl(item.subQuantity ?? 0, subUnit)}`}
                                      </span>
                                    )}
                                    {hasSubQty && !subUnit && (
                                      <span className="text-indigo-700 font-medium">
                                        {item.subQuantity} sub-unit{item.subQuantity !== 1 ? 's' : ''}
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}

                              {item.prescriptionRequired && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-green-50 text-green-700 border border-green-200 w-fit">
                                  <CheckCircle className="w-3 h-3" />
                                  Prescription Uploaded
                                </span>
                              )}
                            </div>
                          </div>

                          {/* RIGHT — FIX: line total uses lineSellingPrice */}
                          <div className="text-right flex-shrink-0">
                            <p className="text-lg font-bold text-gray-900">₹{lineTot.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Total Summary */}
      <Card className="border-2 border-[#123B6B]">
        <CardContent className="p-6">
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Total Items</span>
              <span className="font-medium text-black">{totalItems}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium text-black">₹{subtotal.toFixed(2)}</span>
            </div>
            {Object.keys(itemsByPharmacy).length > 1 && (
              <div className="flex items-start text-xs p-2 rounded bg-blue-50 text-blue-800 border border-blue-200">
                <AlertCircle className="w-3 h-3 mr-1.5 mt-0.5 flex-shrink-0" />
                <span>
                  {Object.keys(itemsByPharmacy).length} separate orders will be created for different pharmacies
                </span>
              </div>
            )}
            <hr className="my-2" />
            <div className="flex justify-between items-center">
              <span className="text-lg font-bold text-black">Grand Total <span className="text-gray-500 text-xs font-semibold">(Rounded off)</span></span>
              <span className="text-2xl font-bold text-[#123B6B]">₹{Math.round(total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          onClick={handleCancel}
          variant="outline"
          className="flex-1 border-2 border-gray-300 hover:bg-gray-50"
        >
          <span className="font-semibold">No, Cancel</span>
        </Button>
        <Button
          onClick={handleConfirm}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
          disabled={submitting}
        >
          <ShoppingCart className="w-4 h-4 mr-2" />
          <span className="font-semibold">{submitting ? 'Placing...' : 'Yes, I Confirm'}</span>
        </Button>
      </div>

      {/* Additional Info */}
      <Card className="bg-gray-50">
        <CardContent className="p-4 text-xs text-gray-600">
          <p className="mb-2"><strong>Payment & Pickup:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Payment will be collected at the time of pickup</li>
            <li>You will receive notifications when orders are ready</li>
            <li>Please bring your prescription documents to the pharmacy</li>
            <li>Contact the pharmacy directly for any queries</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}