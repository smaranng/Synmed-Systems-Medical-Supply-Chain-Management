import { OrderStatus } from '@/types/order';
import { Badge } from '@/components/ui/badge';
import { Package, Clock, Truck, CheckCircle, XCircle, PackageCheck } from 'lucide-react';

interface StatusBadgeProps {
  status: OrderStatus;
}

const statusConfig = {
  pending: {
    label: 'Pending',
    variant: 'pending' as const,
    icon: Clock,
  },
  processing: {
    label: 'Processing',
    variant: 'secondary' as const,
    icon: Package,
  },
  'in-transit': {
    label: 'In Transit',
    variant: 'default' as const,
    icon: Truck,
  },
  'out-for-delivery': {
    label: 'Out for Delivery',
    variant: 'warning' as const,
    icon: PackageCheck,
  },
  delivered: {
    label: 'Delivered',
    variant: 'success' as const,
    icon: CheckCircle,
  },
  cancelled: {
    label: 'Cancelled',
    variant: 'destructive' as const,
    icon: XCircle,
  },
};

export const StatusBadge = ({ status }: StatusBadgeProps) => {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="flex items-center gap-1.5 px-3 py-1">
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </Badge>
  );
};
