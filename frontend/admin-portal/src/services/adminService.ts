const API_URL = 'http://localhost:5203';

export interface UserStats {
  total: number;
  users: number;
  distributors: number;
  pharmacies: number;
  thisMonth: number;
  lastMonth: number;
  growth: number;
}

export interface Registration {
  id: string;
  type: 'customer' | 'distributor' | 'admin' | 'pharmacy';
  name: string;
  email: string;
  createdAt: string;
}

export interface Pharmacy {
  _id: string;
  name: string;
  email: string;
  username: string;
  phone: string;
  address: string;
  licenseNumber: string;
  logo?: string;
  licenseCertificate?: string;
  role: string;
  createdAt: string;
}

export interface PharmacyStats {
  totalOrders: number;
  totalRevenue: number;
}

export const adminService = {
  async getUserStats(): Promise<UserStats> {
    const res = await fetch(`${API_URL}/admin/stats/users`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Failed to load user stats');
    }

    return data;
  },

  async getWeeklyRegistrations(): Promise<Registration[]> {
    const res = await fetch(`${API_URL}/admin/stats/registrations/weekly`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Failed to load weekly registrations');
    }

    return data.registrations;
  },

  async getAllPharmacies(): Promise<Pharmacy[]> {
    const res = await fetch(`${API_URL}/admin/pharmacies`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Failed to load pharmacies');
    }

    return data;
  },

  async getPharmacyStats(): Promise<PharmacyStats> {
    const res = await fetch(`${API_URL}/admin/pharmacies/stats`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Failed to load pharmacy stats');
    }

    return data;
  },
};
