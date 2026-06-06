import { useState } from "react";
import { X, MapPin, Navigation } from "lucide-react";
import { Button } from "./ui/Button";

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLocationSet: (latitude: number, longitude: number, address?: string) => void;
  portalType?: 'customer' | 'pharmacy' | 'distributor';
}

export function LocationModal({ isOpen, onClose, onLocationSet, portalType = 'customer' }: LocationModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [method, setMethod] = useState<"gps" | "address">("gps");

  if (!isOpen) return null;

  // Theme colors based on portal type
  const theme =
    portalType === 'pharmacy'
      ? {
          icon: "text-emerald-600",
          activeTab: "text-emerald-600 border-b-2 border-emerald-600",
          ring: "focus:ring-emerald-500",
          button: "bg-emerald-600 hover:bg-emerald-700 text-white",
        }
      : portalType === 'distributor'
      ? {
          icon: "text-orange-600",
          activeTab: "text-orange-600 border-b-2 border-orange-600",
          ring: "focus:ring-orange-500",
          button: "bg-orange-600 hover:bg-orange-700 text-white",
        }
      : {
          icon: "text-blue-600",
          activeTab: "text-blue-600 border-b-2 border-blue-600",
          ring: "focus:ring-blue-500",
          button: "bg-blue-600 hover:bg-blue-700 text-white",
        };

  // Get the correct token based on portal type
  const getToken = () => {
    if (portalType === 'pharmacy') return localStorage.getItem("pharmacy_token");
    if (portalType === 'distributor') return localStorage.getItem("distributor_token");
    return localStorage.getItem("token");
  };

  const handleGetCurrentLocation = async () => {
    setLoading(true);
    setError(null);

    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        onLocationSet(latitude, longitude);
        setLoading(false);
      },
      (err) => {
        setError(err.message || "Unable to retrieve your location");
        setLoading(false);
      }
    );
  };

  const handleGeocodeAddress = async () => {
    if (!address.trim()) {
      setError("Please enter an address");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = getToken();

      if (!token) {
        setError("Not authenticated. Please login again.");
        setLoading(false);
        return;
      }

      const response = await fetch("http://localhost:5203/location/geocode", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ address }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to geocode address");
      }

      onLocationSet(data.latitude, data.longitude, data.displayName);
    } catch (err: any) {
      let errorMessage = err.message || "Failed to geocode address";

      if (errorMessage.includes("not found")) {
        errorMessage = "Address not found. Try these formats:\n\n1. Just the city/landmark: \"Jayanagar, Bengaluru, Karnataka\"\n2. Landmark + city: \"Nethradama Hospital, Bengaluru, Karnataka\"\n3. Area + city: \"7th Block, Bengaluru, Karnataka\"\n\nThe full address with building numbers sometimes fails to match.";
      } else if (errorMessage.includes("rate") || errorMessage.includes("too many requests")) {
        errorMessage = "Too many geocoding requests. Please wait 30 seconds and try again.";
      } else if (errorMessage.includes("network") || errorMessage.includes("internet")) {
        errorMessage = "Network error. Please check your internet connection and try again.";
      } else if (errorMessage.includes("Geocoding service")) {
        errorMessage = "Geocoding service temporarily unavailable. Please try again in a moment.";
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className={`w-6 h-6 ${theme.icon}`} />
            <h2 className="text-2xl font-bold text-gray-900">Set Your Location</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={loading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <p className="text-gray-600">
          We need your location to show nearby pharmacies and provide accurate delivery options.
        </p>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Method selector */}
        <div className="flex gap-2 border-b border-gray-200">
          <button
            className={`flex-1 px-4 py-2 font-medium transition-colors ${
              method === "gps" ? theme.activeTab : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setMethod("gps")}
            disabled={loading}
          >
            <Navigation className="w-4 h-4 inline mr-2" />
            Use GPS
          </button>
          <button
            className={`flex-1 px-4 py-2 font-medium transition-colors ${
              method === "address" ? theme.activeTab : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setMethod("address")}
            disabled={loading}
          >
            <MapPin className="w-4 h-4 inline mr-2" />
            Enter Address
          </button>
        </div>

        {method === "gps" ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Click the button below to allow location access and automatically set your current location.
            </p>
            <Button
              onClick={handleGetCurrentLocation}
              disabled={loading}
              className={`w-full ${theme.button}`}
            >
              {loading ? (
                "Getting Location..."
              ) : (
                <>
                  <Navigation className="w-4 h-4 mr-2" />
                  Get My Current Location
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter Your Address
              </label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Example: 265/B, 36th B Cross Rd, near Nethradama Hospital, 7th Block, Jayanagar, Bengaluru, Karnataka 560070"
                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 ${theme.ring} text-sm`}
                rows={4}
                disabled={loading}
                maxLength={500}
              />
              <p className="text-xs text-gray-500 mt-1">
                {address.length}/500 characters | Include building number, street, landmarks, city, state, and pincode
              </p>
            </div>
            <Button
              onClick={handleGeocodeAddress}
              disabled={loading || !address.trim()}
              className={`w-full ${theme.button}`}
            >
              {loading ? "Geocoding..." : "Set Location"}
            </Button>
          </div>
        )}

        <div className="pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            Your location is stored securely and used only to show nearby pharmacies.
          </p>
        </div>
      </div>
    </div>
  );
}