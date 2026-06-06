import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useNotification } from '../context/NotificationContext';

interface OrderNotification {
  orderId: string;
  orderNumber: string;
  status: 'PLACED' | 'APPROVED' | 'PLACED & APPROVED' | 'COMPLETED' | 'REJECTED' | 'TIME_EXPIRED' | 'CANCELLED';
  pharmacyName: string;
  timestamp: Date;
}

export default function OrderNotificationBadge() {
  const location = useLocation();
  const [showDropdown, setShowDropdown] = useState(false);

  const { 
    notifications, 
    unreadCount, 
    markAllAsRead, 
    dismissNotification, 
    clearAllNotifications 
  } = useNotification();

  const statusConfig = {
    PLACED: { color: '#FFA500', bgColor: '#FFF3E0', text: 'In Transit', icon: '📍' },
    APPROVED: { color: '#4CAF50', bgColor: '#E8F5E9', text: 'Accepted and Yet to Receive', icon: '☑️' },
    'PLACED & APPROVED': { color: '#FFA500', bgColor: '#FFF3E0', text: 'Placed & Approved', icon: '📍' },
    COMPLETED: { color: '#00C853', bgColor: '#E8F5E9', text: 'Completed', icon: '✅' },
    REJECTED: { color: '#F44336', bgColor: '#FFEBEE', text: 'Rejected', icon: '❌' },
    TIME_EXPIRED: { color: '#FF6F00', bgColor: '#FFF3E0', text: 'Timed out & Cancelled', icon: '⏱️' },
    CANCELLED: { color: '#F44336', bgColor: '#FFEBEE', text: 'Cancelled', icon: '🚫' },
  };

  // Clear all notifications when user navigates to orders page
  useEffect(() => {
    if (location.pathname === '/dashboard/orders' || location.pathname === '/orders') {
      clearAllNotifications();
    }
  }, [location.pathname]);

  return (
    <>
      {/* Fixed Badge at Bottom Right */}
      <div className="fixed bottom-6 right-6 z-40">
        {/* Notification Bell Button */}
        <div className="relative">
          <button
            onClick={() => {
              setShowDropdown(!showDropdown);
              markAllAsRead();
            }}
            className="w-14 h-14 rounded-full bg-blue-900 text-white shadow-lg hover:bg-blue-800 transition-colors flex items-center justify-center relative border-2 border-white"
            title="Order notifications"
          >
            <Bell className="w-6 h-6 text-white" />
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown Notifications */}
          {showDropdown && (
            <div className="absolute bottom-16 right-0 bg-white rounded-lg shadow-2xl border border-gray-200 w-80 max-h-96 overflow-y-auto">
              {/* Header */}
              <div className="sticky top-0 bg-gradient-to-r from-blue-900 to-blue-800 text-white p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold">Order Updates</p>
                  <p className="text-xs text-blue-100">{notifications.length} notification{notifications.length !== 1 ? 's' : ''}</p>
                </div>
                <button
                  onClick={() => setShowDropdown(false)}
                  className="text-white hover:bg-blue-700 p-1 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Notifications List */}
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No new notifications</p>
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map((notif) => {
                    const config = statusConfig[notif.status];
                    return (
                      <div
                        key={`${notif.orderId}-${notif.status}`}
                        onClick={() => dismissNotification(notif.orderId, notif.status)}
                        className="p-4 hover:bg-opacity-80 transition-colors border-l-4"
                        style={{ 
                          borderLeftColor: config.color,
                          backgroundColor: config.bgColor
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">{config.icon}</span>
                              <p className="font-semibold text-sm text-gray-900">{notif.orderNumber}</p>
                            </div>
                            <p
                              className="text-sm font-medium mb-1"
                              style={{ color: config.color }}
                            >
                              {config.text}
                            </p>
                            <p className="text-xs text-gray-600">{notif.pharmacyName}</p>
                            <p className="text-xs text-gray-400 mt-1">
                              {new Date(notif.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                          
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Footer */}
              {notifications.length > 0 && (
                <div className="sticky bottom-0 bg-gray-50 border-t p-3 flex gap-2">
                  <button
                    onClick={clearAllNotifications}
                    className="flex-1 text-xs font-medium cursor-pointer text-gray-600 hover:text-gray-900 py-2 px-3 rounded hover:bg-gray-200"
                  >
                    Clear All
                  </button>
                  <a
                    href="/dashboard/orders"
                    onClick={() => setShowDropdown(false)}
                    className="flex-1 text-xs font-medium text-blue-600 hover:text-blue-800 py-2 px-3 rounded hover:bg-blue-50 text-center"
                  >
                    View All Orders
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Global Notification Toast for Real-time Updates */}
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes slideOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(400px);
            opacity: 0;
          }
        }

        .notification-toast {
          animation: slideIn 0.3s ease-out;
        }

        .notification-toast.hide {
          animation: slideOut 0.3s ease-out;
        }
      `}</style>
    </>
  );
}