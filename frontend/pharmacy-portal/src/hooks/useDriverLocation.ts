// hooks/useDriverLocation.ts
import { useEffect, useRef, useState } from 'react';
import { DriverLocation } from '../components/LiveDriverMap';

export function useDriverLocation(deliveryID: string | null, token: string | null) {
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!deliveryID || !token) return;

    const ws = new WebSocket(
      `ws://localhost:5205/ws/distributor-orders?token=${token}`
    );
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe_location', deliveryID }));
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'location_update') {
        setDriverLocation({
          lat:               msg.lat,
          lng:               msg.lng,
          timestamp:         msg.timestamp,
          speedKmh:          msg.speedKmh          ?? null,
          distanceCoveredKm: msg.distanceCoveredKm ?? null,
        });
      }
    };

    ws.onclose  = () => console.log('WS closed');
    ws.onerror  = (e) => console.error('WS error', e);

    return () => {
      ws.send(JSON.stringify({ type: 'unsubscribe_location' }));
      ws.close();
    };
  }, [deliveryID, token]);

  return driverLocation;
}