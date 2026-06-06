import { useState, useEffect } from 'react';
import { X, AlertTriangle, Clock, CreditCard } from 'lucide-react';
import { Button } from './ui/Button';
import { orderService } from '../services/orderService';

interface CancelOrderModalProps {
  order: any;
  onClose: () => void;
  /** Called after the order has been successfully cancelled (free or paid). */
  onSuccess: () => void;
}

export default function CancelOrderModal({ order, onClose, onSuccess }: CancelOrderModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancellationInfo, setCancellationInfo] = useState<any>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);

  useEffect(() => {
    checkCancellationFee();
  }, [order]);

  /**
   * Call the cancel endpoint immediately on mount.
   * - If it's free, the order is already cancelled and we can call onSuccess.
   * - If it requires payment, we store the fee info and show the payment screen.
   */
  const checkCancellationFee = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await orderService.cancelOrder(order._id);

      if (response.requiresPayment) {
        setCancellationInfo(response);
      } else {
        // Free cancellation — order is already cancelled on the server
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      console.error('Failed to check cancellation fee:', err);
      setError(err.message || 'Failed to check cancellation fee');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPayment = async () => {
    try {
      setProcessingPayment(true);
      setError(null);

      // Simulate payment gateway (replace with real gateway in production)
      await new Promise((resolve) => setTimeout(resolve, 1500));

      await orderService.confirmCancellationPayment(
        order._id,
        cancellationInfo.cancellationAmount,
        cancellationInfo.cancellationFeePercentage
      );

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to process cancellation payment:', err);
      setError(err.message || 'Failed to process payment');
    } finally {
      setProcessingPayment(false);
    }
  };

  const formatMinutesElapsed = (minutes: number): string => {
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours} hour${hours !== 1 ? 's' : ''}`;
    return `${hours} hour${hours !== 1 ? 's' : ''} ${mins} minute${mins !== 1 ? 's' : ''}`;
  };

  const getFeeColor = (percentage: number): string => {
    if (percentage === 0) return 'text-green-600';
    if (percentage <= 25) return 'text-yellow-600';
    if (percentage <= 50) return 'text-orange-600';
    return 'text-red-600';
  };

  const getFeeMessage = (percentage: number): string => {
    if (percentage === 0) return 'Free cancellation available!';
    if (percentage === 25) return 'Low cancellation fee';
    if (percentage === 50) return 'Medium cancellation fee';
    return 'Full order amount will be charged';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">Cancel Order</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
            disabled={loading || processingPayment}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              <p className="mt-2 text-gray-600">Checking cancellation terms...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-red-900">Error</h3>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          ) : cancellationInfo && !showPayment ? (
            <>
              {/* Order summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">Order Details</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Order Number:</span>
                    <span className="font-medium text-gray-900">{order.orderNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Amount:</span>
                    <span className="font-medium text-gray-900">
                      ₹{cancellationInfo.totalAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Time since approval:</span>
                    <span className="font-medium text-gray-900">
                      {formatMinutesElapsed(cancellationInfo.minutesElapsed)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Fee breakdown */}
              <div
                className={`border-2 rounded-lg p-4 ${
                  cancellationInfo.cancellationFeePercentage === 0
                    ? 'border-green-200 bg-green-50'
                    : cancellationInfo.cancellationFeePercentage <= 50
                    ? 'border-orange-200 bg-orange-50'
                    : 'border-red-200 bg-red-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2 rounded-full ${
                      cancellationInfo.cancellationFeePercentage === 0
                        ? 'bg-green-100'
                        : cancellationInfo.cancellationFeePercentage <= 50
                        ? 'bg-orange-100'
                        : 'bg-red-100'
                    }`}
                  >
                    <Clock
                      className={`w-5 h-5 ${getFeeColor(cancellationInfo.cancellationFeePercentage)}`}
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className={`font-semibold ${getFeeColor(cancellationInfo.cancellationFeePercentage)}`}>
                      {getFeeMessage(cancellationInfo.cancellationFeePercentage)}
                    </h3>
                    <p className="text-sm text-gray-700 mt-1">
                      Cancellation fee:{' '}
                      <span className="font-semibold">
                        {cancellationInfo.cancellationFeePercentage}%
                      </span>
                    </p>
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Amount to pay:</span>
                        <span
                          className={`text-2xl font-bold ${getFeeColor(
                            cancellationInfo.cancellationFeePercentage
                          )}`}
                        >
                          ₹{cancellationInfo.cancellationAmount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Policy */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2 text-sm">Cancellation Policy:</h4>
                <ul className="space-y-1 text-xs text-blue-800">
                  <li>• 0–3 minutes: Free cancellation</li>
                  <li>• 3–6 minutes: 25% cancellation fee</li>
                  <li>• 6–9 minutes: 50% cancellation fee</li>
                  <li>• After 9 minutes: 100% cancellation fee</li>
                  {/* <li>• 0–30 minutes (<0.5hrs): Free cancellation</li>
                  <li>• 30–60 minutes (0.5 hrs - 1 hr): 25% cancellation fee</li>
                  <li>• 60–90 minutes (1hr - 1.5 hrs): 50% cancellation fee</li>
                  <li>• After 90 minutes (>1.5 hrs): 100% cancellation fee</li> */}
                </ul>
              </div>

              {/* Warning */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-800">
                    <strong>Warning:</strong> This action cannot be undone. Your stock will be
                    returned to the pharmacy.
                  </p>
                </div>
              </div>
            </>
          ) : showPayment && cancellationInfo ? (
            <>
              {/* Payment screen */}
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-6">
                <div className="flex items-center justify-center mb-4">
                  <div className="p-3 bg-white rounded-full shadow-md">
                    <CreditCard className="w-8 h-8 text-blue-600" />
                  </div>
                </div>
                <h3 className="text-center font-semibold text-gray-900 mb-2">Payment Required</h3>
                <p className="text-center text-sm text-gray-600 mb-4">
                  Please complete the payment to cancel your order
                </p>
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-600">
                      Cancellation Fee ({cancellationInfo.cancellationFeePercentage}%)
                    </span>
                    <span className="font-semibold text-gray-900">
                      ₹{cancellationInfo.cancellationAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="h-px bg-gray-200 my-2" />
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-900">Total Amount</span>
                    <span className="text-2xl font-bold text-blue-600">
                      ₹{cancellationInfo.cancellationAmount.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> In a production environment, you would be redirected to a
                  secure payment gateway.
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        {!loading && !error && cancellationInfo && (
          <div className="flex gap-3 p-6 border-t bg-gray-50">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={processingPayment}
            >
              Keep Order
            </Button>

            {!showPayment ? (
              <Button
                onClick={() => setShowPayment(true)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                Proceed to Cancel
              </Button>
            ) : (
              <Button
                onClick={handleConfirmPayment}
                disabled={processingPayment}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {processingPayment ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Processing...
                  </span>
                ) : (
                  'Confirm Payment & Cancel'
                )}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}