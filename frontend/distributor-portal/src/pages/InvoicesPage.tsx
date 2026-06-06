import { Card, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Plus, Download, Eye, Edit, DollarSign, AlertTriangle, CheckCircle } from "lucide-react";
import { Badge } from "../components/ui/Badge";
const mockInvoices = [
  {
    id: 'INV-001',
    customer: 'MediCare Pharmacy',
    amount: 1250.00,
    status: 'pending',
    dueDate: '2024-01-25',
    createdDate: '2024-01-15'
  },
  {
    id: 'INV-002',
    customer: 'Health Plus Pharmacy',
    amount: 890.50,
    status: 'paid',
    dueDate: '2024-01-20',
    createdDate: '2024-01-10'
  },
  {
    id: 'INV-003',
    customer: 'QuickMed Pharmacy',
    amount: 2100.75,
    status: 'overdue',
    dueDate: '2024-01-10',
    createdDate: '2024-01-05'
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
export default function InvoicesPage() {
  return (
<div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-black mb-2">Invoice Management</h1>
                <p className="text-gray-600">Manage your invoices and payments</p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Invoice
                </Button>
              </div>
            </div>

            {/* Invoice Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Outstanding</p>
                      <p className="text-2xl font-bold text-black">₹12,450.00</p>
                    </div>
                    <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center">
                      <DollarSign className="h-6 w-6 text-orange-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Overdue Invoices</p>
                      <p className="text-2xl font-bold text-black">3</p>
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
                      <p className="text-sm font-medium text-gray-600">Paid This Month</p>
                      <p className="text-2xl font-bold text-black">₹28,750.00</p>
                    </div>
                    <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Invoices Table */}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {mockInvoices.map((invoice, index) => (
                        <tr key={invoice.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-black">{invoice.id}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{invoice.customer}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${invoice.amount.toFixed(2)}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(invoice.status)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{invoice.dueDate}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{invoice.createdDate}</td>
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
