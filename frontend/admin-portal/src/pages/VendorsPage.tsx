import { useEffect, useState } from "react";
import { adminService, UserStats } from "../services/adminService";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import {
  Download,
  Plus,
  Building2,
  CheckCircle,
  Clock,
  DollarSign,
  Eye,
  Edit,
  Bell,
  AlertTriangle,
} from "lucide-react";

import { Badge } from "../components/ui/Badge";
const mockdistributors = [
  {
    id: "VND-001",
    name: "MedSupply Solutions",
    email: "distributor@medsupply.com",
    status: "approved",
    licenseNumber: "VND-2024-001",
    registrationDate: "2024-01-10",
    totalOrders: 45,
    revenue: 125000,
  },
  {
    id: "VND-002",
    name: "PharmaDist Ltd",
    email: "contact@pharmadist.com",
    status: "pending",
    licenseNumber: "VND-2024-002",
    registrationDate: "2024-01-12",
    totalOrders: 0,
    revenue: 0,
  },
  {
    id: "VND-003",
    name: "MediSource Corp",
    email: "info@medisource.com",
    status: "approved",
    licenseNumber: "VND-2023-156",
    registrationDate: "2023-11-15",
    totalOrders: 89,
    revenue: 245000,
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

export default function distributorsPage() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await adminService.getUserStats();
        setStats(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-black mb-2">
            distributor Management
          </h1>
          <p className="text-gray-600">
            Manage distributor registrations and approvals
          </p>
        </div>
        <div className="flex gap-3">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add distributor
          </Button>
        </div>
      </div>

      {/* distributor Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total distributors
                </p>
                <p className="text-2xl font-bold text-black">
                  {loading || !stats ? "—" : stats.distributors.toLocaleString()}
                </p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Building2 className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Approved</p>
                <p className="text-2xl font-bold text-black">142</p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-black">12</p>
              </div>
              <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center">
                <Clock className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total Revenue
                </p>
                <p className="text-2xl font-bold text-black">₹2.4M</p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* distributors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockdistributors.map((distributor) => (
          <Card key={distributor.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg text-black">
                    {distributor.name}
                  </CardTitle>
                  <CardDescription className="text-gray-600">
                    {distributor.email}
                  </CardDescription>
                </div>
                {getStatusBadge(distributor.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">License:</span>
                  <span className="font-medium text-black">
                    {distributor.licenseNumber}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Orders:</span>
                  <span className="font-medium text-black">
                    {distributor.totalOrders}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Revenue:</span>
                  <span className="font-medium text-black">
                    ${distributor.revenue.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Registered:</span>
                  <span className="font-medium text-black">
                    {distributor.registrationDate}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" size="sm">
                  <Eye className="w-4 h-4 mr-2" />
                  View
                </Button>
                <Button variant="outline" size="sm">
                  <Edit className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
