// Debug utility for Google Maps API loading
export const debugGoogleMapsLoading = () => {
  // Check window.google availability
  const checkGoogle = () => {
    const isLoaded = !!(window.google && window.google.maps);
    console.log('Google Maps API loaded:', isLoaded);
    if (window.google) {
      console.log('window.google:', window.google);
      console.log('window.google.maps:', window.google.maps);
    }
    return isLoaded;
  };

  // Log initial state
  console.log('Initial Google Maps check:');
  checkGoogle();

  // Check periodically
  const interval = setInterval(() => {
    if (checkGoogle()) {
      clearInterval(interval);
      console.log('Google Maps API is now available!');
    }
  }, 500);

  // Stop checking after 30 seconds
  setTimeout(() => {
    clearInterval(interval);
    console.log('Google Maps API check timeout');
  }, 30000);
};

// Check for API errors
export const checkGoogleMapsErrors = () => {
  // Listen for global errors
  window.addEventListener('error', (event) => {
    if (event.message.includes('google') || event.filename?.includes('maps')) {
      console.error('Google Maps error:', event);
    }
  });
};
