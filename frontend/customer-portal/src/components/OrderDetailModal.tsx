import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { X, Eye, Clock } from 'lucide-react';
import { orderService } from '../services/orderService';
import { pharmacyService } from '../services/pharmacyService';
import { Button } from '../components/ui/Button';
import CancelOrderModal from './CancelOrderModal';

function getStatusDisplay(status: string) {
  const map: Record<string, { label: string; color: string }> = {
    PLACED: { label: 'In Transit', color: 'bg-blue-100 text-blue-700' },
    'PLACED & APPROVED': { label: 'Accepted & Yet to receive', color: 'bg-blue-100 text-blue-700' },
    APPROVED: { label: 'Accepted & Yet to receive', color: 'bg-purple-100 text-purple-700' },
    COMPLETED: { label: 'Order Received', color: 'bg-green-100 text-green-700' },
    REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
    TIME_EXPIRED: { label: 'Timed out and Cancelled', color: 'bg-yellow-100 text-yellow-700' },
    CANCELLED: { label: 'Cancelled', color: 'bg-orange-100 text-orange-700' },
  };
  return map[status] || { label: status, color: 'bg-gray-100 text-gray-700' };
}

function getTimelineState(
  status: string,
  hasPrescriptionItems: boolean,
  cancellationReason?: string,
  approvedAt?: string | null
) {
  const pharmacyDidNotRespond =
    status === 'TIME_EXPIRED' &&
    hasPrescriptionItems &&
    cancellationReason === 'Pharmacy did not respond in time';

  const wasEverApproved = !!approvedAt;

  return {
    showInTransit: hasPrescriptionItems,
    inTransitComplete:
      hasPrescriptionItems &&
      ['PLACED', 'PLACED & APPROVED', 'APPROVED', 'COMPLETED', 'CANCELLED', 'REJECTED', 'TIME_EXPIRED'].includes(status),
   acceptedComplete:
  !pharmacyDidNotRespond &&
  (
    ['PLACED & APPROVED', 'APPROVED', 'COMPLETED'].includes(status) ||
    (['CANCELLED', 'TIME_EXPIRED', 'REJECTED'].includes(status) && wasEverApproved)
  ),
    status,
    isSuccess: status === 'COMPLETED',
    isFailed: ['REJECTED', 'CANCELLED', 'TIME_EXPIRED'].includes(status),
  };
}

interface OrderDetailModalProps {
  order: any | null;
  onClose: () => void;
}

function formatDateTime(dateString: string) {
  const date = new Date(dateString);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${dd}-${mm}-${yyyy}, ${hours}:${minutes}`;
}

function PrescriptionModal({
  prescriptionPath,
  onClose,
}: {
  prescriptionPath: string | null;
  onClose: () => void;
}) {
  if (!prescriptionPath) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white border-b">
          <CardTitle>Prescription</CardTitle>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </CardHeader>
        <CardContent className="p-6 text-center">
          <img
            src={`http://localhost:5201${prescriptionPath}`}
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
  );
}

