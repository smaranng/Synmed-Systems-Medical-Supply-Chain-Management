import { useState, useEffect, useRef } from 'react';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { ChevronRight, Clock, FileText, Heart, Package, XCircle } from 'lucide-react';
import { orderService } from '../services/orderService';
import OrderDetailModal from '../components/OrderDetailModal';
import CancelOrderModal from '../components/CancelOrderModal';
import ViewBillModal from '../components/ViewBillModal';
import { useLocation } from 'react-router-dom';

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

export default function OrderTrackingPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [orderToCancel, setOrderToCancel] = useState<any | null>(null);
  const [nowTick, setNowTick] = useState<number>(Date.now());
  const [filterType, setFilterType] = useState<'all' | 'received' | 'transit' | 'waiting' | 'cancelled' | 'timed out and cancelled' >('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsError, setWsError] = useState<string | null>(null);
  const itemsPerPage = 9;
  const location = useLocation();
  const [billOrder, setBillOrder] = useState<any>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await orderService.getCustomerOrders();
      setOrders(data);
      setCurrentPage(1);
      
      if (selectedOrder) {
        const updated = data.find(o => o._id === selectedOrder._id);
        if (updated) {
          setSelectedOrder(updated);
        }
      }
    } catch (err) {
      console.error('Failed to load orders', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFavourite = async (orderId: string, currentFavourite: boolean) => {
    try {
      const updated = await orderService.toggleFavourite(orderId, !currentFavourite);
      setOrders((prev: any[]) =>
        prev.map((o: any) => (o._id === orderId ? { ...o, isFavourite: updated.isFavourite } : o))
      );
      if (selectedOrder && selectedOrder._id === orderId) {
        setSelectedOrder((prev: any) => prev ? { ...prev, isFavourite: updated.isFavourite } : null);
      }
    } catch (err) {
      console.error('Failed to toggle favourite', err);
    }
  };

  const handleCancelOrder = (order: any) => {
    setOrderToCancel(order);
  };

  const handleCancelSuccess = () => {
    setOrderToCancel(null);
    loadOrders();
  };

  // WebSocket connection for real-time order status updates
  useEffect(() => {
    const connectWebSocket = () => {
      try {
        // Get auth token from localStorage
        const token = localStorage.getItem('token');
        if (!token) {
          console.log('❌ No auth token found, skipping WebSocket connection');
          setWsError('No authentication token');
          startPolling();
          return;
        }
        
        // Determine WebSocket URL using Vite environment variables
        let wsUrl;
        
        // Use Vite environment variable if set (import.meta.env instead of process.env)
        const envWsHost = import.meta.env.VITE_ORDER_SERVICE_WS;
        
        if (envWsHost) {
          const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          wsUrl = `${wsProtocol}//${envWsHost}/ws/orders?token=${encodeURIComponent(token)}`;
        } 
        // Default to localhost:5202
        else {
          wsUrl = `ws://localhost:5202/ws/orders?token=${encodeURIComponent(token)}`;
        }
        
        console.log('🔌 Attempting WebSocket connection...');
        console.log('📍 URL:', wsUrl.replace(token, 'TOKEN_HIDDEN'));
        
        const ws = new WebSocket(wsUrl);
        
        // Set a connection timeout
        const connectionTimeout = setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            console.log('⏱️ WebSocket connection timeout');
            ws.close();
            setWsError('Connection timeout');
            startPolling();
          }
        }, 10000); // 10 second timeout
        
        ws.onopen = () => {
          clearTimeout(connectionTimeout);
          console.log('✅ WebSocket connected successfully!');
          setWsConnected(true);
          setWsError(null);
          
          // Stop polling when WebSocket is connected
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
            console.log('🛑 Polling stopped (WebSocket active)');
          }
        };
        
        ws.onmessage = (event) => {
          try {
            const update = JSON.parse(event.data);
            console.log('📨 WebSocket message received:', update.type);
            
            // Handle connection established
            if (update.type === 'connection_established') {
              console.log('✅ WebSocket connection confirmed by server');
              return;
            }
            
            // Handle order status updates
            if (update.type === 'order_status_update') {
              const { orderId, status, expiresAt, totalAmount, items, updatedAt, cancellationReason, cancellationAmount, cancellationFeePercentage } = update.data;
              
              console.log(`📦 Order update: ${orderId} → ${status}`);
              
              // Update orders list
              setOrders(prev => 
                prev.map(order => 
                  order._id === orderId
                    ? { 
                        ...order, 
                        status,
                        updatedAt,
                        ...(expiresAt && { expiresAt }),
                        ...(totalAmount && { totalAmount }),
                        ...(items && { items }),
                        ...(cancellationReason && { cancellationReason }),
                        ...(cancellationAmount && { cancellationAmount }),
                        ...(cancellationFeePercentage && { cancellationFeePercentage })
                      }
                    : order
                )
              );
              
              // Update selected order if it matches
              setSelectedOrder(prev => 
                prev && prev._id === orderId
                  ? { 
                      ...prev, 
                      status,
                      updatedAt,
                      ...(expiresAt && { expiresAt }),
                      ...(totalAmount && { totalAmount }),
                      ...(items && { items }),
                      ...(cancellationReason && { cancellationReason }),
                      ...(cancellationAmount && { cancellationAmount }),
                      ...(cancellationFeePercentage && { cancellationFeePercentage })
                    }
                  : prev
              );
            } 
            
            // Handle new orders
            else if (update.type === 'new_order') {
              const newOrder = update.data;
              setOrders(prev => {
                const exists = prev.some(o => o._id === newOrder._id);
                if (exists) return prev;
                return [newOrder, ...prev];
              });
              console.log('✅ New order added:', newOrder.orderNumber);
            } 
            
            // Handle order deletion
            else if (update.type === 'order_deleted') {
              const { orderId } = update.data;
              setOrders(prev => prev.filter(order => order._id !== orderId));
              if (selectedOrder && selectedOrder._id === orderId) {
                setSelectedOrder(null);
              }
              console.log('✅ Order deleted:', orderId);
            }
          } catch (error) {
            console.error('❌ Failed to parse WebSocket message:', error);
          }
        };
        
        ws.onerror = (error) => {
          clearTimeout(connectionTimeout);
          console.error('❌ WebSocket error:', error);
          setWsConnected(false);
          setWsError('Connection error');
        };
        
        ws.onclose = (event) => {
          clearTimeout(connectionTimeout);
          console.log('👋 WebSocket disconnected');
          console.log('   Code:', event.code);
          console.log('   Reason:', event.reason || 'No reason provided');
          console.log('   Clean:', event.wasClean);
          
          setWsConnected(false);
          wsRef.current = null;
          
          // Map close codes to error messages
          if (event.code === 1008) {
            setWsError('Authentication failed');
          } else if (event.code === 1006) {
            setWsError('Server offline');
          } else {
            setWsError(`Disconnected (${event.code})`);
          }
          
          // Start polling as fallback
          startPolling();
          
          // Attempt to reconnect after 5 seconds (unless authentication failed)
          if (event.code !== 1008) {
            reconnectTimeoutRef.current = setTimeout(() => {
              console.log('🔄 Attempting to reconnect WebSocket...');
              connectWebSocket();
            }, 5000);
          } else {
            console.log('🚫 Not reconnecting due to authentication failure');
          }
        };
        
        wsRef.current = ws;
      } catch (error) {
        console.error('❌ Failed to create WebSocket connection:', error);
        setWsConnected(false);
        setWsError('Failed to initialize');
        startPolling();
      }
    };
    
    // Start WebSocket connection
    connectWebSocket();
    
    // Cleanup on unmount
    return () => {
      if (wsRef.current) {
        console.log('🧹 Cleaning up WebSocket connection');
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Polling fallback when WebSocket is not connected
  const startPolling = () => {
    if (pollingIntervalRef.current) return;
    
    console.log('🔄 Starting polling fallback (10s interval)');
    
    pollingIntervalRef.current = setInterval(() => {
      if (!document.hidden && !wsConnected) {
        console.log('📡 Polling for updates...');
        loadOrders();
      }
    }, 10000); // Poll every 10 seconds
  };

  // Initial load
  useEffect(() => {
    loadOrders();
  }, []);

  // Refresh on location state change
  useEffect(() => {
    if (location.state?.refresh) {
      loadOrders();
    }
  }, [location.state?.refresh]);

  // Refresh on tab visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && !wsConnected) {
        loadOrders();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [wsConnected]);

  useEffect(() => {
    // Real-time tick for UI updates (timer countdown)
    const tickInterval = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(tickInterval);
  }, []);

  function formatDateTime(dateString: string) {
    const date = new Date(dateString);
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${dd}-${mm}-${yyyy}, ${hours}:${minutes}`;
  }

  function canCancelOrder(order: any): boolean {
    // Can only cancel APPROVED or PLACED & APPROVED orders
    return ['APPROVED', 'PLACED & APPROVED'].includes(order.status);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-black mb-2">My Orders</h1>
          <p className="text-gray-600">Track and manage your medicine orders.</p>
        </div>
        
        {/* Real-time connection status indicator with tooltip */}
        <div className="flex items-center gap-2 group relative">
          <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
          <span className="text-xs text-gray-500">
            {wsConnected ? 'Live updates' : 'Polling mode'}
          </span>
          
          {/* Tooltip on hover */}
          {wsError && !wsConnected && (
            <div className="absolute top-full right-0 mt-2 p-2 bg-gray-800 text-white text-xs rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              {wsError}
            </div>
          )}
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => { setFilterType('all'); setCurrentPage(1); }}
          className={`px-4 py-2 rounded-full text-sm font-medium transition ${
            filterType === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          All Orders
        </button>
        <button
          onClick={() => { setFilterType('transit'); setCurrentPage(1); }}
          className={`px-4 py-2 rounded-full text-sm font-medium transition ${
            filterType === 'transit' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          In Transit
        </button>
        <button
          onClick={() => { setFilterType('waiting'); setCurrentPage(1); }}
          className={`px-4 py-2 rounded-full text-sm font-medium transition ${
            filterType === 'waiting' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Accepted & Yet to Receive
        </button>
        <button
          onClick={() => { setFilterType('received'); setCurrentPage(1); }}
          className={`px-4 py-2 rounded-full text-sm font-medium transition ${
            filterType === 'received' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Order Received
        </button>
        <button
          onClick={() => { setFilterType('cancelled'); setCurrentPage(1); }}
          className={`px-4 py-2 rounded-full text-sm font-medium transition ${
            filterType === 'cancelled' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Rejected/Cancelled
        </button>
        <button
          onClick={() => { setFilterType('timed out and cancelled'); setCurrentPage(1); }}
          className={`px-4 py-2 rounded-full text-sm font-medium transition ${
            filterType === 'timed out and cancelled' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Timed out & Cancelled
        </button>
      </div>

      <div className="space-y-4">
        {loading ? (
          <Card>
            <CardContent className="p-6 text-center text-gray-500">
              Loading orders...
            </CardContent>
          </Card>
        ) : orders.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-gray-500">
              No orders yet. Start shopping!
            </CardContent>
          </Card>
        ) : (
          <>
            {(() => {
              const filteredOrders = orders.filter((order: any) => {
                switch (filterType) {
                  case 'received': return order.status === 'COMPLETED';
                  case 'transit': return order.status === 'PLACED';
                  case 'waiting': return ['APPROVED', 'PLACED & APPROVED', 'READY_FOR_PICKUP'].includes(order.status);
                  case 'cancelled': return ['CANCELLED', 'REJECTED'].includes(order.status);
                  case 'timed out and cancelled': return order.status === 'TIME_EXPIRED';
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
                  <div className="text-sm text-gray-600 mb-4">
                    Showing {paginatedOrders.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}-
                    {Math.min(currentPage * itemsPerPage, sortedOrders.length)} of {sortedOrders.length} orders
                  </div>

                  {paginatedOrders.length === 0 ? (
                    <Card>
                      <CardContent className="p-6 text-center text-gray-500">
                        No orders found for this filter.
                      </CardContent>
                    </Card>
                  ) : (
                    paginatedOrders.map((order: any) => {
                      const itemCount = order.items.reduce((sum: number, item: any) => sum + item.quantity, 0);
                      const subUnitCount = order.items.reduce((sum: number, item: any) => sum + (item.subQuantity || 0), 0);
                    
                      const formatCount = (count: number, label: string) =>
                        count > 0
                          ? `${count} ${label}${count !== 1 ? "s" : ""}`
                          : "";

                      const itemText = formatCount(itemCount, "item");
                      const subItemText = formatCount(subUnitCount, "sub-item");

                      const combined = [itemText, subItemText].filter(Boolean).join(", ");

                      const displayText =
                        combined.length > 0
                          ? `${combined} • ₹${order.totalAmount.toFixed(2)}`
                          : `₹${order.totalAmount.toFixed(2)}`;
                      const { label, color } = getStatusDisplay(order.status);
                      const expiresAt = order.expiresAt ? new Date(order.expiresAt).getTime() : null;
                      const now = nowTick;
                      let remainingLabel = '';
                      let isLastHalfHour = false;
                      if (expiresAt && ['APPROVED', 'PLACED & APPROVED'].includes(order.status)) {
                        const diff = Math.max(0, expiresAt - now);
                        const hh = Math.floor(diff / 3600000);
                        const mm = Math.floor((diff % 3600000) / 60000);
                        const ss = Math.floor((diff % 60000) / 1000);
                        remainingLabel = `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
                        isLastHalfHour = diff <= 1 * 60 * 1000 && diff > 0;
                      }

                      return (
                        <Card key={order._id} className="hover:shadow-md transition-shadow relative">
                          {expiresAt && ['APPROVED', 'PLACED & APPROVED'].includes(order.status) && (
                            <div className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-semibold ${isLastHalfHour ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                              <span className="inline-flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Time left: {remainingLabel}
                              </span>
                            </div>
                          )}
                          <CardContent className="p-4 pt-6 flex justify-between items-center">
                            <div className="flex items-start gap-4">
                              <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <Package className="h-5 w-5 text-blue-600" />
                              </div>
                              <div>
                                <h3 className="font-semibold text-black">{order.orderNumber}</h3>
                                <p className="text-sm text-gray-600">Placed on {formatDateTime(order.placedAt)}</p>
                                <p className="text-sm text-gray-600 mt-1">
                                  {displayText}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => handleToggleFavourite(order._id, order.isFavourite || false)}
                                className="p-2 hover:bg-gray-100 rounded-full transition"
                                title={order.isFavourite ? 'Remove from favourites' : 'Add to favourites'}
                              >
                                <Heart
                                  className={`w-5 h-5 transition ${
                                    order.isFavourite ? 'fill-pink-500 text-pink-500' : 'text-gray-400 hover:text-pink-500'
                                  }`}
                                />
                              </button>
                             
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${color}`}>
                                {label}
                              </span>
                              <Button variant="outline" size="sm" onClick={() => setSelectedOrder(order)}>
                                View Details
                              </Button>
                              {order.status === 'COMPLETED' && (
                              <button
                                onClick={() => setBillOrder(order)}
                                className="flex items-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-800 transition"
                              >
                                <FileText size={15} />
                                View Bill
                              </button>
                            )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}

                  {totalPages > 1 && (
                    <div className="flex justify-center items-center gap-2 mt-6">
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-2 rounded border border-gray-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                      >
                        <ChevronRight className="w-4 h-4 inline-block rotate-180" />
                        Previous
                      </button>
                      <div className="flex gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`px-3 py-2 rounded text-sm font-medium transition ${
                              currentPage === page ? 'bg-[#123B6B] text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            {page}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-2 rounded border border-gray-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                      >
                        Next <ChevronRight className="w-4 h-4 inline-block" />
                      </button>
                    </div>
                  )}
                </>
              );
            })()}
          </>
        )}
      </div>

      {selectedOrder && (
        <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      )}
        {billOrder && (
        <ViewBillModal
          order={billOrder}
          onClose={() => setBillOrder(null)}
        />
        )}
      {orderToCancel && (
        <CancelOrderModal 
          order={orderToCancel} 
          onClose={() => setOrderToCancel(null)}
          onSuccess={handleCancelSuccess}
        />
      )}
    </div>
  );
}