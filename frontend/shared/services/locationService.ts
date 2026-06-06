export interface PharmacyLocation {
  id: string;
  name: string;
  address: string;
  city?: string;
  pharmaID: string;
  area?: string;
  phone?: string;
  email?: string;
  logo?: string;
  location: {
    latitude: number;
    longitude: number;
  };
  distance: number;
  walkingTime: number;
  drivingTime: number;
  timings?: {
    Monday?: { open: string; close: string };
    Tuesday?: { open: string; close: string };
    Wednesday?: { open: string; close: string };
    Thursday?: { open: string; close: string };
    Friday?: { open: string; close: string };
    Saturday?: { open: string; close: string };
    Sunday?: { open: string; close: string };
  };
}

export interface DistributorLocation {
  id: string;
  mongoId: string;
  name: string;
  companyName?: string;
  address: string;
  distributorID: string;
  avgLeadTime?: number;
  phone?: string;
  email?: string;
  logo?: string;
  licenseNumber?: string;
  licenseCertificate?: string;
  location: {
    latitude: number;
    longitude: number;
  };
  distance: number;
  walkingTime: number;
  drivingTime: number;
}

export interface NearbyPharmaciesResponse {
  userLocation: {
    latitude: number;
    longitude: number;
  };
  pharmacies: PharmacyLocation[];
  total: number;
}

export interface NearbyDistributorsResponse {
  userLocation: {
    latitude: number;
    longitude: number;
  };
  distributors: DistributorLocation[];
  total: number;
}

type PortalType = 'customer' | 'pharmacy' | 'distributor';

class LocationService {
  private baseURL = "http://localhost:5203";

  private getAuthHeader(portalType: PortalType = 'customer') {
    let token: string | null = null;

    if (portalType === 'pharmacy') {
      token = localStorage.getItem("pharmacy_token");
    } else if (portalType === 'distributor') {
      token = localStorage.getItem("distributor_token");
    } else {
      token = localStorage.getItem("token");
    }

    if (!token) {
      throw new Error("Authentication token not found");
    }

    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  async updateLocation(latitude: number, longitude: number, address?: string, portalType: PortalType = 'customer'): Promise<void> {
    const response = await fetch(`${this.baseURL}/users/location`, {
      method: "POST",
      headers: this.getAuthHeader(portalType),
      body: JSON.stringify({ latitude, longitude, address }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to update location");
    }
  }

  async getNearbyPharmacies(maxDistance = 10000, portalType: PortalType = 'customer'): Promise<NearbyPharmaciesResponse> {
    const response = await fetch(
      `${this.baseURL}/pharmacies/nearby?maxDistance=${maxDistance}`,
      {
        method: "GET",
        headers: this.getAuthHeader(portalType),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      if (data.requiresLocation) {
        throw new Error("LOCATION_REQUIRED");
      }
      throw new Error(data.error || "Failed to fetch nearby pharmacies");
    }

    return data;
  }

  async getNearbyDistributors(maxDistance = 50000, portalType: PortalType = 'pharmacy'): Promise<NearbyDistributorsResponse> {
    const response = await fetch(
      `${this.baseURL}/distributors/nearby?maxDistance=${maxDistance}`,
      {
        method: "GET",
        headers: this.getAuthHeader(portalType),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      if (data.requiresLocation) {
        throw new Error("LOCATION_REQUIRED");
      }
      throw new Error(data.error || "Failed to fetch nearby distributors");
    }

    return data;
  }

  async geocodeAddress(address: string, portalType: PortalType = 'customer'): Promise<{
    latitude: number;
    longitude: number;
    displayName: string;
  }> {
    const response = await fetch(`${this.baseURL}/location/geocode`, {
      method: "POST",
      headers: this.getAuthHeader(portalType),
      body: JSON.stringify({ address }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to geocode address");
    }

    return data;
  }

  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  formatDistance(km: number): string {
    if (km < 1) {
      return `${Math.round(km * 1000)}m`;
    }
    return `${km.toFixed(1)}km`;
  }

  formatTime(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  getGoogleMapsDirectionsUrl(originLat: number, originLng: number, destLat: number, destLng: number): string {
    return `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destLat},${destLng}&travelmode=driving&dir_action=navigate`;
  }
}

export const locationService = new LocationService();