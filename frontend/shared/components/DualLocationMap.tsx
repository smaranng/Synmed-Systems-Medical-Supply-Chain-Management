import { MapPin, ExternalLink, Navigation, Expand } from "lucide-react";
import { Button } from "./ui/Button";
import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import { MapWrapper } from "./MapWrapper";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

function FixMapSize() {
  const map = useMap();

  useEffect(() => {
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }, [map]);

  return null;
}

interface DualLocationMapProps {
  customerLat?: number;
  customerLng?: number;
  pharmacyLat?: number;
  pharmacyLng?: number;
  pharmacyName?: string;
  distance?: number;
  isFullscreen?: boolean;
  onFullscreenClick?: () => void;
}

// Fix Leaflet's default icon issue with Webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Custom blue icon for customer location
const customerIcon = L.divIcon({
  className: "custom-div-icon",
  html: `
    <div style="position: relative;">
      <div style="
        width: 32px;
        height: 32px;
        background: #3B82F6;
        border: 3px solid white;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(45deg);">
          <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
        </svg>
      </div>
      <div style="
        position: absolute;
        top: -25px;
        left: 50%;
        transform: translateX(-50%);
        background: white;
        padding: 4px 8px;
        border-radius: 4px;
        border: 2px solid #3B82F6;
        font-size: 11px;
        font-weight: 600;
        white-space: nowrap;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        color: #1E40AF;
      ">My Location</div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

// Custom red icon for pharmacy location
const pharmacyIcon = (name: string) => L.divIcon({
  className: "custom-div-icon",
  html: `
    <div style="position: relative;">
      <div style="
        width: 32px;
        height: 32px;
        background: #EF4444;
        border: 3px solid white;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(45deg);">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
          <circle cx="12" cy="10" r="3"></circle>
        </svg>
      </div>
      <div style="
        position: absolute;
        top: -25px;
        left: 50%;
        transform: translateX(-50%);
        background: white;
        padding: 4px 8px;
        border-radius: 4px;
        border: 2px solid #EF4444;
        font-size: 11px;
        font-weight: 600;
        white-space: nowrap;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        color: #991B1B;
        max-width: 150px;
        overflow: hidden;
        text-overflow: ellipsis;
      ">${name}</div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

export function DualLocationMap({
  customerLat,
  customerLng,
  pharmacyLat,
  pharmacyLng,
  pharmacyName,
  distance,
  isFullscreen = false,
}: DualLocationMapProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Normalize props to numbers to avoid crashes when API returns strings
  const customerLatNum = customerLat !== undefined && customerLat !== null ? Number(customerLat) : undefined;
  const customerLngNum = customerLng !== undefined && customerLng !== null ? Number(customerLng) : undefined;
  const pharmacyLatNum = pharmacyLat !== undefined && pharmacyLat !== null ? Number(pharmacyLat) : undefined;
  const pharmacyLngNum = pharmacyLng !== undefined && pharmacyLng !== null ? Number(pharmacyLng) : undefined;
  const distanceNum = distance !== undefined && distance !== null ? Number(distance) : undefined;

  console.log("DualLocationMap render with:", {
    customerLat: customerLatNum,
    customerLng: customerLngNum,
    pharmacyLat: pharmacyLatNum,
    pharmacyLng: pharmacyLngNum,
    pharmacyName,
    distance: distanceNum,
    isFullscreen
  });

  // Accept zero coordinates; only block undefined/null
  if (
    customerLatNum === undefined || !Number.isFinite(customerLatNum) ||
    customerLngNum === undefined || !Number.isFinite(customerLngNum) ||
    pharmacyLatNum === undefined || !Number.isFinite(pharmacyLatNum) ||
    pharmacyLngNum === undefined || !Number.isFinite(pharmacyLngNum)
  ) {
    console.warn("DualLocationMap: Missing required coordinates");
    return (
      <div className="w-full h-96 bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-center p-6">
          <MapPin className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p className="text-gray-600">Locations not available</p>
        </div>
      </div>
    );
  }

  const mapHeight = isFullscreen ? "70vh" : isExpanded ? "600px" : "400px";

  // Calculate center point and zoom level
  const centerLat = (customerLatNum + pharmacyLatNum) / 2;
  const centerLng = (customerLngNum + pharmacyLngNum) / 2;

  // Calculate appropriate zoom level based on distance
  const getZoomLevel = () => {
    if (!distanceNum) return 13;
    if (distanceNum < 1) return 15;
    if (distanceNum < 5) return 13;
    if (distanceNum < 10) return 12;
    if (distanceNum < 20) return 11;
    return 10;
  };

  // Line connecting the two locations
  const polylinePositions: [number, number][] = [
    [customerLatNum, customerLngNum],
    [pharmacyLatNum, pharmacyLngNum],
  ];

  // Enhanced Google Maps URL with location labels and route display
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${customerLatNum},${customerLngNum}&destination=${pharmacyLatNum},${pharmacyLngNum}&travelmode=driving&dir_action=navigate`;

  return (
    <div className="w-full space-y-4">
      {/* Map View with Expand Button */}
      <div className="relative">
        <div 
          className="w-full rounded-lg overflow-hidden border-2 border-gray-300 bg-gray-50 relative"
          style={{ height: mapHeight, minHeight: mapHeight }}
        >
          <MapWrapper>
            <MapContainer
              key={`${centerLat}-${centerLng}`}
              center={[centerLat, centerLng]}
              zoom={getZoomLevel()}
              style={{ height: "100%", width: "100%", position: "relative", zIndex: 1 }}
              scrollWheelZoom={true}
            >
              <FixMapSize />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              {/* Customer Location Marker - Blue */}
              <Marker position={[customerLatNum, customerLngNum]} icon={customerIcon}>
                <Popup>
                  <div className="text-center">
                    <p className="font-semibold text-blue-700">My Location</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {customerLatNum.toFixed(4)}, {customerLngNum.toFixed(4)}
                    </p>
                  </div>
                </Popup>
              </Marker>

              {/* Pharmacy Location Marker - Red */}
              <Marker position={[pharmacyLatNum, pharmacyLngNum]} icon={pharmacyIcon(pharmacyName || "Pharmacy")}>
                <Popup>
                  <div className="text-center">
                    <p className="font-semibold text-red-700">{pharmacyName || "Pharmacy"}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {pharmacyLatNum.toFixed(4)}, {pharmacyLngNum.toFixed(4)}
                    </p>
                    {distanceNum !== undefined && (
                      <p className="text-xs text-green-600 font-semibold mt-1">
                        {distanceNum.toFixed(2)} km away
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>

              {/* Connecting Line */}
              <Polyline 
                positions={polylinePositions} 
                pathOptions={{ 
                  color: '#10B981', 
                  weight: 3, 
                  opacity: 0.7,
                  dashArray: '10, 10'
                }} 
              />
            </MapContainer>
          </MapWrapper>
          
          {/* Expand Button Overlay */}
          <div className="absolute top-4 right-4 flex gap-2 z-[1000]">
            {!isFullscreen && (
              <Button
                onClick={() => setIsExpanded(!isExpanded)}
                size="sm"
                className="bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 shadow-lg"
                title={isExpanded ? "Minimize map" : "Expand map"}
              >
                <Expand className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Distance Display - More Prominent */}
      {distanceNum !== undefined && (
        <div className="p-4 bg-gradient-to-r from-blue-50 to-emerald-50 border-2 border-emerald-400 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Distance</p>
              <p className="text-3xl font-bold text-emerald-600">{distanceNum.toFixed(2)}</p>
              <p className="text-sm text-gray-600">kilometers away</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Estimated Time</p>
              <p className="text-2xl font-bold text-blue-600">{Math.round((distanceNum / 30) * 60)}</p>
              <p className="text-sm text-gray-600">minutes (by car)</p>
            </div>
          </div>
        </div>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Your Location - Blue Theme */}
        <div className="p-4 rounded-lg bg-blue-50 border-2 border-blue-300 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center shadow-md">
              <Navigation className="w-4 h-4 text-white" />
            </div>
            <h4 className="font-semibold text-blue-900">My Location</h4>
          </div>
          <p className="text-sm text-blue-700 font-mono break-all">
            {customerLatNum.toFixed(4)}, {customerLngNum.toFixed(4)}
          </p>
        </div>

        {/* Pharmacy Location - Red Theme */}
        <div className="p-4 rounded-lg bg-red-50 border-2 border-red-300 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 bg-red-500 rounded-full flex items-center justify-center shadow-md">
              <MapPin className="w-4 h-4 text-white" />
            </div>
            <h4 className="font-semibold text-red-900 truncate">{pharmacyName || 'Pharmacy'}</h4>
          </div>
          <p className="text-sm text-red-700 font-mono break-all">
            {pharmacyLatNum.toFixed(4)}, {pharmacyLngNum.toFixed(4)}
          </p>
        </div>
      </div>

      {/* Action Button */}
      <Button
        onClick={() => window.open(googleMapsUrl, "_blank")}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-11"
      >
        <ExternalLink className="w-4 h-4 mr-2" />
        Get Directions on Google Maps
      </Button>
    </div>
  );
}
