import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Plus, RefreshCw, Eye, Package, Truck, Clock } from "lucide-react";
import { CardDescription } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
const mockShipments = [
  {
    id: 'SHIP-001',
    orderId: 'ORD-001',
    destination: 'MediCare Pharmacy',
    status: 'in_transit',
    trackingNumber: 'TRK123456789',
    estimatedDelivery: '2024-01-18',
    carrier: 'FedEx'
  },
  {
    id: 'SHIP-002',
    orderId: 'ORD-002',
    destination: 'Health Plus Pharmacy',
    status: 'processing',
    trackingNumber: 'TRK987654321',
    estimatedDelivery: '2024-01-20',
    carrier: 'UPS'
  },
  {
    id: 'SHIP-003',
    orderId: 'ORD-003',
    destination: 'QuickMed Pharmacy',
    status: 'delivered',
    trackingNumber: 'TRK456789123',
    estimatedDelivery: '2024-01-15',
    carrier: 'DHL'
  }
];

  const getStatusBadge = (status: string) => {
    const statusMap = {
      pending: { variant: 'warning' as const, label: 'Pending' },
      processing: { variant: 'info' as const, label: 'Processing' },
      shipped: { variant: 'shipped' as const, label: 'Shipped' },
      delivered: { variant: 'delivered' as const, label: 'Delivered' },
      cancelled: { variant: 'cancelled' as const, label: 'Cancelled' },
      paid: { variant: 'success' as const, label: 'Paid' },
      overdue: { variant: 'destructive' as const, label: 'Overdue' },
      active: { variant: 'success' as const, label: 'Active' },
      out_of_stock: { variant: 'destructive' as const, label: 'Out of Stock' },
      in_transit: { variant: 'processing' as const, label: 'In Transit' }
    };

    const statusInfo = statusMap[status as keyof typeof statusMap] || { variant: 'default' as const, label: status };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const priorityMap = {
      high: { variant: 'destructive' as const, label: 'High' },
      medium: { variant: 'warning' as const, label: 'Medium' },
      low: { variant: 'success' as const, label: 'Low' }
    };

    const priorityInfo = priorityMap[priority as keyof typeof priorityMap] || { variant: 'default' as const, label: priority };
    return <Badge variant={priorityInfo.variant}>{priorityInfo.label}</Badge>;
  };
export default function ShipmentsPage() {
  return (
<div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-black mb-2">Shipment Tracking</h1>
                <p className="text-gray-600">Track and manage all your shipments</p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Shipment
                </Button>
              </div>
            </div>

            {/* Shipments Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {mockShipments.map((shipment) => (
                <Card key={shipment.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg text-black">{shipment.id}</CardTitle>
                        <CardDescription className="text-gray-600">{shipment.destination}</CardDescription>
                      </div>
                      {getStatusBadge(shipment.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center text-sm text-gray-600">
                        <Package className="w-4 h-4 mr-2" />
                        <span className="font-medium">Order:</span>
                        <span className="ml-2">{shipment.orderId}</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Truck className="w-4 h-4 mr-2" />
                        <span className="font-medium">Carrier:</span>
                        <span className="ml-2">{shipment.carrier}</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Clock className="w-4 h-4 mr-2" />
                        <span className="font-medium">ETA:</span>
                        <span className="ml-2">{shipment.estimatedDelivery}</span>
                      </div>
                    </div>
                    <div className="pt-2 border-t">
                      <p className="text-xs text-gray-500 mb-2">Tracking Number</p>
                      <p className="text-sm font-mono bg-gray-100 p-2 rounded">{shipment.trackingNumber}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button className="flex-1" size="sm">
                        Track Package
                      </Button>
                      <Button variant="outline" size="sm">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

  );
}
