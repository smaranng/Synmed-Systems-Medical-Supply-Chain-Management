import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';
import 'leaflet/dist/leaflet.css';
import { AuthProvider } from './hooks/useAuth';
import { CartProvider } from './context/CartContext';
import.meta.env.VITE_GOOGLE_MAPS_API_KEY
// Declare window.google for TypeScript
declare global {
  interface Window {
    google?: any;
  }
}

// Load Google Maps API with callback
const loadGoogleMapsAPI = () => {
  // Only load if not already loaded
  if (window.google && window.google.maps) {
    console.log('✓ Google Maps API already loaded');
    return Promise.resolve();
  }

  if (document.querySelector('script[data-google-maps]')) {
    return Promise.resolve();
  }


  console.log('📍 Loading Google Maps API...');

  return new Promise<void>((resolve) => {
    // Create callback function on window
    (window as any).initGoogleMaps = () => {
      console.log('✓ Google Maps API callback triggered, window.google is now available');
      resolve();
    };

    // Get API key from HTML data attribute or environment
    const apiKey = document.documentElement.getAttribute('data-google-maps-key') ||  import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
                  

    if (!apiKey) {
      console.error('❌ Google Maps API key not found');
      resolve(); // Still resolve to prevent hang
      return;
    }

    const script = document.createElement('script');
    // script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,directions,geometry&callback=initGoogleMaps`;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry&callback=initGoogleMaps&loading=async`;
    script.async = true;
    script.defer = true;
    script.setAttribute('data-google-maps', 'true');
    
    script.onerror = () => {
      console.error('❌ Failed to load Google Maps API script');
      resolve(); // Still resolve to prevent hang
    };

    document.head.appendChild(script);
    console.log('📡 Appending Google Maps API script to head:', script.src);
  });
};


// Load the API when the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadGoogleMapsAPI);
} else {
  loadGoogleMapsAPI();
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <CartProvider>
            <App />
          </CartProvider>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
);