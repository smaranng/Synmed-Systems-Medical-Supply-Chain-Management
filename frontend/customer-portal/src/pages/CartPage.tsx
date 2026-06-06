import { Button } from '../components/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '../components/ui/Card';
import {
  MapPin,
  ShoppingCart,
  Trash2,
  CreditCard,
  Plus,
  Minus,
  CheckCircle,
  XCircle,
  Upload,
  AlertCircle,
  MapPinned,
  Phone,
  Receipt,
} from 'lucide-react';
import { cartService, CartItemEnrichPayload, TaxBreakdown } from '../services/cartService';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartContext } from '../context/CartContext';
import { parse } from 'path';

interface CartItem {
  productID: string;
  name: string;
  price: number;
  mrp: number;
  discountPercent: number;
  gstRate: number;
  hsnCode?: string;
  quantity: number;
  subQuantity?: number;
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
  gstRegistered?: string;
  gstIN?: string;
}

interface EnrichedCartItem extends CartItem {
  pharmacy?: PharmacyDetails;
  pricePerSubUnit?: number;
  mrpPerSubUnit?: number;
  dosageForm?: string;        // ← drives pack/sub-unit label display
}

// ─── Tax helper ───────────────────────────────────────────────────────────────
const calculateTaxFromTotals = (
  totalMrp: number,
  totalSellingPrice: number,
  gstRate: number
): TaxBreakdown => {
  const safeMrp   = Number(totalMrp)          || 0;
  const safeNet   = Number(totalSellingPrice)  || 0;
  const safeGst   = Number(gstRate)            || 0;

  const rate      = safeGst > 1 ? safeGst / 100 : safeGst;
  const gross     = safeMrp;
  const discount  = safeMrp - safeNet;
  const taxable   = rate > 0 ? safeNet / (1 + rate) : safeNet;
  const gst       = safeNet - taxable;
  const cgst      = gst / 2;
  const sgst      = parseFloat(gst.toFixed(2)) - parseFloat(cgst.toFixed(2));

  return {
    gross,
    discount: parseFloat(discount.toFixed(2)),
    taxable:  parseFloat(taxable.toFixed(2)),
    gst:      parseFloat(gst.toFixed(2)),
    cgst:     parseFloat(cgst.toFixed(2)),
    sgst:     parseFloat(sgst.toFixed(2)),
  };
};

// ─── Line-total helpers ───────────────────────────────────────────────────────
// FIX: guard against undefined pricePerSubUnit — fall back to 0 so sub-units
// are never silently dropped from the bill when the live product fetch missed it.
function lineSellingPrice(item: EnrichedCartItem): number {
  const packCost   = (item.price ?? 0) * (item.quantity ?? 0);
  const subUnitCost = (item.pricePerSubUnit ?? 0) * (item.subQuantity ?? 0);
  return packCost + subUnitCost;
}

