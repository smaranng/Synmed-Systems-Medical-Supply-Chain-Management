import { useEffect, useState } from "react";
import { adminService } from "../services/adminService";
import { UserStats, Registration } from "../services/adminService";
import {
  Activity,
  AlertTriangle,
  Bell,
  Package,
  Server,
  Truck,
  Users,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import { useAuth } from "../hooks/useAuth";
import { Badge } from "../components/ui/Badge";
const mockSystemStatus = [
  {
    service: "API Gateway",
    status: "online",
    uptime: "99.9%",
    responseTime: "45ms",
  },
  {
    service: "Database",
    status: "online",
    uptime: "99.8%",
    responseTime: "12ms",
  },
  {
    service: "Redis Cache",
    status: "online",
    uptime: "99.9%",
    responseTime: "2ms",
  },
  {
    service: "Message Queue",
    status: "degraded",
    uptime: "95.2%",
    responseTime: "120ms",
  },
  {
    service: "File Storage",
    status: "online",
    uptime: "99.7%",
    responseTime: "8ms",
  },
  {
    service: "Email Service",
    status: "online",
    uptime: "99.5%",
    responseTime: "250ms",
  },
];

const mockAlerts = [
  {
    id: "ALT-001",
    type: "warning",
    title: "High CPU Usage",
    description: "Server CPU usage is at 85%",
    timestamp: "2024-01-15T14:30:00Z",
    status: "active",
  },
  {
    id: "ALT-002",
    type: "error",
    title: "Database Connection Pool Exhausted",
    description: "Connection pool is at 95% capacity",
    timestamp: "2024-01-15T13:45:00Z",
    status: "resolved",
  },
];
const getStatusBadge = (status: string) => {
  const statusMap = {
    active: { variant: "success" as const, label: "Active" },
    inactive: { variant: "inactive" as const, label: "Inactive" },
    pending: { variant: "pending" as const, label: "Pending" },
    approved: { variant: "approved" as const, label: "Approved" },
    rejected: { variant: "rejected" as const, label: "Rejected" },
    suspended: { variant: "warning" as const, label: "Suspended" },
    online: { variant: "online" as const, label: "Online" },
    offline: { variant: "offline" as const, label: "Offline" },
    degraded: { variant: "degraded" as const, label: "Degraded" },
  };

  const statusInfo = statusMap[status as keyof typeof statusMap] || {
    variant: "default" as const,
    label: status,
  };
  return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
};

const getAlertIcon = (type: string) => {
  switch (type) {
    case "error":
      return <AlertTriangle className="w-4 h-4 text-red-500" />;
    case "warning":
      return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    case "info":
      return <Bell className="w-4 h-4 text-blue-500" />;
    default:
      return <Bell className="w-4 h-4 text-gray-500" />;
  }
};

const getRegistrationTypeLabel = (type: string) => {
  const typeMap = {
    customer: "New Customer Registration",
    distributor: "New distributor Registration",
    admin: "New Admin Registration",
    pharmacy: "New Pharmacy Registration",
  };
  return typeMap[type as keyof typeof typeMap] || "New Registration";
};
export default function OverviewPage() {
  const { user } = useAuth();
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [weeklyRegistrations, setWeeklyRegistrations] = useState<Registration[]>([]);

  const [statsLoading, setStatsLoading] = useState(true);
  const [registrationsLoading, setRegistrationsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const stats = await adminService.getUserStats();
        setUserStats(stats);
      } catch (err) {
        console.error(err);
      } finally {
        setStatsLoading(false);
      }
    };

    fetchStats();
  }, []);

  useEffect(() => {
    const fetchRegistrations = async () => {
      try {
        const registrations = await adminService.getWeeklyRegistrations();
        setWeeklyRegistrations(registrations);
      } catch (err) {
        console.error(err);
      } finally {
        setRegistrationsLoading(false);
      }
    };

    fetchRegistrations();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-black mb-2">System Overview</h1>
        <p className="text-gray-600">
          Welcome back, {user?.name}. Here's your system dashboard.
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-black">
                  {statsLoading || !userStats
                    ? "—"
                    : userStats.total.toLocaleString()}
                </p>

                <p
                  className={`text-xs flex items-center gap-1 ${
                    !statsLoading && userStats && userStats.growth >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {statsLoading || !userStats ? (
                    "—"
                  ) : (
                    <>
                      {userStats.growth >= 0 ? "▲ " : "▼ "}
                      {Math.abs(userStats.growth)}% this month
                    </>
                  )}
                </p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600" />
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
                <p className="text-2xl font-bold text-black">8,942</p>
                <p className="text-xs text-green-600">+8% this month</p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                <Package className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Active Shipments
                </p>
                <p className="text-2xl font-bold text-black">284</p>
                <p className="text-xs text-blue-600">23 in transit</p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Truck className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  System Alerts
                </p>
                <p className="text-2xl font-bold text-red-600">7</p>
                <p className="text-xs text-red-600">Requires attention</p>
              </div>
              <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Status and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Server className="w-5 h-5 mr-2 text-blue-600" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mockSystemStatus.map((service) => (
                <div
                  key={service.service}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-black">{service.service}</p>
                    <p className="text-sm text-gray-600">
                      Uptime: {service.uptime} • {service.responseTime}
                    </p>
                  </div>
                  {getStatusBadge(service.status)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Activity className="w-5 h-5 mr-2 text-green-600" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {registrationsLoading ? (
                <p className="text-sm text-gray-600">Loading registrations...</p>
              ) : weeklyRegistrations.length === 0 ? (
                <p className="text-sm text-gray-600">No new registrations this week</p>
              ) : (
                weeklyRegistrations.slice(0, 3).map((reg) => (
                  <div
                    key={reg.id}
                    className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-shrink-0 mt-1">
                      <Bell className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-black">
                        {getRegistrationTypeLabel(reg.type)}
                      </p>
                      <p className="text-sm text-gray-600">
                        {reg.name} ({reg.email})
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(reg.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <Badge variant="success">New</Badge>
                    </div>
                  </div>
                ))
              )}
              {!registrationsLoading && mockAlerts.length > 0 && (
                <>
                  {mockAlerts.slice(0, 3).map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-shrink-0 mt-1">
                        {getAlertIcon(alert.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-black">{alert.title}</p>
                        <p className="text-sm text-gray-600">{alert.description}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(alert.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        {getStatusBadge(alert.status)}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
