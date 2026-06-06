import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { useAuth } from '../hooks/useAuth';
import { offlineOrderService, OfflineOrder } from '../services/offlineOrderService';
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  X,
  AlertCircle,
  User,
  Phone,
  Mail,
  Package,
  Receipt,
} from 'lucide-react';

interface PaymentModalProps {
  order: OfflineOrder;
  onConfirm: (paymentMode: 'CASH' | 'ONLINE', transactionId: string) => Promise<void>;
  onClose: () => void;
  isLoading: boolean;
}

function PaymentModal({ order, onConfirm, onClose, isLoading }: PaymentModalProps) {
  const [method, setMethod] = useState<'ONLINE' | 'CASH'>('ONLINE');
  const [transactionId, setTransactionId] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    if (method === 'ONLINE' && !transactionId.trim()) {
      setError('Please enter a transaction ID for online payments.');
      return;
    }
    await onConfirm(method, method === 'CASH' ? '' : transactionId.trim());
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-emerald-50 to-teal-50">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-emerald-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Mark Order Completed</h2>
              <p className="text-xs text-gray-500">{order.orderNumber}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
            <CreditCard className="h-4 w-4 text-emerald-600 flex-shrink-0" />
            <span className="text-xs text-emerald-700 font-medium tracking-wide">
              Payment Mode: <span className="font-bold">Select Payment Method</span>
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
              How did the customer pay?
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'ONLINE' as const, label: 'Online', sub: 'UPI / Card / Net Banking', icon: '📲' },
                { value: 'CASH' as const, label: 'Cash', sub: 'Physical cash at counter', icon: '💵' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setMethod(opt.value);
                    setTransactionId('');
                    setError('');
                  }}
                  className={`flex flex-col items-start gap-0.5 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                    method === opt.value
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="text-base">{opt.icon}</span>
                    {opt.label}
                  </span>
                  <span className="text-[10px] font-normal text-gray-400 ml-0.5">{opt.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {method === 'ONLINE' && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                Transaction ID <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={transactionId}
                  onChange={e => {
                    setTransactionId(e.target.value);
                    setError('');
                  }}
                  placeholder="Enter UPI / card / net banking reference ID"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
                />
              </div>
              {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
            </div>
          )}

          <div className="bg-gray-50 rounded-xl px-4 py-3 flex justify-between items-center text-sm">
            <span className="text-gray-500">Total Amount</span>
            <span className="font-bold text-gray-900">₹{order.totalAmount.toFixed(2)}</span>
          </div>
        </div>

        <div className="px-6 py-4 border-t flex gap-3 justify-end bg-gray-50">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isLoading ? 'Completing…' : 'Confirm & Complete'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function OfflineOrderConfirmation() {
  const { orderId } = useParams<{ orderId: string }>();
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

  const [order, setOrder] = useState<OfflineOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const statusTone: Record<OfflineOrder['status'], string> = {
    PENDING: 'bg-amber-100 text-amber-700 border-amber-200',
    COMPLETED: 'bg-green-100 text-green-700 border-green-200',
    CANCELLED: 'bg-red-100 text-red-700 border-red-200',
  };

  const statusLabel: Record<OfflineOrder['status'], string> = {
    PENDING: 'Pending Completion',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
  };

  useEffect(() => {
    if (!orderId) {
      setError('Order ID not found');
      setLoading(false);
      return;
    }
    loadOrder();
  }, [orderId]);

  const loadOrder = async () => {
    try {
      setLoading(true);
      setError(null);
      if (!orderId) throw new Error('Order ID not found');
      const orderData = await offlineOrderService.getOfflineOrder(orderId);
      setOrder(orderData);
    } catch (err) {
      console.error('Failed to load order:', err);
      setError(err instanceof Error ? err.message : 'Failed to load order');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteOrder = async (paymentMode: 'CASH' | 'ONLINE', transactionId: string) => {
    if (!orderId) return;
    try {
      setCompleting(true);
      const completed = await offlineOrderService.completeOfflineOrder(
        orderId,
        paymentMode,
        transactionId || undefined
      );
      setOrder(completed);
      setShowPaymentModal(false);
      setSuccess(true);
      setTimeout(() => {
        handleBackToShopping();
      }, 2000);
    } catch (err: any) {
      console.error('Failed to complete order:', err);
      setError(err.message || 'Failed to complete order');
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-black mb-2">Order Confirmation</h1>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-lg text-gray-600">Loading order details...</div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleBackToShopping}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-1" />
              <div>
                <p className="font-semibold text-red-900">Order Not Found</p>
                <p className="text-sm text-red-700 mt-1">{error || 'Unable to load order details'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden bg-white border border-emerald-100">
          <div className="bg-gradient-to-r from-emerald-700 to-emerald-600 px-8 py-6 text-center text-white space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-full flex items-center justify-center border border-white/30">
                <CheckCircle2 className="w-10 h-10 text-white" />
              </div>
            </div>
            <h2 className="text-2xl font-bold">Transaction Successful</h2>
            <p className="text-sm text-emerald-50">Order {order.orderNumber} has been completed.</p>
          </div>
          <div className="p-5 text-center">
            <p className="text-xs text-gray-500">Redirecting to inventory...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleBackToShopping}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      </div>

      <Card className="overflow-hidden border-0 shadow-lg">
        <CardContent className="p-0">
          <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 px-6 py-6 text-white">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-emerald-100">Offline Purchase Confirmation</p>
                <h1 className="text-2xl md:text-3xl font-bold mt-1">{order.orderNumber}</h1>
                <p className="text-sm text-emerald-50 mt-2">
                  Created on {new Date(order.createdAt).toLocaleDateString()} at {new Date(order.createdAt).toLocaleTimeString()}
                </p>
              </div>
              <div className={`px-3 py-1.5 rounded-full border text-xs font-semibold ${statusTone[order.status]}`}>
                {statusLabel[order.status]}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-emerald-50/60 p-4">
            <div className="rounded-lg bg-white p-3 border border-emerald-100">
              <p className="text-xs text-gray-500">Customer</p>
              <p className="text-sm font-semibold text-gray-900 truncate">{order.customerName}</p>
            </div>
            <div className="rounded-lg bg-white p-3 border border-emerald-100">
              <p className="text-xs text-gray-500">Doctor</p>
              <p className="text-sm font-semibold text-gray-900 truncate">{order.doctorName}</p>
            </div>
            <div className="rounded-lg bg-white p-3 border border-emerald-100">
              <p className="text-xs text-gray-500">Items</p>
              <p className="text-sm font-semibold text-gray-900">{order.items.length}</p>
            </div>
            <div className="rounded-lg bg-white p-3 border border-emerald-100">
              <p className="text-xs text-gray-500">Bill Amount</p>
              <p className="text-sm font-bold text-emerald-700">₹{order.totalAmount.toFixed(2)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-1" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Customer Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              Customer Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-gray-500 uppercase">Customer Name</p>
              <p className="font-semibold text-gray-900">{order.customerName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Doctor Name</p>
              <p className="font-semibold text-gray-900">{order.doctorName}</p>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="w-4 h-4 text-gray-400 mt-1 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500 uppercase">Mobile Number</p>
                <p className="font-semibold text-gray-900">{order.mobileNumber}</p>
              </div>
            </div>
            {order.email && (
              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-gray-400 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500 uppercase">Email</p>
                  <p className="font-semibold text-gray-900">{order.email}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-green-600" />
              Order Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-gray-500 uppercase">Total Items</p>
              <p className="font-semibold text-gray-900">{order.items.length} item{order.items.length !== 1 ? 's' : ''}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Status</p>
              <p className="font-semibold text-gray-900 capitalize">{order.status}</p>
            </div>
            <div className="pt-3 border-t">
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-600">Total Amount</p>
                <p className="text-2xl font-bold text-emerald-600">₹{order.totalAmount.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Order Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-purple-600" />
            Order Items ({order.items.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {order.items.map((item, index) => (
              <div key={index} className="flex items-start justify-between p-3 border rounded-lg hover:bg-gray-50">
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{item.name}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Qty: {item.quantity} pack{item.quantity !== 1 ? 's' : ''}
                    {item.subQuantity && item.subQuantity > 0 && ` + ${item.subQuantity} sub-unit${item.subQuantity !== 1 ? 's' : ''}`}
                  </p>
                </div>
                <div className="text-right ml-4">
                  <p className="font-bold text-gray-900">₹{(item.price * item.quantity).toFixed(2)}</p>
                  {item.subQuantity && item.subQuantity > 0 && item.pricePerUnit && (
                    <p className="text-sm text-gray-600">+ ₹{(item.pricePerUnit * item.subQuantity).toFixed(2)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Payment Information */}
      {order.paymentMode && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-600" />
              Payment Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-gray-500 uppercase">Payment Mode</p>
              <p className="font-semibold text-gray-900">{order.paymentMode}</p>
            </div>
            {order.transactionId && (
              <div>
                <p className="text-xs text-gray-500 uppercase">Transaction ID</p>
                <p className="font-mono text-sm text-gray-900">{order.transactionId}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4">
        <Button
          variant="outline"
          onClick={handleBackToShopping}
          className="flex-1"
        >
          Continue Shopping
        </Button>
        {order.status !== 'COMPLETED' && (
          <Button
            onClick={() => setShowPaymentModal(true)}
            disabled={completing}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {completing ? 'Processing...' : 'Mark as Completed'}
          </Button>
        )}
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <PaymentModal
          order={order}
          onConfirm={handleCompleteOrder}
          onClose={() => setShowPaymentModal(false)}
          isLoading={completing}
        />
      )}
    </div>
  );
}
