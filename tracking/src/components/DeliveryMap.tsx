import { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation } from 'lucide-react';
import { Button } from './ui/button';

interface DeliveryMapProps {
  currentLocation: {
    latitude: number;
    longitude: number;
  };
  destination: {
    latitude: number;
    longitude: number;
    address: string;
  };
}

export const DeliveryMap = ({ currentLocation, destination }: DeliveryMapProps) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [distance, setDistance] = useState<string>('');

  useEffect(() => {
    // Calculate approximate distance
    const R = 6371; // Earth's radius in km
    const dLat = (destination.latitude - currentLocation.latitude) * Math.PI / 180;
    const dLon = (destination.longitude - currentLocation.longitude) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(currentLocation.latitude * Math.PI / 180) * Math.cos(destination.latitude * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const dist = R * c;
    
    setDistance(dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`);
  }, [currentLocation, destination]);

  return (
    <div className="space-y-4">
      {/* Map placeholder with styled gradient */}
      <div 
        ref={mapContainerRef}
        className="relative w-full h-[400px] rounded-lg overflow-hidden bg-gradient-to-br from-primary/10 via-secondary/10 to-accent border-2 border-border"
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center space-y-4 p-8">
            <div className="relative">
              {/* Animated pulse effect for current location */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 bg-primary/20 rounded-full animate-ping" />
              </div>
              <div className="relative z-10 flex items-center justify-center">
                <div className="bg-primary text-primary-foreground p-4 rounded-full shadow-lg">
                  <Navigation className="h-8 w-8" />
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <p className="text-lg font-semibold text-foreground">Live Tracking Active</p>
              <p className="text-sm text-muted-foreground">Distance to destination: {distance}</p>
            </div>
            
            <Button variant="outline" size="sm" className="gap-2">
              <MapPin className="h-4 w-4" />
              View Full Map
            </Button>
          </div>
        </div>
        
        {/* Destination marker */}
        <div className="absolute top-4 right-4 bg-card border-2 border-secondary shadow-lg rounded-lg p-3 max-w-[200px]">
          <div className="flex items-start gap-2">
            <MapPin className="h-5 w-5 text-secondary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-foreground mb-1">Destination</p>
              <p className="text-xs text-muted-foreground line-clamp-2">{destination.address}</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-accent/50 border border-border rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary text-primary-foreground p-2 rounded-full">
            <Navigation className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Delivery in progress</p>
            <p className="text-xs text-muted-foreground">Your order is on its way!</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-primary">{distance}</p>
            <p className="text-xs text-muted-foreground">away</p>
          </div>
        </div>
      </div>
    </div>
  );
};