export default function OrderDetailModal({ order, onClose }: OrderDetailModalProps) {
  const [prescriptionView, setPrescriptionView] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<string>('');
  const [isLastHalfHour, setIsLastHalfHour] = useState(false);
  const [beeped, setBeeped] = useState(false);
  const [currentOrder, setCurrentOrder] = useState(order);
  const [pharmacyInfo, setPharmacyInfo] = useState<any | null>(null);
  const [pharmacyLoading, setPharmacyLoading] = useState(false);
  const [pharmacyError, setPharmacyError] = useState<string | null>(null);

  const [showCancelModal, setShowCancelModal] = useState(false);

  const formatAddress = (addr: any): string => {
    if (!addr) return '';
    if (typeof addr === 'string') return addr;
    const parts = [
      addr.line1 || addr.address1 || addr.street,
      addr.line2 || addr.address2,
      addr.city,
      addr.state,
      addr.zip || addr.postalCode || addr.pincode,
      addr.country,
    ].filter(Boolean);
    return parts.join(', ');
  };

  useEffect(() => {
    setCurrentOrder(order);
  }, [order]);

  useEffect(() => {
    const loadPharmacy = async () => {
      if (!currentOrder?.pharmaID) {
        setPharmacyError('No pharmacy ID available');
        return;
      }
      try {
        setPharmacyLoading(true);
        setPharmacyError(null);
        const info = await pharmacyService.getPharmacyById(currentOrder.pharmaID);
        if (info) {
          setPharmacyInfo(info);
        } else {
          setPharmacyError('Pharmacy information not found');
        }
      } catch (err: any) {
        setPharmacyError(err.message || 'Failed to load pharmacy information');
      } finally {
        setPharmacyLoading(false);
      }
    };

    loadPharmacy();
  }, [currentOrder?.pharmaID]);

  const handleCancelSuccess = async () => {
    try {
      const updatedOrders = await orderService.getCustomerOrders();
      const updatedOrder = updatedOrders.find((o: any) => o._id === currentOrder._id);
      if (updatedOrder) {
        setCurrentOrder(updatedOrder);
      }
    } catch (err) {
      console.error('Failed to refresh order after cancellation:', err);
    }
    setShowCancelModal(false);
  };

  if (!currentOrder) return null;

  const items = Array.isArray(currentOrder.items) ? currentOrder.items : [];
  const itemCount = items.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);
  const subUnitCount = items.reduce((sum: number, item: any) => sum + Number(item.subQuantity || 0), 0);
   const formatCount = (count: number, label: string) =>
                        count > 0
                          ? `${count} ${label}${count !== 1 ? "s" : ""}`
                          : "";

  const itemText = formatCount(itemCount, "item");
  const subItemText = formatCount(subUnitCount, "sub-item");

  const combined = [itemText, subItemText].filter(Boolean).join(", ");

  const displayText =
    combined.length > 0
      ? `${combined}`
      : ``;
  const totalAmount = Number(currentOrder.totalAmount ?? 0);
  const { label, color } = getStatusDisplay(currentOrder.status || '');

  const hasPrescriptionItems = items.some((item: any) => item.prescriptionRequired === true);

  const showCancelButton =
    ['PLACED', 'APPROVED', 'PLACED & APPROVED'].includes(currentOrder.status) &&
    !currentOrder.cancelledBy;

  const isOnlinePayment = currentOrder.paymentMode?.endsWith('ONLINE');

  useEffect(() => {
    const expiresAt = currentOrder.expiresAt ? new Date(currentOrder.expiresAt).getTime() : null;
    if (!expiresAt || !['PLACED', 'APPROVED', 'PLACED & APPROVED'].includes(currentOrder.status)) return;

    const tick = async () => {
      const now = Date.now();
      const diff = expiresAt - now;

      if (diff <= 0) {
        try {
          const updatedOrders = await orderService.getCustomerOrders();
          const updatedOrder = updatedOrders.find((o: any) => o._id === currentOrder._id);
          if (updatedOrder) setCurrentOrder(updatedOrder);
        } catch (err) {
          console.error('Failed to refresh order status', err);
        }
        return;
      }

      const hh = Math.max(0, Math.floor(diff / 3600000));
      const mm = Math.max(0, Math.floor((diff % 3600000) / 60000));
      const ss = Math.max(0, Math.floor((diff % 60000) / 1000));
      setRemaining(
        `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`
      );
      const last5Min = diff <= 1 * 60 * 1000 && diff > 0;
      setIsLastHalfHour(last5Min);
      if (last5Min && !beeped && currentOrder.status !== 'COMPLETED') {
        try {
          const audio = new Audio(
            'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAAABkYXRhAAAAAA=='
          );
          audio.play().catch(() => {});
          setBeeped(true);
        } catch {}
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [currentOrder?.expiresAt, currentOrder?.status]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white border-b">
          <CardTitle>Order Summary</CardTitle>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Pharmacy Details */}
          {pharmacyLoading ? (
            <div className="bg-gray-50 border rounded-md p-4">
              <h4 className="font-semibold text-black mb-2">Pharmacy Details</h4>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded animate-pulse w-48"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse w-32"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse w-40"></div>
              </div>
            </div>
          ) : pharmacyError ? (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <h4 className="font-semibold text-red-900 mb-2">Pharmacy Details</h4>
              <p className="text-sm text-red-700">{pharmacyError}</p>
              <p className="text-xs text-gray-500 mt-1">Pharmacy ID: {currentOrder.pharmaID}</p>
            </div>
          ) : pharmacyInfo ? (
            <div className="bg-blue-50 border rounded-md p-4">
              <h4 className="font-semibold text-blue-800 mb-2">Pharmacy Details</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Name</p>
                  <p className="text-gray-800 font-medium">
                    {pharmacyInfo.name || pharmacyInfo.storeName || pharmacyInfo.title || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Phone</p>
                  <p className="text-gray-800 font-medium">
                    {pharmacyInfo.phone || pharmacyInfo.contactNumber || pharmacyInfo.mobile || '—'}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-gray-500 uppercase">Address</p>
                  <p className="text-gray-800 font-medium">
                    {formatAddress(pharmacyInfo.address) ||
                      (typeof pharmacyInfo.address === 'string' ? pharmacyInfo.address : '') ||
                      '—'}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {/* Countdown Timer */}
          {currentOrder.expiresAt &&
            ['PLACED', 'APPROVED', 'PLACED & APPROVED'].includes(currentOrder.status) && (
              <div
                className={`p-3 rounded-md text-sm font-semibold ${
                  isLastHalfHour ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {currentOrder.status === 'PLACED'
                    ? `Time left for pharmacy to respond: ${remaining || '00:05:00'}`
                    : `Time left to receive: ${remaining || '00:13:00'}`}
                </span>
              </div>
            )}

          {/* Order Meta */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase">Order Number</p>
              <p className="text-lg font-semibold text-black">{currentOrder.orderNumber}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Status</p>
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${color}`}>
                {label}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Total Items</p>
              <p className="text-lg font-semibold text-black">
                {displayText}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Total Amount</p>
              <p className="text-lg font-semibold text-black">₹{currentOrder.totalAmount.toFixed(2)}</p>
            </div>
          </div>

          {/* Cancellation details (post-cancel, fee was charged) */}
          {currentOrder.status === 'CANCELLED' && currentOrder.cancellationAmount > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
              <h4 className="font-semibold text-orange-900 mb-2 text-sm">Cancellation Details</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-orange-700">Cancellation Fee:</span>
                  <span className="font-medium text-orange-900">
                    ₹{currentOrder.cancellationAmount.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-orange-700">Status:</span>
                  <span className="font-medium text-orange-900">
                    {currentOrder.cancellationFeePaid ? 'Paid' : 'Pending'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Rejection / Cancellation reason */}
          {(currentOrder.rejectionReason || currentOrder.cancellationReason) && (
            <div
              className={`border rounded-md p-3 ${
                currentOrder.status === 'REJECTED'
                  ? 'bg-red-50 border-red-200'
                  : 'bg-orange-50 border-orange-200'
              }`}
            >
              <h4
                className={`font-semibold mb-1 text-sm ${
                  currentOrder.status === 'REJECTED' ? 'text-red-900' : 'text-orange-900'
                }`}
              >
                {currentOrder.status === 'REJECTED' ? 'Rejection Reason' : 'Cancellation Reason'}
              </h4>
              <p
                className={`text-sm ${
                  currentOrder.status === 'REJECTED' ? 'text-red-700' : 'text-orange-700'
                }`}
              >
                {currentOrder.rejectionReason || currentOrder.cancellationReason}
              </p>
            </div>
          )}

          {/* Timeline */}
          <div className="border-t pt-4">
            {(() => {
              const timeline = getTimelineState(
                currentOrder.status,
                hasPrescriptionItems,
                currentOrder.cancellationReason || currentOrder.rejectionReason,
                currentOrder.approvedAt
              );

              const finalLabel = timeline.isSuccess
                ? 'Completed'
                : currentOrder.status === 'REJECTED'
                ? 'Rejected'
                : currentOrder.status === 'TIME_EXPIRED'
                ? 'Timed out & Cancelled'
                : currentOrder.status === 'CANCELLED'
                ? 'Cancelled'
                : 'Completed';

              const connectorColor = timeline.isFailed ? 'bg-red-200' : 'bg-blue-200';

              const step2Color =
                timeline.isFailed && !timeline.acceptedComplete
                  ? 'bg-red-200 text-red-700'
                  : timeline.acceptedComplete
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-400';

              const finalStepColor = timeline.isSuccess
                ? 'bg-green-600 text-white'
                : timeline.isFailed
                ? 'bg-red-600 text-white'
                : 'bg-gray-200 text-gray-400';

              const finalLabelColor = timeline.isSuccess
                ? 'text-green-700'
                : timeline.isFailed
                ? 'text-red-700'
                : 'text-gray-600';

              if (!timeline.showInTransit) {
                return (
                  <div className="border rounded-md p-4 mb-4 bg-white">
                    <div className="flex items-center justify-between relative">
                      <div className={`absolute top-5 left-[25%] right-[25%] h-1 rounded-full ${connectorColor}`} />
                      <div className="relative z-10 flex flex-col items-center w-1/2">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            timeline.acceptedComplete ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'
                          }`}
                        >
                          1
                        </div>
                        <p className="text-xs mt-2 text-center font-medium">Accepted & Yet to receive</p>
                      </div>
                      <div className="relative z-10 flex flex-col items-center w-1/2">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${finalStepColor}`}>
                          {timeline.isSuccess ? '✓' : timeline.isFailed ? '✕' : '2'}
                        </div>
                        <p className={`text-xs mt-2 text-center font-medium ${finalLabelColor}`}>{finalLabel}</p>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div className="border rounded-md p-4 mb-4 bg-white">
                  <div className="flex items-center justify-between relative">
                    <div className={`absolute top-5 left-[12%] right-[12%] h-1 rounded-full ${connectorColor}`} />
                    <div className="relative z-10 flex flex-col items-center w-1/3">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          timeline.inTransitComplete ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'
                        }`}
                      >
                        1
                      </div>
                      <p className="text-xs mt-2 text-center font-medium">In Transit</p>
                    </div>
                    <div className="relative z-10 flex flex-col items-center w-1/3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${step2Color}`}>2</div>
                      <p className="text-xs mt-2 text-center font-medium">Accepted & Yet to receive</p>
                    </div>
                    <div className="relative z-10 flex flex-col items-center w-1/3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${finalStepColor}`}>
                        {timeline.isSuccess ? '✓' : timeline.isFailed ? '✕' : '3'}
                      </div>
                      <p className={`text-xs mt-2 text-center font-medium ${finalLabelColor}`}>{finalLabel}</p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Order Items */}
            <h4 className="font-semibold text-black mb-3">Order Items</h4>
            <div className="space-y-2">
              {items.map((item: any, idx: number) => {
                const subQty = Number(item.subQuantity || 0);
                return (
                  <div key={idx} className="flex justify-between items-start py-2 border-b last:border-b-0">
                    <div className="flex-1">
                      <p className="font-medium text-black">{item.name}</p>
                      <p className="text-xs text-gray-600">
                        Qty: {item.quantity}
                        {subQty > 0 && (
                          <span className="ml-1 text-gray-600">
                            Sub-Qty: {subQty}
                          </span>
                        )}
                        {item.prescriptionRequired && (
                          <span className="ml-2 text-orange-600 font-medium">Prescription Required</span>
                        )}
                      </p>
                      {item.prescriptionPath && (
                        <button
                          onClick={() => setPrescriptionView(item.prescriptionPath)}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium mt-1 flex items-center gap-1"
                          title="View prescription"
                        >
                          <Eye className="w-3 h-3" />
                          View Prescription
                        </button>
                      )}
                    </div>
                    <p className="font-semibold text-black text-sm">
                      ₹{((item.taxBreakdown?.gross - item.taxBreakdown?.discount) || 0).toFixed(2)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t pt-4 flex justify-between text-md font-semibold text-black">
            <span>Total Amount <span className='text-gray-500 text-xs'>(Rounded off)</span></span>
            <span className="text-blue-800 text-lg">
              ₹{totalAmount.toFixed(2)}
            </span>
          </div>

          {/* Payment Details — visible once the order is marked completed */}
          {currentOrder.status === 'COMPLETED' && currentOrder.paymentMode && (
            <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Payment Details
              </p>
              <div className="mt-2 space-y-1">
                <p className="text-sm text-gray-600">
                  <span className="font-medium text-gray-800">Payment Mode:</span>
                  <span className="font-mono ml-2 text-emerald-600 tracking-wide">
                    {currentOrder.paymentMode}
                  </span>
                </p>
                {isOnlinePayment && currentOrder.transactionId && (
                  <p className="text-xs text-gray-500">
                    <span className="font-medium text-gray-700">Transaction ID:</span>
                    <span className="font-mono ml-2 text-gray-900 tracking-wide break-all">
                      {currentOrder.transactionId}
                    </span>
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="border-t pt-4">
            <p className="text-xs text-gray-500 uppercase">Placed on</p>
            <p className="text-sm text-gray-700">{formatDateTime(currentOrder.placedAt)}</p>
          </div>

          {/* Cancel Order Button */}
          {showCancelButton && (
            <div className="border-t pt-4">
              <Button
                onClick={() => setShowCancelModal(true)}
                variant="outline"
                className="w-full border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
              >
                Cancel Order
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Prescription viewer */}
      <PrescriptionModal
        prescriptionPath={prescriptionView}
        onClose={() => setPrescriptionView(null)}
      />

      {/* Cancellation modal */}
      {showCancelModal && (
        <CancelOrderModal
          order={currentOrder}
          onClose={() => setShowCancelModal(false)}
          onSuccess={handleCancelSuccess}
        />
      )}
    </div>
  );
}