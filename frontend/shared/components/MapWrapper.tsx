// Wrapper to handle Leaflet dynamic import to avoid SSR issues
import { useEffect, useState } from "react";
// Ensure Leaflet styles are always available anywhere this wrapper is used
import "leaflet/dist/leaflet.css";

export function MapWrapper({ children }: { children: React.ReactNode }) {
  const [isClient, setIsClient] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setIsClient(true);
      
      // Ensure leaflet CSS is loaded
      const leafletCSS = document.querySelector('link[href*="leaflet.css"]');
      if (!leafletCSS) {
        console.warn("Leaflet CSS not found in document head. Maps may not render correctly.");
      }
    } catch (err: any) {
      console.error("MapWrapper initialization error:", err);
      setError(err.message);
    }
  }, []);

  if (error) {
    return (
      <div className="w-full h-full bg-red-50 rounded-lg flex items-center justify-center" style={{ minHeight: "320px" }}>
        <div className="text-center p-6">
          <p className="text-sm text-red-600">Map initialization failed</p>
        </div>
      </div>
    );
  }

  if (!isClient) {
    return (
      <div className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center" style={{ minHeight: "320px" }}>
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
          <p className="text-sm text-gray-600">Loading map...</p>
        </div>
      </div>
    );
  }

  return <div style={{ height: "100%", width: "100%", position: "relative" }}>{children}</div>;
}
