// LiveDriverMap.tsx
import React, { useEffect, useRef, useState } from 'react';
import { loadMaps, GMAPS_MAP_ID } from '../services/googleMapsLoader';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DriverLocation {
  lat:               number;
  lng:               number;
  timestamp:         string;
  speedKmh:          number | null;
  distanceCoveredKm: number | null;
}

interface Props {
  /** Resolved location object from the useDriverLocation hook in the parent. */
  driverLocation: DriverLocation | null;
  /** Current order status string, used to customise the overlay message. */
  orderStatus: string;
  /** Delivery destination coordinates fetched from the deliveries endpoint. */
  destination?: { lat: number; lng: number } | null;
}


// ─── Truck SVG (top-down, purple) ─────────────────────────────────────────────

const TRUCK_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="40" height="40">
  <rect x="4"  y="18" width="36" height="22" rx="4" fill="#7c3aed"/>
  <rect x="40" y="24" width="16" height="14" rx="3" fill="#6d28d9"/>
  <circle cx="14" cy="42" r="6" fill="#1e293b"/>
  <circle cx="14" cy="42" r="3" fill="#e2e8f0"/>
  <circle cx="46" cy="42" r="6" fill="#1e293b"/>
  <circle cx="46" cy="42" r="3" fill="#e2e8f0"/>
  <rect x="42" y="26" width="12" height="8" rx="2" fill="#bae6fd" opacity="0.8"/>
</svg>`.trim();

// ─── Destination pin SVG (red drop-pin) ──────────────────────────────────────

const DEST_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 60" width="32" height="40">
  <path d="M24 0C13.507 0 5 8.507 5 19c0 14.25 19 41 19 41s19-26.75 19-41C43 8.507 34.493 0 24 0z"
        fill="#ef4444" stroke="white" stroke-width="2.5"/>
  <circle cx="24" cy="19" r="8" fill="white" opacity="0.95"/>
  <circle cx="24" cy="19" r="4.5" fill="#ef4444"/>
</svg>`.trim();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Safely reads `lat` or `lng` from whatever shape AdvancedMarkerElement
 * hands back (LatLng instance OR plain LatLngLiteral).
 */
function resolveCoord(
  pos: google.maps.LatLng | google.maps.LatLngLiteral | null | undefined,
  axis: 'lat' | 'lng',
): number | null {
  if (!pos) return null;
  const val = (pos as any)[axis];
  return typeof val === 'function' ? (val as () => number)() : (val ?? null);
}

// ─── LiveDriverMap ────────────────────────────────────────────────────────────

