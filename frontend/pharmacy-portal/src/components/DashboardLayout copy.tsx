import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link, useLocation } from 'react-router-dom';
import { Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  FileText,
  LogOut,
  Bell,
  Settings,
  Plus,
  Network,
  PackageSearch,
  Radar,
  ShoppingBasket,
  BaggageClaim
  
} from 'lucide-react';

import { useAuth } from '../hooks/useAuth';
import { CartProvider } from '../context/CartContext';
import { orderService, Order } from '../services/orderService';
import { Badge } from '../components/ui/Badge';

interface DashboardLayoutProps {
  children: React.ReactNode;
}


const SEEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
type NotifiableStatus = 'PLACED' | 'PLACED & APPROVED' | 'APPROVED' | 'CANCELLED' | 'TIME_EXPIRED';

type SeenMap = Record<string, { status: string; seenAt: number }>;

function loadSeen(): SeenMap {
  try {
    const stored = localStorage.getItem('notif_seen_v4');
    if (!stored) return {};
    const parsed: SeenMap = JSON.parse(stored);
    const now = Date.now();
    // Prune very old entries to avoid unbounded growth
    return Object.fromEntries(
      Object.entries(parsed).filter(([, v]) => now - v.seenAt < SEEN_EXPIRY_MS)
    );
  } catch { return {}; }
}

function saveSeen(map: SeenMap) {
  localStorage.setItem('notif_seen_v4', JSON.stringify(map));
}

const NOTIFIABLE_STATUSES: NotifiableStatus[] = [
  'PLACED', 'PLACED & APPROVED', 'APPROVED', 'CANCELLED', 'TIME_EXPIRED'
];

