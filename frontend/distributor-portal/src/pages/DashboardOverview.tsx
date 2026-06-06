import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { distributorOrderService, DistributorOrder } from '../services/orderService';
import { pharmacyService } from '../services/pharmacyService';
import {
  Package,
  Truck,
  IndianRupee,
  Clock,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  MapPin,
} from 'lucide-react';

type ShipmentRow = {
  order: DistributorOrder;
  pharmacyName: string;
  delivery: {
    _id: string;
    orderNumber: string;
    driverID: string;
    driverName: string;
    driverPhone: string;
    driverRating?: number;
    vehicleID: string;
    vehicleNumber: string;
    vehicleType: string;
    distanceKm: number | null;
    allocationScore: number;
    status: string;
    createdAt: string;
    updatedAt: string;
  } | null;
};

const ACTIVE_SHIPMENT_STATUSES = new Set(['DISPATCHED', 'PICKED_UP']);
const SHIPMENT_STATUSES = new Set(['DISPATCHED', 'PICKED_UP', 'DELIVERED', 'CANCELLED', 'REJECTED']);

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatDateTime(value?: string) {
  if (!value) return 'Just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTimeAgo(value?: string) {
  if (!value) return 'Just now';
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  if (Number.isNaN(date.getTime()) || diff < 0) return formatDateTime(value);

  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getOrderStatusMeta(status?: string) {
  switch (status) {
    case 'PLACED':
      return { label: 'Pending', variant: 'pending' as const };
    case 'ACCEPTED':
      return { label: 'Accepted', variant: 'warning' as const };
    case 'DISPATCHED':
      return { label: 'Dispatched', variant: 'default' as const };
    case 'PICKED_UP':
      return { label: 'Picked Up', variant: 'default' as const };
    case 'DELIVERED':
      return { label: 'Delivered', variant: 'success' as const };
    case 'REJECTED':
      return { label: 'Rejected', variant: 'destructive' as const };
    case 'CANCELLED':
      return { label: 'Cancelled', variant: 'destructive' as const };
    case 'TIME_EXPIRED':
      return { label: 'Timed Out', variant: 'destructive' as const };
    default:
      return { label: status || 'Unknown', variant: 'secondary' as const };
  }
}

function getShipmentMeta(status?: string) {
  switch (status) {
    case 'DISPATCHED':
      return { label: 'In Transit', variant: 'default' as const };
    case 'PICKED_UP':
      return { label: 'Picked Up', variant: 'warning' as const };
    case 'DELIVERED':
      return { label: 'Delivered', variant: 'success' as const };
    case 'CANCELLED':
    case 'REJECTED':
      return { label: status, variant: 'destructive' as const };
    default:
      return { label: status || 'Unknown', variant: 'secondary' as const };
  }
}

function getPharmacyName(pharmacyNames: Record<string, string>, pharmaID?: string) {
  if (!pharmaID) return 'Unknown pharmacy';
  return pharmacyNames[pharmaID] || pharmaID;
}

export default function OverviewPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<DistributorOrder[]>([]);
  const [shipmentRows, setShipmentRows] = useState<ShipmentRow[]>([]);
  const [pharmacyNames, setPharmacyNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const loadDashboard = async () => {
    if (!user?.id) return;

    setIsLoading(true);
    setError(null);

    try {
      const fetchedOrders = await distributorOrderService.getOrdersByDistributor(user.id);
      const sortedOrders = [...fetchedOrders].sort((a, b) => {
        const left = new Date(b.placedAt || b.updatedAt || 0).getTime();
        const right = new Date(a.placedAt || a.updatedAt || 0).getTime();
        return left - right;
      });

      const recentOrders = sortedOrders.slice(0, 3);
      const activeShipmentOrders = sortedOrders
        .filter(order => SHIPMENT_STATUSES.has(order.status))
        .slice(0, 3);

      const idsToResolve = [...new Set([
        ...recentOrders,
        ...activeShipmentOrders,
      ]
        .map(order => order.pharmaID)
        .filter(Boolean))];

      const resolvedNames = await Promise.all(
        idsToResolve.map(async (pharmaID) => {
          const pharmacy = await pharmacyService.getPharmacyById(pharmaID);
          return [pharmaID, pharmacy?.name || pharmaID] as const;
        })
      );

      const namesMap = Object.fromEntries(resolvedNames);

      const resolvedShipments = await Promise.all(
        activeShipmentOrders.map(async (order) => {
          const delivery = await distributorOrderService.getDelivery(order._id).catch(() => null);
          return {
            order,
            pharmacyName: getPharmacyName(namesMap, order.pharmaID),
            delivery,
          };
        })
      );

      setOrders(sortedOrders);
      setPharmacyNames(namesMap);
      setShipmentRows(resolvedShipments);
      setLastSyncedAt(new Date().toISOString());
    } catch (err: any) {
      setError(err?.message || 'Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    void loadDashboard();
  }, [user?.id]);

  const totalOrders = orders.length;
  const activeShipments = orders.filter(order => ACTIVE_SHIPMENT_STATUSES.has(order.status)).length;
  const revenue = orders
    .filter(order => order.paymentStatus === 'PAID')
    .reduce((sum, order) => sum + Number(order.grandTotal || 0), 0);
  const pendingOrders = orders.filter(order => order.status === 'PLACED').length;

  const recentOrders = orders.slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-sky-50 px-6 py-6 text-slate-900 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500"></p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              Welcome back, {user?.name || 'there'}
            </h1>
            <p className="mt-2 text-sm text-slate-600 md:text-base">
              Here's a quick overview of your distributor orders and shipments. Dive in to manage your deliveries and track your performance.
            </p>
          </div>

          <button
            type="button"
            onClick={loadDashboard}
            disabled={isLoading}
            className="inline-flex items-center gap-2 self-start rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-sky-300 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Refreshing' : 'Refresh'}
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Total Orders"
            value={isLoading && totalOrders === 0 ? '...' : String(totalOrders)}
            caption={totalOrders > 0 ? 'All distributor orders from the order service' : 'No orders found yet'}
            icon={<Package className="h-6 w-6 text-sky-600" />}
            iconBg="bg-sky-100"
          />
          <SummaryCard
            title="Active Shipments"
            value={isLoading && totalOrders === 0 ? '...' : String(activeShipments)}
            caption={activeShipments > 0 ? 'Orders currently dispatched or picked up' : 'No dispatches are active right now'}
            icon={<Truck className="h-6 w-6 text-emerald-600" />}
            iconBg="bg-emerald-100"
          />
          <SummaryCard
            title="Revenue"
            value={isLoading && totalOrders === 0 ? '...' : formatCurrency(revenue)}
            caption="Only paid orders are counted, matching the pay route in the backend"
            icon={<IndianRupee className="h-6 w-6 text-violet-600" />}
            iconBg="bg-violet-100"
          />
          <SummaryCard
            title="Pending Orders"
            value={isLoading && totalOrders === 0 ? '...' : String(pendingOrders)}
            caption={pendingOrders > 0 ? 'Waiting for distributor acceptance' : 'No orders are awaiting acceptance'}
            icon={<Clock className="h-6 w-6 text-amber-600" />}
            iconBg="bg-amber-100"
          />
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50/80">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-red-600" />
            <div>
              <p className="font-semibold text-red-800">Dashboard could not be refreshed</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardHeader className="border-b border-slate-100 bg-white">
            <CardTitle className="flex items-center gap-2 text-black">
              <Clock className="h-5 w-5 text-sky-600" />
              Recent Orders
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {recentOrders.length === 0 ? (
              <EmptyState
                icon={<Package className="h-6 w-6 text-slate-400" />}
                title="No orders yet"
                description="Recent distributor orders will appear here once pharmacies start placing orders."
              />
            ) : (
              <div className="space-y-3">
                {recentOrders.map(order => {
                  const statusMeta = getOrderStatusMeta(order.status);
                  return (
                    <div key={order._id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:bg-sky-50/40">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-semibold text-black">{order.orderNumber || order._id}</p>
                          <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                        </div>
                        <p className="mt-1 truncate text-sm text-slate-600">{getPharmacyName(pharmacyNames, order.pharmaID)}</p>
                        <p className="mt-1 text-xs text-slate-500">{formatTimeAgo(order.placedAt || order.updatedAt)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-black">{formatCurrency(Number(order.grandTotal || 0))}</p>
                        <p className="text-xs text-slate-500">Grand total</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-white">
          <CardHeader className="border-b border-slate-100 bg-white">
            <CardTitle className="flex items-center gap-2 text-black">
              <Truck className="h-5 w-5 text-emerald-600" />
              Shipment Details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {shipmentRows.length === 0 ? (
              <EmptyState
                icon={<Truck className="h-6 w-6 text-slate-400" />}
                title="No active shipments"
                description="Dispatched orders will appear here with driver, vehicle, and route details."
              />
            ) : (
              <div className="space-y-3">
                {shipmentRows.map(({ order, pharmacyName, delivery }) => {
                  const shipmentMeta = getShipmentMeta(delivery?.status || order.status);
                  const shipmentParts = [
                    delivery?.driverName ? `Driver: ${delivery.driverName}` : null,
                    delivery?.vehicleNumber ? `Vehicle: ${delivery.vehicleNumber}` : null,
                    delivery?.driverPhone ? `Phone: ${delivery.driverPhone}` : null,
                    delivery?.distanceKm != null ? `Distance: ${delivery.distanceKm.toFixed(1)} km` : null,
                  ].filter(Boolean) as string[];
                  return (
                    <div key={order._id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate font-semibold text-black">{order.orderNumber || order._id}</p>
                            <Badge variant={shipmentMeta.variant}>{shipmentMeta.label}</Badge>
                          </div>
                          <p className="mt-1 truncate text-sm text-slate-600">{pharmacyName}</p>
                        </div>
                        <div className="text-right text-xs text-slate-500">
                          <p>{formatTimeAgo(delivery?.createdAt || order.updatedAt || order.placedAt)}</p>
                          <p>Dispatch time</p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        {shipmentParts.length > 0 ? (
                          <span>{shipmentParts.join(' · ')}</span>
                        ) : (
                          <span>Shipment details not available yet</span>
                        )}
                        <span className="ml-auto flex items-center gap-1.5 text-slate-700">

                        </span>
                        <span className="flex items-center gap-1.5 font-medium text-slate-700">
                          View order
                          <ArrowRight className="h-3.5 w-3.5" />
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



    </div>
  );
}

function SummaryCard({
  title,
  value,
  caption,
  icon,
  iconBg,
}: {
  title: string;
  value: string;
  caption: string;
  icon: React.ReactNode;
  iconBg: string;
}) {
  return (
    <Card className="border-white/10 bg-white/95 shadow-[0_14px_40px_rgba(15,23,42,0.12)] backdrop-blur">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-black">{value}</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">{caption}</p>
          </div>
          <div className={`flex h-12 w-12 items-center justify-center rounded-full ${iconBg}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
        {icon}
      </div>
      <p className="mt-4 font-semibold text-black">{title}</p>
      <p className="mt-2 max-w-sm text-sm text-slate-500">{description}</p>
    </div>
  );
}


