import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Check, Loader2, ShoppingCart, XCircle } from 'lucide-react';
import { cartService } from '../services/distributor_cartService';
import { useAuth } from '../hooks/useAuth';

interface TaxBreakdown {
  gross: number;
  discount: number;
  taxable: number;
  gst: number;
  cgst: number;
  sgst: number;
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
  orderNumber: string;
  pharmaID: string;
  distributorID: string;
  items: SuggestedOrderItem[];
  grandTotal: number;
}

interface CheckoutState {
  order?: SuggestedOrder;
}

function resolveTotal(t: { $numberDecimal: string } | number): number {
  return typeof t === 'number' ? t : parseFloat(t.$numberDecimal);
}

export default function ProcurementCheckoutConfirmation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { order } = (location.state as CheckoutState) || {};

  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [sliderValue, setSliderValue] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!order) {
      navigate('/dashboard/procurement', { replace: true });
    }
  }, [order, navigate]);

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

  if (!order) return null;

  const handleConfirm = async () => {
    try {
      setSubmitting(true);
      setError(null);
      setSliderValue(0);
      setShowSuccess(true);

      await cartService.placeOrder({
        distributorID: order.distributorID,
        orderNumber: order.orderNumber,
        grandTotal: order.grandTotal,
        pharmaID: user?.pharmaID ?? order.pharmaID,
        items: order.items,
      });
    } catch (err: any) {
      setError(err?.message ?? 'Failed to place order. Please try again.');
      setSliderValue(-1);
    } finally {
      setSubmitting(false);
    }
  };

  const totalItems = order.items.reduce((sum, item) => sum + (item.quantity ?? 0), 0);

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
              <h2 className="text-xl font-bold text-green-600">Placing your order...</h2>
              <input
                type="range"
                min="0"
                max="100"
                value={sliderValue}
                disabled
                className="w-full h-3 rounded-lg appearance-none accent-green-600"
                style={{ background: `linear-gradient(to right, #16a34a ${sliderValue}%, #e5e7eb ${sliderValue}%)` }}
              />
            </div>
          )}

          {isSuccess && (
            <div className="bg-green-600 p-8 text-white text-center space-y-6 animate-fade-in">
              <Check className="w-12 h-12 mx-auto" strokeWidth={2} />
              <h2 className="text-2xl font-bold">Order Confirmed!</h2>
              <p className="text-sm opacity-90">Distributor order has been placed successfully.</p>
              <button
                onClick={() => navigate('/dashboard/procurement', {
                  state: {
                    refresh: true,
                    placedMedicineNames: order.items.map((item) => item.name),
                  },
                })}
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
              <p className="text-sm text-gray-700">{error ?? 'Unable to place order'}</p>
              <button
                onClick={() => {
                  setShowSuccess(false);
                  setSliderValue(0);
                }}
                className="w-full bg-red-600 text-white font-bold py-3 rounded-lg hover:bg-red-700 transition"
              >
                Back to Checkout
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
        <p className="text-gray-600">Please review your procurement order details before confirming.</p>
      </div>

      <Card className="border-2 border-[#123B6B]">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              <span className="font-semibold text-gray-800">Order Number:</span> {order.orderNumber}
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-semibold text-gray-800">Distributor:</span> {order.distributorID}
            </div>

            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-500 text-xs">Medicine</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-gray-500 text-xs">Qty</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-gray-500 text-xs">Price</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-gray-500 text-xs">Discount</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-gray-500 text-xs">GST</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-gray-500 text-xs">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, idx) => (
                    <tr key={`${item.productID_Phm}-${idx}`} className="border-b border-gray-50">
                      <td className="px-4 py-3 text-gray-900 font-medium">{item.name}</td>
                      <td className="px-4 py-3 text-right">{item.quantity}</td>
                      <td className="px-4 py-3 text-right">Rs.{item.price.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right">{item.discountPercent}%</td>
                      <td className="px-4 py-3 text-right">{item.gstRate}%</td>
                      <td className="px-4 py-3 text-right font-semibold">Rs.{resolveTotal(item.totalAmount).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Total Items</span>
              <span className="font-medium text-black">{totalItems}</span>
            </div>
            <hr className="my-1" />
            <div className="flex justify-between items-center">
              <span className="text-lg font-bold text-black">Grand Total</span>
              <span className="text-2xl font-bold text-[#123B6B]">Rs.{order.grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="p-3 rounded-md border border-red-200 bg-red-50 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          onClick={() => navigate('/dashboard/procurement')}
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
          {submitting
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Placing...</>
            : <><ShoppingCart className="w-4 h-4 mr-2" /> Yes, I Confirm</>
          }
        </Button>
      </div>
    </div>
  );
}
