import { useParams, useNavigate } from 'react-router-dom';
import { mockOrders } from '@/data/mockOrders';
import { TrackingTimeline } from '@/components/TrackingTimeline';
import { DeliveryMap } from '@/components/DeliveryMap';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Calendar, DollarSign, MapPin, Package, Truck } from 'lucide-react';

const OrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const order = mockOrders.find((o) => o.id === id);

  if (!order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">Order not found</h2>
          <Button onClick={() => navigate('/')} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Orders
          </Button>
        </div>
      </div>
    );
  }

  const showMap = order.status === 'out-for-delivery' && order.currentLocation && order.destination;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="mb-4 -ml-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Orders
          </Button>
          
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">{order.orderNumber}</h1>
              <p className="text-muted-foreground">{order.distributorName}</p>
            </div>
            <StatusBadge status={order.status} />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Order Details */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Order Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Order Date</p>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <p className="font-medium">
                      {new Date(order.orderDate).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>

                <Separator />

                <div>
                  <p className="text-sm text-muted-foreground mb-1">Estimated Delivery</p>
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-secondary" />
                    <p className="font-medium">
                      {new Date(order.estimatedDelivery).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>

                <Separator />

                <div>
                  <p className="text-sm text-muted-foreground mb-1">Medicine Count</p>
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-primary" />
                    <p className="font-medium">{order.medicineCount} items</p>
                  </div>
                </div>

                <Separator />

                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Amount</p>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-success" />
                    <p className="text-xl font-bold text-success">
                      ₹{order.totalAmount.toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>

                {order.destination && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Delivery Address</p>
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-secondary mt-1 flex-shrink-0" />
                        <p className="text-sm">{order.destination.address}</p>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Tracking Timeline and Map */}
          <div className="lg:col-span-2 space-y-6">
            {showMap && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-secondary" />
                    Live Tracking
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <DeliveryMap
                    currentLocation={order.currentLocation!}
                    destination={order.destination!}
                  />
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-primary" />
                  Tracking Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TrackingTimeline hubs={order.hubs} />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default OrderDetail;
