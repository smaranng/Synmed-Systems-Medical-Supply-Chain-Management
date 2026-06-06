import { Button } from '../components/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '../components/ui/Card';
import {
  ShoppingCart,
  Trash2,
  CreditCard,
  Plus,
  Minus,
  XCircle,
  MapPinned,
  Phone,
  Receipt,
  Truck,
  Store,
} from 'lucide-react';
import { cartService, CartItemEnrichPayload, TaxBreakdown } from '../services/distributor_cartService';
import { pharmacyService } from '../services/pharmacyService';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartContext } from '../context/CartContext';


interface CartItem {
  productID: string;
  name: string;
  price: number;
  mrp: number;
  discountPercent: number;
  gstRate: number;
  hsnCode?: string;
  packsPerBox?: number;
  packSize?: number;
  packSizeUnit?: string;
  pharmaID: string;
  distributorID?: string;
  addedAt?: string;
  prescriptionRequired?: boolean;
  packsAvailable: number;  // FIX: was missing; this is the cart quantity field
}

interface PharmacyDetails {
  pharmaID: string;
  name: string;
  address: string | { line1?: string; line2?: string; city?: string; state?: string; pincode?: string };
  phone: string;
  email: string;
  gstRegistered?: string;
  gstIN?: string;
}

interface DistributorDetails {
  distributorID: string;
  name: string;
  address?: string | { line1?: string; line2?: string; city?: string; state?: string; pincode?: string };
  phone?: number | string;
  gstRegistered?: string;
}

interface EnrichedCartItem extends CartItem {
  pharmacy?: PharmacyDetails;
  distributor?: DistributorDetails;
  pricePerSubUnit?: number;
  mrpPerSubUnit?: number;
  dosageForm?: string;
}

// ─── Tax helper ───────────────────────────────────────────────────────────────
const calculateTaxFromTotals = (
  totalMrp: number,
  totalSellingPrice: number,
  gstRate: number
): TaxBreakdown => {
  const safeMrp = Number(totalMrp) || 0;
  const safeNet = Number(totalSellingPrice) || 0;
  const safeGst = Number(gstRate) || 0;
  const rate = safeGst > 1 ? safeGst / 100 : safeGst;
  const discount = safeMrp - safeNet;
  const taxable = rate > 0 ? safeNet / (1 + rate) : safeNet;
  const gst = safeNet - taxable;
  const cgst = gst / 2;
  const sgst = parseFloat(gst.toFixed(2)) - parseFloat(cgst.toFixed(2));
  return {
    gross: safeMrp,
    discount: parseFloat(discount.toFixed(2)),
    taxable: parseFloat(taxable.toFixed(2)),
    gst: parseFloat(gst.toFixed(2)),
    cgst: parseFloat(cgst.toFixed(2)),
    sgst: parseFloat(sgst.toFixed(2)),
  };
};

// ─── Line-total helpers ───────────────────────────────────────────────────────
// FIX: removed subQuantity references; use packsAvailable throughout
function lineSellingPrice(item: EnrichedCartItem): number {
  return (item.price ?? 0) * (item.packsAvailable ?? 0);
}

function lineMrp(item: EnrichedCartItem): number {
  return (item.mrp ?? item.price ?? 0) * (item.packsAvailable ?? 0);
}

// ─── Dosage-form label map ────────────────────────────────────────────────────
const DOSAGE_LABELS: Record<string, { packUnit: string }> = {
  tablet:           { packUnit: 'strip'  },
  capsule:          { packUnit: 'strip'  },
  syrup:            { packUnit: 'bottle' },
  injection:        { packUnit: 'vial'   },
  cream:            { packUnit: 'tube'   },
  ointment:         { packUnit: 'tube'   },
  'cream/ointment': { packUnit: 'tube'   },
  gel:              { packUnit: 'unit'   },
  spray:            { packUnit: 'unit'   },
  'gel/spray':      { packUnit: 'unit'   },
  drops:            { packUnit: 'bottle' },
  lotion:           { packUnit: 'bottle' },
  powder:           { packUnit: 'unit'   },
  sachet:           { packUnit: 'box'    },
  gloves:           { packUnit: 'box'    },
  mask:             { packUnit: 'box'    },
};

function getDosageLabels(dosageForm?: string): { packUnit: string } {
  const key = (dosageForm ?? '').toLowerCase().trim();
  return DOSAGE_LABELS[key] ?? { packUnit: 'Unit' };
}

// ─── Address normaliser ───────────────────────────────────────────────────────
function formatAddress(address?: string | { line1?: string; line2?: string; city?: string; state?: string; pincode?: string }): string {
  if (!address) return '';
  if (typeof address === 'string') return address;
  return [address.line1, address.line2, address.city, address.state, address.pincode]
    .filter(Boolean)
    .join(', ');
}

