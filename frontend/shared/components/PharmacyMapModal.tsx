import { X } from "lucide-react";
import { Button } from "./ui/Button";
import { GoogleDualLocationMap } from "./GoogleDualLocationMap";
import { useEffect } from "react";

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
  
  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      console.log("PharmacyMapModal opened with:", {
        pharmacyName,
        pharmacyLat,
        pharmacyLng,
        customerLat,
        customerLng,
        distance
      });
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, pharmacyName, pharmacyLat, pharmacyLng, customerLat, customerLng, distance]);

  if (!isOpen) return null;

  // Validate that we have the required data
  if (!pharmacyLat || !pharmacyLng || !customerLat || !customerLng) {
    console.error("PharmacyMapModal: Missing required coordinates", {
      pharmacyLat,
      pharmacyLng,
      customerLat,
      customerLng
    });
  }

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ 
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)'
      }}
      onClick={(e) => {
        // Close modal if clicking on the backdrop
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
          <GoogleDualLocationMap
            pharmacyName={pharmacyName}
            pharmacyLat={pharmacyLat}
            pharmacyLng={pharmacyLng}
            customerLat={customerLat}
            customerLng={customerLng}
            distance={distance}
            drivingTime={drivingTime}
            walkingTime={walkingTime}
            isFullscreen={true}
          />
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
