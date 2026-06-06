import { MapPin, ExternalLink, Maximize2 } from "lucide-react";
import { Button } from "./ui/Button";
import { useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { MapWrapper } from "./MapWrapper";
import L from "leaflet";

interface LocationMapProps {
  latitude?: number;
  longitude?: number;
  name?: string;
  address?: string;
  showDirections?: boolean;
}

// Fix Leaflet's default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Custom green icon for location
const locationIcon = L.divIcon({
  className: "custom-div-icon",
  html: `
    <div style="position: relative;">
      <div style="
        width: 36px;
        height: 36px;
        background: #10B981;
        border: 3px solid white;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 3px 10px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(45deg);">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
          <circle cx="12" cy="10" r="3"></circle>
        </svg>
      </div>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36],
});

export function LocationMap({
  latitude,
  longitude,
  name,
  address,
  showDirections = true,
}: LocationMapProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Accept zero coordinates; only block undefined/null
  if (latitude === undefined || latitude === null || longitude === undefined || longitude === null) {
    return (
      <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center">
        <p className="text-gray-600 text-center">
          <MapPin className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          Location not set
        </p>
      </div>
    );
  }

  // Enhanced Google Maps URL with location name for better context
  const googleMapsUrl = name 
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=${latitude},${longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

  const mapHeight = isExpanded ? "600px" : "320px";

  return (
    <div className="w-full space-y-3 relative z-0">
      {/* Map Preview with Expand Button */}
      <div className="relative w-full">
        <div 
          className="w-full rounded-lg overflow-hidden border-2 border-gray-300 bg-gray-50 relative"
          style={{ 
            height: mapHeight,
            minHeight: isExpanded ? "600px" : "320px",
            position: "relative",
            zIndex: 1
          }}
        >
          <MapWrapper>
            <MapContainer
              center={[latitude, longitude]}
              zoom={15}
              style={{ 
                height: "100%", 
                width: "100%",
                display: "block",
                position: "relative",
                zIndex: 1
              }}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              {/* Location Marker */}
              <Marker position={[latitude, longitude]} icon={locationIcon}>
                <Popup>
                  <div className="text-center">
                    {name && <p className="font-semibold text-emerald-700">{name}</p>}
                    {address && <p className="text-xs text-gray-600 mt-1">{address}</p>}
                    <p className="text-xs text-gray-500 mt-1">
                      {latitude.toFixed(6)}, {longitude.toFixed(6)}
                    </p>
                  </div>
                </Popup>
              </Marker>
            </MapContainer>
          </MapWrapper>
          
          {/* Expand Button */}
          <div className="absolute top-4 right-4" style={{ zIndex: 1000 }}>
            <Button
              onClick={() => setIsExpanded(!isExpanded)}
              size="sm"
              className="bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 shadow-lg"
              title={isExpanded ? "Minimize map" : "Expand map"}
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Location Info */}
      <div className="space-y-2">
        {name && (
          <div>
            <p className="text-xs text-gray-600 font-medium">LOCATION NAME</p>
            <p className="text-sm font-semibold text-gray-900">{name}</p>
          </div>
        )}

        {address && (
          <div>
            <p className="text-xs text-gray-600 font-medium">ADDRESS</p>
            <p className="text-sm text-gray-700 leading-relaxed">{address}</p>
          </div>
        )}

        <div className="bg-gray-50 p-3 rounded-lg">
          <p className="text-xs text-gray-600 font-medium">COORDINATES</p>
          <p className="text-sm text-gray-700 font-mono">
            {latitude.toFixed(6)}, {longitude.toFixed(6)}
          </p>
        </div>

        {/* Action Buttons */}
        {showDirections && (
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(googleMapsUrl, "_blank")}
              className="flex-1"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View on Maps
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
