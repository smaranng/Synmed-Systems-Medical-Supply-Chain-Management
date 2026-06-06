import { X, AlertCircle } from "lucide-react";
import { Button } from "./ui/Button";
import { GoogleDualLocationMap } from "../../../shared/components/GoogleDualLocationMap";
import { useEffect, useState } from "react";

interface PharmacyMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  pharmacyName?: string;
  pharmacyLat?: number;
  pharmacyLng?: number;
  customerLat?: number;
  customerLng?: number;
  distance?: number;
  drivingTime?: number;
  walkingTime?: number;
}

export function PharmacyMapModal({
  isOpen,
  onClose,
  pharmacyName,
  pharmacyLat,
  pharmacyLng,
  customerLat,
  customerLng,
  distance,
  drivingTime,
  walkingTime,
}: PharmacyMapModalProps) {
  const [hasError, setHasError] = useState(false);
  
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setHasError(false);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const hasValidCoordinates = 
    pharmacyLat != null &&
    pharmacyLng != null &&
    customerLat != null &&
    customerLng != null &&
    !isNaN(Number(pharmacyLat)) &&
    !isNaN(Number(pharmacyLng)) &&
    !isNaN(Number(customerLat)) &&
    !isNaN(Number(customerLng));

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black bg-opacity-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="bg-white rounded-lg shadow-2xl w-full max-h-[90vh] overflow-y-auto"
        style={{ maxWidth: '900px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-semibold text-gray-900">
            {pharmacyName || "Pharmacy"} - Location Map
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-6" style={{ minHeight: "500px" }}>
          {!hasValidCoordinates || hasError ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center p-8">
                <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {!hasValidCoordinates ? "Missing Location Data" : "Map Error"}
                </h3>
                <p className="text-gray-600 mb-4">
                  {!hasValidCoordinates 
                    ? "Location coordinates are not available."
                    : "There was an error loading the map."}
                </p>
                <Button onClick={onClose} variant="outline">
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <GoogleDualLocationMap
              pharmacyName={pharmacyName}
              pharmacyLat={Number(pharmacyLat)}
              pharmacyLng={Number(pharmacyLng)}
              customerLat={Number(customerLat)}
              customerLng={Number(customerLng)}
              distance={distance ? Number(distance) : undefined}
              drivingTime={drivingTime ? Number(drivingTime) : undefined}
              walkingTime={walkingTime ? Number(walkingTime) : undefined}
              isFullscreen={true}
            />
          )}
        </div>

        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-4 flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
