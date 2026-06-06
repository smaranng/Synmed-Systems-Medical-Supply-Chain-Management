const API_URL = 'http://localhost:5203';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LoginResponse {
  id: string;
  email?: string;
  name: string;
  role: string;
  username: string
  distributorID: string;
  logo?: string;
  phone?: string;
  address?: string | { line1: string; city: string; state: string; pincode: string };
  companyName?: string;
  licenseNumber?: string;
  gstRegistered?: boolean;
  gstIN?: string;
  revenue: number;
}

export interface DriverLoginResponse {
  id: string;
  mongoId: string;
  distributorID: string;
  name: string;
  username: string;
  phone: string;
  vehicleNumber: string | null;
  vehicleType: string | null;
  role: 'driver';
  isActive: boolean;
}
export interface RegisterDriverData {
  name: string;
  username: string;
  password: string;
  phone: string;
  licenseNumber?: string;
  licenseExpiry?: string;
  vehicleOwnership?: 'Driver' | 'Distributor';
  vehicleRegistration?: string;
  vehicleType?: string;
  vehicleCapacity?: string;
  vehicleFuelType?: string;
  insuranceExpiry?: string;
  permitExpiry?: string;
}

export interface UpdateProfileData {
  name: string;
  email: string;
  username: string;
  phone?: string;
  licenseNumber?: string;
  logo?: string;
  gstRegistered?: boolean;
  gstIN?: string;
  companyName?: string;
  address?: {
    line1: string;
    city: string;
    state: string;
    pincode: string;
  };
}

// ─── Token Management ─────────────────────────────────────────────────────────

export const setToken        = (t: string) => localStorage.setItem('distributor_token', t);
export const getToken        = ()           => localStorage.getItem('distributor_token');
export const clearToken      = ()           => localStorage.removeItem('distributor_token');

export const setDriverToken   = (t: string) => localStorage.setItem('driver_token', t);
export const getDriverToken   = ()           => localStorage.getItem('driver_token');
export const clearDriverToken = ()           => localStorage.removeItem('driver_token');

// ─── Auth Service ─────────────────────────────────────────────────────────────

