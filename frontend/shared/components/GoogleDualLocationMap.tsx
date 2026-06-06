import { useState, useCallback } from "react";
import { GoogleMap, LoadScript, Marker, Polyline, DirectionsRenderer, InfoWindow } from "@react-google-maps/api";
import { Button } from "./ui/Button";
import { Maximize2, Minimize2, Navigation, Car, MapPin as MapPinIcon } from "lucide-react";

interface GoogleDualLocationMapProps {
  customerLat?: number;
  customerLng?: number;
  pharmacyLat?: number;
  pharmacyLng?: number;
  pharmacyName?: string;
  distance?: number;
  drivingTime?: number;
  walkingTime?: number;
  isFullscreen?: boolean;
}

const mapContainerStyle = {
  width: "100%",
  height: "100%",
};

const libraries: ("places" | "drawing" | "geometry" | "visualization")[] = ["places"];

export function GoogleDualLocationMap({
  customerLat,
  customerLng,
  pharmacyLat,
  pharmacyLng,
  pharmacyName,
  distance,
  drivingTime,
  walkingTime,
  isFullscreen = false,
}: GoogleDualLocationMapProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [travelMode, setTravelMode] = useState<"DRIVING" | "WALKING">("DRIVING");
  const [showPharmacyInfo, setShowPharmacyInfo] = useState(true);

  const apiKey = (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY || "";

  // Normalize props to numbers
  const customerLatNum = customerLat !== undefined && customerLat !== null ? Number(customerLat) : undefined;
  const customerLngNum = customerLng !== undefined && customerLng !== null ? Number(customerLng) : undefined;
  const pharmacyLatNum = pharmacyLat !== undefined && pharmacyLat !== null ? Number(pharmacyLat) : undefined;
  const pharmacyLngNum = pharmacyLng !== undefined && pharmacyLng !== null ? Number(pharmacyLng) : undefined;
  const distanceNum = distance !== undefined && distance !== null ? Number(distance) : undefined;
  const drivingTimeNum = drivingTime !== undefined && drivingTime !== null ? Number(drivingTime) : undefined;
  const walkingTimeNum = walkingTime !== undefined && walkingTime !== null ? Number(walkingTime) : undefined;

  console.log("GoogleDualLocationMap render with:", {
    customerLat: customerLatNum,
    customerLng: customerLngNum,
    pharmacyLat: pharmacyLatNum,
    pharmacyLng: pharmacyLngNum,
    pharmacyName,
    distance: distanceNum,
    drivingTime: drivingTimeNum,
    walkingTime: walkingTimeNum,
    isFullscreen,
  });

  if (
    customerLatNum === undefined ||
    !Number.isFinite(customerLatNum) ||
    customerLngNum === undefined ||
    !Number.isFinite(customerLngNum) ||
    pharmacyLatNum === undefined ||
    !Number.isFinite(pharmacyLatNum) ||
    pharmacyLngNum === undefined ||
    !Number.isFinite(pharmacyLngNum)
  ) {
    return (
      <div className="w-full h-96 bg-gray-100 rounded-lg flex items-center justify-center">
        <p className="text-gray-600 text-center">
          <MapPinIcon className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          Invalid location coordinates
        </p>
      </div>
    );
  }

  const mapHeight = isFullscreen ? "70vh" : isExpanded ? "600px" : "400px";

  // Calculate center point
  const center = {
    lat: (customerLatNum + pharmacyLatNum) / 2,
    lng: (customerLngNum + pharmacyLngNum) / 2,
  };

  // Customer marker (blue)
  const customerPosition = { lat: customerLatNum, lng: customerLngNum };

  // Pharmacy marker (red)
  const pharmacyPosition = { lat: pharmacyLatNum, lng: pharmacyLngNum };

  // Polyline path
  const linePath = [customerPosition, pharmacyPosition];

  // Google Maps URL with directions
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${customerLatNum},${customerLngNum}&destination=${pharmacyLatNum},${pharmacyLngNum}&travelmode=driving&dir_action=navigate`;

  const onLoad = useCallback((map: google.maps.Map) => {
    // Fit bounds to show both markers
    const bounds = new window.google.maps.LatLngBounds();
    bounds.extend(customerPosition);
    bounds.extend(pharmacyPosition);
    map.fitBounds(bounds);
  }, [customerPosition, pharmacyPosition]);

  // Fetch directions when travel mode changes
  const fetchDirections = useCallback(() => {
    if (window.google && window.google.maps) {
      const directionsService = new google.maps.DirectionsService();
      directionsService.route(
        {
          origin: customerPosition,
          destination: pharmacyPosition,
          travelMode: travelMode as google.maps.TravelMode,
        },
        (result, status) => {
          if (status === "OK" && result) {
            setDirections(result);
          } else {
            console.error("Directions request failed:", status);
          }
        }
      );
    }
  }, [customerPosition, pharmacyPosition, travelMode]);

  return (
    <div className="w-full space-y-3">
      {/* Travel Mode Toggle */}
      <div className="flex gap-2 items-center justify-between">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={travelMode === "DRIVING" ? "default" : "outline"}
            onClick={() => {
              setTravelMode("DRIVING");
              setDirections(null);
            }}
          >
            <Car className="w-4 h-4 mr-2" />
            Driving
          </Button>
          <Button
            size="sm"
            variant={travelMode === "WALKING" ? "default" : "outline"}
            onClick={() => {
              setTravelMode("WALKING");
              setDirections(null);
            }}
          >
            <Navigation className="w-4 h-4 mr-2" />
            Walking
          </Button>
        </div>
        <Button size="sm" onClick={fetchDirections} variant="outline">
          Get Directions
        </Button>
      </div>

      {/* Distance and Time Info */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-gray-600 font-medium">DISTANCE</p>
            <p className="text-lg font-bold text-gray-900">
              {distanceNum !== undefined ? `${distanceNum.toFixed(1)} km` : "N/A"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600 font-medium">DRIVING TIME</p>
            <p className="text-lg font-bold text-blue-600">
              {drivingTimeNum !== undefined ? `${drivingTimeNum} min` : "N/A"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600 font-medium">WALKING TIME</p>
            <p className="text-lg font-bold text-green-600">
              {walkingTimeNum !== undefined ? `${walkingTimeNum} min` : "N/A"}
            </p>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="relative w-full rounded-lg overflow-hidden border-2 border-gray-300" style={{ height: mapHeight }}>
        <LoadScript googleMapsApiKey={apiKey} libraries={libraries}>
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={center}
            zoom={13}
            onLoad={onLoad}
            options={{
              streetViewControl: false,
              mapTypeControl: true,
              fullscreenControl: false,
            }}
          >
            {/* Customer Marker (Blue) */}
            <Marker
              position={customerPosition}
              icon={{
                url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
                scaledSize: new window.google.maps.Size(40, 40),
              }}
              title="Your Location"
            />

            {/* Pharmacy Marker (Red) */}
            <Marker
              position={pharmacyPosition}
              icon={{
                url: "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
                scaledSize: new window.google.maps.Size(40, 40),
              }}
              title={pharmacyName || "Pharmacy Location"}
              onClick={() => setShowPharmacyInfo(true)}
            />
            
            {/* Pharmacy Info Window showing name above marker */}
            {showPharmacyInfo && (
              <InfoWindow
                position={pharmacyPosition}
                onCloseClick={() => setShowPharmacyInfo(false)}
              >
                <div className="text-red-600 font-bold text-sm">
                  {pharmacyName || "Pharmacy"}
                </div>
              </InfoWindow>
            )}

            {/* Show Directions or Simple Line */}
            {directions ? (
              <DirectionsRenderer
                directions={directions}
                options={{
                  suppressMarkers: true,
                  polylineOptions: {
                    strokeColor: travelMode === "DRIVING" ? "#3B82F6" : "#10B981",
                    strokeWeight: 4,
                  },
                }}
              />
            ) : (
              <Polyline
                path={linePath}
                options={{
                  strokeColor: "#6B7280",
                  strokeOpacity: 0.8,
                  strokeWeight: 3,
                  geodesic: true,
                }}
              />
            )}
          </GoogleMap>
        </LoadScript>

        {/* Expand/Minimize Button */}
        {!isFullscreen && (
          <div className="absolute top-4 right-4 z-10">
            <Button
              onClick={() => setIsExpanded(!isExpanded)}
              size="sm"
              className="bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 shadow-lg"
              title={isExpanded ? "Minimize map" : "Expand map"}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => window.open(googleMapsUrl, "_blank")} className="flex-1">
          <Navigation className="w-4 h-4 mr-2" />
          Open in Google Maps
        </Button>
      </div>
    </div>
  );
}
