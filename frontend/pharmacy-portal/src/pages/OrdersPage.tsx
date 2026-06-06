import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { orderService, Order, OrderStatus, CustomerDetails } from '../services/orderService';
import { useAuth } from '../hooks/useAuth';
import { X, Eye, ChevronLeft, ChevronRight, Package, Clock, User, CreditCard, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface OrderDetailModalProps {
  order: Order | null;
  onClose: () => void;
  onStatusChange: (orderId: string, status: OrderStatus) => Promise<void>;
  updatingId: string | null;
}

// ─── Completion / Payment Modal ────────────────────────────────────────────────
interface CompletionModalProps {
  order: Order;
  onConfirm: (paymentMode: string, transactionId: string) => Promise<void>;
  onClose: () => void;
  isLoading: boolean;
}

function CompletionModal({ order, onConfirm, onClose, isLoading }: CompletionModalProps) {
  const [method, setMethod] = useState<'ONLINE' | 'CASH'>('ONLINE');
  const [transactionId, setTransactionId] = useState('');
  const [error, setError] = useState('');

  const finalPaymentMode = `PAY_AT_PHARMACY - ${method}`;

  const handleSubmit = async () => {
    setError('');
    if (method === 'ONLINE' && !transactionId.trim()) {
      setError('Please enter a transaction ID for online payments.');
      return;
    }
    await onConfirm(finalPaymentMode, method === 'CASH' ? '' : transactionId.trim());
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
              Payment Mode: <span className="font-bold">{finalPaymentMode}</span>
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
                  onClick={() => { setMethod(opt.value); setTransactionId(''); setError(''); }}
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
                  onChange={e => { setTransactionId(e.target.value); setError(''); }}
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

// ─── Rejection Reason Modal ────────────────────────────────────────────────────
const PLACED_REJECTION_REASONS = [
  'Uploaded prescription by customer not clear',
  'Invalid prescription',
  'Medicines ordered with prescription required not matching with prescription medicines',
  'Other',
];

interface RejectionModalProps {
  order: Order;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
  isLoading: boolean;
}

function RejectionModal({ order, onConfirm, onClose, isLoading }: RejectionModalProps) {
  const isPrescriptionOrder = order.status === 'PLACED';
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [freeReason, setFreeReason] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    let finalReason = '';

    if (isPrescriptionOrder) {
      if (!selectedReason) { setError('Please select a rejection reason.'); return; }
      finalReason = selectedReason === 'Other' ? customReason.trim() : selectedReason;
      if (selectedReason === 'Other' && !customReason.trim()) {
        setError('Please describe the reason.'); return;
      }
    } else {
      finalReason = freeReason.trim();
      if (!finalReason) { setError('Please enter a rejection reason.'); return; }
    }

    await onConfirm(finalReason);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-red-50 to-rose-50">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Reject Order</h2>
              <p className="text-xs text-gray-500">{order.orderNumber}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600">
            {isPrescriptionOrder
              ? 'Select the reason for rejecting this prescription order:'
              : 'Please provide a reason for rejecting this order:'}
          </p>

          {isPrescriptionOrder ? (
            <div className="space-y-2">
              {PLACED_REJECTION_REASONS.map(reason => (
                <label
                  key={reason}
                  className={`flex items-start gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedReason === reason
                      ? 'border-red-400 bg-red-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="rejectionReason"
                    value={reason}
                    checked={selectedReason === reason}
                    onChange={() => { setSelectedReason(reason); setError(''); }}
                    className="mt-0.5 accent-red-500"
                  />
                  <span className="text-sm text-gray-700">{reason}</span>
                </label>
              ))}

              {selectedReason === 'Other' && (
                <textarea
                  value={customReason}
                  onChange={e => { setCustomReason(e.target.value); setError(''); }}
                  placeholder="Describe the rejection reason…"
                  rows={3}
                  className="w-full mt-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent"
                />
              )}
            </div>
          ) : (
            <textarea
              value={freeReason}
              onChange={e => { setFreeReason(e.target.value); setError(''); }}
              placeholder="Enter reason for rejection…"
              rows={4}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent"
            />
          )}

          {error && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {error}
            </p>
          )}
        </div>

        <div className="px-6 py-4 border-t flex gap-3 justify-end bg-gray-50">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? 'Rejecting…' : 'Confirm Rejection'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDateTime(dateString: string) {
  const date = new Date(dateString);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${dd}-${mm}-${yyyy}, ${hours}:${minutes}`;
}

function getStatusDisplay(order: Order): { label: string; color: string } {
  const statusMap: Record<string, { label: string; color: string }> = {
    PLACED: { label: 'In Transit', color: 'bg-blue-100 text-blue-700 hover:bg-transparent' },
    'PLACED & APPROVED': { label: 'Placed and Approved', color: 'bg-blue-100 text-blue-700 hover:bg-transparent' },
    APPROVED: { label: 'Accepted & Yet to receive', color: 'bg-purple-100 text-purple-700 hover:bg-transparent' },
    COMPLETED: { label: 'Accepted & Received', color: 'bg-green-100 text-green-700 hover:bg-transparent' },
    REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-700 hover:bg-transparent' },
    TIME_EXPIRED: { label: 'Timed out and Cancelled', color: 'bg-yellow-100 text-yellow-700 hover:bg-transparent' },
    CANCELLED: { label: 'Cancelled', color: 'bg-orange-100 text-orange-700 hover:bg-transparent' },
  };
  return statusMap[order.status] || { label: order.status.replace(/_/g, ' '), color: 'bg-gray-100 text-gray-700' };
}

// ─── Sub-unit summary helper ───────────────────────────────────────────────────

  function getItemSummary(order: Order): string {
  const itemCount = order.items.reduce((s, i) => s + i.quantity, 0);
  const subUnitCount = order.items.reduce((s, i) => s + ((i as any).subQuantity || 0), 0);

  const formatCount = (count: number, label: string) =>
    count > 0 ? `${count} ${label}${count !== 1 ? "s" : ""}` : "";

  const itemText = formatCount(itemCount, "item");
  const subItemText = formatCount(subUnitCount, "sub-item");

  const combined = [itemText, subItemText].filter(Boolean).join(", ");

  return combined.length > 0
    ? `${combined}`
    : ``;
}

// ─── Order Detail Modal ────────────────────────────────────────────────────────

function OrderDetailModal({ order, onClose, onStatusChange, updatingId }: OrderDetailModalProps) {
  const [prescriptionView, setPrescriptionView] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [customer, setCustomer] = useState<CustomerDetails | null>(null);

  useEffect(() => {
    if (!order) return;
    orderService.getCustomerDetails(order.customerId).then(setCustomer);
  }, [order?.customerId]);

  useEffect(() => {
    if (!order) return;
    const THRESHOLD = 5 * 60 * 1000;
    const update = () => {
      if (order.status === 'PLACED') {
        const remaining = THRESHOLD - (Date.now() - new Date(order.placedAt).getTime());
        if (remaining > 0) {
          const m = Math.floor(remaining / 60000);
          const s = Math.floor((remaining % 60000) / 1000);
          setTimeRemaining(`${m}m ${s}s`);
        } else {
          setTimeRemaining('Expired - No action taken');
        }
      } else {
        setTimeRemaining('');
      }
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [order]);

  if (!order) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Order Summary</CardTitle>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X className="w-5 h-5" />
            </button>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Customer Details */}
            <div className="border rounded-lg p-4 bg-blue-50 shadow-sm">
              <p className="text-xs font-semibold uppercase text-blue-500 mb-3 mt-2 ml-2 tracking-wide">
                Customer Details
              </p>
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex flex-col">
                  <span className="text-base font-semibold text-gray-900">{customer?.name || 'Unknown Customer'}</span>
                  <span className="text-sm text-gray-500 mt-1">{customer?.phone || 'No phone number available'}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase">Order Number</p>
                <p className="text-lg font-semibold text-black">{order.orderNumber}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Total Items</p>
                <p className="text-lg font-semibold text-black">{getItemSummary(order)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Total Amount</p>
                <p className="text-lg font-semibold text-black">₹{order.totalAmount.toFixed(2)}</p>
              </div>
            </div>

            {order.status === 'PLACED' && timeRemaining && (
              <div className={`flex items-center gap-2 p-3 rounded-lg ${
                timeRemaining.includes('Expired') ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
              }`}>
                <Clock className="w-5 h-5" />
                <div className="flex-1">
                  <p className="font-semibold text-sm">
                    {timeRemaining.includes('Expired') ? 'Action Required' : 'Time to Respond'}
                  </p>
                  <p className="text-xs">
                    {timeRemaining.includes('Expired')
                      ? 'This order has exceeded the response time limit'
                      : `Time remaining: ${timeRemaining}`}
                  </p>
                </div>
              </div>
            )}
            {(order.status === 'APPROVED' || order.status === 'PLACED & APPROVED') && order.expiresAt && (() => {
                const remaining = new Date(order.expiresAt).getTime() - Date.now();
                const isExp = remaining <= 0;
                const h = Math.floor(remaining / 3600000);
                const m = Math.floor((remaining % 3600000) / 60000);
                const s = Math.floor((remaining % 60000) / 1000);
                const label = isExp ? 'Pickup expired' : h > 0 ? `${h}h ${m}m remaining` : `${m}m ${s}s remaining`;
                return (
                  <div className={`flex items-center gap-2 p-3 rounded-lg ${isExp ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                    <Clock className="w-5 h-5" />
                    <div>
                      <p className="font-semibold text-sm">Order Pickup Time for Customer</p>
                      <p className="text-xs">{label}</p>
                    </div>
                  </div>
                );
              })()}
            <div className="border-t pt-4">
              <h4 className="font-semibold text-black mb-3">Order Items</h4>
              <div className="space-y-3">
                {order.items.map((item, idx) => {
                  const subQty = (item as any).subQuantity || 0;
                  return (
                    <div key={idx} className="flex justify-between items-start py-2 border-b last:border-b-0 pb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-black">{item.name}</p>
                          {item.prescriptionPath && (
                            <button
                              onClick={() => setPrescriptionView(item.prescriptionPath!)}
                              className="text-blue-600 hover:text-blue-800 text-xs font-medium flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" /> View Prescription
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-gray-700">
                           Qty: {item.quantity}
                        {subQty > 0 && (
                          <span className="ml-1 text-gray-600">
                            Sub-Qty: {subQty}
                          </span>
                          )}
                        </p>
                      </div>
                        <p className="font-semibold text-black">₹{(Number(item.taxBreakdown?.gross || 0) - Number(item.taxBreakdown?.discount || 0)).toFixed(2)}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-xs text-gray-500 uppercase">Placed on</p>
              <p className="text-sm text-gray-900 mt-2">{formatDateTime(order.placedAt)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Current Status</p>
              <Badge className={`${getStatusDisplay(order).color} mt-2`}>{getStatusDisplay(order).label}</Badge>
            </div>

            {(order as any).paymentMode && order.status === 'COMPLETED' && (
              <div className="border-t pt-4 space-y-2">
                <p className="text-xs text-gray-500 uppercase">Payment Details</p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium text-gray-800">Payment Mode:</span>{" "}
                  <span className="font-mono ml-1 text-emerald-600 tracking-wide">
                    {order.paymentMode}
                  </span>
                </p>
                {(order as any).transactionId && (
                  <p className="text-xs text-gray-500">
                    <span className="font-medium text-gray-700">Transaction ID:</span>{" "}
                    <span className="font-mono ml-1 text-gray-900 tracking-wide">
                      {(order as any).transactionId}
                    </span>
                  </p>
                )}
              </div>
            )}
            {(order as any).rejectionReason && (
              <div className="border-t pt-4">
                <p className="text-xs text-gray-500 uppercase">Rejection Reason</p>
                <p className="text-sm text-red-600 mt-1">{(order as any).rejectionReason}</p>
              </div>
            )}
            {(order.status === 'CANCELLED' || order.status === 'TIME_EXPIRED') && order.cancellationReason && (
              <div className="border-t pt-4">
                <p className="text-xs text-gray-500 uppercase">
                  {order.status === 'TIME_EXPIRED' ? 'Timeout Reason' : 'Cancellation Reason'}
                </p>
                <p className={`text-sm mt-1 ${order.status === 'TIME_EXPIRED' ? 'text-orange-600' : 'text-red-600'}`}>
                  {order.cancellationReason}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {prescriptionView && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 z-[60]">
          <Card className="w-full max-w-4xl h-[90vh] rounded-2xl shadow-2xl bg-white flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between px-4 sm:px-6 py-4 border-b flex-shrink-0">
              <CardTitle className="text-lg font-semibold">Prescription</CardTitle>
              <button onClick={() => setPrescriptionView(null)} className="text-gray-500 hover:text-gray-700 transition">
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent className="flex justify-center items-center flex-1 overflow-auto p-4 sm:p-6">
              <img
                src={`http://localhost:5201${prescriptionView}`}
                alt="Prescription"
                className="w-full h-full object-contain rounded-xl shadow-lg"
                style={{ minHeight: '300px', maxHeight: '100%' }}
                onError={(e: any) => {
                  e.target.src =
                    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23f0f0f0" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" font-size="16" fill="%23999" text-anchor="middle" dominant-baseline="middle"%3EPrescription image not found%3C/text%3E%3C/svg%3E';
                }}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

// ─── Time Remaining Cell ───────────────────────────────────────────────────────

function TimeRemainingCell({ order }: { order: Order }) {
  const [timeRemaining, setTimeRemaining] = useState('');
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const PLACED_THRESHOLD = 5 * 60 * 1000;

    const update = () => {
      if (order.status === 'PLACED') {
        const remaining = PLACED_THRESHOLD - (Date.now() - new Date(order.placedAt).getTime());
        if (remaining > 0) {
          const m = Math.floor(remaining / 60000);
          const s = Math.floor((remaining % 60000) / 1000);
          setTimeRemaining(`${m}m ${s}s to respond`);
          setIsExpired(false);
        } else {
          setTimeRemaining('Response time expired');
          setIsExpired(true);
        }

      } else if (
        (order.status === 'APPROVED' || order.status === 'PLACED & APPROVED') &&
        order.expiresAt
      ) {
        const remaining = new Date(order.expiresAt).getTime() - Date.now();
        if (remaining > 0) {
          const h = Math.floor(remaining / 3600000);
          const m = Math.floor((remaining % 3600000) / 60000);
          const s = Math.floor((remaining % 60000) / 1000);
          setTimeRemaining(
            h > 0 ? `${h}h ${m}m for pickup` : `${m}m ${s}s for pickup`
          );
          setIsExpired(false);
        } else {
          setTimeRemaining('Pickup time expired');
          setIsExpired(true);
        }

      } else {
        setTimeRemaining('');
        setIsExpired(false);
      }
    };

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [order]);

  if (!timeRemaining) return null;

  return (
    <div className={`flex items-center gap-1 w-max text-xs px-2 py-1 rounded mt-1 ${
      isExpired ? 'text-red-600 bg-red-100' : 
      order.status === 'PLACED' ? 'text-orange-600 bg-orange-100' :
      'text-blue-600 bg-blue-100'
    }`}>
      <Clock className="w-3 h-3" />
      <span className="font-medium">{timeRemaining}</span>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [userCache, setUserCache] = useState<{ [key: string]: CustomerDetails | null }>({});
  const [nowTick, setNowTick] = useState<number>(Date.now());
  const [filterType, setFilterType] = useState<'all' | 'completed' | 'noaction' | 'notyet' | 'timed out and cancelled' | 'cancelled'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;

  const [completionModal, setCompletionModal] = useState<Order | null>(null);
  const [rejectionModal, setRejectionModal] = useState<Order | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    loadOrders();
    const tickInterval = setInterval(() => setNowTick(Date.now()), 1000);
    const refreshInterval = setInterval(() => {
      loadOrders().catch(err => console.error('Safety-net refresh failed:', err));
    }, 60000);
    return () => { clearInterval(tickInterval); clearInterval(refreshInterval); };
  }, [user?.id]);

  useEffect(() => {
    if (!orders.length) return;
    const checkApprovedOrderExpiry = async () => {
      const now = Date.now();
      for (const order of orders) {
        if (order.status === 'APPROVED' && order.expiresAt) {
          const expiresAt = new Date(order.expiresAt).getTime();
          if (expiresAt - now <= 10000 && expiresAt - now > -5000) {
            try {
              const token = localStorage.getItem('token');
              if (token) {
                const res = await fetch(`http://localhost:5202/orders/${order._id}/check-expiry`, {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                });
                if (res.ok) {
                  const updatedOrder = await res.json();
                  setOrders(prev => prev.map(o => (o._id === updatedOrder._id ? updatedOrder : o)));
                }
              }
            } catch (err) {
              console.error('Failed to check order expiry:', err);
            }
          }
        }
      }
    };
    checkApprovedOrderExpiry();
  }, [nowTick, orders]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await orderService.getOrders(user!.id);
      setOrders(data);
      setCurrentPage(1);
      const uniqueCustomerIds = [...new Set(data.map(o => o.customerId))];
      const newCache = { ...userCache };
      for (const cid of uniqueCustomerIds) {
        if (!newCache[cid]) newCache[cid] = await orderService.getCustomerDetails(cid);
      }
      setUserCache(newCache);
    } catch (err: any) {
      setError(err?.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (
    orderId: string,
    status: OrderStatus,
    extra?: { paymentMode?: string; transactionId?: string; rejectionReason?: string }
  ) => {
    try {
      setUpdatingId(orderId);
      const updated = await orderService.updateStatus(orderId, status, extra);
      setOrders(prev => prev.map(o => (o._id === orderId ? updated : o)));
      if (selectedOrder?._id === orderId) setSelectedOrder(updated);
    } catch (err: any) {
      alert(err?.message || 'Failed to update status');
    } finally {
      setUpdatingId(null);
    }
  };

  const initiateCompletion = (order: Order) => setCompletionModal(order);

  const confirmCompletion = async (paymentMode: string, transactionId: string) => {
    if (!completionModal) return;
    await handleStatusChange(completionModal._id, 'COMPLETED', { paymentMode, transactionId });
    setCompletionModal(null);
  };

  const initiateRejection = (order: Order) => setRejectionModal(order);

  const confirmRejection = async (rejectionReason: string) => {
    if (!rejectionModal) return;
    await handleStatusChange(rejectionModal._id, 'REJECTED', { rejectionReason });
    setRejectionModal(null);
  };

  const checkPharmacyInactivity = (order: Order) => {
    const THRESHOLD = 5 * 60 * 1000;
    if (order.status !== 'PLACED') return false;
    return nowTick - new Date(order.placedAt).getTime() > THRESHOLD;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Customer Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

          {/* Filter Buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            {([
              { key: 'all', label: 'All Orders' },
              { key: 'noaction', label: 'No Action Taken' },
              { key: 'notyet', label: 'Not Yet Completed' },
              { key: 'completed', label: 'Completed' },
              { key: 'timed out and cancelled', label: 'Timed out and Cancelled' },
              { key: 'cancelled', label: 'Cancelled/Rejected' },
            ] as const).map(f => (
              <button
                key={f.key}
                onClick={() => { setFilterType(f.key); setCurrentPage(1); }}
                className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                  filterType === f.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">Order Number</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">Items</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">Total</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="py-6 px-4 text-center text-gray-500" colSpan={5}>Loading orders…</td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td className="py-6 px-4 text-center text-gray-500" colSpan={5}>No orders yet.</td>
                  </tr>
                ) : (
                  (() => {
                    const filteredOrders = orders.filter(order => {
                      switch (filterType) {
                        case 'completed': return order.status === 'COMPLETED';
                        case 'timed out and cancelled': return order.status === 'TIME_EXPIRED';
                        case 'cancelled': return ['CANCELLED', 'REJECTED', 'EXPIRED'].includes(order.status);
                        case 'noaction': return checkPharmacyInactivity(order);
                        case 'notyet': return order.status === 'APPROVED' && !checkPharmacyInactivity(order);
                        default: return true;
                      }
                    });
                    const sortedOrders = [...filteredOrders].sort(
                      (a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime()
                    );
                    const totalPages = Math.ceil(sortedOrders.length / itemsPerPage);
                    const paginatedOrders = sortedOrders.slice(
                      (currentPage - 1) * itemsPerPage,
                      currentPage * itemsPerPage
                    );

                    return (
                      <>
                        {paginatedOrders.length === 0 ? (
                          <tr>
                            <td className="py-6 px-4 text-center text-gray-500" colSpan={5}>No orders found for this filter.</td>
                          </tr>
                        ) : (
                          paginatedOrders.map(order => {
                            const isInactive = checkPharmacyInactivity(order);
                            return (
                              <tr key={order._id} className={`border-b hover:bg-gray-50 ${isInactive ? 'bg-red-50' : ''}`}>
                                <td className="py-3 px-4">
                                  <div className="flex items-start gap-3">
                                    <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                                      <Package className="h-5 w-5 text-green-600" />
                                    </div>
                                    <div>
                                      <p className="font-medium">{order.orderNumber}</p>
                                      <p className="text-sm text-gray-500 mt-1">Placed {formatDateTime(order.placedAt)}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-sm">{getItemSummary(order)}</td>
                                <td className="py-3 px-4 font-semibold">₹{order.totalAmount.toFixed(2)}</td>
                                <td className="py-3 px-4">
                                  {(() => {
                                    const { label, color } = getStatusDisplay(order);
                                    return <Badge className={color}>{label}</Badge>;
                                  })()}
                                  
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex flex-col gap-2">
                                    <TimeRemainingCell order={order} />
                                    <div className="flex gap-2 flex-wrap items-center">
                                      <Button size="sm" variant="outline" onClick={() => setSelectedOrder(order)}>
                                        View Order
                                      </Button>

                                      {order.status === 'PLACED' && (
                                        <>
                                          <Button
                                            size="sm"
                                            onClick={() => handleStatusChange(order._id, 'APPROVED')}
                                            disabled={!!updatingId}
                                          >
                                            {updatingId === order._id ? 'Approving…' : 'Approve'}
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => initiateRejection(order)}
                                            disabled={!!updatingId}
                                          >
                                            Reject
                                          </Button>
                                        </>
                                      )}

                                      {order.status === 'PLACED & APPROVED' && (
                                        <>
                                          <Button
                                            size="sm"
                                            className="bg-blue-400 hover:bg-blue-500 text-white"
                                            onClick={() => initiateCompletion(order)}
                                            disabled={!!updatingId}
                                          >
                                            Mark Completed
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => initiateRejection(order)}
                                            disabled={!!updatingId}
                                          >
                                            Reject
                                          </Button>
                                        </>
                                      )}

                                      {order.status === 'APPROVED' && (
                                        <Button
                                          size="sm"
                                          className="bg-blue-400 hover:bg-blue-500 text-white"
                                          onClick={() => initiateCompletion(order)}
                                          disabled={!!updatingId}
                                        >
                                          Mark Completed
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}

                        {/* Pagination */}
                        <tr>
                          <td colSpan={5} className="py-4 px-4 border-t">
                            <div className="flex flex-col gap-4">
                              <div className="text-sm text-gray-600">
                                Showing {paginatedOrders.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}–
                                {Math.min(currentPage * itemsPerPage, filteredOrders.length)} of {filteredOrders.length} orders
                              </div>
                              {totalPages > 1 && (
                                <div className="flex justify-end items-center gap-2">
                                  <button
                                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                    disabled={currentPage === 1}
                                    className="flex items-center gap-1 px-3 py-2 rounded border border-gray-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                                  >
                                    <ChevronLeft className="h-4 w-4" />
                                    <span>Previous</span>
                                  </button>
                                  <div className="flex gap-1">
                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                      <button
                                        key={page}
                                        onClick={() => setCurrentPage(page)}
                                        className={`px-3 py-2 rounded text-sm font-medium transition ${
                                          currentPage === page
                                            ? 'bg-emerald-600 text-white'
                                            : 'border border-gray-300 text-gray-700 hover:bg-gray-100'
                                        }`}
                                      >
                                        {page}
                                      </button>
                                    ))}
                                  </div>
                                  <button
                                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                    disabled={currentPage === totalPages}
                                    className="flex items-center gap-1 px-3 py-2 rounded border border-gray-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                                  >
                                    <span>Next</span>
                                    <ChevronRight className="h-4 w-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      </>
                    );
                  })()
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <OrderDetailModal
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onStatusChange={handleStatusChange}
        updatingId={updatingId}
      />

      {completionModal && (
        <CompletionModal
          order={completionModal}
          onConfirm={confirmCompletion}
          onClose={() => setCompletionModal(null)}
          isLoading={updatingId === completionModal._id}
        />
      )}

      {rejectionModal && (
        <RejectionModal
          order={rejectionModal}
          onConfirm={confirmRejection}
          onClose={() => setRejectionModal(null)}
          isLoading={updatingId === rejectionModal._id}
        />
      )}
    </div>
  );
}