function aggregateTotals(list: EnrichedCartItem[]) {
  return list.reduce(
    (acc, item) => {
      const totalMrp = lineMrp(item);
      const totalSelling = lineSellingPrice(item);
      const t = calculateTaxFromTotals(totalMrp, totalSelling, item.gstRate ?? 0);
      return {
        gross:    acc.gross    + t.gross,
        discount: acc.discount + t.discount,
        net:      acc.net      + totalSelling,
        taxable:  acc.taxable  + t.taxable,
        gst:      acc.gst      + t.gst,
        cgst:     acc.cgst     + t.cgst,
        sgst:     acc.sgst     + t.sgst,
      };
    },
    { gross: 0, discount: 0, net: 0, taxable: 0, gst: 0, cgst: 0, sgst: 0 }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function CartPage() {
  const [items, setItems]               = useState<EnrichedCartItem[]>([]);
  const [loading, setLoading]           = useState(true);
  const [checkingOut, setCheckingOut]   = useState(false);
  const [updating, setUpdating]         = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const navigate = useNavigate();
  const { refetchCart } = useCartContext();

  useEffect(() => { loadCart(); }, []);

  const distributorItems = items.filter(i => !!i.distributorID);
  const pharmacyItems    = items.filter(i => !i.distributorID);

  const loadCart = async () => {
    try {
      setLoading(true);
      const response = await cartService.getCart();
      const cartItems = response.items || [];

      if (cartItems.length === 0) { setItems([]); return; }

      const pharmItems = cartItems.filter((i: CartItem) => !i.distributorID);
      const distItems  = cartItems.filter((i: CartItem) => !!i.distributorID);

      const uniquePharmaIDs  = [...new Set(pharmItems.map((i: CartItem) => i.pharmaID))];
      const uniqueDistribIDs = [...new Set(distItems.map((i: CartItem) => i.distributorID))];

      const [pharmacyResults, productResults, distributorResults] = await Promise.all([
        Promise.all(
          uniquePharmaIDs.map(async (pharmaID) => {
            try {
              const pharmacy = await pharmacyService.getPharmacyById(pharmaID as string);
              return { pharmaID, pharmacy };
            } catch {
              return {
                pharmaID,
                pharmacy: { pharmaID, name: `Pharmacy ${pharmaID}`, address: 'Address not available', phone: 'N/A', email: 'N/A', gstRegistered: 'No' },
              };
            }
          })
        ),
        Promise.all(
          cartItems.map(async (item: CartItem) => {
            try {
              const product = await cartService.fetchProductDetails(
                item.productID,
                item.distributorID ?? item.pharmaID
              );
              return { productID: item.productID, product };
            } catch {
              return { productID: item.productID, product: null };
            }
          })
        ),
        Promise.all(
          uniqueDistribIDs.map(async (distributorID) => {
            try {
              const dist = await cartService.fetchDistributorDetails?.(distributorID as string);
              return { distributorID, distributor: dist };
            } catch {
              return {
                distributorID,
                distributor: { distributorID, name: `Distributor ${distributorID}` },
              };
            }
          })
        ),
      ]);

      const pharmacyMap = new Map<string, PharmacyDetails>();
      pharmacyResults.forEach(({ pharmaID, pharmacy }) => {
        if (pharmacy) pharmacyMap.set(pharmaID as string, pharmacy);
      });

      const distributorMap = new Map<string, DistributorDetails>();
      distributorResults.forEach(({ distributorID, distributor }) => {
        if (distributor) distributorMap.set(distributorID as string, distributor as DistributorDetails);
      });

      const productMap = new Map<string, any>();
      productResults.forEach(({ productID, product }) => { if (product) productMap.set(productID, product); });

      const enrichedItems: EnrichedCartItem[] = cartItems.map((item: CartItem) => {
        const liveProduct = productMap.get(item.productID);
        const price       = liveProduct?.packaging?.price       ?? item.price;
        const mrp         = liveProduct?.packaging?.mrp         ?? item.mrp ?? price;
        const gstRate     = liveProduct?.gstRate ?? liveProduct?.packaging?.gstRate ?? item.gstRate ?? 0;
        const hsnCode     = liveProduct?.hsnCode ?? liveProduct?.packaging?.hsnCode ?? item.hsnCode;
        const dosageForm  = liveProduct?.category?.dosageForm ?? undefined;

        return {
          ...item,
          price,
          mrp,
          discountPercent: liveProduct?.packaging?.discountPercent ?? item.discountPercent ?? 0,
          gstRate,
          hsnCode,
          dosageForm,
          pharmacy:    item.distributorID ? undefined : pharmacyMap.get(item.pharmaID),
          distributor: item.distributorID ? distributorMap.get(item.distributorID) : undefined,
        };
      });

      setItems(enrichedItems);
    } catch (error) {
      console.error('Failed to load cart:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateQuantity = async (productID: string, newQuantity: number) => {
    if (newQuantity < 1) { await handleRemoveItem(productID); return; }
    try {
      setUpdating(productID);
      await cartService.updateQuantity(productID, newQuantity);
      // FIX: update packsAvailable, not quantity
      setItems(prev => prev.map(i => i.productID === productID ? { ...i, packsAvailable: newQuantity } : i));
      await refetchCart();
    } catch (e) {
      console.error('Failed to update quantity:', e);
    } finally {
      setUpdating(null);
    }
  };

  const handleRemoveItem = async (productID: string) => {
    try {
      setUpdating(productID);
      await cartService.removeItem(productID);
      setItems(prev => prev.filter(i => i.productID !== productID));
      await refetchCart();
    } catch (e) {
      console.error('Failed to remove item:', e);
    } finally {
      setUpdating(null);
    }
  };

  // ─── Group items by their origin entity ────────────────────────────────────
  const itemsByDistributor = distributorItems.reduce((acc, item) => {
    const key = item.distributorID!;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, EnrichedCartItem[]>);

  const itemsByPharmacy = pharmacyItems.reduce((acc, item) => {
    if (!acc[item.pharmaID]) acc[item.pharmaID] = [];
    acc[item.pharmaID].push(item);
    return acc;
  }, {} as Record<string, EnrichedCartItem[]>);

  const overallTotals = aggregateTotals(items);

  // FIX: sum packsAvailable across all items
  const totalItems = items.reduce((sum, i) => sum + (i.packsAvailable ?? 0), 0);

  const hasAnyGstSource = items.some(i => i.pharmacy?.gstRegistered === 'Yes');

  const handleProceedToCheckout = async () => {
    try {
      setCheckingOut(true);
      setCheckoutError(null);

      const enrichPayload: CartItemEnrichPayload[] = items.map(item => {
        const totalMrp     = lineMrp(item);
        const totalSelling = lineSellingPrice(item);
        const tax          = calculateTaxFromTotals(totalMrp, totalSelling, item.gstRate ?? 0);
        return {
          productID:       item.productID,
          mrp:             item.mrp ?? item.price,
          discountPercent: item.discountPercent ?? 0,
          gstRate:         item.gstRate ?? 0,
          hsnCode:         item.hsnCode,
          taxBreakdown:    tax,
        };
      });

      await cartService.enrichCartForCheckout(enrichPayload);

      const itemsWithTax = items.map((item, i) => ({ ...item, ...enrichPayload[i] }));

      const taxSummaryByGroup: Record<string, any> = {};
      for (const [id, groupItems] of Object.entries(itemsByDistributor)) {
        taxSummaryByGroup[id] = aggregateTotals(groupItems);
      }
      for (const [id, groupItems] of Object.entries(itemsByPharmacy)) {
        taxSummaryByGroup[id] = aggregateTotals(groupItems);
      }

      navigate('/dashboard/checkout-confirm', {
        state: { itemsWithTax, taxSummaryByPharma: taxSummaryByGroup },
      });
    } catch (error: any) {
      console.error('Checkout enrich failed:', error);
      setCheckoutError('Failed to prepare checkout. Please try again.');
    } finally {
      setCheckingOut(false);
    }
  };

  // ─── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-black mb-2">My Cart</h1>
          <p className="text-gray-600">Review your selected medicines and proceed to secure checkout.</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-lg text-gray-600">Loading cart...</div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-black mb-2">My Cart</h1>
        <p className="text-gray-600">Review your selected medicines and proceed to secure checkout.</p>
      </div>

      {/* ── Checkout error alert ──────────────────────────────────────────── */}
      {checkoutError && (
        <div className="w-full flex items-start gap-3 px-5 py-4 rounded-xl bg-red-600 text-white shadow-lg ring-1 ring-white/10">
          <XCircle className="w-5 h-5 text-white mt-0.5 flex-shrink-0" />
          <div className="text-sm font-medium">{checkoutError}</div>
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {items.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">Your cart is empty</h3>
            <p className="text-gray-500 mb-6">Add products from distributor inventory to get started.</p>
            <div className="flex gap-3 justify-center">
              <Button
                className="bg-emerald-800 hover:bg-emerald-600 text-white"
                onClick={() => navigate(-1)}
              >
                Browse Distributor Inventory
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Main content ──────────────────────────────────────────────────── */}
      {items.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          {/* ── Item cards ───────────────────────────────────────────────── */}
          <div className="space-y-6">

            {/* Distributor groups */}
            {Object.entries(itemsByDistributor).map(([distID, distItems]) => (
              <Card key={distID} className="overflow-hidden border-2">
                <div className="bg-gradient-to-r from-emerald-700 to-emerald-800 text-white p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center flex-shrink-0">
                        <Truck className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-white mb-1">
                          {distItems[0]?.distributor?.name ?? `Distributor ${distID}`}
                        </h3>
                        {distItems[0]?.distributor && (
                          <div className="space-y-1 text-sm text-emerald-100">
                            {distItems[0].distributor.address && (
                              <p className="flex items-start gap-2">
                                <MapPinned className="w-4 h-4 text-white mt-0.5 flex-shrink-0" />
                                <span className="line-clamp-2">{formatAddress(distItems[0].distributor.address)}</span>
                              </p>
                            )}
                            {distItems[0].distributor.phone && (
                              <span className="flex items-center gap-1 text-xs">
                                <Phone className="w-3 h-3 text-white" />
                                {distItems[0].distributor.phone}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="bg-white/20 backdrop-blur px-3 py-1.5 rounded-lg flex-shrink-0">
                      <div className="text-xs text-emerald-100 font-medium">
                        {distItems.length} {distItems.length === 1 ? 'Item' : 'Items'}
                      </div>
                    </div>
                  </div>
                </div>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {distItems.map((item) => (
                      <CartItemRow
                        key={item.productID}
                        item={item}
                        updating={updating}
                        onUpdateQty={handleUpdateQuantity}
                        onRemove={handleRemoveItem}
                        accentClass="bg-gradient-to-br from-emerald-500 to-emerald-700"
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Pharmacy groups */}
            {Object.entries(itemsByPharmacy).map(([pharmaID, pharmItems]) => (
              <Card key={pharmaID} className="overflow-hidden border-2">
                <div className="bg-gradient-to-r from-[#123B6B] to-[#1a4f8a] text-white p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center flex-shrink-0">
                        <Store className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-white mb-1">
                          {pharmItems[0]?.pharmacy?.name ?? `Pharmacy ${pharmaID}`}
                        </h3>
                        {pharmItems[0]?.pharmacy && (
                          <div className="space-y-1 text-sm text-blue-100">
                            {pharmItems[0].pharmacy.address && (
                              <p className="flex items-start gap-2">
                                <MapPinned className="w-4 h-4 text-white mt-0.5 flex-shrink-0" />
                                <span className="line-clamp-2">{formatAddress(pharmItems[0].pharmacy.address)}</span>
                              </p>
                            )}
                            {pharmItems[0].pharmacy.phone && (
                              <span className="flex items-center gap-1 text-xs">
                                <Phone className="w-3 h-3 text-white" />
                                {pharmItems[0].pharmacy.phone}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="bg-white/20 backdrop-blur px-3 py-1.5 rounded-lg flex-shrink-0">
                      <div className="text-xs text-blue-100 font-medium">
                        {pharmItems.length} {pharmItems.length === 1 ? 'Item' : 'Items'}
                      </div>
                    </div>
                  </div>
                </div>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {pharmItems.map((item) => (
                      <CartItemRow
                        key={item.productID}
                        item={item}
                        updating={updating}
                        onUpdateQty={handleUpdateQuantity}
                        onRemove={handleRemoveItem}
                        accentClass="bg-gradient-to-br from-[#123B6B] to-[#1a4f8a]"
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* ── Bill Summary ──────────────────────────────────────────────── */}
          <div>
            <Card className="sticky top-8">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg text-black">Bill Summary</CardTitle>
                  <Receipt className="w-5 h-5 text-gray-500" />
                </div>
                <CardDescription className="text-gray-600">
                  {totalItems} {totalItems === 1 ? 'item' : 'items'}
                  {distributorItems.length > 0 && pharmacyItems.length > 0 && ' · Mixed cart'}
                  {distributorItems.length > 0 && pharmacyItems.length === 0 && (
                    <span className="font-semibold text-emerald-700"> · Distributor Cart</span>
                  )}
                  {pharmacyItems.length > 0 && distributorItems.length === 0 && (
                    <span className="font-semibold text-[#123B6B]"> · Pharmacy Cart</span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-gray-700">
                    <span>MRP Total</span>
                    <span className="font-medium">₹{overallTotals.gross.toFixed(2)}</span>
                  </div>
                  {overallTotals.discount > 0 && (
                    <div className="flex justify-between text-green-700">
                      <span>Discount</span>
                      <span className="font-semibold">-₹{overallTotals.discount.toFixed(2)}</span>
                    </div>
                  )}
                  {hasAnyGstSource && (
                    <>
                      <div className="flex justify-between text-gray-700">
                        <span>Taxable Value</span>
                        <span className="font-medium">₹{overallTotals.taxable.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>GST</span>
                        <span className="font-medium">₹{overallTotals.gst.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-gray-500 text-xs pl-3">
                        <span>CGST</span>
                        <span className="font-medium">₹{overallTotals.cgst.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-gray-500 text-xs pl-3">
                        <span>SGST</span>
                        <span className="font-medium">₹{overallTotals.sgst.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between items-center pt-3 border-t-2 border-gray-300">
                    <span className="text-base font-bold text-black">
                      Grand Total{' '}
                      <span className="text-gray-500 text-xs font-semibold">(Rounded off)</span>
                    </span>
                    <span className="text-2xl font-bold text-gray-900">
                      ₹{Math.round(overallTotals.net)}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex items-center text-xs text-gray-500 bg-gray-50 p-3 rounded">
                    <CreditCard className="w-3 h-3 mr-2 flex-shrink-0" />
                    <span>Secure payments · Distributor delivery or pharmacy pickup</span>
                  </div>

                  <Button
                    disabled={checkingOut}
                    onClick={handleProceedToCheckout}
                    className={`w-full flex items-center justify-center gap-2 ${
                      checkingOut
                        ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                        : 'bg-emerald-800 hover:bg-emerald-600 text-white'
                    }`}
                  >
                    <ShoppingCart className="w-4 h-4" />
                    {checkingOut ? 'Preparing checkout...' : 'Proceed to Checkout'}
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full text-sm"
                    onClick={() => navigate('/dashboard/search')}
                  >
                    Continue Shopping
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cart item row
// ─────────────────────────────────────────────────────────────────────────────
interface CartItemRowProps {
  item: EnrichedCartItem;
  updating: string | null;
  onUpdateQty: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
  accentClass: string;
}

function CartItemRow({ item, updating, onUpdateQty, onRemove, accentClass }: CartItemRowProps) {
  const effectiveSelling = lineSellingPrice(item);
  const effectiveMrp     = lineMrp(item);
  const { packUnit }     = getDosageLabels(item.dosageForm);
  const pl = (n: number, u: string) => `${u.toLowerCase()}${n !== 1 ? 's' : ''}`;

  return (
    <div className="p-4 hover:bg-gray-50 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Item info */}
        <div className="flex-1 flex items-start gap-3">
          <div className={`w-11 h-11 rounded-xl ${accentClass} flex items-center justify-center flex-shrink-0 shadow-md`}>
            <span className="text-white font-bold text-lg">{item.name.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-gray-900">{item.name}</h4>
              {item.prescriptionRequired && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200">
                  Rx
                </span>
              )}
            </div>
            {/* FIX: use packsAvailable instead of quantity */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-gray-600">
              <span>
                ₹{item.price.toFixed(2)} × {item.packsAvailable} {pl(item.packsAvailable, packUnit)}
              </span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex sm:flex-col items-center sm:items-end gap-3 justify-between sm:justify-start">
          <div className="text-right">
            <p className="text-xs text-gray-500 mb-0.5">Subtotal</p>
            <p className="text-lg font-bold text-gray-900">₹{effectiveSelling.toFixed(2)}</p>
            {effectiveMrp > effectiveSelling && (
              <p className="text-xs text-gray-400 line-through">₹{effectiveMrp.toFixed(2)}</p>
            )}
          </div>

          {/* FIX: stepper driven by packsAvailable */}
          <div className="flex items-center gap-1 border-2 border-gray-200 rounded-lg p-1 bg-white shadow-sm">
            <button
              onClick={() => onUpdateQty(item.productID, item.packsAvailable - 1)}
              disabled={updating === item.productID}
              className="p-1.5 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
              aria-label="Decrease quantity"
            >
              <Minus className="w-4 h-4 text-gray-600" />
            </button>
            <span className="w-8 text-center text-sm font-semibold text-gray-900">
              {item.packsAvailable}
            </span>
            <button
              onClick={() => onUpdateQty(item.productID, item.packsAvailable + 1)}
              disabled={updating === item.productID}
              className="p-1.5 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
              aria-label="Increase quantity"
            >
              <Plus className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          <button
            onClick={() => onRemove(item.productID)}
            disabled={updating === item.productID}
            className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}