import {
  Card, CardContent, CardHeader, CardTitle, CardDescription
} from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Download, Plus, Building2, CheckCircle,Wrench, Truck, Navigation, MapPin, Package,Search,Filter, Ban,Clock, DollarSign, Eye, Edit, Bell, AlertTriangle } from "lucide-react";

import { Badge } from '../components/ui/Badge';

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
export default function VehiclesPage() {
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
    }