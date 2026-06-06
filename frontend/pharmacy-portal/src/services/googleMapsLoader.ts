import { Loader } from '@googlemaps/js-api-loader';
 
const GMAPS_KEY   = (import.meta as any).env?.VITE_GMAPS_KEY   ?? '';
const GMAPS_MAP_ID = (import.meta as any).env?.VITE_GMAPS_MAP_ID ?? 'DEMO_MAP_ID';
 
const loader = new Loader({
  apiKey:    GMAPS_KEY,
  version:   'weekly',
  libraries: ['marker'],
});
 
export const loadMaps  = () => loader.load();
export { GMAPS_MAP_ID };