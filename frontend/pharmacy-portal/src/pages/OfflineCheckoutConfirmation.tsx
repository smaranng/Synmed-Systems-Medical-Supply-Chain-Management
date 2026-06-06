import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { useAuth } from '../hooks/useAuth';
import { pharma_cartService } from '../services/pharma_cartService';
import { offlineOrderService, CustomerDetailsForm } from '../services/offlineOrderService';
import { AlertCircle, Trash2, Check, XCircle, Upload, Receipt } from 'lucide-react';

interface CartItem {
  productID: string;
  name: string;
  price: number;
  mrp?: number;
  discountPercent?: number;
  gstRate?: number;
  hsnCode?: string;
  taxBreakdown?: {
    gross: number;
    discount: number;
    taxable: number;
    gst: number;
    cgst: number;
    sgst: number;
  };
  quantity: number;
  subQuantity?: number;
  pharmaID: string;
  prescriptionRequired?: boolean;
  prescriptionPath?: string;
  pricePerUnit?: number;
}

function calculateTaxFromTotals(totalMrp: number, totalSellingPrice: number, gstRate: number) {
  const safeMrp = Number(totalMrp) || 0;
  const safeNet = Number(totalSellingPrice) || 0;
  const safeGst = Number(gstRate) || 0;

  const rate = safeGst > 1 ? safeGst / 100 : safeGst;
  const gross = safeMrp;
  const discount = safeMrp - safeNet;
  const taxable = rate > 0 ? safeNet / (1 + rate) : safeNet;
  const gst = safeNet - taxable;
  const cgst = gst / 2;
  const sgst = parseFloat(gst.toFixed(2)) - parseFloat(cgst.toFixed(2));

  return {
    gross,
    discount: parseFloat(discount.toFixed(2)),
    taxable: parseFloat(taxable.toFixed(2)),
    gst: parseFloat(gst.toFixed(2)),
    cgst: parseFloat(cgst.toFixed(2)),
    sgst: parseFloat(sgst.toFixed(2)),
  };
}

function lineMrp(item: CartItem): number {
  const packMrp = (item.mrp ?? item.price ?? 0) * (item.quantity ?? 0);
  const ratio = (item.price ?? 0) > 0 ? (item.mrp ?? item.price ?? 0) / (item.price ?? 1) : 1;
  const derivedMrpPerSubUnit = (item.pricePerUnit ?? 0) * ratio;
  const subUnitMrp = derivedMrpPerSubUnit * (item.subQuantity ?? 0);
  return packMrp + subUnitMrp;
}

function lineSellingPrice(item: CartItem): number {
  return (item.price ?? 0) * (item.quantity ?? 0)
    + (item.pricePerUnit ?? 0) * (item.subQuantity ?? 0);
}