export default function LiveDriverMap({ driverLocation, orderStatus, destination }: Props) {
  const mapRef         = useRef<HTMLDivElement>(null);
  const mapInstance    = useRef<google.maps.Map | null>(null);
  const markerRef      = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const destMarkerRef  = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const polylineRef    = useRef<google.maps.Polyline | null>(null);       // breadcrumb trail
  const routeRendRef   = useRef<google.maps.DirectionsRenderer | null>(null);
  const routeLineRef   = useRef<google.maps.Polyline | null>(null);       // fallback straight line
  const rafRef         = useRef<number>(0);
  const lastRouteKey   = useRef<string>('');

  if (orderStatus === 'DELIVERED') return null;

  const [ready,  setReady]  = useState(false);
  const [mapErr, setMapErr] = useState(false);
  if (mapErr) return null;

  // ── 1. Load SDK ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    loadMaps()
      .then(() => { if (mounted) setReady(true); })
      .catch(() => { if (mounted) setMapErr(true); });
    return () => { mounted = false; };
  }, []);

  // ── 2. Initialise Map, Markers, Polylines (once) ─────────────────────────────
  useEffect(() => {
    if (!ready || !mapRef.current || mapInstance.current) return;

    const center = driverLocation ?? destination ?? { lat: 20.5937, lng: 78.9629 };

    mapInstance.current = new google.maps.Map(mapRef.current, {
      zoom:              14,
      center,
      mapId:             GMAPS_MAP_ID,
      disableDefaultUI:  false,
      zoomControl:       true,
      streetViewControl: false,
      mapTypeControl:    false,
      fullscreenControl: false,
      styles: [
        { featureType: 'poi',     elementType: 'labels', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
      ],
    });

    // ── Truck marker ──────────────────────────────────────────────────────────
    const truckEl         = document.createElement('div');
    truckEl.innerHTML     = TRUCK_SVG;
    truckEl.style.cssText = 'display:flex;align-items:center;justify-content:center;';

    markerRef.current = new google.maps.marker.AdvancedMarkerElement({
      map:      mapInstance.current,
      position: center,
      content:  truckEl,
      title:    'Driver',
    });

    // ── Destination marker (shown immediately if coords available) ────────────
    if (destination) {
      const destEl         = document.createElement('div');
      destEl.innerHTML     = DEST_SVG;
      destEl.style.cssText = 'display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 3px 6px rgba(239,68,68,0.45));';

      destMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
        map:      mapInstance.current,
        position: destination,
        content:  destEl,
        title:    'Delivery destination',
      });
    }

    // ── Breadcrumb trail polyline ─────────────────────────────────────────────
    polylineRef.current = new google.maps.Polyline({
      map:           mapInstance.current,
      strokeColor:   '#7c3aed',
      strokeOpacity: 0.55,
      strokeWeight:  3,
      icons: [{
        icon:   { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 3, strokeColor: '#7c3aed' },
        offset: '100%',
        repeat: '120px',
      }],
    });

    // ── DirectionsRenderer for road route ────────────────────────────────────
    routeRendRef.current = new google.maps.DirectionsRenderer({
      map:              mapInstance.current,
      suppressMarkers:  true,           // we draw our own truck + dest markers
      polylineOptions:  {
        strokeColor:   '#ef4444',
        strokeOpacity: 0.75,
        strokeWeight:  4,
        icons: [{
          icon:   { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 3, strokeColor: '#ef4444' },
          offset: '100%',
          repeat: '100px',
        }],
      },
    });

    // ── Straight-line fallback polyline ───────────────────────────────────────
    routeLineRef.current = new google.maps.Polyline({
      map:           mapInstance.current,
      strokeColor:   '#ef4444',
      strokeOpacity: 0.55,
      strokeWeight:  3,
      strokeDasharray: '8,6',           // dashed to signal it's approximate
      visible:       false,
    });

  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 3. Update destination marker position when prop changes ──────────────────
  useEffect(() => {
    if (!ready || !mapInstance.current || !destination) return;

    if (!destMarkerRef.current) {
      const destEl         = document.createElement('div');
      destEl.innerHTML     = DEST_SVG;
      destEl.style.cssText = 'display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 3px 6px rgba(239,68,68,0.45));';

      destMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
        map:      mapInstance.current,
        position: destination,
        content:  destEl,
        title:    'Delivery destination',
      });
    } else {
      destMarkerRef.current.position = destination;
    }
  }, [ready, destination]);

  // ── 4. Draw / refresh route whenever driver location or destination changes ──
  useEffect(() => {
    if (!driverLocation || !destination || !mapInstance.current || !routeRendRef.current) return;

    // Deduplicate: only re-request directions if origin moved > ~50 m
    const key = `${driverLocation.lat.toFixed(4)},${driverLocation.lng.toFixed(4)}`;
    if (key === lastRouteKey.current) return;
    lastRouteKey.current = key;

    const origin = { lat: driverLocation.lat, lng: driverLocation.lng };
    const dest   = { lat: destination.lat,    lng: destination.lng    };

    const svc = new google.maps.DirectionsService();
    svc.route(
      {
        origin,
        destination: dest,
        travelMode:  google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          // Road route — show renderer, hide fallback line
          routeRendRef.current!.setDirections(result);
          routeRendRef.current!.setMap(mapInstance.current);
          routeLineRef.current!.setVisible(false);

          // Fit bounds to show full route
          const bounds = new google.maps.LatLngBounds();
          result.routes[0]?.bounds && bounds.union(result.routes[0].bounds);
          mapInstance.current!.fitBounds(bounds, { top: 60, right: 40, bottom: 60, left: 40 });
        } else {
          // Directions API unavailable — fall back to a straight dashed line
          routeRendRef.current!.setMap(null);
          routeLineRef.current!.setPath([origin, dest]);
          routeLineRef.current!.setVisible(true);

          // Fit to the two endpoints
          const bounds = new google.maps.LatLngBounds();
          bounds.extend(origin);
          bounds.extend(dest);
          mapInstance.current!.fitBounds(bounds, { top: 60, right: 40, bottom: 60, left: 40 });
        }
      },
    );
  }, [driverLocation, destination]);

  // ── 5. Smooth truck marker movement on every new location ping ──────────────
  useEffect(() => {
    if (!driverLocation || !markerRef.current || !mapInstance.current) return;

    const marker  = markerRef.current;
    const current = marker.position;

    const fromLat = resolveCoord(current, 'lat') ?? driverLocation.lat;
    const fromLng = resolveCoord(current, 'lng') ?? driverLocation.lng;
    const { lat: toLat, lng: toLng } = driverLocation;

    const duration  = 1_000;
    const startTime = performance.now();

    cancelAnimationFrame(rafRef.current);

    function animate(now: number) {
      const t = Math.min((now - startTime) / duration, 1);
      marker.position = {
        lat: fromLat + (toLat - fromLat) * t,
        lng: fromLng + (toLng - fromLng) * t,
      };
      if (t < 1) rafRef.current = requestAnimationFrame(animate);
    }

    rafRef.current = requestAnimationFrame(animate);

    // Extend breadcrumb trail
    polylineRef.current?.getPath().push(
      new google.maps.LatLng(driverLocation.lat, driverLocation.lng),
    );

    // Only pan to truck when there's no route rendered (route fit handles camera)
    if (!destination) {
      mapInstance.current.panTo({ lat: driverLocation.lat + 0.002, lng: driverLocation.lng });
    }

    return () => cancelAnimationFrame(rafRef.current);
  }, [driverLocation]);

  // ── 6. Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    routeRendRef.current?.setMap(null);
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (mapErr) return null;

  if (!ready) {
    return (
      <div style={styles.loader}>
        <div style={styles.loaderSpinner} />
        <span style={{ fontSize: 12, color: '#7c3aed', fontWeight: 600 }}>Loading map…</span>
      </div>
    );
  }

  return (
    <div style={{ marginLeft: 46, marginBottom: 20 }}>

      {/* Stats bar */}
      {driverLocation && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
          {driverLocation.speedKmh != null && (
            <StatChip icon="🏎️" label="Speed" value={`${driverLocation.speedKmh.toFixed(1)} km/h`} />
          )}
          {driverLocation.distanceCoveredKm != null && (
            <StatChip icon="📍" label="Covered" value={`${driverLocation.distanceCoveredKm.toFixed(2)} km`} />
          )}
          {driverLocation.timestamp && (
            <div style={{ ...styles.statChip, marginLeft: 'auto' }}>
              <span style={{ fontSize: 11, color: '#7c3aed', fontWeight: 700, fontFamily: 'monospace' }}>
                🕐 {new Date(driverLocation.timestamp).toLocaleTimeString('en-IN', {
                  hour: '2-digit', minute: '2-digit', second: '2-digit',
                })}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Map canvas */}
      <div style={styles.mapWrapper}>
        <div ref={mapRef} style={{ width: '100%', height: 260 }} />

        {/* Waiting-for-ping overlay */}
        {!driverLocation && (
          <div style={styles.overlay}>
            <div style={{ fontSize: 28, animation: 'ot-pulse-opacity 2s ease-in-out infinite' }}>🚚</div>
            {orderStatus === 'DISPATCHED' ? (
              <>
                <p style={styles.overlayTitle}>Live tracking starts once driver picks up</p>
                <p style={styles.overlaySub}>Location sharing begins at pickup</p>
              </>
            ) : (
              <>
                <p style={styles.overlayTitle}>Waiting for driver location…</p>
                <p style={styles.overlaySub}>Updates every 10 seconds</p>
              </>
            )}
          </div>
        )}

        {/* Live badge */}
        {driverLocation && (
          <div style={styles.liveBadge}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%', background: '#22c55e',
              animation: 'ot-pulse-opacity 1.5s ease-in-out infinite',
            }} />
            <span style={{ fontSize: 10, fontWeight: 800, color: '#15803d', letterSpacing: '0.06em' }}>LIVE</span>
          </div>
        )}

        {/* Destination legend chip */}
        {destination && (
          <div style={styles.destLegend}>
            <span style={{ fontSize: 13 }}>📍</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#b91c1c', letterSpacing: '0.04em' }}>Destination</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── StatChip ─────────────────────────────────────────────────────────────────

function StatChip({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ ...styles.statChip, gap: 6 }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <div>
        <p style={{ margin: 0, fontSize: 9, color: '#7c3aed', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#4c1d95', fontFamily: 'monospace' }}>{value}</p>
      </div>
    </div>
  );
}

// ─── Inline style objects ─────────────────────────────────────────────────────

const styles = {
  loader: {
    marginLeft: 46, marginBottom: 20,
    height: 220, borderRadius: 14,
    border: '1.5px solid #ede9fe',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#f5f3ff', gap: 10,
  } as React.CSSProperties,

  loaderSpinner: {
    width: 20, height: 20, borderRadius: '50%',
    border: '2.5px solid #ede9fe', borderTopColor: '#7c3aed',
    animation: 'ot-spin 0.8s linear infinite',
  } as React.CSSProperties,

  mapWrapper: {
    position: 'relative', borderRadius: 14, overflow: 'hidden',
    border: '1.5px solid #ede9fe',
    boxShadow: '0 4px 18px rgba(139,92,246,0.10)',
  } as React.CSSProperties,

  overlay: {
    position: 'absolute', inset: 0,
    background: 'rgba(245,243,255,0.82)', backdropFilter: 'blur(2px)',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  } as React.CSSProperties,

  overlayTitle: {
    margin: 0, fontSize: 12, fontWeight: 700, color: '#7c3aed',
  } as React.CSSProperties,

  overlaySub: {
    margin: 0, fontSize: 11, color: '#94a3b8',
  } as React.CSSProperties,

  liveBadge: {
    position: 'absolute', top: 10, right: 10,
    background: 'white', border: '1.5px solid #ede9fe',
    borderRadius: 8, padding: '4px 10px',
    display: 'flex', alignItems: 'center', gap: 5,
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  } as React.CSSProperties,

  destLegend: {
    position: 'absolute', top: 10, left: 10,
    background: 'white', border: '1.5px solid #fecaca',
    borderRadius: 8, padding: '4px 10px',
    display: 'flex', alignItems: 'center', gap: 5,
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  } as React.CSSProperties,

  statChip: {
    display: 'inline-flex', alignItems: 'center',
    background: '#f5f3ff', border: '1.5px solid #ede9fe',
    borderRadius: 8, padding: '5px 11px',
  } as React.CSSProperties,
};