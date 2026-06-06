import {
  Card, CardContent, CardHeader, CardTitle, CardDescription
} from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Download, Plus, Building2, CheckCircle, Truck, Package,Search,Filter, Ban,Clock, DollarSign, Eye, Edit, Bell, AlertTriangle } from "lucide-react";

import { Badge } from '../components/ui/Badge';

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

export default function OrdersPage() {
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
    }