export default function OfflineCheckoutConfirmation() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const pharmacyId = user?.pharmaID || user?.id;
  
  const handleBackToShopping = () => {
    if (pharmacyId) {
      navigate(`/dashboard/offline-orders/${pharmacyId}`);
    } else {
      navigate('/dashboard');
    }
  };

  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [sliderValue, setSliderValue] = useState(0);
  const [removeLoading, setRemoveLoading] = useState<string | null>(null);
  const [prescriptionLoading, setPrescriptionLoading] = useState<string | null>(null);

  const [formData, setFormData] = useState<CustomerDetailsForm>({
    name: '',
    doctorName: '',
    mobileNumber: '',
    email: '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    loadCart();
  }, []);

  useEffect(() => {
    if (!showSuccess || sliderValue < 0 || sliderValue >= 100) return;

    const interval = setInterval(() => {
      setSliderValue((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        const next = prev + 5;
        if (next >= 100) {
          clearInterval(interval);
          return 100;
        }
        return next;
      });
    }, 75);

    return () => clearInterval(interval);
  }, [showSuccess, sliderValue]);

  const loadCart = async () => {
    try {
      setLoading(true);
      const response = await pharma_cartService.getCart();
      setItems(response.items || []);
    } catch (error) {
      console.error('Failed to load cart:', error);
    } finally {
      setLoading(false);
    }
  };

  const pickPrescriptionFile = (): Promise<File | null> => {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/jpeg,image/jpg,image/png,image/gif,image/webp';
      input.onchange = () => {
        const file = input.files?.[0] ?? null;
        resolve(file);
      };
      input.oncancel = () => resolve(null);
      input.click();
    });
  };

  const handleMarkPrescriptionShown = async (productID: string) => {
    try {
      setPrescriptionLoading(productID);
      await pharma_cartService.markPrescriptionShownAtPharmacy(productID);
      setItems((prev) =>
        prev.map((item) =>
          item.productID === productID
            ? { ...item, prescriptionPath: 'PRESCRIPTION_SHOWN_AT_PHARMACY' }
            : item
        )
      );
    } catch (error) {
      console.error('Failed to mark prescription shown at pharmacy:', error);
      alert('Failed to save prescription status. Please try again.');
    } finally {
      setPrescriptionLoading(null);
    }
  };

  const handleUploadPrescription = async (productID: string) => {
    const file = await pickPrescriptionFile();
    if (!file) return;

    try {
      setPrescriptionLoading(productID);
      const result = await pharma_cartService.uploadPrescription(productID, file);
      setItems((prev) =>
        prev.map((item) =>
          item.productID === productID
            ? { ...item, prescriptionPath: result?.prescriptionPath }
            : item
        )
      );
    } catch (error: any) {
      console.error('Failed to upload prescription:', error);
      alert(error?.message || 'Failed to upload prescription. Please try again.');
    } finally {
      setPrescriptionLoading(null);
    }
  };

  const isPrescriptionHandled = (item: CartItem) => {
    if (!item.prescriptionRequired) return true;
    return Boolean(item.prescriptionPath);
  };

  const handleRemoveItem = async (productID: string) => {
    try {
      setRemoveLoading(productID);
      await pharma_cartService.removeItem(productID);
      setItems(items.filter(item => item.productID !== productID));
    } catch (error) {
      console.error('Failed to remove item:', error);
      alert('Failed to remove item. Please try again.');
    } finally {
      setRemoveLoading(null);
    }
  };

  const validateForm = (): boolean => {
    setFormError(null);
    
    if (!formData.name.trim()) {
      setFormError('Customer name is required');
      return false;
    }
    if (!formData.doctorName.trim()) {
      setFormError('Doctor name is required');
      return false;
    }
    if (!formData.mobileNumber.trim()) {
      setFormError('Mobile number is required');
      return false;
    }
    if (!/^\d{10}$/.test(formData.mobileNumber.replace(/\D/g, ''))) {
      setFormError('Please enter a valid 10-digit mobile number');
      return false;
    }
    if (items.length === 0) {
      setFormError('Please add atleast one item to cart');
      return false;
    }
    const missingPrescription = items.find((item) => item.prescriptionRequired && !item.prescriptionPath);
    if (missingPrescription) {
      setFormError(`Prescription action required for ${missingPrescription.name}. Upload prescription or mark shown at pharmacy.`);
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    if (!pharmacyId) {
      setFormError('Pharmacy information missing');
      return;
    }

    try {
      setSubmitting(true);
      setSliderValue(0);
      setShowSuccess(true);

      const productResults = await Promise.all(
        items.map(async (item) => {
          try {
            const product = await pharma_cartService.fetchProductDetails(item.productID, item.pharmaID);
            return { productID: item.productID, product };
          } catch {
            return { productID: item.productID, product: null };
          }
        })
      );

      const productMap = new Map<string, any>();
      productResults.forEach(({ productID, product }) => {
        if (product) productMap.set(productID, product);
      });

      const enrichedItems = items.map((item) => {
        const liveProduct = productMap.get(item.productID);
        const price = liveProduct?.packaging?.price ?? item.price;
        const mrp = liveProduct?.packaging?.mrp ?? item.mrp ?? price;
        const discountPercent = liveProduct?.packaging?.discountPercent ?? item.discountPercent ?? 0;
        const gstRate = liveProduct?.gstRate ?? liveProduct?.packaging?.gstRate ?? item.gstRate ?? 0;
        const hsnCode = liveProduct?.hsnCode ?? liveProduct?.packaging?.hsnCode ?? item.hsnCode;
        const pricePerUnit = liveProduct?.packaging?.pricePerUnit ?? item.pricePerUnit;

        const withPricing: CartItem = {
          ...item,
          price,
          mrp,
          discountPercent,
          gstRate,
          hsnCode,
          pricePerUnit,
        };

        return {
          ...withPricing,
          taxBreakdown: calculateTaxFromTotals(lineMrp(withPricing), lineSellingPrice(withPricing), gstRate),
        };
      });

      const payload = {
        items: enrichedItems,
        customerDetails: formData,
      };

      const order = await offlineOrderService.createOfflineOrder(payload, pharmacyId);

      // Clear cart after successful order creation
      await pharma_cartService.clearCart();

      // Navigate to confirmation page after a short delay
      setTimeout(() => {
        navigate(`/dashboard/offline-order-confirmation/${order._id}`);
      }, 1500);
    } catch (error: any) {
      console.error('Failed to create order:', error);
      setFormError(error.message || 'Failed to create order. Please try again.');
      setSliderValue(-1);
    } finally {
      setSubmitting(false);
    }
  };

  const totalItems = items.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
  const totalSubUnits = items.reduce((sum, item) => sum + (item.subQuantity ?? 0), 0);
  const total = items.reduce((sum, item) => sum + lineSellingPrice(item), 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-black mb-2">Offline Checkout</h1>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-lg text-gray-600">Loading cart...</div>
        </div>
      </div>
    );
  }

  if (showSuccess) {
    const isProcessing = sliderValue >= 0 && sliderValue < 100;
    const isSuccess = sliderValue === 100;
    const isError = sliderValue === -1;

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
                type="range"
                min="0"
                max="100"
                value={sliderValue}
                disabled
                className="w-full h-3 rounded-lg appearance-none accent-green-600"
                style={{
                  background: `linear-gradient(to right, #16a34a ${sliderValue}%, #e5e7eb ${sliderValue}%)`,
                }}
              />
            </div>
          )}

          {isSuccess && (
            <div className="bg-green-600 p-8 text-white text-center space-y-6 animate-fade-in">
              <Check className="w-12 h-12 mx-auto" strokeWidth={2} />
              <h2 className="text-2xl font-bold">Order Created!</h2>
              <p className="text-sm opacity-90">Redirecting to order confirmation...</p>
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
              <p className="text-sm text-gray-700">{formError || 'Failed to create order'}</p>
              <button
                onClick={() => {
                  setShowSuccess(false);
                  setFormError(null);
                  setSliderValue(0);
                }}
                className="w-full bg-red-600 text-white font-bold py-2 rounded-lg hover:bg-red-700 transition"
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        <style>{`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          .animate-fade-in {
            animation: fadeIn 0.5s ease-in-out;
          }
        `}</style>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-black mb-2">Offline Checkout</h1>
          <p className="text-gray-600">Your cart is empty</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Button
            onClick={handleBackToShopping}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Continue Shopping
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-black mb-2">Offline Checkout</h1>
        <p className="text-gray-600">Enter customer details and review your order</p>
      </div>

      {/* Customer Details Form */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-bold text-black mb-4">Customer Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Customer Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter customer name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Doctor Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={formData.doctorName}
                onChange={(e) => setFormData({ ...formData, doctorName: e.target.value })}
                placeholder="Enter doctor name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mobile Number <span className="text-red-600">*</span>
              </label>
              <input
                type="tel"
                value={formData.mobileNumber}
                onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
                placeholder="Enter 10-digit mobile number"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email <span className="text-gray-400">(Optional)</span>
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Enter email address"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {formError && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{formError}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cart Items */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-bold text-black mb-4">Order Items</h2>
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.productID} className="border rounded-lg p-4 flex items-start justify-between hover:bg-gray-50">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{item.name}</h3>
                  <div className="text-sm text-gray-600 mt-1">
                    <span>
                      {item.quantity} pack{item.quantity !== 1 ? 's' : ''} @ ₹{item.price.toFixed(2)}
                    </span>
                    {item.subQuantity && item.subQuantity > 0 && (
                      <span className="ml-2 text-indigo-600">
                        + {item.subQuantity} sub-unit{item.subQuantity !== 1 ? 's' : ''}
                        {item.pricePerUnit && ` @ ₹${item.pricePerUnit.toFixed(2)}`}
                      </span>
                    )}
                  </div>
                  {item.prescriptionRequired && (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs font-semibold text-amber-800 mb-2">Prescription Required</p>
                      {isPrescriptionHandled(item) ? (
                        <p className="text-xs text-green-700 font-medium">
                          {item.prescriptionPath === 'PRESCRIPTION_SHOWN_AT_PHARMACY'
                            ? 'Prescription shown at pharmacy'
                            : 'Prescription uploaded'}
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="text-xs h-8"
                            disabled={prescriptionLoading === item.productID}
                            onClick={() => handleUploadPrescription(item.productID)}
                          >
                            <Upload className="w-3.5 h-3.5 mr-1" />
                            Upload Prescription
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="text-xs h-8"
                            disabled={prescriptionLoading === item.productID}
                            onClick={() => handleMarkPrescriptionShown(item.productID)}
                          >
                            Prescription Shown At Pharmacy
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4 ml-4">
                  <span className="font-bold text-gray-900">₹{lineSellingPrice(item).toFixed(2)}</span>
                  <button
                    onClick={() => handleRemoveItem(item.productID)}
                    disabled={removeLoading === item.productID}
                    className="text-red-600 hover:text-red-700 disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="mt-6 pt-4 border-t space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Items</span>
              <span className="font-medium">
                {totalItems} pack{totalItems !== 1 ? 's' : ''}
                {totalSubUnits > 0 && ` + ${totalSubUnits} sub-unit${totalSubUnits !== 1 ? 's' : ''}`}
              </span>
            </div>
            <div className="flex justify-between items-center text-lg font-bold">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-600" />
                <span>Total Amount</span>
              </div>
              <span className="text-emerald-600">₹{total.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <Button
          variant="outline"
          onClick={handleBackToShopping}
          disabled={submitting}
        >
          Back to Shopping
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={submitting || items.length === 0}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {submitting ? 'Processing...' : 'Proceed to Payment'}
        </Button>
      </div>
    </div>
  );
}
