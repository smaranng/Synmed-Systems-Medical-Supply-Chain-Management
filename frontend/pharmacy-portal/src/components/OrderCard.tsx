import { Order } from '@/types/order';
import { Card, CardContent } from '@/components/ui/Card';
import { StatusBadge } from './StatusBadge';
import { Calendar, Package, DollarSign, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface OrderCardProps {
  order: Order;
}

export const OrderCard = ({ order }: OrderCardProps) => {
  const navigate = useNavigate();

  return (
    <Card
      className="hover:shadow-lg transition-all duration-300 cursor-pointer border-border hover:border-primary/50"
      onClick={() => navigate(`/dashboard/order/${order.id}`)
      }
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-1">{order.orderNumber}</h3>
            <p className="text-sm text-muted-foreground">{order.distributorName}</p>
          </div>
          <StatusBadge status={order.status} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center text-sm text-foreground">
            <Package className="h-4 w-4 mr-2 text-primary" />
            <span className="font-medium">{order.medicineCount}</span>
            <span className="text-muted-foreground ml-1">medicines</span>
          </div>

          <div className="flex items-center text-sm text-foreground">
            <Calendar className="h-4 w-4 mr-2 text-primary" />
            <span className="text-muted-foreground">Est. Delivery:</span>
            <span className="font-medium ml-1">
              {new Date(order.estimatedDelivery).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>

          <div className="flex items-center text-sm text-foreground">
            <DollarSign className="h-4 w-4 mr-2 text-primary" />
            <span className="font-semibold">₹{order.totalAmount.toLocaleString('en-IN')}</span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
          <span className="text-sm text-muted-foreground">View Details</span>
          <ChevronRight className="h-5 w-5 text-primary" />
        </div>
      </CardContent>
    </Card>
  );
};
