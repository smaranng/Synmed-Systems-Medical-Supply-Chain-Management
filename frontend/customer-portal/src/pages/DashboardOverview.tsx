import { useAuth } from "../hooks/useAuth";
import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import {
  ShoppingCart,
  Package,
  Heart,
  History,
} from "lucide-react";
import { orderService } from "../services/orderService";
import { cartService } from "../services/cartService";

export default function DashboardOverview() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    activeOrders: 0,
    cartItems: 0,
    favorites: 0,
    totalOrders: 0,
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const getStatusDisplay = (status: string) => {
    const map: Record<string, { label: string; color: string }> = {
      PLACED: { label: 'In Transit', color: 'bg-blue-100 text-blue-700' },
      'PLACED & APPROVED': { label: 'Placed & Approved', color: 'bg-blue-100 text-blue-700' },
      APPROVED: { label: 'Accepted & Yet to receive', color: 'bg-purple-100 text-purple-700' },
      COMPLETED: { label: 'Order Received', color: 'bg-green-100 text-green-700' },
      REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
      TIME_EXPIRED: { label: 'Timed out & cancelled', color: 'bg-yellow-100 text-yellow-700' },
      CANCELLED: { label: 'Cancelled', color: 'bg-orange-100 text-orange-700' },
    };
    return map[status] || { label: status, color: 'bg-gray-100 text-gray-700' };
  };

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      
      // Fetch orders
      const orders = await orderService.getCustomerOrders();
      
      // Count active orders (PLACED, APPROVED, READY_FOR_PICKUP)
      const activeOrdersCount = orders.filter((order: any) =>
        ['PLACED', 'APPROVED', 'READY_FOR_PICKUP'].includes(order.status)
      ).length;
    
      
      // Count favorites
      const favoritesCount = orders.filter((order: any) => order.isFavourite).length;

      
      // Total orders
      const totalOrdersCount = orders.length;
      
      
      // Get 3 latest orders sorted by createdAt descending
      // Show ALL orders (not just filtered ones)
      const latestOrders = orders
        .sort((a: any, b: any) => {
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return dateB - dateA;
        })
        .slice(0, 5);
      
      // Fetch cart
      let cartItemsCount = 0;
      try {
        const cartData = await cartService.getCart();
        cartItemsCount = cartData.items ? cartData.items.length : 0;
        
      } catch (cartError) {
        console.warn('⚠️ Dashboard: Failed to load cart:', cartError);
        // Don't fail the whole dashboard if cart fails
      }
      
      const newStats = {
        activeOrders: activeOrdersCount,
        cartItems: cartItemsCount,
        favorites: favoritesCount,
        totalOrders: totalOrdersCount,
      };
      
      
      setStats(newStats);
      setRecentOrders(latestOrders);
      
    } catch (error: any) {
      console.error('❌ Dashboard: Failed to load stats:', error);
      setError(error.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  function formatDateTime(dateString: string) {
  const date = new Date(dateString);

  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${dd}-${mm}-${yyyy}, ${hours}:${minutes}`;
}
      
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome back, {user?.name || "Customer"}!
        </h1>
        <p className="text-gray-600">
          Here's what's happening with your orders today.
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <p className="text-red-800">⚠️ {error}</p>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Active Orders
                </p>
                <p className="text-2xl font-bold text-black">{loading ? '-' : stats.activeOrders}</p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Cart Items</p>
                <p className="text-2xl font-bold text-black">{loading ? '-' : stats.cartItems}</p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                <ShoppingCart className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Favorites</p>
                <p className="text-2xl font-bold text-black">{loading ? '-' : stats.favorites}</p>
              </div>
              <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
                <Heart className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total Orders
                </p>
                <p className="text-2xl font-bold text-black">{loading ? '-' : stats.totalOrders}</p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                <History className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader>
          <CardTitle className="text-black">Recent Orders</CardTitle>
          <CardDescription className="text-gray-600">
            Your latest medicine orders
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-gray-500 py-8">Loading orders...</p>
          ) : error ? (
            <p className="text-center text-red-500 py-8">{error}</p>
          ) : recentOrders.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No orders yet. Start shopping!</p>
          ) : (
            <div className="space-y-4">
              {recentOrders.map((order: any) => {
                //const itemCount = order.items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0;
                //const firstItemName = order.items && order.items.length > 0 ? order.items[0].name : 'Order';
                const { label, color } = getStatusDisplay(order.status);
                
                return (
                  <div key={order._id} className="flex items-center justify-between p-4 border rounded-lg hover:shadow-md transition-shadow">
                    <div className="flex items-center space-x-4">
                      <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Package className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-black"> {order.orderNumber}</p>
                        <p className="text-sm text-gray-600">
                          Placed on {formatDateTime(order.placedAt)} 
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-black">₹{(order.totalAmount || 0).toFixed(2)}</p>
                      <span className={`inline-block mt-1 px-2 py-1 rounded-full text-xs font-medium ${color}`}>
                        {label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}