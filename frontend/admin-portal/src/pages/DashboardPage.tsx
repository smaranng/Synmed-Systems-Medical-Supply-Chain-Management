import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import SideBarLayout from '../components/SidebarLayout';
import {
  Activity,
  AlertTriangle,
  Ban,
  BarChart3,
  Bell,
  Building2,
  Calendar,
  CheckCircle,
  CheckCircle2,
  Clock,
  Database,
  DollarSign,
  Download,
  Edit,
  Eye,
  FileText,
  Filter,
  Home,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Navigation,
  Package,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Server,
  Settings,
  Shield,
  ShipIcon,
  Trash2,
  TrendingUp,
  Truck,
  Unlock,
  User,
  Users,
  Wrench,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const sidebarItems = [
  { id: 'overview', label: 'Overview', icon: Home },
  // { id: 'users', label: 'User Management', icon: Users },
  { id: 'distributors', label: 'distributors', icon: Building2 },
  { id: 'pharmacies', label: 'Pharmacies', icon: Package },
  { id: 'orders', label: 'Orders', icon: Truck },
  //{ id: 'analytics', label: 'Analytics', icon: BarChart3 },
  //{ id: 'system', label: 'System', icon: Server },
  { id: 'vehicles', label: 'Transport & Shipments', icon: ShipIcon },
  { id: 'settings', label: 'Settings', icon: Settings },
];
// Top of file (with other mocks)
const mockVehicles = [
  {
    id: 'TRK-001',
    truckNumber: 'MH12 AB 2345',
    driver: 'Rahul Patil',
    route: 'Mumbai → Pune',
    shipmentId: 'SHP-9823',
    status: 'in_transit', // idle | in_transit | delayed | maintenance
    lastLocation: 'Lonavala Toll Plaza',
    capacityUsed: 78, // %
    loadType: 'Pharma',
    lastUpdated: '2025-12-09 16:32',
  },
  {
    id: 'TRK-002',
    truckNumber: 'KA09 CD 4411',
    driver: 'Anita Rao',
    route: 'Bangalore → Chennai',
    shipmentId: 'SHP-9824',
    status: 'idle',
    lastLocation: 'Bangalore Warehouse',
    capacityUsed: 0,
    loadType: 'Empty',
    lastUpdated: '2025-12-09 15:05',
  },
  {
    id: 'TRK-003',
    truckNumber: 'GJ05 EF 7710',
    driver: 'Vikram Shah',
    route: 'Ahmedabad → Surat',
    shipmentId: 'SHP-9825',
    status: 'delayed',
    lastLocation: 'NH48 KM 214',
    capacityUsed: 92,
    loadType: 'Critical Medicines',
    lastUpdated: '2025-12-09 14:10',
  },
  {
    id: 'TRK-004',
    truckNumber: 'DL01 GH 9900',
    driver: 'Neha Singh',
    route: 'Delhi → Jaipur',
    shipmentId: 'SHP-9826',
    status: 'maintenance',
    lastLocation: 'Delhi Service Center',
    capacityUsed: 0,
    loadType: '—',
    lastUpdated: '2025-12-08 10:45',
  },
];

const getVehicleStatusBadge = (status: string) => {
  switch (status) {
    case 'in_transit':
      return (
        <Badge variant="success" className="flex items-center gap-1">
          <Truck className="w-3 h-3" />
          In Transit
        </Badge>
      );
    case 'idle':
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Idle
        </Badge>
      );
    case 'delayed':
      return (
        <Badge variant="warning" className="flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Delayed
        </Badge>
      );
    case 'maintenance':
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <Wrench className="w-3 h-3" />
          Maintenance
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const mockUsers = [
  {
    id: 'USR-001',
    name: 'John Smith',
    email: 'john@example.com',
    role: 'customer',
    status: 'active',
    lastLogin: '2024-01-15',
    registrationDate: '2023-06-15'
  },
  {
    id: 'USR-002',
    name: 'MediCare Pharmacy',
    email: 'pharmacy@medicare.com',
    role: 'pharmacy',
    status: 'active',
    lastLogin: '2024-01-14',
    registrationDate: '2023-08-20'
  },
  {
    id: 'USR-003',
    name: 'MedSupply Solutions',
    email: 'distributor@medsupply.com',
    role: 'distributor',
    status: 'pending',
    lastLogin: '2024-01-13',
    registrationDate: '2024-01-10'
  },
  {
    id: 'USR-004',
    name: 'Health Plus Pharmacy',
    email: 'info@healthplus.com',
    role: 'pharmacy',
    status: 'active',
    lastLogin: '2024-01-12',
    registrationDate: '2023-09-05'
  },
  {
    id: 'USR-005',
    name: 'Jane Doe',
    email: 'jane@example.com',
    role: 'customer',
    status: 'inactive',
    lastLogin: '2023-12-20',
    registrationDate: '2023-07-10'
  }
];

const mockdistributors = [
  {
    id: 'VND-001',
    name: 'MedSupply Solutions',
    email: 'distributor@medsupply.com',
    status: 'approved',
    licenseNumber: 'VND-2024-001',
    registrationDate: '2024-01-10',
    totalOrders: 45,
    revenue: 125000
  },
  {
    id: 'VND-002',
    name: 'PharmaDist Ltd',
    email: 'contact@pharmadist.com',
    status: 'pending',
    licenseNumber: 'VND-2024-002',
    registrationDate: '2024-01-12',
    totalOrders: 0,
    revenue: 0
  },
  {
    id: 'VND-003',
    name: 'MediSource Corp',
    email: 'info@medisource.com',
    status: 'approved',
    licenseNumber: 'VND-2023-156',
    registrationDate: '2023-11-15',
    totalOrders: 89,
    revenue: 245000
  }
];

const mockPharmacies = [
  {
    id: 'PHM-001',
    name: 'MediCare Pharmacy',
    email: 'pharmacy@medicare.com',
    status: 'active',
    licenseNumber: 'PHM-2024-001',
    location: 'Downtown',
    registrationDate: '2023-08-20',
    totalOrders: 156,
    revenue: 89000
  },
  {
    id: 'PHM-002',
    name: 'Health Plus Pharmacy',
    email: 'info@healthplus.com',
    status: 'active',
    licenseNumber: 'PHM-2024-002',
    location: 'Central District',
    registrationDate: '2023-09-05',
    totalOrders: 203,
    revenue: 156000
  },
  {
    id: 'PHM-003',
    name: 'QuickMed Pharmacy',
    email: 'orders@quickmed.com',
    status: 'suspended',
    licenseNumber: 'PHM-2023-089',
    location: 'Westside',
    registrationDate: '2023-07-15',
    totalOrders: 78,
    revenue: 45000
  }
];

const mockSystemStatus = [
  { service: 'API Gateway', status: 'online', uptime: '99.9%', responseTime: '45ms' },
  { service: 'Database', status: 'online', uptime: '99.8%', responseTime: '12ms' },
  { service: 'Redis Cache', status: 'online', uptime: '99.9%', responseTime: '2ms' },
  { service: 'Message Queue', status: 'degraded', uptime: '95.2%', responseTime: '120ms' },
  { service: 'File Storage', status: 'online', uptime: '99.7%', responseTime: '8ms' },
  { service: 'Email Service', status: 'online', uptime: '99.5%', responseTime: '250ms' }
];

const mockAlerts = [
  {
    id: 'ALT-001',
    type: 'warning',
    title: 'High CPU Usage',
    description: 'Server CPU usage is at 85%',
    timestamp: '2024-01-15T14:30:00Z',
    status: 'active'
  },
  {
    id: 'ALT-002',
    type: 'error',
    title: 'Database Connection Pool Exhausted',
    description: 'Connection pool is at 95% capacity',
    timestamp: '2024-01-15T13:45:00Z',
    status: 'resolved'
  },
  {
    id: 'ALT-003',
    type: 'info',
    title: 'New distributor Registration',
    description: 'PharmaDist Ltd has registered and is pending approval',
    timestamp: '2024-01-15T12:15:00Z',
    status: 'active'
  }
];

const mockOrders = [
  {
    id: 'ORD-001',
    customer: 'MediCare Pharmacy',
    distributor: 'MedSupply Solutions',
    items: 3,
    total: 1250.00,
    status: 'pending',
    priority: 'high',
    date: '2024-01-15',
    paymentStatus: 'pending',
    shippingAddress: '123 Main St, Downtown',
    trackingNumber: 'TRK123456789'
  },
  {
    id: 'ORD-002',
    customer: 'Health Plus Pharmacy',
    distributor: 'PharmaDist Ltd',
    items: 2,
    total: 890.50,
    status: 'processing',
    priority: 'medium',
    date: '2024-01-14',
    paymentStatus: 'paid',
    shippingAddress: '456 Oak Ave, Central District',
    trackingNumber: 'TRK987654321'
  },
  {
    id: 'ORD-003',
    customer: 'QuickMed Pharmacy',
    distributor: 'MediSource Corp',
    items: 5,
    total: 2100.75,
    status: 'shipped',
    priority: 'low',
    date: '2024-01-13',
    paymentStatus: 'paid',
    shippingAddress: '789 Pine St, Westside',
    trackingNumber: 'TRK456789123'
  },
  {
    id: 'ORD-004',
    customer: 'Wellness Pharmacy',
    distributor: 'MedSupply Solutions',
    items: 1,
    total: 450.00,
    status: 'delivered',
    priority: 'medium',
    date: '2024-01-12',
    paymentStatus: 'paid',
    shippingAddress: '321 Elm St, Eastside',
    trackingNumber: 'TRK789123456'
  },
  {
    id: 'ORD-005',
    customer: 'CityMed Pharmacy',
    distributor: 'PharmaDist Ltd',
    items: 4,
    total: 1750.25,
    status: 'cancelled',
    priority: 'high',
    date: '2024-01-11',
    paymentStatus: 'refunded',
    shippingAddress: '654 Maple Ave, Northside',
    trackingNumber: null
  }
];

const mockAnalytics = {
  revenue: {
    total: 2450000,
    monthly: 185000,
    growth: 12.5
  },
  orders: {
    total: 8942,
    monthly: 1247,
    growth: 8.3
  },
  users: {
    total: 2543,
    monthly: 127,
    growth: 15.2
  },
  conversion: {
    rate: 3.2,
    trend: 'up'
  },
  topProducts: [
    { name: 'Paracetamol 500mg', orders: 1247, revenue: 31250 },
    { name: 'Amoxicillin 250mg', orders: 892, revenue: 40140 },
    { name: 'Ibuprofen 400mg', orders: 756, revenue: 22680 },
    { name: 'Vitamin D3', orders: 634, revenue: 34870 },
    { name: 'Aspirin 100mg', orders: 523, revenue: 7845 }
  ],
  monthlyData: [
    { month: 'Jan', orders: 1200, revenue: 180000 },
    { month: 'Feb', orders: 1350, revenue: 195000 },
    { month: 'Mar', orders: 1420, revenue: 210000 },
    { month: 'Apr', orders: 1380, revenue: 205000 },
    { month: 'May', orders: 1560, revenue: 230000 },
    { month: 'Jun', orders: 1680, revenue: 245000 }
  ]
};

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [activeSection, setActiveSection] = useState(
    () => localStorage.getItem('activeSection') || 'overview'
  );

  useEffect(() => {
    localStorage.setItem('activeSection', activeSection);
  }, [activeSection]);
  const navigate = useNavigate();
  const handleLogout = () => {
    logout();
    navigate('/');
  };
  const getStatusBadge = (status: string) => {
    const statusMap = {
      active: { variant: 'success' as const, label: 'Active' },
      inactive: { variant: 'inactive' as const, label: 'Inactive' },
      pending: { variant: 'pending' as const, label: 'Pending' },
      approved: { variant: 'approved' as const, label: 'Approved' },
      rejected: { variant: 'rejected' as const, label: 'Rejected' },
      suspended: { variant: 'warning' as const, label: 'Suspended' },
      online: { variant: 'online' as const, label: 'Online' },
      offline: { variant: 'offline' as const, label: 'Offline' },
      degraded: { variant: 'degraded' as const, label: 'Degraded' }
    };

    const statusInfo = statusMap[status as keyof typeof statusMap] || { variant: 'default' as const, label: status };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'error': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'info': return <Bell className="w-4 h-4 text-blue-500" />;
      default: return <Bell className="w-4 h-4 text-gray-500" />;
    }
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-black mb-2">System Overview</h1>
              <p className="text-gray-600">Welcome back, {user?.name}. Here's your system dashboard.</p>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Users</p>
                      <p className="text-2xl font-bold text-black">2,543</p>
                      <p className="text-xs text-green-600">+12% this month</p>
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
                      <p className="text-sm font-medium text-gray-600">Total Orders</p>
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
                      <p className="text-sm font-medium text-gray-600">Active Shipments</p>
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
                      <p className="text-sm font-medium text-gray-600">System Alerts</p>
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
                      <div key={service.service} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-black">{service.service}</p>
                          <p className="text-sm text-gray-600">Uptime: {service.uptime} • {service.responseTime}</p>
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
                    {mockAlerts.slice(0, 3).map((alert) => (
                      <div key={alert.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
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
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case 'users':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-black mb-2">User Management</h1>
                <p className="text-gray-600">Manage system users and their permissions</p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add User
                </Button>
              </div>
            </div>

            {/* User Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Users</p>
                      <p className="text-2xl font-bold text-black">2,543</p>
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
                      <p className="text-sm font-medium text-gray-600">Active Users</p>
                      <p className="text-2xl font-bold text-black">2,156</p>
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
                      <p className="text-sm font-medium text-gray-600">New This Month</p>
                      <p className="text-2xl font-bold text-black">127</p>
                    </div>
                    <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                      <TrendingUp className="h-6 w-6 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Pending Approval</p>
                      <p className="text-2xl font-bold text-black">23</p>
                    </div>
                    <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center">
                      <Clock className="h-6 w-6 text-orange-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Users Table */}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Login</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registered</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {mockUsers.map((user, index) => (
                        <tr key={user.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <p className="text-sm font-medium text-black">{user.name}</p>
                              <p className="text-sm text-gray-600">{user.email}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge variant="info">{user.role}</Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(user.status)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.lastLogin}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.registrationDate}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-2">
                              <Button variant="outline" size="sm">
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button variant="outline" size="sm">
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button variant="outline" size="sm">
                                {user.status === 'active' ? <Ban className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'distributors':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-black mb-2">distributor Management</h1>
                <p className="text-gray-600">Manage distributor registrations and approvals</p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
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
                      <p className="text-sm font-medium text-gray-600">Total distributors</p>
                      <p className="text-2xl font-bold text-black">156</p>
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
                      <p className="text-sm font-medium text-gray-600">Total Revenue</p>
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
                        <CardTitle className="text-lg text-black">{distributor.name}</CardTitle>
                        <CardDescription className="text-gray-600">{distributor.email}</CardDescription>
                      </div>
                      {getStatusBadge(distributor.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">License:</span>
                        <span className="font-medium text-black">{distributor.licenseNumber}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Orders:</span>
                        <span className="font-medium text-black">{distributor.totalOrders}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Revenue:</span>
                        <span className="font-medium text-black">${distributor.revenue.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Registered:</span>
                        <span className="font-medium text-black">{distributor.registrationDate}</span>
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

      case 'pharmacies':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-black mb-2">Pharmacy Management</h1>
                <p className="text-gray-600">Manage pharmacy registrations and operations</p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Pharmacy
                </Button>
              </div>
            </div>

            {/* Pharmacy Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Pharmacies</p>
                      <p className="text-2xl font-bold text-black">89</p>
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
                      <p className="text-sm font-medium text-gray-600">Active</p>
                      <p className="text-2xl font-bold text-black">76</p>
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
                      <p className="text-sm font-medium text-gray-600">Suspended</p>
                      <p className="text-2xl font-bold text-black">8</p>
                    </div>
                    <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
                      <Ban className="h-6 w-6 text-red-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Orders</p>
                      <p className="text-2xl font-bold text-black">1,247</p>
                    </div>
                    <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                      <Truck className="h-6 w-6 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Pharmacies Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {mockPharmacies.map((pharmacy) => (
                <Card key={pharmacy.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg text-black">{pharmacy.name}</CardTitle>
                        <CardDescription className="text-gray-600">{pharmacy.email}</CardDescription>
                      </div>
                      {getStatusBadge(pharmacy.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">License:</span>
                        <span className="font-medium text-black">{pharmacy.licenseNumber}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Location:</span>
                        <span className="font-medium text-black">{pharmacy.location}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Orders:</span>
                        <span className="font-medium text-black">{pharmacy.totalOrders}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Revenue:</span>
                        <span className="font-medium text-black">${pharmacy.revenue.toLocaleString()}</span>
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

      case 'system':
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-black mb-2">System Monitoring</h1>
              <p className="text-gray-600">Monitor system health and performance metrics</p>
            </div>

            {/* System Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">System Uptime</p>
                      <p className="text-2xl font-bold text-black">99.9%</p>
                      <p className="text-xs text-green-600">Last 30 days</p>
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
                      <p className="text-sm font-medium text-gray-600">Active Alerts</p>
                      <p className="text-2xl font-bold text-red-600">3</p>
                      <p className="text-xs text-red-600">Requires attention</p>
                    </div>
                    <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
                      <AlertTriangle className="h-6 w-6 text-red-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Database Size</p>
                      <p className="text-2xl font-bold text-black">2.4 GB</p>
                      <p className="text-xs text-blue-600">+15% this month</p>
                    </div>
                    <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <Database className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* System Services */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Server className="w-5 h-5 mr-2 text-blue-600" />
                  Service Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockSystemStatus.map((service) => (
                    <div key={service.service} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <div className={`w-3 h-3 rounded-full ${service.status === 'online' ? 'bg-green-500' :
                            service.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
                            }`}></div>
                        </div>
                        <div>
                          <p className="font-medium text-black">{service.service}</p>
                          <p className="text-sm text-gray-600">Response Time: {service.responseTime}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-black">{service.uptime}</p>
                        {getStatusBadge(service.status)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'orders':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-black mb-2">Order Management</h1>
                <p className="text-gray-600">Monitor and manage all system orders</p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Order
                </Button>
              </div>
            </div>

            {/* Order Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Orders</p>
                      <p className="text-2xl font-bold text-black">8,942</p>
                      <p className="text-xs text-green-600">+8% this month</p>
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
                      <p className="text-sm font-medium text-gray-600">Pending Orders</p>
                      <p className="text-2xl font-bold text-black">156</p>
                      <p className="text-xs text-orange-600">Requires attention</p>
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
                      <p className="text-sm font-medium text-gray-600">In Transit</p>
                      <p className="text-2xl font-bold text-black">284</p>
                      <p className="text-xs text-blue-600">Active shipments</p>
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
                      <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                      <p className="text-2xl font-bold text-black">₹2.4M</p>
                      <p className="text-xs text-green-600">+12% this month</p>
                    </div>
                    <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                      <DollarSign className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <input
                        type="text"
                        placeholder="Search orders..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <select className="px-4 py-2 border border-gray-300 rounded-md bg-white text-sm">
                      <option>All Status</option>
                      <option>Pending</option>
                      <option>Processing</option>
                      <option>Shipped</option>
                      <option>Delivered</option>
                      <option>Cancelled</option>
                    </select>
                    <select className="px-4 py-2 border border-gray-300 rounded-md bg-white text-sm">
                      <option>All Priority</option>
                      <option>High</option>
                      <option>Medium</option>
                      <option>Low</option>
                    </select>
                    <select className="px-4 py-2 border border-gray-300 rounded-md bg-white text-sm">
                      <option>All Payment Status</option>
                      <option>Paid</option>
                      <option>Pending</option>
                      <option>Refunded</option>
                    </select>
                    <Button variant="outline">
                      <Filter className="w-4 h-4 mr-2" />
                      Filters
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Orders Table */}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">distributor</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {mockOrders.map((order, index) => (
                        <tr key={order.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-black">{order.id}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.customer}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.distributor}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.items}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${order.total.toFixed(2)}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(order.status)}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge variant={order.priority === 'high' ? 'destructive' : order.priority === 'medium' ? 'warning' : 'success'}>
                              {order.priority}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge variant={order.paymentStatus === 'paid' ? 'success' : order.paymentStatus === 'pending' ? 'warning' : 'destructive'}>
                              {order.paymentStatus}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.date}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-2">
                              <Button variant="outline" size="sm">
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button variant="outline" size="sm">
                                <Edit className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'analytics':
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-black mb-2">Analytics Dashboard</h1>
              <p className="text-gray-600">Comprehensive analytics and business insights</p>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                      <p className="text-2xl font-bold text-black">${mockAnalytics.revenue.total.toLocaleString()}</p>
                      <p className="text-xs text-green-600">+{mockAnalytics.revenue.growth}% this month</p>
                    </div>
                    <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                      <DollarSign className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Orders</p>
                      <p className="text-2xl font-bold text-black">{mockAnalytics.orders.total.toLocaleString()}</p>
                      <p className="text-xs text-green-600">+{mockAnalytics.orders.growth}% this month</p>
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
                      <p className="text-sm font-medium text-gray-600">Total Users</p>
                      <p className="text-2xl font-bold text-black">{mockAnalytics.users.total.toLocaleString()}</p>
                      <p className="text-xs text-green-600">+{mockAnalytics.users.growth}% this month</p>
                    </div>
                    <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                      <Users className="h-6 w-6 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Conversion Rate</p>
                      <p className="text-2xl font-bold text-black">{mockAnalytics.conversion.rate}%</p>
                      <p className="text-xs text-green-600">Trending {mockAnalytics.conversion.trend}</p>
                    </div>
                    <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center">
                      <TrendingUp className="h-6 w-6 text-orange-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts and Analytics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <BarChart3 className="w-5 h-5 mr-2 text-blue-600" />
                    Monthly Trends
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center py-8">
                      <div className="flex justify-center items-center mb-2">
                        <BarChart3 className="w-10 h-10 text-primary" />
                      </div>
                      <p className="text-gray-600">Revenue and Orders Chart</p>
                      <p className="text-sm text-gray-500">Interactive chart showing monthly trends</p>
                    </div>
                    <div className="space-y-2">
                      {mockAnalytics.monthlyData.slice(-3).map((data) => (
                        <div key={data.month} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-medium text-black">{data.month}</p>
                            <p className="text-sm text-gray-600">{data.orders} orders</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-black">${data.revenue.toLocaleString()}</p>
                            <p className="text-sm text-gray-600">Revenue</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Package className="w-5 h-5 mr-2 text-green-600" />
                    Top Products
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {mockAnalytics.topProducts.map((product, index) => (
                      <div key={product.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-bold text-blue-600">#{index + 1}</span>
                          </div>
                          <div>
                            <p className="font-medium text-black">{product.name}</p>
                            <p className="text-sm text-gray-600">{product.orders} orders</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-black">${product.revenue.toLocaleString()}</p>
                          <p className="text-sm text-gray-600">Revenue</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Performance Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Revenue Growth</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600 mb-2">+{mockAnalytics.revenue.growth}%</div>
                    <p className="text-sm text-gray-600">Monthly growth rate</p>
                    <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full" style={{ width: `${mockAnalytics.revenue.growth * 5}%` }}></div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Order Volume</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600 mb-2">+{mockAnalytics.orders.growth}%</div>
                    <p className="text-sm text-gray-600">Monthly order growth</p>
                    <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${mockAnalytics.orders.growth * 10}%` }}></div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">User Growth</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-purple-600 mb-2">+{mockAnalytics.users.growth}%</div>
                    <p className="text-sm text-gray-600">Monthly user growth</p>
                    <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${mockAnalytics.users.growth * 5}%` }}></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );
      case 'vehicles':
        return (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-black mb-2">Transport & Shipments</h1>
                <p className="text-gray-600">Track trucks, routes, and live shipment status</p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Export Transport Details
                </Button>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Vehicle
                </Button>
              </div>
            </div>

            {/* Fleet Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Vehicles</p>
                      <p className="text-2xl font-bold text-black">124</p>
                      <p className="text-xs text-green-600">+6 added this month</p>
                    </div>
                    <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <Truck className="h-8 w-8 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Active Shipments</p>
                      <p className="text-2xl font-bold text-black">47</p>
                      <p className="text-xs text-blue-600">Live on route</p>
                    </div>
                    <div className="h-12 w-12 bg-indigo-100 rounded-full flex items-center justify-center">
                      <Navigation className="h-6 w-6 text-indigo-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Delayed Shipments</p>
                      <p className="text-2xl font-bold text-black">5</p>
                      <p className="text-xs text-orange-600">Need escalation</p>
                    </div>
                    <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center">
                      <AlertTriangle className="h-6 w-6 text-orange-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Avg. Capacity Used</p>
                      <p className="text-2xl font-bold text-black">82%</p>
                      <p className="text-xs text-green-600">Fleet utilization</p>
                    </div>
                    <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                      <MapPin className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <input
                        type="text"
                        placeholder="Search by truck number, driver, or shipment ID..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    <select className="px-4 py-2 border border-gray-300 rounded-md bg-white text-sm">
                      <option>All Status</option>
                      <option>In Transit</option>
                      <option>Idle</option>
                      <option>Delayed</option>
                      <option>Maintenance</option>
                    </select>
                    <select className="px-4 py-2 border border-gray-300 rounded-md bg-white text-sm">
                      <option>All Load Types</option>
                      <option>Pharma</option>
                      <option>Critical Medicines</option>
                      <option>General</option>
                      <option>Empty</option>
                    </select>
                    <select className="px-4 py-2 border border-gray-300 rounded-md bg-white text-sm">
                      <option>All Routes</option>
                      <option>Short Haul (&lt; 200km)</option>
                      <option>Medium Haul</option>
                      <option>Long Haul</option>
                    </select>
                    <Button variant="outline">
                      <Filter className="w-4 h-4 mr-2" />
                      Filters
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Vehicles & Shipments Table */}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Truck ID
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Truck Number
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Driver
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Route
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Shipment ID
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Last Location
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Capacity Used
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Last Updated
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {mockVehicles.map((vehicle, index) => (
                        <tr
                          key={vehicle.id}
                          className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-black">
                            {vehicle.id}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {vehicle.truckNumber}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {vehicle.driver}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {vehicle.route}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {vehicle.shipmentId}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getVehicleStatusBadge(vehicle.status)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-gray-500" />
                              <span>{vehicle.lastLocation}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="flex items-center gap-2">
                              <span>{vehicle.capacityUsed}%</span>
                              <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${vehicle.capacityUsed > 90
                                    ? 'bg-red-500'
                                    : vehicle.capacityUsed > 70
                                      ? 'bg-yellow-400'
                                      : 'bg-green-500'
                                    }`}
                                  style={{ width: `${vehicle.capacityUsed}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {vehicle.lastUpdated}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-2">
                              <Button variant="outline" size="sm">
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button variant="outline" size="sm">
                                <Edit className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'settings':
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-black mb-2">System Settings</h1>
              <p className="text-gray-600">Configure system parameters and security settings</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Security Settings</CardTitle>
                  <CardDescription>Configure authentication and security policies</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Session Timeout (minutes)</label>
                    <input
                      type="number"
                      defaultValue="30"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Password Policy</label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option>Strong (8+ chars, special chars)</option>
                      <option>Medium (6+ chars)</option>
                      <option>Basic (4+ chars)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Two-Factor Authentication</label>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" defaultChecked className="rounded" />
                      <span className="text-sm text-gray-700">Enable 2FA for all users</span>
                    </div>
                  </div>
                  <Button>Save Security Settings</Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>System Configuration</CardTitle>
                  <CardDescription>Configure system-wide settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">System Name</label>
                    <input
                      type="text"
                      defaultValue="Medical Supply Chain Management"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Maintenance Mode</label>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" className="rounded" />
                      <span className="text-sm text-gray-700">Enable maintenance mode</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Log Level</label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option>Debug</option>
                      <option>Info</option>
                      <option>Warning</option>
                      <option>Error</option>
                    </select>
                  </div>
                  <Button>Save System Settings</Button>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      default:
        return null;
    }
  };
  return (
    <SideBarLayout
      sidebarItems={sidebarItems}
      activeSection={activeSection}
      setActiveSection={setActiveSection}
      user={user}
      handleLogout={handleLogout}
      renderContent={renderContent}
    />
  );
}