function lineMrp(item: EnrichedCartItem): number {
  const packMrp    = (item.mrp ?? item.price ?? 0) * (item.quantity ?? 0);
  // FIX: derive mrpPerSubUnit from the pack mrp/price ratio when not explicitly provided
  const mrpPerSub  = item.mrpPerSubUnit ?? item.pricePerSubUnit ?? 0;
  const subUnitMrp = mrpPerSub * (item.subQuantity ?? 0);
  return packMrp + subUnitMrp;
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
export default function CartPage() {
  const [items, setItems]               = useState<EnrichedCartItem[]>([]);
  const [loading, setLoading]           = useState(true);
  const [checkingOut, setCheckingOut]   = useState(false);
  const [updating, setUpdating]         = useState<string | null>(null);
  const [uploading, setUploading]       = useState<string | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadFailure, setUploadFailure] = useState<string | null>(null);
  const navigate = useNavigate();
  const { refetchCart } = useCartContext();

  useEffect(() => { loadCart(); }, []);

  const loadCart = async () => {
    try {
      setLoading(true);
      const response = await cartService.getCart();
      const cartItems = response.items || [];

      if (cartItems.length === 0) { setItems([]); return; }

      const uniquePharmaIDs = [...new Set(cartItems.map((item: CartItem) => item.pharmaID))];

      const [pharmacyResults, productResults] = await Promise.all([
        Promise.all(
          uniquePharmaIDs.map(async (pharmaID) => {
            try {
              const pharmacy = await cartService.fetchPharmacyDetails(pharmaID);
              return { pharmaID, pharmacy };
            } catch {
              return {
                pharmaID,
                pharmacy: { pharmaID, name: `Pharmacy ${pharmaID}`, address: 'Address not available', phone: 'N/A', email: 'N/A', gstRegistered: 'No', gstIN: undefined },
              };
            }
          })
        ),
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
      pharmacyResults.forEach(({ pharmaID, pharmacy }) => { if (pharmacy) pharmacyMap.set(pharmaID as string, pharmacy); });

      const productMap = new Map<string, any>();
      productResults.forEach(({ productID, product }) => { if (product) productMap.set(productID, product); });

      const enrichedItems: EnrichedCartItem[] = cartItems.map((item: CartItem) => {
        const liveProduct = productMap.get(item.productID);

        const price   = liveProduct?.packaging?.price ?? item.price;
        const mrp     = liveProduct?.packaging?.mrp   ?? item.mrp ?? price;
        const gstRate = liveProduct?.gstRate ?? liveProduct?.packaging?.gstRate ?? item.gstRate ?? 0;
        const hsnCode = liveProduct?.hsnCode ?? liveProduct?.packaging?.hsnCode ?? item.hsnCode;

        // Per-sub-unit selling price from live product
        const pricePerSubUnit = liveProduct?.packaging?.pricePerUnit ?? undefined;

        // FIX: derive mrpPerSubUnit properly — use the pack's mrp/price discount ratio
        // applied to the sub-unit selling price. Fall back to pricePerSubUnit if price is 0.
        const mrpPerSubUnit = pricePerSubUnit !== undefined
          ? (price > 0 ? pricePerSubUnit * (mrp / price) : pricePerSubUnit)
          : undefined;

        const dosageForm = liveProduct?.category?.dosageForm ?? undefined;

        return {
          ...item,
          price,
          mrp,
          discountPercent: liveProduct?.packaging?.discountPercent ?? item.discountPercent ?? 0,
          gstRate,
          hsnCode,
          pricePerSubUnit,
          mrpPerSubUnit,
          dosageForm,
          pharmacy: pharmacyMap.get(item.pharmaID),
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
      setItems(items.map(item => item.productID === productID ? { ...item, quantity: newQuantity } : item));
      await refetchCart();
    } catch (error) {
      console.error('Failed to update quantity:', error);
    } finally {
      setUpdating(null);
    }
  };

  const handleRemoveItem = async (productID: string) => {
    try {
      setUpdating(productID);
      await cartService.removeItem(productID);
      setItems(items.filter(item => item.productID !== productID));
      await refetchCart();
    } catch (error) {
      console.error('Failed to remove item:', error);
    } finally {
      setUpdating(null);
    }
  };

  const handlePrescriptionUpload = async (productID: string, file: File) => {
    try {
      setUploading(productID);
      setUploadFailure(null);
      const result = await cartService.uploadPrescription(productID, file);
      setItems(items.map(item => item.productID === productID ? { ...item, prescriptionPath: result.prescriptionPath } : item));
      setUploadSuccess('Prescription uploaded successfully!');
      setTimeout(() => setUploadSuccess(null), 3000);
    } catch (error: any) {
      setUploadFailure(error.message || 'Failed to upload prescription. Please try again.');
    } finally {
      setUploading(null);
    }
  };

  const handleBulkPrescriptionUpload = async (file: File) => {
    try {
      setBulkUploading(true);
      setUploadFailure(null);
      const result = await cartService.uploadBulkPrescription(file);
      setItems(items.map(item => item.prescriptionRequired ? { ...item, prescriptionPath: result.prescriptionPath } : item));
      setUploadSuccess('Prescription uploaded for all medicines!');
      setTimeout(() => setUploadSuccess(null), 3000);
    } catch (error: any) {
      setUploadFailure(error.message || 'Failed to upload prescription. Please try again.');
    } finally {
      setBulkUploading(false);
    }
  };

  const getMedicineInitial = (name: string) => name.charAt(0).toUpperCase();

  const itemsByPharmacy = items.reduce((acc, item) => {
    if (!acc[item.pharmaID]) acc[item.pharmaID] = [];
    acc[item.pharmaID].push(item);
    return acc;
  }, {} as Record<string, EnrichedCartItem[]>);

  // FIX: count pack units; for sub-unit-only lines count as 1 so they aren't invisible
  const totalItems = items.reduce((sum, item) => {
    const packs = item.quantity ?? 0;
    return sum + (packs > 0 ? packs : ((item.subQuantity ?? 0) > 0 ? 1 : 0));
  }, 0);

  // ── Bill summary totals ───────────────────────────────────────────────────
  // FIX: lineSellingPrice and lineMrp now correctly include sub-unit costs
  const overallTotals = items.reduce((acc, item) => {
    const totalMrp     = lineMrp(item);
    const totalSelling = lineSellingPrice(item);
    const t            = calculateTaxFromTotals(totalMrp, totalSelling, item.gstRate ?? 0);
    return {
      gross:    acc.gross    + t.gross,
      discount: acc.discount + t.discount,
      net:      acc.net      + totalSelling,
      taxable:  acc.taxable  + t.taxable,
      gst:      acc.gst      + t.gst,
      cgst:     acc.cgst     + t.cgst,
      sgst:     acc.sgst     + t.sgst,
    };
  }, { gross: 0, discount: 0, net: 0, taxable: 0, gst: 0, cgst: 0, sgst: 0 });

  const hasAnyGstPharmacy       = items.some(item => item.pharmacy?.gstRegistered === 'Yes');
  const hasPrescriptionRequired  = items.some(item => item.prescriptionRequired);
  const allPrescriptionsUploaded = !items.some(item => item.prescriptionRequired && !item.prescriptionPath);

  const handleProceedToCheckout = async () => {
    try {
      setCheckingOut(true);

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

      const itemsWithTax = items.map((item, i) => ({
        ...item,
        mrp:             enrichPayload[i].mrp,
        discountPercent: enrichPayload[i].discountPercent,
        gstRate:         enrichPayload[i].gstRate,
        hsnCode:         enrichPayload[i].hsnCode,
        taxBreakdown:    enrichPayload[i].taxBreakdown,
      }));

      const taxSummaryByPharma: Record<string, { discount: number; net: number; taxable: number; gst: number; cgst: number; sgst: number }> = {};
      for (const [pharmaID, pharmacyItems] of Object.entries(itemsByPharmacy)) {
        taxSummaryByPharma[pharmaID] = pharmacyItems.reduce(
          (acc, item) => {
            const totalMrp     = lineMrp(item);
            const totalSelling = lineSellingPrice(item);
            const t            = calculateTaxFromTotals(totalMrp, totalSelling, item.gstRate ?? 0);
            return {
              discount: acc.discount + t.discount,
              net:      acc.net      + totalSelling,
              taxable:  acc.taxable  + t.taxable,
              gst:      acc.gst      + t.gst,
              cgst:     acc.cgst     + t.cgst,
              sgst:     acc.sgst     + t.sgst,
            };
          },
          { discount: 0, net: 0, taxable: 0, gst: 0, cgst: 0, sgst: 0 }
        );
      }

      navigate('/dashboard/checkout-confirm', { state: { itemsWithTax, taxSummaryByPharma } });
    } catch (error: any) {
      console.error('Checkout enrich failed:', error);
      setUploadFailure('Failed to prepare checkout. Please try again.');
    } finally {
      setCheckingOut(false);
    }
  };

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

  if (items.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-black mb-2">My Cart</h1>
          <p className="text-gray-600">Review your selected medicines and proceed to secure checkout.</p>
        </div>
        <Card>
          <CardContent className="p-12 text-center">
            <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">Your cart is empty</h3>
            <p className="text-gray-500 mb-6">Add medicines and supplies to get started</p>
            <Button className="bg-[#123B6B] hover:bg-[#0f2a54] text-white" onClick={() => navigate('/dashboard/pharmacies')}>
              Continue Shopping
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-black mb-2">My Cart</h1>
        <p className="text-gray-600">Review your selected medicines and proceed to secure checkout.</p>
      </div>

      {/* Alerts */}
      {uploadSuccess && (
        <div className="w-full flex items-start gap-3 px-5 py-4 rounded-xl bg-green-600 text-white shadow-lg ring-1 ring-white/10">
          <CheckCircle className="w-5 h-5 text-white mt-0.5 flex-shrink-0" />
          <div className="text-sm font-medium">{uploadSuccess}</div>
        </div>
      )}
      {uploadFailure && (
        <div className="w-full flex items-start gap-3 px-5 py-4 rounded-xl bg-red-600 text-white shadow-lg ring-1 ring-white/10">
          <XCircle className="w-5 h-5 text-white mt-0.5 flex-shrink-0" />
          <div className="text-sm font-medium">{uploadFailure}</div>
        </div>
      )}

      {/* Bulk Prescription */}
      {hasPrescriptionRequired && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-1">Prescription Required</h3>
                <p className="text-sm text-blue-800 mb-3">
                  You can upload one prescription for all medicines. Our pharmacy will verify and use it if applicable for multiple items.
                </p>
                <label
                  htmlFor="bulk-prescription-upload"
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-colors ${
                    bulkUploading || allPrescriptionsUploaded
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  {bulkUploading ? 'Uploading...' : allPrescriptionsUploaded ? 'Prescription Uploaded' : 'Upload One Prescription for All'}
                </label>
                <input
                  id="bulk-prescription-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={bulkUploading || allPrescriptionsUploaded}
                  onChange={(e) => { const file = e.target.files?.[0]; if (file) handleBulkPrescriptionUpload(file); }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cart Content */}
      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        {/* Items by Pharmacy */}
        <div className="space-y-6">
          {Object.entries(itemsByPharmacy).map(([pharmaID, pharmacyItems]) => (
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

              {/* Items */}
              <CardContent className="p-0">
                <div className="divide-y">
                  {pharmacyItems.map((item) => {
                    const effectiveSelling = lineSellingPrice(item);
                    const effectiveMrp     = lineMrp(item);
                    const hasSubQty        = (item.subQuantity ?? 0) > 0;
                    const hasPackQty       = item.quantity > 0;

                    return (
                      <div key={item.productID} className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                          {/* Item Info */}
                          <div className="flex-1 flex items-start gap-3">
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-md">
                              <span className="text-white font-bold text-lg">{getMedicineInitial(item.name)}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-gray-900 mb-1">{item.name}</h4>

                              {/* Dosage-form-aware quantity breakdown */}
                              {(() => {
                                const { packUnit, subUnit } = getDosageLabels(item.dosageForm);
                                const pl = (n: number, u: string) => `${u.toLowerCase()}${n !== 1 ? "s" : ""}`;
                                return (
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-gray-600 mb-1">
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
                                        {item.subQuantity} sub-unit{item.subQuantity !== 1 ? "s" : ""}
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}

                              {item.prescriptionRequired && (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                                    Prescription Required
                                  </span>
                                  {!item.prescriptionPath ? (
                                    <label
                                      htmlFor={`prescription-${item.productID}`}
                                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                                        uploading === item.productID
                                          ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                                          : 'bg-blue-600 text-white hover:bg-blue-700'
                                      }`}
                                    >
                                      <Upload className="w-3 h-3" />
                                      {uploading === item.productID ? 'Uploading...' : 'Upload'}
                                    </label>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                                      <CheckCircle className="w-3 h-3" /> Uploaded
                                    </span>
                                  )}
                                  <input
                                    id={`prescription-${item.productID}`}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    disabled={uploading === item.productID || !!item.prescriptionPath}
                                    onChange={(e) => { const file = e.target.files?.[0]; if (file) handlePrescriptionUpload(item.productID, file); }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Controls */}
                          <div className="flex sm:flex-col items-center sm:items-end gap-3 justify-between sm:justify-start">
                            <div className="text-right">
                              <p className="text-xs text-gray-500 mb-0.5">Subtotal</p>
                              <p className="text-lg font-bold text-gray-900">₹{effectiveSelling.toFixed(2)}</p>
                              {/* FIX: show MRP strikethrough using correct lineMrp */}
                              {effectiveMrp > effectiveSelling && (
                                <p className="text-xs text-gray-400 line-through">₹{effectiveMrp.toFixed(2)}</p>
                              )}
                            </div>

                            {/* Pack-unit stepper */}
                            {hasPackQty && (
                              <div className="flex items-center gap-1 border-2 border-gray-200 rounded-lg p-1 bg-white shadow-sm">
                                <button
                                  onClick={() => handleUpdateQuantity(item.productID, item.quantity - 1)}
                                  disabled={updating === item.productID}
                                  className="p-1.5 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  aria-label="Decrease quantity"
                                >
                                  <Minus className="w-4 h-4 text-gray-600" />
                                </button>
                                <span className="w-8 text-center text-sm font-semibold text-gray-900">{item.quantity}</span>
                                <button
                                  onClick={() => handleUpdateQuantity(item.productID, item.quantity + 1)}
                                  disabled={updating === item.productID}
                                  className="p-1.5 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  aria-label="Increase quantity"
                                >
                                  <Plus className="w-4 h-4 text-gray-600" />
                                </button>
                              </div>
                            )}

                            <button
                              onClick={() => handleRemoveItem(item.productID)}
                              disabled={updating === item.productID}
                              className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Bill Summary */}
        <div>
          <Card className="sticky top-8">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-black">Bill Summary</CardTitle>
                <Receipt className="w-5 h-5 text-gray-500" />
              </div>
              <CardDescription className="text-gray-600">
                {totalItems} {totalItems === 1 ? 'item' : 'items'} in your cart
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

                {/* GST breakdown — shown whenever a GST-registered pharmacy is in the cart */}
                {hasAnyGstPharmacy && (
                  <>
                    {/* Taxable value = net selling price excluding GST */}
                    <div className="flex justify-between text-gray-700">
                      <span>Taxable Value</span>
                      <span className="font-medium">₹{overallTotals.taxable.toFixed(2)}</span>
                    </div>
                    {/* GST = net - taxable; shown as total and split into CGST + SGST */}
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

                {/* Total = taxable + GST = net selling price */}
                <div className="flex justify-between items-center pt-3 border-t-2 border-gray-300">
                  <span className="text-base font-bold text-black">Grand Total <span className="text-gray-500 text-xs font-semibold">(Rounded off)</span></span>
                  <span className="text-2xl font-bold text-[#123B6B]">₹{Math.round(overallTotals.net)}</span>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                {hasPrescriptionRequired && (
                  <div className={`flex items-start text-xs p-3 rounded border ${
                    !allPrescriptionsUploaded
                      ? 'text-red-700 bg-red-50 border-red-200'
                      : 'text-green-700 bg-green-50 border-green-200'
                  }`}>
                    <span className="mr-2 mt-0.5">{!allPrescriptionsUploaded ? '💉' : '✅'}</span>
                    <span>
                      <strong>{!allPrescriptionsUploaded ? 'Prescription Required:' : 'Prescriptions Added:'}</strong>{' '}
                      {!allPrescriptionsUploaded
                        ? 'Please upload prescription for medicines that require it.'
                        : 'All required prescriptions have been uploaded.'}
                    </span>
                  </div>
                )}

                <div className="flex items-center text-xs text-gray-500 bg-gray-50 p-3 rounded">
                  <CreditCard className="w-3 h-3 mr-2 flex-shrink-0" />
                  <span>Self-pickup from pharmacy • Secure payments</span>
                </div>

                <Button
                  disabled={!allPrescriptionsUploaded || checkingOut}
                  onClick={handleProceedToCheckout}
                  className={`w-full flex items-center justify-center gap-2 ${
                    !allPrescriptionsUploaded || checkingOut
                      ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                      : 'bg-[#123B6B] hover:bg-[#0f2a54] text-white'
                  }`}
                >
                  <ShoppingCart className="w-4 h-4" />
                  {checkingOut ? 'Preparing checkout...' : 'Proceed to Checkout'}
                </Button>

                <Button variant="outline" className="w-full text-sm" onClick={() => navigate('/dashboard/pharmacies')}>
                  Continue Shopping
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}