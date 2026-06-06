import { useEffect, useState } from 'react';

export function GoogleMapsStatus() {
  const [status, setStatus] = useState('Checking...');
  const [apiReady, setApiReady] = useState(false);

  useEffect(() => {
    const checkAPI = () => {
      if (window.google && window.google.maps) {
        setStatus('✓ Google Maps API Loaded Successfully');
        setApiReady(true);
      } else {
        setStatus('⏳ Waiting for Google Maps API...');
        setTimeout(checkAPI, 500);
      }
    };

    checkAPI();

    // Also log to console
    console.log('GoogleMapsStatus mounted');
    console.log('window.google:', window.google);
    console.log('window.initGoogleMaps:', (window as any).initGoogleMaps);
  }, []);

  return (
    <div className="p-4 bg-blue-50 border border-blue-200 rounded">
      <p className="text-sm font-mono">
        Status: <span className={apiReady ? 'text-green-600 font-bold' : 'text-blue-600'}>
          {status}
        </span>
      </p>
      {apiReady && (
        <p className="text-xs text-gray-600 mt-2">
          Maps API Version: {(window.google?.maps as any)?.version || 'Unknown'}
        </p>
      )}
    </div>
  );
}
