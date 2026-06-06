import { useState } from "react";
import { GoogleMap, LoadScript, Marker } from "@react-google-maps/api";
import { Button } from "./ui/Button";
import { Maximize2, Minimize2, ExternalLink, MapPin as MapPinIcon } from "lucide-react";

interface GoogleLocationMapProps {
  latitude?: number;
  longitude?: number;
  name?: string;
  address?: string;
  showDirections?: boolean;
}

const mapContainerStyle = {
  width: "100%",
  height: "100%",
};

const libraries: ("places" | "drawing" | "geometry" | "visualization")[] = ["places"];

export function GoogleLocationMap({
  latitude,
  longitude,
  name,
  address,
  showDirections = true,
}: GoogleLocationMapProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

  // Accept zero coordinates; only block undefined/null
  if (latitude === undefined || latitude === null || longitude === undefined || longitude === null) {
    return (
      <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center">
        <p className="text-gray-600 text-center">
          <MapPinIcon className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          Location not set
        </p>
      </div>
    );
  }

  const mapHeight = isExpanded ? "600px" : "320px";

  const center = {
    lat: Number(latitude),
    lng: Number(longitude),
  };

  // Google Maps URL
  const googleMapsUrl = name
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=${latitude},${longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

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
            zIndex: 1,
          }}
        >
          <LoadScript googleMapsApiKey={apiKey} libraries={libraries}>
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={center}
              zoom={15}
              options={{
                streetViewControl: false,
                mapTypeControl: true,
                fullscreenControl: false,
              }}
            >
              {/* Location Marker */}
              <Marker
                position={center}
                icon={{
                  url: "http://maps.google.com/mapfiles/ms/icons/green-dot.png",
                  scaledSize: new window.google.maps.Size(40, 40),
                }}
                title={name || "Location"}
              />
            </GoogleMap>
          </LoadScript>

          {/* Expand Button */}
          <div className="absolute top-4 right-4" style={{ zIndex: 1000 }}>
            <Button
              onClick={() => setIsExpanded(!isExpanded)}
              size="sm"
              className="bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 shadow-lg"
              title={isExpanded ? "Minimize map" : "Expand map"}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
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
            {Number(latitude).toFixed(6)}, {Number(longitude).toFixed(6)}
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
              View on Google Maps
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
