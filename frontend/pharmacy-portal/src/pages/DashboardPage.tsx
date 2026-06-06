import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import {
  TrendingUp,
  Package,
  DollarSign,
  AlertCircle,
  Boxes,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { useAuth } from "../hooks/useAuth";
import { useState, useEffect } from "react";
import { orderService, Order } from "../services/orderService";
import { offlineOrderService, OfflineOrder } from "../services/offlineOrderService";
import { inventoryService, InventoryStats } from "../services/inventoryService";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { LocationModal } from "../../../shared/components/LocationModal";
import { locationService } from "../../../shared/services/locationService";

interface MonthlyData {
  month: string;
  sales: number;
  orders: number;
}

interface YearlyData {
  year: string;
  sales: number;
  orders: number;
}

interface DashboardOrder {
  _id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  placedAt: string;
  cancellationAmount?: number;
}

export default function DashboardPage() {
  const { user, isLoading } = useAuth();
  const [orders, setOrders] = useState<DashboardOrder[]>([]);
  const [stats, setStats] = useState<{
    medicines: InventoryStats | null;  
  }>({
    medicines: null,
  });
  const [salesData, setSalesData] = useState<MonthlyData[]>([]);
  const [yearlyData, setYearlyData] = useState<YearlyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [totalInventoryValue, setTotalInventoryValue] = useState(0);
  const [timePeriod, setTimePeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationChecked, setLocationChecked] = useState(false);

  const IconBadge = ({
    children,
    bg,
    color,
  }: {
    children: React.ReactNode;
    bg: string;
    color: string;
  }) => (
    <div
      className={`w-10 h-10 flex items-center justify-center rounded-full ${bg} ${color}`}
    >
      {children}
    </div>
  );

  // Check location on mount
  useEffect(() => {
    if (!locationChecked && user?.id) {
      checkPharmacyLocation();
    }
  }, [locationChecked, user?.id]);

  const checkPharmacyLocation = async () => {
  try {
    await locationService.getNearbyPharmacies(1000, 'pharmacy'); // ← pass 'pharmacy'
    setLocationChecked(true);
  } catch (err: any) {
    console.log('Location check error:', err.message);
    if (err.message === "LOCATION_REQUIRED") {
      setShowLocationModal(true);
    }
    setLocationChecked(true);
  }
};

  const handleLocationSet = async (latitude: number, longitude: number, address?: string) => {
    try {
      // Pass 'pharmacy' as portalType when updating location
      await locationService.updateLocation(latitude, longitude, address, 'pharmacy');
      setShowLocationModal(false);
      setLocationChecked(true);
      // Optionally show success message
      console.log('✅ Location updated successfully');
    } catch (err: any) {
      console.error('Location update error:', err);
      alert(err.message || "Failed to update location");
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    if (!user?.id) {
      console.log('⚠️ No user ID available');
      return;
    }
    console.log('🔍 Dashboard user ID:', user.id);
    console.log('🔍 Full user object:', user);
    loadDashboardData();
  }, [user?.id]);

  // Regenerate sales data when time period or year changes
  useEffect(() => {
    if (orders.length > 0) {
      if (timePeriod === 'monthly') {
        generateMonthlySalesData(orders, selectedYear);
      } else {
        generateYearlySalesData(orders);
      }
    }
  }, [timePeriod, selectedYear, orders]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      console.log('📊 Fetching orders for pharmacy:', user!.id);

      const [onlineOrdersData, offlineOrdersData, medicinesStats] = await Promise.all([
        orderService.getOrders(user!.id),
        offlineOrderService.getPharmacyOfflineOrders(user!.id),
        inventoryService.getStats(user!.id),
      ]);

      const normalizedOnlineOrders: DashboardOrder[] = onlineOrdersData.map((order: Order) => ({
        _id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        totalAmount: order.totalAmount,
        placedAt: order.placedAt,
        cancellationAmount: order.cancellationAmount,
      }));

      const normalizedOfflineOrders: DashboardOrder[] = offlineOrdersData.map((order: OfflineOrder) => ({
        _id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        totalAmount: order.totalAmount,
        placedAt: order.createdAt,
      }));

      const allOrders = [...normalizedOnlineOrders, ...normalizedOfflineOrders];
      console.log('📦 Total orders received:', allOrders.length, {
        online: normalizedOnlineOrders.length,
        offline: normalizedOfflineOrders.length,
      });
      setOrders(allOrders);

      console.log('💊 Inventory stats:', medicinesStats);
      
      setStats({
        medicines: medicinesStats,
      });

      // Calculate low stock count and total value
      const totalLowStock = medicinesStats?.lowStock || 0;
      const totalValue = parseFloat(medicinesStats?.totalValue.toString() || '0')|| 0;

      setLowStockCount(totalLowStock);
      setTotalInventoryValue(totalValue);

      // Extract available years from orders
      const completedOrders = allOrders.filter(order => order.status === 'COMPLETED');
      const years = [...new Set(completedOrders.map(order => new Date(order.placedAt).getFullYear()))].sort((a, b) => b - a);
      setAvailableYears(years.length > 0 ? years : [new Date().getFullYear()]);

      // Generate sales data
      generateMonthlySalesData(allOrders, selectedYear);
      generateYearlySalesData(allOrders);
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateMonthlySalesData = (ordersData: DashboardOrder[], year: number) => {
    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];

    // Filter for completed orders in the selected year
    const completedOrders = ordersData.filter(order => {
      const orderDate = new Date(order.placedAt);
      return order.status === 'COMPLETED' && orderDate.getFullYear() === year;
    });
    
    console.log(`✅ Completed orders in ${year}:`, completedOrders.length);

    // Initialize all 12 months with zero values
    const monthlyMap: Record<number, { sales: number; count: number }> = {};
    for (let i = 0; i < 12; i++) {
      monthlyMap[i] = { sales: 0, count: 0 };
    }

    // Populate with actual order data
    completedOrders.forEach((order) => {
      const date = new Date(order.placedAt);
      const month = date.getMonth();

      monthlyMap[month].sales += order.totalAmount;
      monthlyMap[month].count += 1;
    });

    // Convert to array with all 12 months
    const data = Object.entries(monthlyMap).map(([monthIndex, value]) => ({
      month: monthNames[parseInt(monthIndex)],
      sales: Math.round(value.sales),
      orders: value.count,
    }));

    console.log(`📈 Monthly sales data for ${year}:`, data);
    setSalesData(data);
  };

  const generateYearlySalesData = (ordersData: DashboardOrder[]) => {
    const yearlyMap: Record<number, { sales: number; count: number }> = {};

    // Filter for completed orders only
    const completedOrders = ordersData.filter(order => order.status === 'COMPLETED');
    console.log('✅ Completed orders for yearly view:', completedOrders.length);

    completedOrders.forEach((order) => {
      const year = new Date(order.placedAt).getFullYear();

      if (!yearlyMap[year]) {
        yearlyMap[year] = { sales: 0, count: 0 };
      }

      yearlyMap[year].sales += order.totalAmount;
      yearlyMap[year].count += 1;
    });

    // Convert to array and sort by year
    const data = Object.entries(yearlyMap)
      .sort(([yearA], [yearB]) => parseInt(yearA) - parseInt(yearB))
      .map(([year, value]) => ({
        year: year,
        sales: Math.round(value.sales),
        orders: value.count,
      }));

    console.log('📈 Yearly sales data:', data);
    setYearlyData(data);
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

  const getStatusDisplay = (status: string) => {
    const map: Record<string, { label: string; color: string }> = {
      PENDING: { label: 'Pending', color: 'bg-amber-100 text-amber-700' },
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

  const formatCurrency = (value: number) => {
    if (value >= 100000) {
      const lakhs = (value / 100000).toFixed(2);
      return `₹${lakhs}L`;
    }
    return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getTotalOrdersCount = () => {
    return orders.length;
  };

  const getTotalMedicines = () => {
    return stats.medicines?.totalItems || 0;
  };

  const getTotalRevenue = () => {
    return orders.reduce((sum, order) => {
      if (order.status === 'COMPLETED') {
        return sum + order.totalAmount;
      }

      if (order.status === 'CANCELLED' && order.cancellationAmount) {
        return sum + order.cancellationAmount / 2;
      }

      return sum;
    }, 0);
  };

  const getRecentOrders = () => {
    return [...orders]
      .sort(
        (a, b) =>
          new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime(),
      )
      .slice(0, 5);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-[#3BB273]/10 text-[#3BB273]";
      case "APPROVED":
      case "READY_FOR_PICKUP":
        return "bg-blue-100 text-blue-800";
      case "CANCELLED":
        return "bg-red-100 text-red-800";
      case "REJECTED":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const calculateRevenueChange = (orders: DashboardOrder[]) => {
    const now = new Date();
    const m = now.getMonth();
    const y = now.getFullYear();

    const prevM = m === 0 ? 11 : m - 1;
    const prevY = m === 0 ? y - 1 : y;

    let current = 0;
    let previous = 0;

    for (const o of orders) {
      if (o.status !== "COMPLETED") continue;

      const d = new Date(o.placedAt);

      if (d.getMonth() === m && d.getFullYear() === y) {
        current += o.totalAmount;
      } else if (d.getMonth() === prevM && d.getFullYear() === prevY) {
        previous += o.totalAmount;
      }
    }

    if (previous === 0) return current === 0 ? 0 : null;

    return Number((((current - previous) / previous) * 100).toFixed(1));
  };

  const calculateOrdersChange = (orders: DashboardOrder[]) => {
    if (!orders.length) return 0;

    // anchor to latest order date, not system clock
    const latest = new Date(
      Math.max(...orders.map(o => new Date(o.placedAt).getTime()))
    );

    const m = latest.getMonth();
    const y = latest.getFullYear();

    const prevM = m === 0 ? 11 : m - 1;
    const prevY = m === 0 ? y - 1 : y;

    let current = 0;
    let previous = 0;

    for (const o of orders) {
      if (o.status !== "COMPLETED") continue;
      const d = new Date(o.placedAt);

      if (d.getMonth() === m && d.getFullYear() === y) {
        current++;
      } else if (d.getMonth() === prevM && d.getFullYear() === prevY) {
        previous++;
      }
    }

    // no baseline → growth meaningless
    if (previous === 0) return current === 0 ? 0 : null;

    return Number((((current - previous) / previous) * 100).toFixed(1));
  };

  if (loading || isLoading) {
  return (
    <>
      <LocationModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onLocationSet={handleLocationSet}
        portalType="pharmacy"
      />
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500">Loading dashboard...</p>
      </div>
    </>
  );
}

  const totalOrders = getTotalOrdersCount();
  const totalMedicines = getTotalMedicines();
  const totalRevenue = getTotalRevenue();
  const recentOrders = getRecentOrders();

  // Calculate percentage change dynamically from database values
  const revenueChangePercent = calculateRevenueChange(orders);
  const ordersChangePercent = calculateOrdersChange(orders);

  const currentChartData = timePeriod === 'monthly' ? salesData : yearlyData;
  const chartDataKey = timePeriod === 'monthly' ? 'month' : 'year';

  return (
    <>
      {/* Location Modal */}
      <LocationModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onLocationSet={handleLocationSet}
        portalType="pharmacy"
      />

      <div className="space-y-6">
        <div className="flex items-center justify-between p-6 bg-white rounded-lg">
          <div className="flex items-center gap-4">
            {user?.logo ? (
              <img
                src={`http://localhost:5203${user.logo}?t=${Date.now()}`}
                alt="Pharmacy logo"
                className="w-16 h-16 rounded-full object-cover border"
              />
            ) : (
              <div
                className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700
                     flex items-center justify-center font-bold"
              >
                {user?.name?.charAt(0).toUpperCase() || "P"}
              </div>
            )}

            <div>
              <h1 className="text-2xl font-bold">
                Welcome back, {user?.name || "Pharmacy"}
              </h1>
              <p className="text-gray-600 mt-1">
                Here's a summary of your pharmacy's performance.
              </p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-sm font-medium text-gray-600">
                  Total Revenue
                </CardTitle>
                <p className="text-xs text-gray-500 mt-1">
                  (Sales + Cancellation Fee)
                </p>
              </div>
              <IconBadge bg="bg-green-100" color="text-green-700 font-bold">
                ₹
              </IconBadge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(totalRevenue)}
              </div>
              <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                {revenueChangePercent === null ? (
                  <span className="text-red-400 font-sans text-xs">
                    No data from last month
                  </span>
                ) : (
                  (() => {
                    const isPositive = revenueChangePercent >= 0
                    const color = isPositive ? "text-green-600" : "text-red-600"
                    const Icon = isPositive ? ArrowUpRight : ArrowDownRight

                    return (
                      <div className="flex items-center gap-1 text-sm">
                        <Icon className={`w-4 h-4 ${color}`} />
                        <span className={color}>
                          {isPositive ? "+" : ""}
                          {revenueChangePercent}%
                        </span>
                        <span className="text-gray-500 ml-1">
                          from last month
                        </span>
                      </div>
                    )
                  })()
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Orders
              </CardTitle>
              <IconBadge bg="bg-blue-100" color="text-blue-700">
                <Package className="w-5 h-5" />
              </IconBadge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalOrders}</div>
              <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                {ordersChangePercent === null ? (
                  <span className="text-red-400 font-sans text-xs">
                    No data from last month
                  </span>
                ) : (
                  (() => {
                    const isPositive = ordersChangePercent >= 0
                    const color = isPositive ? "text-green-600" : "text-red-600"
                    const Icon = isPositive ? ArrowUpRight : ArrowDownRight

                    return (
                      <div className="flex items-center gap-1 text-sm">
                        <Icon className={`w-4 h-4 ${color}`} />
                        <span className={color}>
                          {isPositive ? "+" : ""}
                          {ordersChangePercent}%
                        </span>
                        <span className="text-gray-500 ml-1">
                          from last month
                        </span>
                      </div>
                    )
                  })()
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Items in Stock
              </CardTitle>
              <IconBadge bg="bg-emerald-100" color="text-emerald-700">
                <Boxes className="w-5 h-5" />
              </IconBadge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalMedicines}</div>
              <p className="text-xs text-gray-500 mt-1">Total inventory items</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Low Stock Alerts
              </CardTitle>
              <IconBadge bg="bg-red-100" color="text-red-700">
                <AlertCircle className="w-5 h-5" />
              </IconBadge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#E63946]">
                {lowStockCount}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Requires immediate attention
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  {timePeriod === 'monthly' ? `Sales - ${selectedYear}` : 'Yearly Sales'}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filter Controls */}
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => setTimePeriod('monthly')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      timePeriod === 'monthly'
                        ? 'bg-[#3BB273] text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setTimePeriod('yearly')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      timePeriod === 'yearly'
                        ? 'bg-[#3BB273] text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Yearly
                  </button>
                </div>

                {timePeriod === 'monthly' && availableYears.length > 0 && (
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3BB273]"
                  >
                    {availableYears.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={currentChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey={chartDataKey} />
                  <YAxis />
                  <Tooltip formatter={(value) => `₹${value}`} />
                  <Bar dataKey="sales" fill="#3BB273" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                {timePeriod === 'monthly' ? `Order Trends - ${selectedYear}` : 'Yearly Order Trends'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 h-[44px]"></div> {/* Spacer to align with Sales chart */}
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={currentChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey={chartDataKey} />
                  <YAxis />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="orders"
                    stroke="#4BA3C3"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Recent Orders */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
          </CardHeader>

          <CardContent>
            <div className="space-y-3">
              {recentOrders.length > 0 ? (
                recentOrders.map((order: any) => {
                  const { label, color } = getStatusDisplay(order.status);

                  return (
                    <div
                      key={order._id}
                      className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                    >
                      {/* Icon */}
                      <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Package className="h-5 w-5 text-green-600" />
                      </div>

                      {/* Content */}
                      <div className="flex flex-1 items-center justify-between">
                        {/* Left */}
                        <div>
                          <p className="font-medium">{order.orderNumber}</p>
                          <p className="text-sm text-gray-500">
                            Placed on {formatDateTime(order.placedAt)}
                          </p>
                        </div>

                        {/* Right */}
                        <div className="text-right">
                          <p className="font-medium">
                            ₹{Number(order.totalAmount).toFixed(2)}
                          </p>

                          <span
                            className={`inline-block mt-1 px-2 py-1 rounded-full text-xs font-medium ${color}`}
                          >
                            {label}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-gray-500 text-center py-4">
                  No orders yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}