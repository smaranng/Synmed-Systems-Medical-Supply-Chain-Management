import { useState, useEffect } from 'react';
import { Bell, X, ChevronRight } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getToken } from '../services/authService';
import { useNavigate } from 'react-router-dom';

interface NewOrder {
  _id: string;
  orderNumber: string;
  customerId: string;
  customerName?: string;
  totalAmount: number;
  itemCount: number;
  subItemCount: number;
  placedAt: string;
  status?: string;
  cancellationReason?: string;
}

const RECENT_HOURS = 24;
const RECENT_CUTOFF_MS = RECENT_HOURS * 60 * 60 * 1000;

const countItems = (items: any[]) =>
  (items ?? []).reduce((sum: number, item: any) => sum + (item.quantity ?? 0), 0);

const countSubItems = (items: any[]) =>
  (items ?? []).reduce((sum: number, item: any) => sum + (item.subQuantity ?? 0), 0);

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [newOrders, setNewOrders] = useState<NewOrder[]>([]);
  const [actionRequiredOrders, setActionRequiredOrders] = useState<NewOrder[]>([]);
  const [cancelledOrders, setCancelledOrders] = useState<NewOrder[]>([]);
  const [expiredOrders, setExpiredOrders] = useState<NewOrder[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dismissedOrders, setDismissedOrders] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchNewOrders = async () => {
      if (!user?.id) return;

      try {
        const token = getToken();
        if (!token) return;

        const res = await fetch('http://localhost:5202/orders/pharmacy/' + user.id, {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!res.ok) return;

        const data = await res.json();
        const cutoff = Date.now() - RECENT_CUTOFF_MS;

        const placedOrders = data
          .filter((order: any) => order.status === 'PLACED' || order.status === 'PLACED & APPROVED')
          .filter((order: any) => !dismissedOrders.has(order._id))
          .map((order: any) => ({
            _id: order._id,
            orderNumber: order.orderNumber,
            customerId: order.customerId,
            totalAmount: order.totalAmount,
            itemCount: countItems(order.items),
            subItemCount: countSubItems(order.items),
            placedAt: order.placedAt,
            status: order.status,
          }));

        const actionRes = await fetch('http://localhost:5202/orders/pharmacy/' + user.id + '/action-required', {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        let needsAction: NewOrder[] = [];
        if (actionRes.ok) {
          const actionData = await actionRes.json();
          needsAction = actionData
            .filter((order: any) => !dismissedOrders.has(order._id + '_action'))
            .map((order: any) => ({
              _id: order._id + '_action',
              orderNumber: order.orderNumber,
              customerId: order.customerId,
              totalAmount: order.totalAmount,
              itemCount: countItems(order.items),
              subItemCount: countSubItems(order.items),
              placedAt: order.placedAt,
              status: order.status,
            }));
        }

        const cancelled = data
          .filter((order: any) => {
            const reason = order.cancellationReason?.toLowerCase().trim() ?? '';
            const updatedAt = new Date(order.updatedAt ?? order.placedAt).getTime();
            return (
              order.status === 'CANCELLED' &&
              reason !== 'pharmacy did not respond in time' &&
              updatedAt >= cutoff &&
              !dismissedOrders.has(order._id)
            );
          })
          .map((order: any) => ({
            _id: order._id,
            orderNumber: order.orderNumber,
            customerId: order.customerId,
            totalAmount: order.totalAmount,
            itemCount: countItems(order.items),
            subItemCount: countSubItems(order.items),
            placedAt: order.placedAt,
            status: order.status,
            cancellationReason: order.cancellationReason,
          }));

        const expired = data
          .filter((order: any) => {
            const reason = order.cancellationReason?.toLowerCase().trim() ?? '';
            const updatedAt = new Date(order.updatedAt ?? order.placedAt).getTime();
            return (
              order.status === 'TIME_EXPIRED' &&
              reason === 'Customer did not collect order in time' &&
              updatedAt >= cutoff &&
              !dismissedOrders.has(order._id)
            );
          })
          .map((order: any) => ({
            _id: order._id,
            orderNumber: order.orderNumber,
            customerId: order.customerId,
            totalAmount: order.totalAmount,
            itemCount: countItems(order.items),
            subItemCount: countSubItems(order.items),
            placedAt: order.placedAt,
            status: order.status,
            cancellationReason: order.cancellationReason,
          }));

        setNewOrders(placedOrders);
        setActionRequiredOrders(needsAction);
        setCancelledOrders(cancelled);
        setExpiredOrders(expired);
        setUnreadCount(placedOrders.length + needsAction.length + cancelled.length + expired.length);
      } catch (err) {
        console.error('Failed to fetch new orders:', err);
      }
    };

    fetchNewOrders();
    const interval = setInterval(fetchNewOrders, 5000);
    return () => clearInterval(interval);
  }, [user?.id, dismissedOrders]);

  const handleDismissOrder = (orderId: string) => {
    setDismissedOrders(prev => new Set([...prev, orderId]));
    setNewOrders(prev => prev.filter(o => o._id !== orderId));
    setActionRequiredOrders(prev => prev.filter(o => o._id !== orderId));
    setCancelledOrders(prev => prev.filter(o => o._id !== orderId));
    setExpiredOrders(prev => prev.filter(o => o._id !== orderId));
  };

  const handleViewAllOrders = () => {
    setShowDropdown(false);
    setNewOrders([]);
    setActionRequiredOrders([]);
    setCancelledOrders([]);
    setExpiredOrders([]);
    setUnreadCount(0);
    setDismissedOrders(new Set());
    navigate('/orders');
  };

  const handleOrderClick = (orderId: string) => {
    setShowDropdown(false);
    handleDismissOrder(orderId);
    navigate('/orders');
  };

  const hasAny =
    newOrders.length > 0 ||
    actionRequiredOrders.length > 0 ||
    cancelledOrders.length > 0 ||
    expiredOrders.length > 0;

  // ── Reusable item count label ──────────────────────────────────────────────
  const ItemCountLabel = ({ order }: { order: NewOrder }) => {
    const parts: string[] = [];

    if (order.itemCount > 0) {
      parts.push(`${order.itemCount} unit${order.itemCount !== 1 ? 's' : ''}`);
    }

    if (order.subItemCount > 0) {
      parts.push(`${order.subItemCount} sub-unit${order.subItemCount !== 1 ? 's' : ''}`);
    }

    // Fallback: if items array was missing/empty, just show amount
    const summary = parts.length > 0 ? `${parts.join(', ')} • ` : '';

    return (
      <p className="text-xs text-gray-600 mb-1">
        {summary}₹{order.totalAmount.toFixed(2)}
      </p>
    );
  };

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          title="New orders"
        >
          <Bell className="w-6 h-6" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1 -translate-y-1 bg-red-600 rounded-full">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {showDropdown && (
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 rounded-t-lg flex items-center justify-between">
              <div>
                <p className="font-semibold">Orders & Actions</p>
                <p className="text-xs text-blue-100">
                  {unreadCount} update{unreadCount !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={() => setShowDropdown(false)}
                className="text-white hover:bg-blue-600 p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!hasAny ? (
              <div className="p-6 text-center text-gray-500">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              <div className="divide-y max-h-96 overflow-y-auto">

                {newOrders.length > 0 && (
                  <>
                    <div className="px-4 py-2 bg-blue-50 border-b">
                      <p className="text-xs font-semibold text-blue-700 uppercase">New Orders</p>
                    </div>
                    {newOrders.map((order) => (
                      <div
                        key={order._id}
                        className="p-4 hover:bg-gray-50 transition-colors cursor-pointer border-l-4 border-orange-400"
                        onClick={() => handleOrderClick(order._id)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">📍</span>
                              <p className="font-semibold text-sm text-gray-900">{order.orderNumber}</p>
                            </div>
                            <ItemCountLabel order={order} />
                            <p className="text-xs text-gray-400">
                              {new Date(order.placedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-400 mt-1" />
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {actionRequiredOrders.length > 0 && (
                  <>
                    <div className="px-4 py-2 bg-red-50 border-b">
                      <p className="text-xs font-semibold text-red-700 uppercase">⚠️ Action Required</p>
                    </div>
                    {actionRequiredOrders.map((order) => (
                      <div
                        key={order._id}
                        className="p-4 hover:bg-gray-50 transition-colors cursor-pointer border-l-4 border-red-400"
                        onClick={() => handleOrderClick(order._id)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">⚠️</span>
                              <p className="font-semibold text-sm text-gray-900">{order.orderNumber}</p>
                            </div>
                            <ItemCountLabel order={order} />
                            <p className="text-xs text-gray-400">
                              {new Date(order.placedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-400 mt-1" />
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {cancelledOrders.length > 0 && (
                  <>
                    <div className="px-4 py-2 bg-red-50 border-b">
                      <p className="text-xs font-semibold text-red-700 uppercase">🚫 Cancelled by Customer</p>
                    </div>
                    {cancelledOrders.map((order) => (
                      <div
                        key={order._id}
                        className="p-4 hover:bg-gray-50 transition-colors cursor-pointer border-l-4 border-red-400"
                        onClick={() => handleOrderClick(order._id)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">🚫</span>
                              <p className="font-semibold text-sm text-gray-900">{order.orderNumber}</p>
                            </div>
                            <ItemCountLabel order={order} />
                            <p className="text-xs text-red-500">{order.cancellationReason}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-400 mt-1" />
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {expiredOrders.length > 0 && (
                  <>
                    <div className="px-4 py-2 bg-orange-50 border-b">
                      <p className="text-xs font-semibold text-orange-700 uppercase">⏰ Pickup Expired</p>
                    </div>
                    {expiredOrders.map((order) => (
                      <div
                        key={order._id}
                        className="p-4 hover:bg-gray-50 transition-colors cursor-pointer border-l-4 border-orange-400"
                        onClick={() => handleOrderClick(order._id)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">⏰</span>
                              <p className="font-semibold text-sm text-gray-900">{order.orderNumber}</p>
                            </div>
                            <ItemCountLabel order={order} />
                            <p className="text-xs text-orange-500">Customer did not collect order in time</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-400 mt-1" />
                        </div>
                      </div>
                    ))}
                  </>
                )}

              </div>
            )}

            {hasAny && (
              <div className="border-t p-3 bg-gray-50 rounded-b-lg">
                <button
                  onClick={handleViewAllOrders}
                  className="w-full text-center text-sm font-semibold text-blue-600 hover:text-blue-800 py-2 px-3 rounded hover:bg-blue-50 transition-colors"
                >
                  View All Orders
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}