function shouldNotify(order: Order, seen: SeenMap): boolean {
  if (!NOTIFIABLE_STATUSES.includes(order.status as NotifiableStatus)) return false;

  // Filter out auto-cancelled by pharmacy logic
  if (order.status === 'CANCELLED') {
    const reason = order.cancellationReason?.toLowerCase().trim() ?? '';
    if (reason === 'pharmacy did not respond in time') return false;
  }

  // Filter out system-expired (only show customer-caused expiry)
  if (order.status === 'TIME_EXPIRED') {
    const reason = order.cancellationReason?.toLowerCase().trim() ?? '';
    if (reason !== 'Customer did not collect order in time') return false;
  }

  const prev = seen[order._id];
  // New order — never seen before
  if (!prev) return true;
  // Status changed since last time we showed it
  if (prev.status !== order.status) return true;
  // Same status, already shown → no notification
  return false;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Order[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  // seen tracks: orderId → { status, seenAt } — persisted to localStorage
  const [seen, setSeen] = useState<SeenMap>(() => loadSeen());
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => { saveSeen(seen); }, [seen]);

  const handleLogout = () => { logout(); navigate('/'); };

  const badgeVariant: Record<Order['status'], 'success' | 'secondary' | 'destructive' | 'default'> = {
    PLACED: 'secondary',
    APPROVED: 'secondary',
    COMPLETED: 'success',
    REJECTED: 'destructive',
    TIME_EXPIRED: 'destructive',
    CANCELLED: 'destructive',
    'PLACED & APPROVED': 'secondary'
  };

  const navigation = [
    { name: 'Dashboard',    href: '/dashboard',             icon: LayoutDashboard, exact: true },
    { name: 'Inventory',    href: '/dashboard/inventory',   icon: Package },
    { name: 'Procurement',  href: '/dashboard/procurement', icon: BaggageClaim},
    { name: 'ICN Exchange', href: `/dashboard/icn${user?.pharmaID ? `/${user.pharmaID}` : ''}`,         icon: Network },
    { name: 'Find Distributors', href: '/dashboard/distributor',  icon: Users },
    //{ name: 'Carts',       href: '/dashboard/carts',      icon: ShoppingCart },
    // ── Offline Purchase: pharmaID appended so SearchPage can scope inventory ──
    { name: 'Offline Purchase', href: `/dashboard/offline-orders${user?.pharmaID ? `/${user.pharmaID}` : ''}`, icon: PackageSearch },
    { name: 'Customer Orders',       href: '/dashboard/orders',      icon: FileText }, 
    { name: 'Order Tracking',     href: '/dashboard/order',       icon: Radar },
    { name: 'Settings',     href: '/dashboard/settings',    icon: Settings },
  ];

  const loadNotifications = async () => {
    if (!user?.id) return;
    try {
      setNotificationsLoading(true);
      const allOrders = await orderService.getOrders(user.id);

      // Load latest seen from localStorage so we always compare against persisted state
      const currentSeen = loadSeen();

      const pending = allOrders.filter(order => shouldNotify(order, currentSeen));
      setNotifications(pending);
    } catch (err) {
      console.error('Notification fetch failed', err);
    } finally {
      setNotificationsLoading(false);
    }
  };

  const markAsSeen = (order: Order) => {
    setSeen(prev => {
      const next = { ...prev, [order._id]: { status: order.status, seenAt: Date.now() } };
      saveSeen(next);
      return next;
    });
  };

  const toggleNotifications = () => {
    const next = !showNotifications;
    setShowNotifications(next);
    if (next) loadNotifications();
  };

  const handleNotificationClick = (order: Order) => {
    markAsSeen(order);
    setNotifications(prev => prev.filter(n => n._id !== order._id));
    navigate('/dashboard/orders');
    setShowNotifications(false);
  };

  const clearAllNotifications = () => {
    notifications.forEach(n => markAsSeen(n));
    setNotifications([]);
  };

  function formatDateTime(dateString: string) {
    const date = new Date(dateString);
    const dd  = String(date.getDate()).padStart(2, '0');
    const mm  = String(date.getMonth() + 1).padStart(2, '0');
    const h   = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${dd}-${mm}-${date.getFullYear()}, ${h}:${min}`;
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PLACED':
      case 'PLACED & APPROVED': return 'New Order - Action Required';
      case 'APPROVED':          return 'Awaiting Pickup';
      case 'CANCELLED':         return 'Order Cancelled';
      case 'TIME_EXPIRED':      return 'Order Timed Out';
      default:                  return status.replace(/_/g, ' ');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PLACED':
      case 'PLACED & APPROVED': return 'bg-emerald-50 border-l-4 border-emerald-500 hover:bg-emerald-100';
      case 'APPROVED':          return 'bg-amber-50  border-l-4 border-amber-500  hover:bg-amber-100';
      case 'CANCELLED':         return 'bg-red-50    border-l-4 border-red-500    hover:bg-red-100';
      case 'TIME_EXPIRED':      return 'bg-orange-50 border-l-4 border-orange-500 hover:bg-orange-100';
      default:                  return 'bg-gray-50 hover:bg-gray-100';
    }
  };

  // Poll every 3s in background; 2s when panel is open
  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 3000);
    return () => clearInterval(interval);
  }, [user?.id]);

  useEffect(() => {
    if (!showNotifications) return;
    const interval = setInterval(loadNotifications, 2000);
    return () => clearInterval(interval);
  }, [showNotifications]);

  useEffect(() => {
    if (!showNotifications) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);

  return (
    <div className="flex h-screen bg-[#F9FAFB]">
      {/* Sidebar */}
      <div className="w-64 bg-[#047857] shadow-lg flex flex-col h-screen text-white">
        <div className="p-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center relative">
              <Plus className="w-7 h-7 text-green-600 absolute" strokeWidth={5} />
              <Plus className="w-5 h-5 text-green-600" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">Pharmacy Portal</h1>
              <p className="text-sm text-emerald-100">SYNMED Systems</p>
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-white bg-[#047857]" />
        <nav className="flex-1 px-4 space-y-2 pb-6">
          {navigation.map((item) => {
          const isActive = item.exact
           ? location.pathname === item.href
            : location.pathname === item.href || location.pathname.startsWith(item.href + '/');
            const Icon = item.icon;
            const badge = item.name === 'Orders' ? notifications.length : null;
            return (
              <div key={item.name} className="relative">
                <Link
                  to={item.href}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-white text-emerald-700 border-r-2 border-white'
                      : 'text-emerald-100 hover:bg-emerald-500'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.name}</span>
                </Link>
                {badge > 0 && (
                  <span className="absolute -top-1 -right-2 min-w-[20px] h-[20px] px-1 rounded-full bg-[#E63946] text-white text-[10px] flex items-center justify-center font-bold">
                    {badge}
                  </span>
                )}
              </div>
            );
          })}
        </nav>
        <div className="p-6 border-t border-white bg-[#047857]">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
              <span className="text-sm font-semibold text-emerald-700">{user?.name?.charAt(0)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-emerald-100 truncate">{user?.username}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-white text-emerald-700 font-medium hover:bg-emerald-100 transition"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-6 py-4 flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-[#0A1D37]">
             {navigation
              .slice()
              .sort((a, b) => b.href.length - a.href.length)
              .find(item => location.pathname === item.href || location.pathname.startsWith(item.href + '/'))
              ?.name || 'Dashboard'}
            </h2>
            <div className="flex items-center space-x-4">
              <div className="relative" ref={notificationRef}>
                <button
                  className={`relative p-2 flex items-center gap-2 rounded-lg transition-colors ${
                    notifications.length > 0
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                  onClick={toggleNotifications}
                >
                  <Bell className="w-6 h-6" />
                  {notifications.length > 0 && (
                    <>
                      <span className="text-xs font-semibold">
                        {notifications.length} New notification{notifications.length !== 1 ? 's' : ''}
                      </span>
                      <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#E63946] text-white text-[10px] flex items-center justify-center">
                        {notifications.length}
                      </span>
                    </>
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-96 bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-emerald-100 z-10 max-h-[600px] overflow-hidden flex flex-col">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-emerald-600 to-emerald-600 text-white">
                      <div>
                        <span className="text-sm font-semibold">Orders & Actions</span>
                        <p className="text-xs text-white mt-0.5">
                          {notifications.length} pending update{notifications.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {notificationsLoading && <span className="text-xs text-white">Refreshing...</span>}
                        {notifications.length > 0 && (
                          <button
                            onClick={clearAllNotifications}
                            className="text-xs text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded font-medium"
                          >
                            Clear all
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto divide-y">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center">
                          <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                          <p className="text-sm text-gray-500 font-medium">No new notifications</p>
                          <p className="text-xs text-gray-400 mt-1">All orders are up to date</p>
                        </div>
                      ) : (
                        notifications.map((order) => (
                          <div
                            key={order._id}
                            className={`p-4 cursor-pointer transition-colors ${getStatusColor(order.status)}`}
                            onClick={() => handleNotificationClick(order)}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-sm font-bold text-gray-900">{order.orderNumber}</p>
                                  <Badge color={badgeVariant[order.status] || 'default'}>
                                    {order.status === 'PLACED' || order.status === 'PLACED & APPROVED'
                                      ? 'New'
                                      : order.status === 'APPROVED'
                                      ? 'Pickup'
                                      : order.status === 'CANCELLED'
                                      ? 'Cancelled'
                                      : order.status === 'TIME_EXPIRED'
                                      ? 'Timed Out'
                                      : order.status.replace(/_/g, ' ')}
                                  </Badge>
                                </div>
                                <p className="text-xs font-medium text-gray-700 mb-1">
                                  {getStatusLabel(order.status)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                             <p className="text-xs text-gray-600">
                                  {(() => {
                                    const units = order.items.reduce((sum, i) => sum + (i.quantity ?? 0), 0);
                                    const subUnits = order.items.reduce((sum, i) => sum + (i.subQuantity ?? 0), 0);
                                    const parts = [];
                                    if (units > 0) parts.push(`${units} item${units !== 1 ? 's' : ''}`);
                                    if (subUnits > 0) parts.push(`${subUnits} sub-item${subUnits !== 1 ? 's' : ''}`);
                                    return parts.length > 0 ? parts.join(', ') : '0 items';
                                  })()} • ₹{order.totalAmount.toFixed(2)}
                                </p>
                              <p className="text-[11px] text-gray-500">{formatDateTime(order.placedAt)}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {notifications.length > 0 && (
                      <div className="border-t p-3 bg-gray-50">
                        <button
                          onClick={() => {
                            navigate('/dashboard/orders');
                            setShowNotifications(false);
                          }}
                          className="w-full text-center text-sm font-semibold text-emerald-600 hover:text-emerald-800 py-2 px-3 rounded hover:bg-emerald-50 transition-colors"
                        >
                          View All Orders →
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <CartProvider>
          <Outlet />
          </CartProvider>
        </main>
      </div>
    </div>
  );
}