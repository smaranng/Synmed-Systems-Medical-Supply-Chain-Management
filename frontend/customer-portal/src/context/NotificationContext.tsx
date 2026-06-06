import { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';
import { pharmacyService } from '../services/pharmacyService';
import { useAuth } from '../hooks/useAuth';

interface Order {
  _id: string;
  orderNumber: string;
  status: 'PLACED' | 'APPROVED' | 'PLACED & APPROVED' | 'COMPLETED' | 'REJECTED' | 'TIME_EXPIRED' | 'CANCELLED';
  pharmaID: string;
  pharmacyName?: string;
  placedAt: string;
  updatedAt?: string;
}

interface OrderNotification {
  orderId: string;
  orderNumber: string;
  status: 'PLACED' | 'APPROVED' | 'PLACED & APPROVED' | 'COMPLETED' | 'REJECTED' | 'TIME_EXPIRED' | 'CANCELLED';
  pharmacyName: string;
  timestamp: Date;
}

interface NotificationContextType {
  notifications: OrderNotification[];
  unreadCount: number;
  refreshNotifications: () => Promise<void>;
  markAllAsRead: () => void;
  dismissNotification: (orderId: string, status?: OrderNotification['status']) => void;
  clearAllNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

// ── Module-level cache: survives remounts, never resets ──────────────────────
const pharmacyNameCache: Record<string, string> = {};

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<OrderNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshNotifications = async () => {
    if (!user?.id) return;

    try {
      const token = authService.getToken();
      if (!token) return;

      const res = await fetch('http://localhost:5202/orders/customer', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!res.ok) return;

      const data = await res.json();

      // Only fetch names for pharmacies not already in the module-level cache
      const uniquePharmacyIds = [...new Set(data.map((o: Order) => o.pharmaID))] as string[];
      const uncached = uniquePharmacyIds.filter(id => !pharmacyNameCache[id]);

      // Fetch all uncached pharmacy names in parallel (not sequentially)
      if (uncached.length > 0) {
        await Promise.all(
          uncached.map(async (pharmacyId) => {
            try {
              const pharmacy = await pharmacyService.getPharmacyById(pharmacyId);
              pharmacyNameCache[pharmacyId] = pharmacy?.name || `Pharmacy ${pharmacyId}`;
            } catch {
              pharmacyNameCache[pharmacyId] = `Pharmacy ${pharmacyId}`;
            }
          })
        );
      }

      const actionStatuses: Order['status'][] = [
        'APPROVED',
        'PLACED & APPROVED',
        'COMPLETED',
        'REJECTED',
        'TIME_EXPIRED',
        'CANCELLED',
      ];

      const newNotifications: OrderNotification[] = data
        .filter((order: Order) => actionStatuses.includes(order.status))
        .filter((order: Order) => localStorage.getItem(`dismissed_${order._id}_${order.status}`) !== 'true')
        .map((order: Order) => ({
          orderId: order._id,
          orderNumber: order.orderNumber,
          status: order.status,
          pharmacyName: pharmacyNameCache[order.pharmaID] ?? `Pharmacy ${order.pharmaID}`,
          timestamp: new Date(order.updatedAt || order.placedAt),
        }));

      setNotifications(newNotifications);
      setUnreadCount(newNotifications.length);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    }
  };

  const markAllAsRead = () => setUnreadCount(0);

  const dismissNotification = (orderId: string, status?: OrderNotification['status']) => {
    setNotifications(prev =>
      prev.filter(n => !(n.orderId === orderId && (!status || n.status === status)))
    );
    localStorage.setItem(`dismissed_${orderId}_${status || ''}`, 'true');
  };

  const clearAllNotifications = () => {
    notifications.forEach(n =>
      localStorage.setItem(`dismissed_${n.orderId}_${n.status}`, 'true')
    );
    setNotifications([]);
    setUnreadCount(0);
  };

  useEffect(() => {
    refreshNotifications();
    const interval = setInterval(refreshNotifications, 15000); // ✅ 15s instead of 1s
    return () => clearInterval(interval);
  }, [user?.id]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        refreshNotifications,
        markAllAsRead,
        dismissNotification,
        clearAllNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used inside NotificationProvider');
  return ctx;
};