export const authService = {

  // ── DISTRIBUTOR LOGIN ──────────────────────────────────────────────────────
  async login(username: string, password: string): Promise<LoginResponse> {
    const res = await fetch(`${API_URL}/auth/distributor/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    if (data.token) setToken(data.token);
    return data.user;
  },

  // ── DRIVER LOGIN ───────────────────────────────────────────────────────────
  /*async loginDriver(username: string, password: string): Promise<DriverLoginResponse> {
    const res = await fetch(`${API_URL}/auth/driver/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    if (data.token) setDriverToken(data.token);
    return data.user;
  },*/

  // ── DISTRIBUTOR REGISTER ───────────────────────────────────────────────────
  async register(distributorData: any): Promise<LoginResponse> {
    const res = await fetch(`${API_URL}/auth/distributor/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(distributorData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  // ── REGISTER DRIVER (called by a logged-in distributor) ─────────────────
  // Accepts FormData so DL certificate file can be uploaded
  async registerDriver(formData: FormData): Promise<DriverLoginResponse> {
    const token = getToken();
    const res = await fetch(`${API_URL}/auth/driver/register`, {
      method: 'POST',
      headers: {
        // Do NOT set Content-Type manually — browser sets multipart boundary automatically
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  // ── GET ALL DRIVERS FOR A DISTRIBUTOR ─────────────────────────────────────
  async getDrivers(distributorID: string): Promise<DriverLoginResponse[]> {
    const token = getToken();
    const res = await fetch(`${API_URL}/distributor/${distributorID}/drivers`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data.drivers;
  },

  // ── ACTIVATE / DEACTIVATE A DRIVER ────────────────────────────────────────
  async setDriverStatus(driverID: string, isActive: boolean): Promise<{ success: boolean }> {
    const token = getToken();
    const res = await fetch(`${API_URL}/driver/${driverID}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ isActive }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  // ── DISTRIBUTOR PROFILE UPDATE ─────────────────────────────────────────────
  async updateDistributorProfile(
    distributorId: string,
    profileData: UpdateProfileData
  ): Promise<LoginResponse> {
    const token = getToken();
    const res = await fetch(`${API_URL}/distributor/${distributorId}/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(profileData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  // ── DISTRIBUTOR PASSWORD CHANGE ────────────────────────────────────────────
  async changeDistributorPassword(
    distributorId: string,
    passwords: { currentPassword: string; newPassword: string }
  ): Promise<{ success: boolean }> {
    const token = getToken();
    const res = await fetch(`${API_URL}/distributor/${distributorId}/password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(passwords),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  // ── DRIVER PASSWORD CHANGE ─────────────────────────────────────────────────
  /*async changeDriverPassword(
    driverID: string,
    passwords: { currentPassword: string; newPassword: string }
  ): Promise<{ success: boolean }> {
    const token = getDriverToken();
    const res = await fetch(`${API_URL}/driver/${driverID}/password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(passwords),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },*/

  // ── ADD DISTRIBUTOR VEHICLE (fleet vehicle, no driver required) ───────────
  async addDistributorVehicle(vehicleData: {
    registrationNumber: string;
    vehicleType?: string;
    capacity?: number;
    fuelType?: string;
    model?: string;
    year?: number;
    insuranceExpiry?: string;
    permitExpiry?: string;
    assignedDriverID?: string;   // optional — assign to a driver immediately
  }): Promise<{ vehicleID: string; registrationNumber: string }> {
    const token = getToken();
    const res = await fetch(`${API_URL}/distributor/vehicles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(vehicleData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  // ── ATTACH DRIVER'S OWN VEHICLE to an existing driver ────────────────────
  async attachDriverVehicle(driverID: string, vehicleData: {
    registrationNumber: string;
    vehicleType?: string;
    capacity?: number;
    fuelType?: string;
    insuranceExpiry?: string;
    permitExpiry?: string;
  }): Promise<{ vehicleID: string; registrationNumber: string }> {
    const token = getToken();
    const res = await fetch(`${API_URL}/driver/${driverID}/vehicle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ...vehicleData, ownership: 'Driver' }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  // ── UPDATE A DISTRIBUTOR FLEET VEHICLE ───────────────────────────────────
  async updateDistributorVehicle(
    vehicleID: string,
    updates: {
      vehicleType?: string;
      capacity?: number;
      fuelType?: string;
      insuranceExpiry?: string;
      permitExpiry?: string;
    }
  ): Promise<{ success: boolean }> {
    const token = getToken();
    const res = await fetch(`${API_URL}/distributor/vehicles/${vehicleID}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },
  
  // ── GET ALL DISTRIBUTOR FLEET VEHICLES ───────────────────────────────────
  async getDistributorVehicles(): Promise<Array<{
    vehicleID: string;
    registrationNumber: string;
    vehicleType: string | null;
    status: string;
    driverID: string | null;
    distributorID: string;
  }>> {
    const token = getToken();
    // distributorID is decoded from the JWT on the server side
    const res = await fetch(`${API_URL}/distributor/vehicles`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data.vehicles ?? [];
  },

  // ── ASSIGN AN EXISTING FLEET VEHICLE to a driver ─────────────────────────
  async assignFleetVehicleToDriver(
    driverID: string,
    vehicleID: string
  ): Promise<{ success: boolean }> {
    const token = getToken();
    const res = await fetch(`${API_URL}/driver/${driverID}/assign-vehicle`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ vehicleID }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  // ── ADD A NEW DISTRIBUTOR VEHICLE and immediately assign it to a driver ───
  async attachDistributorVehicleToDriver(
    driverID: string,
    vehicleData: {
      registrationNumber: string;
      vehicleType?: string;
      capacity?: number;
      fuelType?: string;
      insuranceExpiry?: string;
      permitExpiry?: string;
    }
  ): Promise<{ vehicleID: string; registrationNumber: string }> {
    const token = getToken();
    const res = await fetch(`${API_URL}/driver/${driverID}/vehicle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ...vehicleData, ownership: 'Distributor' }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  // ── DELETE DRIVER ─────────────────────────────────────────────────────────
  async deleteDriver(driverID: string): Promise<{ success: boolean }> {
    const token = getToken();
    const res = await fetch(`${API_URL}/driver/${driverID}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },
};